/**
 * Email & Reports API Routes
 * 
 * Endpoints for:
 * - Report generation (super admin, admin, user)
 * - PDF report downloads
 * - Security notifications configuration
 * - Manual report triggers
 * - Invoice management
 */

import { Router, Response, NextFunction } from 'express';
import { reportService, ReportPeriod } from '@/services/report.service';
import { securityNotificationService } from '@/services/security-notification.service';
import { invoiceService } from '@/services/invoice.service';
import { authenticate, AuthRequest } from '@/middleware/auth';
import { UserRole } from '@/middleware/rbac';
import { logger } from '@/utils/logger';

const router = Router();

// ============================================
// Authorization Helpers
// ============================================

const requireSuperAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.user?.role !== UserRole.SUPER_ADMIN) {
    res.status(403).json({ error: 'Super admin access required' });
    return;
  }
  next();
};

const requireAdminAccess = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.user?.role === UserRole.SUPER_ADMIN || (req.user?.accountIds && req.user.accountIds.length > 0)) {
    next();
    return;
  }
  res.status(403).json({ error: 'Admin access required' });
};

// ============================================
// Super Admin Routes
// ============================================

/**
 * Generate Super Admin platform report
 * POST /api/reports/super-admin
 */
router.post('/super-admin', authenticate, requireSuperAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { period = 'weekly', sendEmail = false, customRange } = req.body;
    
    const result = await reportService.generateSuperAdminReport({
      period,
      sendEmail,
      recipientEmail: sendEmail ? req.user?.email : undefined,
      customRange: customRange ? {
        start: new Date(customRange.start),
        end: new Date(customRange.end),
      } : undefined,
    });

    res.json(result);
  } catch (error) {
    logger.error('Failed to generate super admin report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

/**
 * Generate Security report
 * POST /api/reports/security
 */
router.post('/security', authenticate, requireSuperAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { period = 'daily', sendEmail = false } = req.body;
    
    const result = await reportService.generateSecurityReport({
      period,
      sendEmail,
      recipientEmail: sendEmail ? req.user?.email : undefined,
    });

    res.json(result);
  } catch (error) {
    logger.error('Failed to generate security report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

/**
 * Send test security notification
 * POST /api/reports/test-notification
 */
router.post('/test-notification', authenticate, requireSuperAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { type } = req.body;
    
    if (!type) {
      res.status(400).json({ error: 'Notification type required' });
      return;
    }

    const result = await securityNotificationService.sendTestNotification(type);
    res.json(result);
  } catch (error) {
    logger.error('Failed to send test notification:', error);
    res.status(500).json({ error: 'Failed to send test notification' });
  }
});

/**
 * Get security notification config
 * GET /api/reports/notification-config
 */
router.get('/notification-config', authenticate, requireSuperAdmin, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const config = securityNotificationService.getConfig();
    res.json(config);
  } catch (error) {
    logger.error('Failed to get notification config:', error);
    res.status(500).json({ error: 'Failed to get config' });
  }
});

/**
 * Update security notification config
 * PUT /api/reports/notification-config
 */
router.put('/notification-config', authenticate, requireSuperAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await securityNotificationService.updateConfig(req.body);
    const config = securityNotificationService.getConfig();
    res.json({ success: true, config });
  } catch (error) {
    logger.error('Failed to update notification config:', error);
    res.status(500).json({ error: 'Failed to update config' });
  }
});

/**
 * Trigger scheduled reports manually
 * POST /api/reports/trigger-scheduled
 */
router.post('/trigger-scheduled', authenticate, requireSuperAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { period = 'weekly' } = req.body;
    
    await reportService.sendScheduledReports(period);
    res.json({ success: true, message: `Triggered ${period} reports` });
  } catch (error) {
    logger.error('Failed to trigger scheduled reports:', error);
    res.status(500).json({ error: 'Failed to trigger reports' });
  }
});

// ============================================
// Admin (Dealer) Routes
// ============================================

/**
 * Generate Admin account report
 * POST /api/reports/admin
 */
