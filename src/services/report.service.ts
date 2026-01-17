/**
 * Report Generation Service
 * 
 * Generates comprehensive reports for different user levels:
 * - Super Admin: System-wide stats, all accounts, security, revenue
 * - Admin (Dealer): Account stats, team performance, inventory
 * - User: Personal activity and performance
 */

import prisma from '@/config/database';
import { logger } from '@/utils/logger';
import { emailTemplates, reportTemplates } from './email-templates.service';
import { emailService } from './email.service';
import intelliceilService from './intelliceil.service';
import { pdfService } from './pdf.service';

// ============================================
// Types
// ============================================

export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'custom';
export type ReportScope = 'super_admin' | 'admin' | 'user';
export type ReportFormat = 'html' | 'pdf' | 'both';

interface DateRange {
  start: Date;
  end: Date;
}

interface ReportOptions {
  period: ReportPeriod;
  customRange?: DateRange;
  sendEmail?: boolean;
  recipientEmail?: string;
  format?: ReportFormat;
}

// ============================================
// Helper Functions
// ============================================

function getDateRange(period: ReportPeriod, customRange?: DateRange): DateRange {
  const now = new Date();
  const end = new Date(now);
  let start: Date;

  switch (period) {
    case 'daily':
      start = new Date(now);
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'weekly':
      start = new Date(now);
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      break;
    case 'monthly':
      start = new Date(now);
      start.setMonth(start.getMonth() - 1);
      start.setHours(0, 0, 0, 0);
      break;
    case 'custom':
      if (!customRange) throw new Error('Custom range required for custom period');
      return customRange;
    default:
      start = new Date(now);
      start.setDate(start.getDate() - 7);
  }

  return { start, end };
}

// ============================================
// Super Admin Reports
// ============================================

export async function generateSuperAdminReport(options: ReportOptions) {
  const { start, end } = getDateRange(options.period, options.customRange);
  
  logger.info(`Generating Super Admin ${options.period} report for ${start.toISOString()} - ${end.toISOString()}`);

  try {
    // Account stats
    const totalAccounts = await prisma.account.count();
    const newAccounts = await prisma.account.count({
      where: { createdAt: { gte: start, lte: end } }
    });
    const activeAccounts = await prisma.account.count({
      where: { 
        accountUsers: { some: { user: { lastLoginAt: { gte: start } } } }
      }
    });

    // User stats
    const totalUsers = await prisma.user.count();
    const newUsers = await prisma.user.count({
      where: { createdAt: { gte: start, lte: end } }
    });
    const activeUsers = await prisma.user.count({
      where: { lastLoginAt: { gte: start } }
    });

    // Inventory stats
    const totalVehicles = await prisma.vehicle.count();
    const newListings = await prisma.vehicle.count({
      where: { createdAt: { gte: start, lte: end } }
    });
    const soldVehicles = await prisma.vehicle.count({
      where: { 
        status: 'SOLD',
        updatedAt: { gte: start, lte: end }
      }
    });

    // Facebook stats
    const postsCreated = await prisma.facebookPost.count({
      where: { createdAt: { gte: start, lte: end } }
    });
    const groupsConnected = await (prisma as any).facebookGroup.count();

    // Security stats from Intelliceil
    const securityStatus = intelliceilService.getStatus();

    // Top performing accounts
    const topAccounts = await prisma.account.findMany({
      take: 10,
      include: {
        _count: {
          select: {
            vehicles: true,
          }
        }
      },
      orderBy: {
        vehicles: { _count: 'desc' }
      }
    });

    const reportData = {
      period: { start, end },
      accounts: {
        total: totalAccounts,
        new: newAccounts,
        active: activeAccounts,
        churned: 0, // Calculate based on subscription data
      },
      users: {
        total: totalUsers,
        new: newUsers,
        active: activeUsers,
      },
      inventory: {
        totalVehicles,
        newListings,
        sold: soldVehicles,
      },
      revenue: {
        mrr: 0, // Calculate from subscriptions
        newRevenue: 0,
        growth: 0,
      },
      facebook: {
        postsCreated,
        groupsConnected,
        reach: 0, // Would need FB insights
      },
      security: {
        attacksBlocked: securityStatus.blockedRequests,
        threatsDetected: securityStatus.securityMetrics.sqlInjectionAttempts + 
                         securityStatus.securityMetrics.xssAttempts +
                         securityStatus.securityMetrics.botDetections,
        uptime: 99.9, // Calculate from monitoring
      },
      topAccounts: topAccounts.map(a => ({
        name: a.name,
        posts: 0, // Would need to aggregate
        leads: 0,
      })),
    };

    // Generate HTML report
    const htmlReport = reportTemplates.superAdminWeeklyReport(reportData);

    // Generate PDF report
    const format = options.format || 'both';
    let pdfBuffer: Buffer | undefined;
    
    if (format === 'pdf' || format === 'both') {
      try {
        pdfBuffer = await pdfService.generateSuperAdminReport(reportData);
        logger.info('Super Admin PDF report generated');
      } catch (pdfError) {
        logger.error('Failed to generate PDF:', pdfError);
      }
    }

    // Send email if requested
    if (options.sendEmail && options.recipientEmail) {
      const attachments = pdfBuffer ? [{
        filename: `Platform-Report-${start.toISOString().split('T')[0]}.pdf`,
        content: pdfBuffer,
      }] : undefined;

      await emailService.sendEmail({
        to: options.recipientEmail,
        subject: `${options.period.charAt(0).toUpperCase() + options.period.slice(1)} Platform Report - ${BRANDING.companyName}`,
        html: htmlReport,
        attachments,
      });
      logger.info(`Super Admin report sent to ${options.recipientEmail}`);
    }

    return {
      success: true,
      data: reportData,
      html: htmlReport,
      pdf: pdfBuffer,
      generatedAt: new Date(),
    };
  } catch (error) {
    logger.error('Failed to generate Super Admin report:', error);
    throw error;
  }
}

