import { Response } from 'express';
import prisma from '@/config/database';
import { AuthRequest } from '@/middleware/auth';
import { logger } from '@/utils/logger';
import { LeadStatus, LeadSource } from '@prisma/client';

export class MessageController {
  /**
   * Get all conversations for the authenticated user's account
   * Aggregates messages by lead and returns conversation summaries
   */
  async getConversations(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { source, unreadOnly } = req.query;

      // Get user's account
      const accountUser = await prisma.accountUser.findFirst({
        where: { userId },
        include: { account: true },
      });

      if (!accountUser) {
        return res.status(404).json({ success: false, message: 'Account not found' });
      }

      // Get all leads with messages for this account
      const leads = await prisma.lead.findMany({
        where: {
          accountId: accountUser.accountId,
          messages: { some: {} }, // Only leads with messages
        },
        include: {
          messages: {
            orderBy: { sentAt: 'desc' },
            take: 1, // Get latest message
          },
          vehicle: {
            select: {
              id: true,
              year: true,
              make: true,
              model: true,
            },
          },
          _count: {
            select: {
              messages: {
                where: { isOutgoing: false }, // Count only incoming unread messages
              },
            },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });

      // Transform leads into conversation format
      const conversations = leads.map((lead) => {
        const lastMessage = lead.messages[0];
        
        return {
          id: lead.id,
          contact: {
            id: lead.facebookUserId || lead.id,
            name: lead.fullName || `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Unknown Contact',
            avatar: lead.facebookProfileUrl ? undefined : undefined,
            isOnline: false, // We don't track online status
          },
          lastMessage: lastMessage ? {
            text: lastMessage.text.substring(0, 100),
            timestamp: lastMessage.sentAt.toISOString(),
            isRead: true, // TODO: Implement read tracking
            isFromMe: lastMessage.isOutgoing,
          } : null,
          unreadCount: 0, // TODO: Implement unread count
          source: lead.source?.toLowerCase().includes('facebook') ? 'facebook' : 'messenger' as const,
          vehicleContext: lead.vehicle ? {
            id: lead.vehicle.id,
            year: lead.vehicle.year || 0,
            make: lead.vehicle.make || '',
            model: lead.vehicle.model || '',
          } : undefined,
          isStarred: lead.priority === 'HIGH',
          isArchived: lead.status === LeadStatus.ARCHIVED || lead.status === LeadStatus.LOST,
          leadNumber: lead.leadNumber,
          facebookProfileUrl: lead.facebookProfileUrl,
          facebookMessengerUrl: lead.facebookMessengerUrl,
        };
      });

      // Filter by source if specified
      let filteredConversations = conversations;
      if (source && source !== 'all') {
        filteredConversations = conversations.filter(c => c.source === source);
      }

      // Filter unread only if specified
      if (unreadOnly === 'true') {
        filteredConversations = filteredConversations.filter(c => c.unreadCount > 0);
      }

      return res.json({
        success: true,
        data: filteredConversations,
        total: filteredConversations.length,
      });
    } catch (error) {
      logger.error('Error fetching conversations:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch conversations' });
    }
  }

  /**
   * Get messages for a specific conversation (lead)
   */
  async getMessages(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const id = req.params.id as string;
      const { limit = 50, before } = req.query;

      // Get user's account
      const accountUser = await prisma.accountUser.findFirst({
        where: { userId },
        include: { account: true },
      });

      if (!accountUser) {
        return res.status(404).json({ success: false, message: 'Account not found' });
      }

      // Verify lead belongs to user's account
      const lead = await prisma.lead.findFirst({
        where: {
          id,
          accountId: accountUser.accountId,
        },
      });

      if (!lead) {
        return res.status(404).json({ success: false, message: 'Conversation not found' });
      }

      // Build query conditions
      const whereConditions: any = { leadId: id };
      if (before) {
        whereConditions.sentAt = { lt: new Date(before as string) };
      }

      // Get messages
      const messages = await prisma.message.findMany({
        where: whereConditions,
        orderBy: { sentAt: 'asc' },
        take: Number(limit),
      });

      // Transform messages for frontend
      const transformedMessages = messages.map((msg) => ({
        id: msg.id,
        text: msg.text,
        timestamp: msg.sentAt.toISOString(),
        isFromMe: msg.isOutgoing,
        status: 'delivered' as const, // TODO: Implement proper status tracking
        sender: msg.sender,
        sentiment: msg.sentiment,
        intent: msg.intent,
      }));

      return res.json({
        success: true,
        data: {
          messages: transformedMessages,
          contact: {
            id: lead.facebookUserId || lead.id,
            name: lead.fullName || `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Unknown',
            facebookProfileUrl: lead.facebookProfileUrl,
            facebookMessengerUrl: lead.facebookMessengerUrl,
          },
          leadNumber: lead.leadNumber,
        },
      });
    } catch (error) {
      logger.error('Error fetching messages:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch messages' });
    }
  }

