/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * ADF Lead Controller
 * Handles all lead management and ADF operations
 */

import { Response } from 'express';
import { AuthRequest } from '@/middleware/auth';
import prisma from '@/config/database';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';
import { adfService } from '@/services/adf.service';
import { LeadStatus, LeadSource } from '@prisma/client';

// Helper to safely extract string from query/param
const str = (val: any): string => String(val || '');
const optStr = (val: any): string | undefined => val ? String(val) : undefined;

export class LeadController {
  /**
   * Get all leads for account
   */
  async getLeads(req: AuthRequest, res: Response): Promise<void> {
    const accountId = str(req.query.accountId);
    const page = parseInt(str(req.query.page) || '1', 10);
    const limit = parseInt(str(req.query.limit) || '20', 10);
    const status = optStr(req.query.status) as LeadStatus | undefined;
    const assignedTo = optStr(req.query.assignedTo);
    const source = optStr(req.query.source) as LeadSource | undefined;
    const search = optStr(req.query.search);
    const sortBy = str(req.query.sortBy) || 'createdAt';
    const sortOrder = (str(req.query.sortOrder) || 'desc') as 'asc' | 'desc';
    const skip = (page - 1) * limit;

    if (!accountId) {
      throw new AppError('Account ID required', 400);
    }

    // Verify user has access
    const hasAccess = await prisma.accountUser.findFirst({
      where: { userId: req.user!.id, accountId },
    });

    if (!hasAccess) {
      throw new AppError('Access denied', 403);
    }

    // Build where clause
    const where: any = { accountId };
    
    if (status) where.status = status;
    if (assignedTo) where.assignedToId = assignedTo;
    if (source) where.source = source;
    if (search) {
      where.OR = [
        { leadNumber: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          assignedTo: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          vehicle: {
            select: { id: true, year: true, make: true, model: true, stockNumber: true, listPrice: true },
          },
          _count: { select: { communications: true, activities: true } },
        },
      }),
      prisma.lead.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        leads,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  }