// ============================================
// Admin (Dealer) Reports
// ============================================

export async function generateAdminReport(accountId: string, options: ReportOptions) {
  const { start, end } = getDateRange(options.period, options.customRange);
  
  logger.info(`Generating Admin report for account ${accountId}: ${start.toISOString()} - ${end.toISOString()}`);

  try {
    // Get account info with users via junction table
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: {
        accountUsers: {
          include: {
            user: true,
          }
        },
      }
    });

    if (!account) throw new Error('Account not found');

    // Extract users from junction table
    const users = account.accountUsers.map(au => au.user);

    // Inventory stats
    const totalVehicles = await prisma.vehicle.count({
      where: { accountId }
    });
    const newListings = await prisma.vehicle.count({
      where: { 
        accountId,
        createdAt: { gte: start, lte: end }
      }
    });
    const soldVehicles = await prisma.vehicle.count({
      where: { 
        accountId,
        status: 'SOLD',
        updatedAt: { gte: start, lte: end }
      }
    });
    const pendingVehicles = await prisma.vehicle.count({
      where: { 
        accountId,
        status: 'PENDING'
      }
    });

    // Facebook stats - posts go through profile which has accountId
    const posts = await prisma.facebookPost.count({
      where: {
        profile: { accountId },
        createdAt: { gte: start, lte: end }
      }
    });

    // User activity stats - posts are linked via profile->user
    const userStats = await Promise.all(
      users.map(async (user) => {
        const userPosts = await prisma.facebookPost.count({
          where: {
            profile: { userId: user.id },
            createdAt: { gte: start, lte: end }
          }
        });
        return {
          name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
          posts: userPosts,
          leads: 0, // Would aggregate from leads table
        };
      })
    );

    // Find top performer
    const topPerformer = userStats.reduce((top, user) => 
      user.posts > top.posts ? user : top,
      { name: 'N/A', posts: 0 }
    );

    const activeUsers = users.filter(u => 
      u.lastLoginAt && new Date(u.lastLoginAt) >= start
    ).length;

    const reportData = {
      accountName: account.name,
      period: { start, end },
      inventory: {
        total: totalVehicles,
        new: newListings,
        sold: soldVehicles,
        pending: pendingVehicles,
      },
      facebook: {
        posts,
        reach: 0,
        engagement: 0,
        leads: 0,
      },
      team: {
        totalUsers: users.length,
        activeUsers,
        topPerformer,
      },
      userStats,
    };

    // Generate HTML report
    const htmlReport = reportTemplates.adminWeeklyReport(reportData);

    // Generate PDF report
    const format = options.format || 'both';
    let pdfBuffer: Buffer | undefined;
    
    if (format === 'pdf' || format === 'both') {
      try {
        pdfBuffer = await pdfService.generateAdminReport(reportData);
        logger.info('Admin PDF report generated');
      } catch (pdfError) {
        logger.error('Failed to generate PDF:', pdfError);
      }
    }

    // Send email if requested
    if (options.sendEmail && options.recipientEmail) {
      const attachments = pdfBuffer ? [{
        filename: `${account.name}-Report-${start.toISOString().split('T')[0]}.pdf`,
        content: pdfBuffer,
      }] : undefined;

      await emailService.sendEmail({
        to: options.recipientEmail,
        subject: `${options.period.charAt(0).toUpperCase() + options.period.slice(1)} Report - ${account.name}`,
        html: htmlReport,
        attachments,
      });
      logger.info(`Admin report sent to ${options.recipientEmail}`);
    }

    return {
      success: true,
      data: reportData,
      html: htmlReport,
      pdf: pdfBuffer,
      generatedAt: new Date(),
    };
  } catch (error) {
    logger.error(`Failed to generate Admin report for ${accountId}:`, error);
    throw error;
  }
}