  /**
   * Send a new message to a conversation
   * This creates a record in the database - actual Facebook sending requires the extension
   */
  async sendMessage(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const id = req.params.id as string;
      const { text } = req.body;

      if (!text || text.trim().length === 0) {
        return res.status(400).json({ success: false, message: 'Message text is required' });
      }

      // Get user's account
      const accountUser = await prisma.accountUser.findFirst({
        where: { userId },
        include: { account: true },
      });

      if (!accountUser) {
        return res.status(404).json({ success: false, message: 'Account not found' });
      }

      // Verify lead belongs to user's account
      const lead = await prisma.lead.findFirst({
        where: {
          id,
          accountId: accountUser.accountId,
        },
      });

      if (!lead) {
        return res.status(404).json({ success: false, message: 'Conversation not found' });
      }

      // Create the message
      const message = await prisma.message.create({
        data: {
          leadId: id,
          text: text.trim(),
          sender: 'dealer',
          isOutgoing: true,
          sentAt: new Date(),
        },
      });

      // Update lead's last contacted timestamp
      await prisma.lead.update({
        where: { id },
        data: { lastContactedAt: new Date() },
      });

      return res.json({
        success: true,
        data: {
          id: message.id,
          text: message.text,
          timestamp: message.sentAt.toISOString(),
          isFromMe: true,
          status: 'sent', // Will be 'delivered' once extension confirms
        },
      });
    } catch (error) {
      logger.error('Error sending message:', error);
      return res.status(500).json({ success: false, message: 'Failed to send message' });
    }
  }

  /**
   * Sync messages from Facebook using the Chrome extension
   * The extension will call this endpoint to store messages it collects
   */
  async syncFromFacebook(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { messages: incomingMessages, facebookUserId, facebookUsername, leadId } = req.body;

      // Get user's account
      const accountUser = await prisma.accountUser.findFirst({
        where: { userId },
        include: { account: true },
      });

      if (!accountUser) {
        return res.status(404).json({ success: false, message: 'Account not found' });
      }

      let lead;
      
      // If leadId provided, use it
      if (leadId) {
        lead = await prisma.lead.findFirst({
          where: {
            id: leadId,
            accountId: accountUser.accountId,
          },
        });
      }
      
      // If no lead found, try to find by Facebook user ID
      if (!lead && facebookUserId) {
        lead = await prisma.lead.findFirst({
          where: {
            accountId: accountUser.accountId,
            facebookUserId,
          },
        });
      }

      // If still no lead, create one
      if (!lead) {
        const leadCount = await prisma.lead.count({
          where: { accountId: accountUser.accountId },
        });

        lead = await prisma.lead.create({
          data: {
            accountId: accountUser.accountId,
            leadNumber: `FB-${Date.now()}-${leadCount + 1}`,
            facebookUserId,
            facebookUsername,
            fullName: facebookUsername || 'Facebook User',
            source: LeadSource.FACEBOOK_MARKETPLACE,
            status: LeadStatus.NEW,
            priority: 'MEDIUM',
          },
        });
      }

      // Insert messages, skipping duplicates
      let insertedCount = 0;
      if (Array.isArray(incomingMessages)) {
        for (const msg of incomingMessages) {
          try {
            await prisma.message.upsert({
              where: {
                leadId_facebookMessageId: {
                  leadId: lead.id,
                  facebookMessageId: msg.facebookMessageId || `temp-${Date.now()}-${Math.random()}`,
                },
              },
              update: {}, // Don't update existing messages
              create: {
                leadId: lead.id,
                facebookMessageId: msg.facebookMessageId,
                text: msg.text,
                sender: msg.sender || 'buyer',
                isOutgoing: msg.isOutgoing || false,
                sentAt: msg.sentAt ? new Date(msg.sentAt) : new Date(),
                sentiment: msg.sentiment,
                intent: msg.intent,
              },
            });
            insertedCount++;
          } catch (err) {
            // Skip duplicates or errors
            logger.warn('Failed to insert message:', err);
          }
        }
      }

      return res.json({
        success: true,
        message: `Synced ${insertedCount} messages`,
        leadId: lead.id,
        leadNumber: lead.leadNumber,
      });
    } catch (error) {
      logger.error('Error syncing messages from Facebook:', error);
      return res.status(500).json({ success: false, message: 'Failed to sync messages' });
    }
  }

  /**
   * Archive a conversation
   */
  async archiveConversation(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const id = req.params.id as string;

      const accountUser = await prisma.accountUser.findFirst({
        where: { userId },
      });

      if (!accountUser) {
        return res.status(404).json({ success: false, message: 'Account not found' });
      }

      await prisma.lead.update({
        where: { id },
        data: { status: LeadStatus.ARCHIVED },
      });

      return res.json({ success: true, message: 'Conversation archived' });
    } catch (error) {
      logger.error('Error archiving conversation:', error);
      return res.status(500).json({ success: false, message: 'Failed to archive conversation' });
    }
  }

  /**
   * Star/unstar a conversation
   */
  async toggleStar(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const id = req.params.id as string;

      const accountUser = await prisma.accountUser.findFirst({
        where: { userId },
      });

      if (!accountUser) {
        return res.status(404).json({ success: false, message: 'Account not found' });
      }

      const lead = await prisma.lead.findFirst({
        where: { 
          id,
          accountId: accountUser.accountId,
        },
      });

      if (!lead) {
        return res.status(404).json({ success: false, message: 'Conversation not found' });
      }

      await prisma.lead.update({
        where: { id },
        data: {
          priority: lead.priority === 'HIGH' ? 'MEDIUM' : 'HIGH',
        },
      });

      return res.json({ 
        success: true, 
        isStarred: lead.priority !== 'HIGH',
      });
    } catch (error) {
      logger.error('Error toggling star:', error);
      return res.status(500).json({ success: false, message: 'Failed to toggle star' });
    }
  }

  /**
   * Get conversation statistics
   */
  async getStats(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;

      const accountUser = await prisma.accountUser.findFirst({
        where: { userId },
      });

      if (!accountUser) {
        return res.status(404).json({ success: false, message: 'Account not found' });
      }

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const [totalConversations, totalMessages, todayMessages] = await Promise.all([
        prisma.lead.count({
          where: {
            accountId: accountUser.accountId,
            messages: { some: {} },
          },
        }),
        prisma.message.count({
          where: {
            lead: { accountId: accountUser.accountId },
          },
        }),
        prisma.message.count({
          where: {
            lead: { accountId: accountUser.accountId },
            sentAt: { gte: today },
          },
        }),
      ]);

      return res.json({
        success: true,
        data: {
          totalConversations,
          totalMessages,
          todayMessages,
          avgResponseTime: 0, // TODO: Calculate average response time
        },
      });
    } catch (error) {
      logger.error('Error fetching message stats:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch stats' });
    }
  }
}