  /**
   * Get single lead by ID
   */
  async getLead(req: AuthRequest, res: Response): Promise<void> {
    const id = str(req.params.id);

    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        vehicle: true,
        communications: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        adfSubmissions: {
          orderBy: { createdAt: 'desc' },
        },
        account: {
          select: { id: true, name: true, dealershipName: true },
        },
      },
    });

    if (!lead) {
      throw new AppError('Lead not found', 404);
    }

    // Verify user has access
    const hasAccess = await prisma.accountUser.findFirst({
      where: { userId: req.user!.id, accountId: lead.accountId },
    });

    if (!hasAccess) {
      throw new AppError('Access denied', 403);
    }

    res.json({ success: true, data: lead });
  }

  /**
   * Create new lead
   */
  async createLead(req: AuthRequest, res: Response): Promise<void> {
    const { accountId, ...leadData } = req.body;

    if (!accountId) {
      throw new AppError('Account ID required', 400);
    }

    // Verify user has access (SUPER_ADMIN has access to all accounts)
    const hasAccess = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        OR: [
          { role: 'SUPER_ADMIN' },
          { accountId: str(accountId), role: { in: ['ACCOUNT_OWNER', 'ADMIN', 'SALES_REP'] } },
        ],
      },
    });

    if (!hasAccess) {
      throw new AppError('Access denied', 403);
    }

    // Generate lead number
    const leadNumber = await adfService.generateLeadNumber(str(accountId));

    // Check for duplicates
    const adfConfig = await prisma.aDFConfiguration.findUnique({
      where: { accountId: str(accountId) },
    });

    if (adfConfig?.duplicateCheckEnabled && (leadData.email || leadData.phone)) {
      const duplicateWindow = new Date();
      duplicateWindow.setHours(duplicateWindow.getHours() - (adfConfig.duplicateWindowHours || 24));

      const existingLead = await prisma.lead.findFirst({
        where: {
          accountId: str(accountId),
          createdAt: { gte: duplicateWindow },
          OR: [
            leadData.email ? { email: leadData.email } : {},
            leadData.phone ? { phone: leadData.phone } : {},
          ].filter((o: any) => Object.keys(o).length > 0),
        },
      });

      if (existingLead) {
        logger.info(`Duplicate lead detected: ${existingLead.leadNumber}`);
        res.json({
          success: true,
          data: existingLead,
          message: 'Duplicate lead detected, returning existing lead',
          isDuplicate: true,
        });
        return;
      }
    }

    // Auto-assign if enabled
    let assignedToId = leadData.assignedToId;
    if (!assignedToId && adfConfig?.autoAssignEnabled) {
      assignedToId = await this.autoAssignLead(str(accountId), leadData.facebookUsername, adfConfig);
    }

    // Create lead
    const lead = await prisma.lead.create({
      data: {
        ...leadData,
        accountId: str(accountId),
        leadNumber,
        assignedToId,
        assignedAt: assignedToId ? new Date() : undefined,
      },
      include: {
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        vehicle: true,
      },
    });

    // Create activity log
    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        userId: req.user!.id,
        type: 'CREATED',
        title: 'Lead Created',
        description: `Lead ${leadNumber} was created`,
        isSystem: false,
      },
    });

    // Auto-send ADF if configured
    if (adfConfig?.adfEmailEnabled && adfConfig.adfEmailRecipients.length > 0) {
      await adfService.sendADFEmail(lead.id, adfConfig.adfEmailRecipients, {
        subjectPrefix: adfConfig.adfEmailSubjectPrefix,
        senderEmail: adfConfig.adfEmailSender || undefined,
      });
    }

    logger.info(`Lead created: ${leadNumber}`);

    res.status(201).json({
      success: true,
      data: lead,
      message: 'Lead created successfully',
    });
  }

  /**
   * Update lead
   */
  async updateLead(req: AuthRequest, res: Response): Promise<void> {
    const id = str(req.params.id);
    const updates = req.body;

    const lead = await prisma.lead.findUnique({ where: { id } });

    if (!lead) {
      throw new AppError('Lead not found', 404);
    }

    // Verify user has access
    const hasAccess = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId: lead.accountId,
        role: { in: ['ACCOUNT_OWNER', 'ADMIN', 'SALES_REP'] },
      },
    });

    if (!hasAccess) {
      throw new AppError('Access denied', 403);
    }

    // Track status changes
    const statusChanged = updates.status && updates.status !== lead.status;
    const assignmentChanged = updates.assignedToId && updates.assignedToId !== lead.assignedToId;

    // Update lead
    const updatedLead = await prisma.lead.update({
      where: { id },
      data: {
        ...updates,
        assignedAt: assignmentChanged ? new Date() : lead.assignedAt,
        closedAt: ['WON', 'LOST', 'ARCHIVED'].includes(updates.status) ? new Date() : lead.closedAt,
      },
      include: {
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        vehicle: true,
      },
    });

    // Create activity logs
    if (statusChanged) {
      await prisma.leadActivity.create({
        data: {
          leadId: id,
          userId: req.user!.id,
          type: 'STATUS_CHANGE',
          title: 'Status Changed',
          description: `Status changed from ${lead.status} to ${updates.status}`,
          previousValue: lead.status,
          newValue: updates.status,
        },
      });
    }

    if (assignmentChanged) {
      const newAssignee = await prisma.user.findUnique({
        where: { id: updates.assignedToId },
        select: { firstName: true, lastName: true },
      });
      
      await prisma.leadActivity.create({
        data: {
          leadId: id,
          userId: req.user!.id,
          type: 'ASSIGNED',
          title: 'Lead Assigned',
          description: `Lead assigned to ${newAssignee?.firstName} ${newAssignee?.lastName}`,
          newValue: updates.assignedToId,
        },
      });
    }

    res.json({ success: true, data: updatedLead });
  }

  /**
   * Delete lead
   */
  async deleteLead(req: AuthRequest, res: Response): Promise<void> {
    const id = str(req.params.id);

    const lead = await prisma.lead.findUnique({ where: { id } });

    if (!lead) {
      throw new AppError('Lead not found', 404);
    }

    // Verify user has access (only ADMIN or ACCOUNT_OWNER can delete)
    const hasAccess = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId: lead.accountId,
        role: { in: ['ACCOUNT_OWNER', 'ADMIN'] },
      },
    });

    if (!hasAccess) {
      throw new AppError('Access denied - admin privileges required', 403);
    }

    await prisma.lead.delete({ where: { id } });

    logger.info(`Lead deleted: ${lead.leadNumber}`);

    res.json({ success: true, message: 'Lead deleted successfully' });
  }

  /**
   * Send ADF for lead
   */
  async sendADF(req: AuthRequest, res: Response): Promise<void> {
    const id = str(req.params.id);
    const { method, recipients, endpoint } = req.body;

    const lead = await prisma.lead.findUnique({
      where: { id },
      include: { account: true },
    });

    if (!lead) {
      throw new AppError('Lead not found', 404);
    }

    // Verify user has access
    const hasAccess = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId: lead.accountId,
        role: { in: ['ACCOUNT_OWNER', 'ADMIN', 'SALES_REP'] },
      },
    });

    if (!hasAccess) {
      throw new AppError('Access denied', 403);
    }

    let result: any;

    if (method === 'EMAIL') {
      if (!recipients || recipients.length === 0) {
        throw new AppError('Email recipients required', 400);
      }
      result = await adfService.sendADFEmail(id, recipients);
    } else if (method === 'DMS') {
      const adfConfig = await prisma.aDFConfiguration.findUnique({
        where: { accountId: lead.accountId },
      });
      
      const dmsEndpoint = endpoint || adfConfig?.dmsEndpoint;
      if (!dmsEndpoint) {
        throw new AppError('DMS endpoint not configured', 400);
      }

      result = await adfService.sendADFToDMS(id, dmsEndpoint, {
        username: adfConfig?.dmsUsername || undefined,
        password: adfConfig?.dmsPassword || undefined,
        apiKey: adfConfig?.dmsApiKey || undefined,
      });
    } else {
      throw new AppError('Invalid send method', 400);
    }

    // Create activity log
    await prisma.leadActivity.create({
      data: {
        leadId: id,
        userId: req.user!.id,
        type: 'ADF_SENT',
        title: 'ADF Sent',
        description: `ADF sent via ${method}${result.success ? '' : ' (failed)'}`,
        metadata: result,
      },
    });

    if (result.success) {
      res.json({ success: true, data: result, message: 'ADF sent successfully' });
    } else {
      throw new AppError(result.error || 'Failed to send ADF', 500);
    }
  }

  /**
   * Get ADF XML preview for lead
   */
  async getADFPreview(req: AuthRequest, res: Response): Promise<void> {
    const id = str(req.params.id);

    const lead: any = await prisma.lead.findUnique({
      where: { id },
      include: { vehicle: true },
    });

    if (!lead) {
      throw new AppError('Lead not found', 404);
    }

    // Verify user has access
    const hasAccess = await prisma.accountUser.findFirst({
      where: { userId: req.user!.id, accountId: lead.accountId },
    });

    if (!hasAccess) {
      throw new AppError('Access denied', 403);
    }

    const adfXml = await adfService.generateADFFromLead(lead, lead.vehicle || undefined);

    res.json({ success: true, data: { xml: adfXml } });
  }

  /**
   * Add communication to lead
   */
  async addCommunication(req: AuthRequest, res: Response): Promise<void> {
    const id = str(req.params.id);
    const { type, direction, subject, content, contentHtml, recipientEmail, recipientPhone } = req.body;

    const lead = await prisma.lead.findUnique({ where: { id } });

    if (!lead) {
      throw new AppError('Lead not found', 404);
    }

    // Verify user has access
    const hasAccess = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId: lead.accountId,
        role: { in: ['ACCOUNT_OWNER', 'ADMIN', 'SALES_REP'] },
      },
    });

    if (!hasAccess) {
      throw new AppError('Access denied', 403);
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { firstName: true, lastName: true },
    });

    const communication = await prisma.leadCommunication.create({
      data: {
        leadId: id,
        type,
        direction,
        subject,
        content,
        contentHtml,
        senderId: req.user!.id,
        senderName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || undefined,
        recipientEmail,
        recipientPhone,
        status: direction === 'OUTBOUND' ? 'SENT' : 'DELIVERED',
        sentAt: direction === 'OUTBOUND' ? new Date() : undefined,
        deliveredAt: direction === 'INBOUND' ? new Date() : undefined,
      },
    });

    // Update lead's last contacted date
    await prisma.lead.update({
      where: { id },
      data: { lastContactedAt: new Date() },
    });

    // Create activity log
    await prisma.leadActivity.create({
      data: {
        leadId: id,
        userId: req.user!.id,
        type: 'COMMUNICATION',
        title: `${type} ${direction === 'OUTBOUND' ? 'Sent' : 'Received'}`,
        description: subject || content.substring(0, 100),
      },
    });

    res.status(201).json({ success: true, data: communication });
  }

  /**
   * Add note to lead
   */
  async addNote(req: AuthRequest, res: Response): Promise<void> {
    const id = str(req.params.id);
    const { note } = req.body;

    const lead = await prisma.lead.findUnique({ where: { id } });

    if (!lead) {
      throw new AppError('Lead not found', 404);
    }

    // Verify user has access
    const hasAccess = await prisma.accountUser.findFirst({
      where: { userId: req.user!.id, accountId: lead.accountId },
    });

    if (!hasAccess) {
      throw new AppError('Access denied', 403);
    }

    // Append to internal notes
    const updatedNotes = lead.internalNotes
      ? `${lead.internalNotes}\n\n---\n${new Date().toISOString()}\n${note}`
      : note;

    await prisma.lead.update({
      where: { id },
      data: { internalNotes: updatedNotes },
    });

    // Create activity log
    await prisma.leadActivity.create({
      data: {
        leadId: id,
        userId: req.user!.id,
        type: 'NOTE_ADDED',
        title: 'Note Added',
        description: note.substring(0, 200),
      },
    });

    res.json({ success: true, message: 'Note added successfully' });
  }

  /**
   * Get lead statistics
   */
  async getStats(req: AuthRequest, res: Response): Promise<void> {
    const accountId = str(req.query.accountId);

    if (!accountId) {
      throw new AppError('Account ID required', 400);
    }

    // Verify user has access
    const hasAccess = await prisma.accountUser.findFirst({
      where: { userId: req.user!.id, accountId },
    });

    if (!hasAccess) {
      throw new AppError('Access denied', 403);
    }

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      totalLeads,
      newLeads,
      assignedLeads,
      wonLeads,
      lostLeads,
      todayLeads,
      weekLeads,
      monthLeads,
      leadsBySource,
      leadsByStatus,
      leadsByRep,
    ] = await Promise.all([
      prisma.lead.count({ where: { accountId } }),
      prisma.lead.count({ where: { accountId, status: 'NEW' } }),
      prisma.lead.count({ where: { accountId, status: 'ASSIGNED' } }),
      prisma.lead.count({ where: { accountId, status: 'WON' } }),
      prisma.lead.count({ where: { accountId, status: 'LOST' } }),
      prisma.lead.count({ where: { accountId, createdAt: { gte: startOfDay } } }),
      prisma.lead.count({ where: { accountId, createdAt: { gte: startOfWeek } } }),
      prisma.lead.count({ where: { accountId, createdAt: { gte: startOfMonth } } }),
      prisma.lead.groupBy({
        by: ['source'],
        where: { accountId },
        _count: true,
      }),
      prisma.lead.groupBy({
        by: ['status'],
        where: { accountId },
        _count: true,
      }),
      prisma.lead.groupBy({
        by: ['assignedToId'],
        where: { accountId, assignedToId: { not: null } },
        _count: true,
      }),
    ]);

    // Calculate conversion rate
    const totalClosedLeads = wonLeads + lostLeads;
    const conversionRate = totalClosedLeads > 0 ? (wonLeads / totalClosedLeads) * 100 : 0;

    res.json({
      success: true,
      data: {
        overview: {
          total: totalLeads,
          new: newLeads,
          assigned: assignedLeads,
          won: wonLeads,
          lost: lostLeads,
          conversionRate: Math.round(conversionRate * 100) / 100,
        },
        timeframe: {
          today: todayLeads,
          thisWeek: weekLeads,
          thisMonth: monthLeads,
        },
        bySource: leadsBySource.map((s) => ({ source: s.source, count: s._count })),
        byStatus: leadsByStatus.map((s) => ({ status: s.status, count: s._count })),
        byRep: leadsByRep.map((r) => ({ assignedToId: r.assignedToId, count: r._count })),
      },
    });
  }

  /**
   * Auto-assign lead based on Facebook username mapping or round-robin
   */
  private async autoAssignLead(
    accountId: string,
    facebookUsername: string | undefined,
    config: any
  ): Promise<string | null> {
    // Try to match by Facebook username
    if (facebookUsername) {
      const mapping = await prisma.salesRepMapping.findFirst({
        where: {
          configuration: { accountId },
          facebookUsername,
          isActive: true,
        },
      });

      if (mapping) {
        // Update mapping stats
        await prisma.salesRepMapping.update({
          where: { id: mapping.id },
          data: {
            leadCount: { increment: 1 },
            lastAssignedAt: new Date(),
          },
        });
        return mapping.userId;
      }
    }

    // Use round-robin if enabled
    if (config?.roundRobinEnabled) {
      const mappings = await prisma.salesRepMapping.findMany({
        where: {
          configuration: { accountId },
          isActive: true,
        },
        orderBy: { lastAssignedAt: 'asc' },
      });

      if (mappings.length > 0) {
        // Find rep with least recent assignment
        const nextRep = mappings[0];
        
        // Check max leads per day
        if (nextRep.maxLeadsPerDay) {
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          
          const todayCount = await prisma.lead.count({
            where: {
              accountId,
              assignedToId: nextRep.userId,
              assignedAt: { gte: todayStart },
            },
          });

          if (todayCount >= nextRep.maxLeadsPerDay) {
            // Skip this rep, try next
            for (let i = 1; i < mappings.length; i++) {
              const rep = mappings[i];
              if (!rep.maxLeadsPerDay) {
                await prisma.salesRepMapping.update({
                  where: { id: rep.id },
                  data: { leadCount: { increment: 1 }, lastAssignedAt: new Date() },
                });
                return rep.userId;
              }
              
              const repTodayCount = await prisma.lead.count({
                where: {
                  accountId,
                  assignedToId: rep.userId,
                  assignedAt: { gte: todayStart },
                },
              });
              
              if (repTodayCount < (rep.maxLeadsPerDay || Infinity)) {
                await prisma.salesRepMapping.update({
                  where: { id: rep.id },
                  data: { leadCount: { increment: 1 }, lastAssignedAt: new Date() },
                });
                return rep.userId;
              }
            }
            return null;
          }
        }

        await prisma.salesRepMapping.update({
          where: { id: nextRep.id },
          data: { leadCount: { increment: 1 }, lastAssignedAt: new Date() },
        });
        return nextRep.userId;
      }
    }

    // Default assignee
    return config?.defaultAssigneeId || null;
  }
}