// ============================================
// User Activity Reports
// ============================================

export async function generateUserReport(userId: string, options: ReportOptions) {
  const { start, end } = getDateRange(options.period, options.customRange);
  
  logger.info(`Generating User report for ${userId}: ${start.toISOString()} - ${end.toISOString()}`);

  try {
    // Get user info with their profiles to find posts
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        accountUsers: {
          include: {
            account: true,
          },
          take: 1,
        },
        facebookProfiles: true,
      }
    });

    if (!user) throw new Error('User not found');

    // Activity stats - posts are linked via profile
    const postsCreated = await prisma.facebookPost.count({
      where: {
        profile: { userId },
        createdAt: { gte: start, lte: end }
      }
    });

    // Get recent posts
    const recentPosts = await prisma.facebookPost.findMany({
      where: {
        profile: { userId },
        createdAt: { gte: start, lte: end }
      },
      include: {
        vehicle: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Calculate login days (simplified - would need login tracking)
    const loginDays = 5; // Placeholder

    // Achievements (gamification)
    const achievements: string[] = [];
    if (postsCreated >= 10) achievements.push('🚀 Posted 10+ vehicles this week!');
    if (postsCreated >= 50) achievements.push('🔥 Power poster - 50+ posts!');
    if (loginDays >= 5) achievements.push('📅 Active all week!');

    const reportData = {
      userName: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
      period: { start, end },
      activity: {
        postsCreated,
        vehiclesPosted: recentPosts.length,
        leadsGenerated: 0, // Would aggregate
        loginDays,
      },
      posts: recentPosts.map(p => ({
        vehicle: p.vehicle ? `${p.vehicle.year} ${p.vehicle.make} ${p.vehicle.model}` : 'Unknown',
        date: p.createdAt,
        status: p.status.toLowerCase(),
      })),
      achievements,
    };

    // Generate HTML report
    const htmlReport = reportTemplates.userActivityReport(reportData);

    // Generate PDF report
    const format = options.format || 'both';
    let pdfBuffer: Buffer | undefined;
    
    if (format === 'pdf' || format === 'both') {
      try {
        pdfBuffer = await pdfService.generateUserReport(reportData);
        logger.info('User PDF report generated');
      } catch (pdfError) {
        logger.error('Failed to generate PDF:', pdfError);
      }
    }

    // Send email if requested
    if (options.sendEmail) {
      const recipientEmail = options.recipientEmail || user.email;
      const attachments = pdfBuffer ? [{
        filename: `Activity-Report-${start.toISOString().split('T')[0]}.pdf`,
        content: pdfBuffer,
      }] : undefined;

      await emailService.sendEmail({
        to: recipientEmail,
        subject: `Your ${options.period.charAt(0).toUpperCase() + options.period.slice(1)} Activity Report`,
        html: htmlReport,
        attachments,
      });
      logger.info(`User report sent to ${recipientEmail}`);
    }

    return {
      success: true,
      data: reportData,
      html: htmlReport,
      pdf: pdfBuffer,
      generatedAt: new Date(),
    };
  } catch (error) {
    logger.error(`Failed to generate User report for ${userId}:`, error);
    throw error;
  }
}

// ============================================
// Security Reports
// ============================================

export async function generateSecurityReport(options: ReportOptions) {
  const { start, end } = getDateRange(options.period, options.customRange);
  
  logger.info(`Generating Security report: ${start.toISOString()} - ${end.toISOString()}`);

  try {
    const securityStatus = intelliceilService.getStatus();
    
    const reportData = {
      date: new Date(),
      totalRequests: securityStatus.allowedRequests + securityStatus.blockedRequests,
      blockedRequests: securityStatus.blockedRequests,
      uniqueIPs: securityStatus.uniqueIPs,
      attacks: [
        { type: 'SQL Injection', count: securityStatus.securityMetrics.sqlInjectionAttempts },
        { type: 'XSS Attacks', count: securityStatus.securityMetrics.xssAttempts },
        { type: 'Bot Detection', count: securityStatus.securityMetrics.botDetections },
        { type: 'Replay Attempts', count: securityStatus.securityMetrics.replayAttempts },
        { type: 'Honeypot Triggers', count: securityStatus.securityMetrics.honeypotHits },
      ].filter(a => a.count > 0),
      topThreats: securityStatus.geoLocations
        .filter(g => !g.isTrusted)
        .slice(0, 10)
        .map(g => ({ ip: g.ip, reason: `${g.requestCount} requests from ${g.country}` })),
      threatLevel: securityStatus.threatLevel.level,
    };

    const htmlReport = emailTemplates.security.dailySecuritySummary(reportData);

    // Generate PDF report
    const format = options.format || 'both';
    let pdfBuffer: Buffer | undefined;
    
    if (format === 'pdf' || format === 'both') {
      try {
        pdfBuffer = await pdfService.generateSecurityReport(reportData);
        logger.info('Security PDF report generated');
      } catch (pdfError) {
        logger.error('Failed to generate PDF:', pdfError);
      }
    }

    if (options.sendEmail && options.recipientEmail) {
      const attachments = pdfBuffer ? [{
        filename: `Security-Report-${new Date().toISOString().split('T')[0]}.pdf`,
        content: pdfBuffer,
      }] : undefined;

      await emailService.sendEmail({
        to: options.recipientEmail,
        subject: `Security Report - ${securityStatus.blockedRequests} Threats Blocked`,
        html: htmlReport,
        attachments,
      });
      logger.info(`Security report sent to ${options.recipientEmail}`);
    }

    return {
      success: true,
      data: reportData,
      html: htmlReport,
      pdf: pdfBuffer,
      generatedAt: new Date(),
    };
  } catch (error) {
    logger.error('Failed to generate Security report:', error);
    throw error;
  }
}

// ============================================
// Bulk Report Generation
// ============================================

export async function sendScheduledReports(period: ReportPeriod) {
  logger.info(`Running scheduled ${period} reports...`);

  try {
    // Get super admin email from settings
    const superAdminSettings = await prisma.systemSettings.findFirst({
      where: { key: 'super_admin_email' }
    });
    const superAdminEmail = (superAdminSettings?.value as string) || process.env.SUPER_ADMIN_EMAIL;

    // 1. Send Super Admin report
    if (superAdminEmail) {
      await generateSuperAdminReport({
        period,
        sendEmail: true,
        recipientEmail: superAdminEmail,
      });
    }

    // 2. Send Security report to Super Admin
    if (superAdminEmail) {
      await generateSecurityReport({
        period,
        sendEmail: true,
        recipientEmail: superAdminEmail,
      });
    }

    // 3. Send Admin reports to all account admins
    const accounts = await prisma.account.findMany({
      include: {
        accountUsers: {
          where: { role: 'ADMIN' },
          include: { user: true },
          take: 1, // Primary admin
        }
      }
    });

    for (const account of accounts) {
      const adminRelation = account.accountUsers[0];
      if (adminRelation?.user?.email) {
        await generateAdminReport(account.id, {
          period,
          sendEmail: true,
          recipientEmail: adminRelation.user.email,
        });
      }
    }

    // 4. Optionally send user reports (can be toggled per user)
    // This is usually optional and enabled per-user preference
    
    logger.info(`Completed scheduled ${period} reports`);
    return { success: true, period };
  } catch (error) {
    logger.error(`Failed to send scheduled ${period} reports:`, error);
    throw error;
  }
}

// Import BRANDING for email subjects
import { BRANDING } from './email-templates.service';

// ============================================
// Export Service
// ============================================

export const reportService = {
  generateSuperAdminReport,
  generateAdminReport,
  generateUserReport,
  generateSecurityReport,
  sendScheduledReports,
  getDateRange,
};

export default reportService;