router.post('/admin', authenticate, requireAdminAccess, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { period = 'weekly', sendEmail = false, customRange } = req.body;
    const accountId = req.user?.accountIds?.[0];

    if (!accountId) {
      res.status(400).json({ error: 'Account ID required' });
      return;
    }
    
    const result = await reportService.generateAdminReport(accountId, {
      period,
      sendEmail,
      recipientEmail: sendEmail ? req.user?.email : undefined,
      customRange: customRange ? {
        start: new Date(customRange.start),
        end: new Date(customRange.end),
      } : undefined,
    });

    res.json(result);
  } catch (error) {
    logger.error('Failed to generate admin report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

/**
 * Generate report for specific account (super admin only)
 * POST /api/reports/admin/:accountId
 */
router.post('/admin/:accountId', authenticate, requireSuperAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const accountId = req.params.accountId as string;
    const { period = 'weekly', sendEmail = false, recipientEmail, customRange } = req.body;
    
    const result = await reportService.generateAdminReport(accountId, {
      period,
      sendEmail,
      recipientEmail,
      customRange: customRange ? {
        start: new Date(customRange.start),
        end: new Date(customRange.end),
      } : undefined,
    });

    res.json(result);
  } catch (error) {
    logger.error('Failed to generate admin report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// ============================================
// User Routes
// ============================================

/**
 * Generate User activity report (own report)
 * POST /api/reports/user
 */
router.post('/user', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { period = 'weekly', sendEmail = false, customRange } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'User ID required' });
      return;
    }
    
    const result = await reportService.generateUserReport(userId, {
      period,
      sendEmail,
      recipientEmail: sendEmail ? req.user?.email : undefined,
      customRange: customRange ? {
        start: new Date(customRange.start),
        end: new Date(customRange.end),
      } : undefined,
    });

    res.json(result);
  } catch (error) {
    logger.error('Failed to generate user report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

/**
 * Generate report for specific user (admin only)
 * POST /api/reports/user/:userId
 */
router.post('/user/:userId', authenticate, requireAdminAccess, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.params.userId as string;
    const { period = 'weekly', sendEmail = false, recipientEmail, customRange } = req.body;
    
    const result = await reportService.generateUserReport(userId, {
      period,
      sendEmail,
      recipientEmail,
      customRange: customRange ? {
        start: new Date(customRange.start),
        end: new Date(customRange.end),
      } : undefined,
    });

    res.json(result);
  } catch (error) {
    logger.error('Failed to generate user report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// ============================================
// Email Preview Routes
// ============================================

/**
 * Preview report email without sending
 * GET /api/reports/preview/:type
 */
router.get('/preview/:type', authenticate, requireAdminAccess, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { type } = req.params;
    const { period = 'weekly' } = req.query;
    const reportPeriod = (period as string) as ReportPeriod;
    
    let result;
    
    switch (type) {
      case 'super-admin':
        if (req.user?.role !== UserRole.SUPER_ADMIN) {
          res.status(403).json({ error: 'Super admin only' });
          return;
        }
        result = await reportService.generateSuperAdminReport({
          period: reportPeriod,
          sendEmail: false,
        });
        break;
      
      case 'admin':
        result = await reportService.generateAdminReport(req.user?.accountIds?.[0] || '', {
          period: reportPeriod,
          sendEmail: false,
        });
        break;
      
      case 'user':
        result = await reportService.generateUserReport(req.user?.id || '', {
          period: reportPeriod,
          sendEmail: false,
        });
        break;
      
      case 'security':
        if (req.user?.role !== UserRole.SUPER_ADMIN) {
          res.status(403).json({ error: 'Super admin only' });
          return;
        }
        result = await reportService.generateSecurityReport({
          period: reportPeriod,
          sendEmail: false,
        });
        break;
      
      default:
        res.status(400).json({ error: 'Invalid report type' });
        return;
    }

    // Return HTML for preview
    res.setHeader('Content-Type', 'text/html');
    res.send(result.html);
  } catch (error) {
    logger.error('Failed to preview report:', error);
    res.status(500).json({ error: 'Failed to generate preview' });
  }
});

// ============================================
// PDF Download Routes
// ============================================

/**
 * Download report as PDF
 * GET /api/reports/download/:type
 */
router.get('/download/:type', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { type } = req.params;
    const { period = 'weekly' } = req.query;
    
    let result;
    let filename: string;
    const dateStr = new Date().toISOString().split('T')[0];
    const reportPeriod = (period as string) as ReportPeriod;
    
    switch (type) {
      case 'super-admin':
        if (req.user?.role !== UserRole.SUPER_ADMIN) {
          res.status(403).json({ error: 'Super admin only' });
          return;
        }
        result = await reportService.generateSuperAdminReport({
          period: reportPeriod,
          sendEmail: false,
          format: 'pdf',
        });
        filename = `Platform-Report-${dateStr}.pdf`;
        break;
      
      case 'admin':
        result = await reportService.generateAdminReport(req.user?.accountIds?.[0] || '', {
          period: reportPeriod,
          sendEmail: false,
          format: 'pdf',
        });
        filename = `Account-Report-${dateStr}.pdf`;
        break;
      
      case 'user':
        result = await reportService.generateUserReport(req.user?.id || '', {
          period: reportPeriod,
          sendEmail: false,
          format: 'pdf',
        });
        filename = `Activity-Report-${dateStr}.pdf`;
        break;
      
      case 'security':
        if (req.user?.role !== UserRole.SUPER_ADMIN) {
          res.status(403).json({ error: 'Super admin only' });
          return;
        }
        result = await reportService.generateSecurityReport({
          period: reportPeriod,
          sendEmail: false,
          format: 'pdf',
        });
        filename = `Security-Report-${dateStr}.pdf`;
        break;
      
      default:
        res.status(400).json({ error: 'Invalid report type' });
        return;
    }

    if (!result.pdf) {
      res.status(500).json({ error: 'Failed to generate PDF' });
      return;
    }

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', result.pdf.length);
    res.send(result.pdf);
  } catch (error) {
    logger.error('Failed to download report:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// ============================================
// Invoice Routes
// ============================================

/**
 * Get account invoices
 * GET /api/reports/invoices
 */
router.get('/invoices', authenticate, requireAdminAccess, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const accountId = req.user?.accountIds?.[0];
    const { status, limit, offset } = req.query;
    
    if (!accountId) {
      res.status(400).json({ error: 'Account ID required' });
      return;
    }
    
    const invoices = await invoiceService.getAccountInvoices(accountId, {
      status: status as string | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });
    
    res.json({ invoices });
  } catch (error) {
    logger.error('Failed to get invoices:', error);
    res.status(500).json({ error: 'Failed to get invoices' });
  }
});

/**
 * Get invoice by ID
 * GET /api/reports/invoices/:invoiceId
 */
router.get('/invoices/:invoiceId', authenticate, requireAdminAccess, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const invoiceId = req.params.invoiceId as string;
    
    const invoice = await invoiceService.getInvoiceById(invoiceId);
    
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }
    
    res.json({ invoice });
  } catch (error) {
    logger.error('Failed to get invoice:', error);
    res.status(500).json({ error: 'Failed to get invoice' });
  }
});