export class ADFConfigController {
  /**
   * Get ADF configuration for account
   */
  async getConfiguration(req: AuthRequest, res: Response): Promise<void> {
    const accountId = str(req.query.accountId);

    if (!accountId) {
      throw new AppError('Account ID required', 400);
    }

    // Verify user has access
    const hasAccess = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId,
        role: { in: ['ACCOUNT_OWNER', 'ADMIN'] },
      },
    });

    if (!hasAccess) {
      throw new AppError('Access denied', 403);
    }

    let config = await prisma.aDFConfiguration.findUnique({
      where: { accountId },
      include: {
        salesRepMappings: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
      },
    });

    // Create default config if not exists
    if (!config) {
      config = await prisma.aDFConfiguration.create({
        data: { accountId },
        include: {
          salesRepMappings: {
            include: {
              user: {
                select: { id: true, firstName: true, lastName: true, email: true },
              },
            },
          },
        },
      });
    }

    // Mask sensitive fields
    const maskedConfig = {
      ...config,
      dmsPassword: config.dmsPassword ? '********' : null,
      dmsApiKey: config.dmsApiKey ? '********' : null,
    };

    res.json({ success: true, data: maskedConfig });
  }

  /**
   * Update ADF configuration
   */
  async updateConfiguration(req: AuthRequest, res: Response): Promise<void> {
    const { accountId, ...updates } = req.body;

    if (!accountId) {
      throw new AppError('Account ID required', 400);
    }

    // Verify user has access
    const hasAccess = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId: str(accountId),
        role: { in: ['ACCOUNT_OWNER', 'ADMIN'] },
      },
    });

    if (!hasAccess) {
      throw new AppError('Access denied', 403);
    }

    // Don't update masked passwords
    if (updates.dmsPassword === '********') delete updates.dmsPassword;
    if (updates.dmsApiKey === '********') delete updates.dmsApiKey;

    const config = await prisma.aDFConfiguration.upsert({
      where: { accountId: str(accountId) },
      update: updates,
      create: { accountId: str(accountId), ...updates },
    });

    logger.info(`ADF configuration updated for account ${accountId}`);

    res.json({ success: true, data: config });
  }

  /**
   * Add/Update sales rep mapping
   */
  async upsertSalesRepMapping(req: AuthRequest, res: Response): Promise<void> {
    const { accountId, userId, ...mappingData } = req.body;

    if (!accountId || !userId) {
      throw new AppError('Account ID and User ID required', 400);
    }

    // Verify user has access
    const hasAccess = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId: str(accountId),
        role: { in: ['ACCOUNT_OWNER', 'ADMIN'] },
      },
    });

    if (!hasAccess) {
      throw new AppError('Access denied', 403);
    }

    // Get or create config
    let config = await prisma.aDFConfiguration.findUnique({
      where: { accountId: str(accountId) },
    });

    if (!config) {
      config = await prisma.aDFConfiguration.create({
        data: { accountId: str(accountId) },
      });
    }

    // Upsert mapping
    const mapping = await prisma.salesRepMapping.upsert({
      where: {
        configurationId_userId: {
          configurationId: config.id,
          userId: str(userId),
        },
      },
      update: mappingData,
      create: {
        configurationId: config.id,
        userId: str(userId),
        ...mappingData,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    res.json({ success: true, data: mapping });
  }

  /**
   * Delete sales rep mapping
   */
  async deleteSalesRepMapping(req: AuthRequest, res: Response): Promise<void> {
    const id = str(req.params.id);

    const mapping: any = await prisma.salesRepMapping.findUnique({
      where: { id },
      include: { configuration: true },
    });

    if (!mapping) {
      throw new AppError('Mapping not found', 404);
    }

    // Verify user has access
    const hasAccess = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId: mapping.configuration.accountId,
        role: { in: ['ACCOUNT_OWNER', 'ADMIN'] },
      },
    });

    if (!hasAccess) {
      throw new AppError('Access denied', 403);
    }

    await prisma.salesRepMapping.delete({ where: { id } });

    res.json({ success: true, message: 'Mapping deleted' });
  }

  /**
   * Test DMS connection
   */
  async testDMSConnection(req: AuthRequest, res: Response): Promise<void> {
    const { accountId, endpoint, username, password, apiKey } = req.body;

    if (!accountId || !endpoint) {
      throw new AppError('Account ID and endpoint required', 400);
    }

    // Verify user has access
    const hasAccess = await prisma.accountUser.findFirst({
      where: {
        userId: req.user!.id,
        accountId: str(accountId),
        role: { in: ['ACCOUNT_OWNER', 'ADMIN'] },
      },
    });

    if (!hasAccess) {
      throw new AppError('Access denied', 403);
    }

    try {
      // Build headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/xml',
        'Accept': 'application/xml, text/xml, */*',
      };

      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      } else if (username && password) {
        const auth = Buffer.from(`${username}:${password}`).toString('base64');
        headers['Authorization'] = `Basic ${auth}`;
      }

      // Send test request
      const response = await fetch(endpoint, {
        method: 'OPTIONS',
        headers,
      });

      if (response.ok || response.status === 405) {
        // 405 Method Not Allowed is acceptable - means endpoint exists but doesn't support OPTIONS
        res.json({ success: true, message: 'DMS endpoint is reachable' });
      } else {
        throw new AppError(`DMS endpoint returned status ${response.status}`, 400);
      }
    } catch (error: any) {
      throw new AppError(`Failed to connect to DMS: ${error.message}`, 400);
    }
  }
}

export const leadController = new LeadController();
export const adfConfigController = new ADFConfigController();
