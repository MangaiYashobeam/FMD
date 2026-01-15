import { Router } from 'express';
import * as emailController from '@/controllers/email.controller';
import { authenticate } from '@/middleware/auth';
import { requireRole, UserRole } from '@/middleware/rbac';

const router = Router();

/**
 * Email Routes
 * All routes require SUPER_ADMIN or ADMIN role
 */

// Test email (admin only)
router.post('/test', authenticate, requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN), emailController.sendTestEmail);

// Get email logs
router.get('/logs', authenticate, requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN), emailController.getEmailLogs);

// Resend failed email
router.post('/resend/:logId', authenticate, requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN), emailController.resendEmail);

// Get email statistics
router.get('/stats', authenticate, requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN), emailController.getEmailStats);

// Send bulk email (super admin only)
router.post('/bulk', authenticate, requireRole(UserRole.SUPER_ADMIN), emailController.sendBulkEmail);

// Get available email templates
router.get('/templates', authenticate, requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN), emailController.getEmailTemplates);

export default router;