/**
 * Get invoice PDF
 * GET /api/reports/invoices/:invoiceId/pdf
 */
router.get('/invoices/:invoiceId/pdf', authenticate, requireAdminAccess, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const invoiceId = req.params.invoiceId as string;
    
    const pdfBuffer = await invoiceService.getInvoicePDF(invoiceId);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoiceId}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    logger.error('Failed to get invoice PDF:', error);
    res.status(500).json({ error: 'Failed to generate invoice PDF' });
  }
});

/**
 * Send invoice email
 * POST /api/reports/invoices/:invoiceId/send
 */
router.post('/invoices/:invoiceId/send', authenticate, requireSuperAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const invoiceId = req.params.invoiceId as string;
    
    await invoiceService.sendInvoiceEmail(invoiceId);
    
    res.json({ success: true, message: 'Invoice sent successfully' });
  } catch (error) {
    logger.error('Failed to send invoice:', error);
    res.status(500).json({ error: 'Failed to send invoice' });
  }
});

/**
 * Mark invoice as paid
 * POST /api/reports/invoices/:invoiceId/paid
 */
router.post('/invoices/:invoiceId/paid', authenticate, requireSuperAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const invoiceId = req.params.invoiceId as string;
    
    const invoice = await invoiceService.markInvoicePaid(invoiceId);
    
    res.json({ success: true, invoice });
  } catch (error) {
    logger.error('Failed to mark invoice as paid:', error);
    res.status(500).json({ error: 'Failed to update invoice' });
  }
});

export default router;
