/**
 * ============================================
 * FaceMyDealer - Invitation Controller
 * ============================================
 * 
 * API endpoints for managing registration invitations
 */

import { Request, Response } from 'express';
import invitationService from '../services/invitation.service';
import dealerVerificationService from '../services/dealer-verification.service';
import { emailService } from '../services/email.service';
import { UserRole } from '@prisma/client';

/**
 * POST /api/invitations
 * Create a new invitation (Admin only)
 */
export async function createInvitation(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;
    const accountUser = (req as any).accountUser;
    
    // Check permissions - only ADMIN+ can create invitations
    const allowedRoles = [UserRole.SUPER_ADMIN, UserRole.ACCOUNT_OWNER, UserRole.ADMIN];
    if (!allowedRoles.includes(accountUser?.role)) {
      res.status(403).json({ error: 'Insufficient permissions to create invitations' });
      return;
    }

    const {
      email,
      accountName,
      companyDomain,
      intendedRole = 'NEW_USER',
      isTrial = true,
      trialDays = 15
    } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    // Determine inviter type based on role
    let inviterType: 'admin' | 'super_admin' | 'root_admin' = 'admin';
    if (accountUser?.role === UserRole.SUPER_ADMIN) {
      inviterType = 'super_admin';
    }

    // Create invitation
    const invitation = await invitationService.createInvitation({
      email,
      inviterType,
      inviterId: user.id,
      inviterEmail: user.email,
      accountName,
      companyDomain,
      intendedRole,
      isTrial,
      trialDays
    });

    // Generate email content
    const registrationUrl = process.env.FRONTEND_URL 
      ? `${process.env.FRONTEND_URL}/register`
      : 'https://facemydealer.com/register';

    const emailHtml = invitationService.generateInvitationEmailHtml({
      code: invitation.code,
      inviterEmail: user.email,
      accountName,
      expiresAt: invitation.expiresAt,
      isTrial,
      trialDays,
      registrationUrl
    });

    const emailText = invitationService.generateInvitationEmailText({
      code: invitation.code,
      inviterEmail: user.email,
      accountName,
      expiresAt: invitation.expiresAt,
      isTrial,
      trialDays,
      registrationUrl
    });

    // Send invitation email
    try {
      await emailService.sendEmail({
        to: email,
        subject: `You're invited to FaceMyDealer${accountName ? ` - ${accountName}` : ''}`,
        html: emailHtml,
        text: emailText
      });
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError);
      // Don't fail the request, just log the error
    }

    res.status(201).json({
      success: true,
      invitation: {
        id: invitation.id,
        code: invitation.code,
        email: invitation.email,
        expiresAt: invitation.expiresAt,
        status: invitation.status
      },
      message: 'Invitation created and email sent'
    });
  } catch (error: any) {
    console.error('Create invitation error:', error);
    res.status(500).json({ error: error.message || 'Failed to create invitation' });
  }
}

/**
 * GET /api/invitations/validate/:code
 * Validate an invitation code (Public - used during registration)
 */
export async function validateInvitation(req: Request, res: Response): Promise<void> {
  try {
    const code = req.params.code;
    const { email } = req.query;

    if (!code || typeof code !== 'string') {
      res.status(400).json({ error: 'Invitation code is required' });
      return;
    }

    const result = await invitationService.validateInvitationCode(
      code, 
      typeof email === 'string' ? email : undefined
    );

    if (!result.valid) {
      res.status(400).json({ 
        valid: false, 
        error: result.reason 
      });
      return;
    }

    res.json({
      valid: true,
      invitation: {
        email: result.invitation.email,
        accountName: result.invitation.accountName,
        intendedRole: result.invitation.intendedRole,
        isTrial: result.invitation.isTrial,
        trialDays: result.invitation.trialDays,
        expiresAt: result.invitation.expiresAt
      }
    });
  } catch (error: any) {
    console.error('Validate invitation error:', error);
    res.status(500).json({ error: error.message || 'Failed to validate invitation' });
  }
}

/**
 * GET /api/invitations
 * List all invitations (Admin only)
 */
export async function listInvitations(req: Request, res: Response): Promise<void> {
  try {
    const accountUser = (req as any).accountUser;
    
    // Check permissions
    const allowedRoles = [UserRole.SUPER_ADMIN, UserRole.ACCOUNT_OWNER, UserRole.ADMIN];
    if (!allowedRoles.includes(accountUser?.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    const { status, email, limit, offset } = req.query;

    const invitations = await invitationService.getAllInvitations({
      status: typeof status === 'string' ? status : undefined,
      email: typeof email === 'string' ? email : undefined,
      limit: typeof limit === 'string' ? parseInt(limit) : undefined,
      offset: typeof offset === 'string' ? parseInt(offset) : undefined
    });

    const stats = await invitationService.getInvitationStats();

    res.json({
      invitations,
      stats,
      total: stats.total
    });
  } catch (error: any) {
    console.error('List invitations error:', error);
    res.status(500).json({ error: error.message || 'Failed to list invitations' });
  }
}

/**
 * DELETE /api/invitations/:code
 * Revoke an invitation (Admin only)
 */
export async function revokeInvitation(req: Request, res: Response): Promise<void> {
  try {
    const accountUser = (req as any).accountUser;
    
    // Check permissions
    const allowedRoles = [UserRole.SUPER_ADMIN, UserRole.ACCOUNT_OWNER, UserRole.ADMIN];
    if (!allowedRoles.includes(accountUser?.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    const code = req.params.code;
    if (typeof code !== 'string') {
      res.status(400).json({ error: 'Invalid code' });
      return;
    }

    await invitationService.revokeInvitation(code);

    res.json({ success: true, message: 'Invitation revoked' });
  } catch (error: any) {
    console.error('Revoke invitation error:', error);
    res.status(500).json({ error: error.message || 'Failed to revoke invitation' });
  }
}

/**
 * POST /api/invitations/resend/:code
 * Resend invitation email (Admin only)
 */
export async function resendInvitation(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;
    const accountUser = (req as any).accountUser;
    
    // Check permissions
    const allowedRoles = [UserRole.SUPER_ADMIN, UserRole.ACCOUNT_OWNER, UserRole.ADMIN];
    if (!allowedRoles.includes(accountUser?.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    const code = req.params.code;
    if (typeof code !== 'string') {
      res.status(400).json({ error: 'Invalid code' });
      return;
    }

    // Validate the invitation exists and is still pending
    const result = await invitationService.validateInvitationCode(code);
    
    if (!result.valid) {
      res.status(400).json({ error: result.reason });
      return;
    }

    const invitation = result.invitation;
    const registrationUrl = process.env.FRONTEND_URL 
      ? `${process.env.FRONTEND_URL}/register`
      : 'https://facemydealer.com/register';

    const emailHtml = invitationService.generateInvitationEmailHtml({
      code: invitation.code,
      inviterEmail: user.email,
      accountName: invitation.accountName,
      expiresAt: invitation.expiresAt,
      isTrial: invitation.isTrial,
      trialDays: invitation.trialDays,
      registrationUrl
    });

    const emailText = invitationService.generateInvitationEmailText({
      code: invitation.code,
      inviterEmail: user.email,
      accountName: invitation.accountName,
      expiresAt: invitation.expiresAt,
      isTrial: invitation.isTrial,
      trialDays: invitation.trialDays,
      registrationUrl
    });

    await emailService.sendEmail({
      to: invitation.email,
      subject: `Reminder: You're invited to FaceMyDealer${invitation.accountName ? ` - ${invitation.accountName}` : ''}`,
      html: emailHtml,
      text: emailText
    });

    res.json({ success: true, message: 'Invitation email resent' });
  } catch (error: any) {
    console.error('Resend invitation error:', error);
    res.status(500).json({ error: error.message || 'Failed to resend invitation' });
  }
}

/**
 * POST /api/dealer-verification
 * Submit dealer verification request
 */
export async function submitDealerVerification(req: Request, res: Response): Promise<void> {
  try {
    const { email, companyName, verificationType, dealerLicenseUrl, dealerLicenseNumber } = req.body;

    if (!email || !companyName) {
      res.status(400).json({ error: 'Email and company name are required' });
      return;
    }

    // Check domain first
    const domainCheck = dealerVerificationService.checkDealerDomain(email);
    
    if (verificationType === 'domain' && !domainCheck.verified) {
      // Domain doesn't look like a dealer - suggest license verification
      res.status(400).json({
        error: 'Domain verification failed',
        suggestion: 'Please upload your dealer license for verification',
        details: domainCheck.details
      });
      return;
    }

    const request = await dealerVerificationService.createVerificationRequest({
      email,
      companyName,
      verificationType: verificationType || 'domain',
      dealerLicenseUrl,
      dealerLicenseNumber
    });

    res.status(201).json({
      success: true,
      verification: {
        id: request.id,
        status: request.status,
        verificationType: request.verificationType
      },
      autoApproved: request.status === 'approved',
      message: request.status === 'approved' 
        ? 'Your dealer status has been verified!' 
        : 'Verification request submitted. Please allow 1-2 business days for review.'
    });
  } catch (error: any) {
    console.error('Submit dealer verification error:', error);
    res.status(500).json({ error: error.message || 'Failed to submit verification' });
  }
}

/**
 * GET /api/dealer-verification/pending
 * Get pending verifications (Admin only)
 */
export async function getPendingVerifications(req: Request, res: Response): Promise<void> {
  try {
    const accountUser = (req as any).accountUser;
    
    // Check permissions - only SUPER_ADMIN can review
    if (accountUser?.role !== UserRole.SUPER_ADMIN) {
      res.status(403).json({ error: 'Only super admins can review verifications' });
      return;
    }

    const pending = await dealerVerificationService.getPendingVerifications();
    const stats = await dealerVerificationService.getVerificationStats();

    res.json({ pending, stats });
  } catch (error: any) {
    console.error('Get pending verifications error:', error);
    res.status(500).json({ error: error.message || 'Failed to get pending verifications' });
  }
}

/**
 * POST /api/dealer-verification/:id/review
 * Review a verification request (Admin only)
 */
export async function reviewVerification(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;
    const accountUser = (req as any).accountUser;
    
    // Check permissions
    if (accountUser?.role !== UserRole.SUPER_ADMIN) {
      res.status(403).json({ error: 'Only super admins can review verifications' });
      return;
    }

    const id = req.params.id;
    const { approved, notes, rejectionReason } = req.body;

    if (typeof id !== 'string') {
      res.status(400).json({ error: 'Invalid verification ID' });
      return;
    }

    if (typeof approved !== 'boolean') {
      res.status(400).json({ error: 'Approved status is required' });
      return;
    }

    const result = await dealerVerificationService.reviewVerificationRequest(
      id,
      approved,
      user.id,
      notes,
      rejectionReason
    );

    res.json({
      success: true,
      verification: result,
      message: approved ? 'Verification approved' : 'Verification rejected'
    });
  } catch (error: any) {
    console.error('Review verification error:', error);
    res.status(500).json({ error: error.message || 'Failed to review verification' });
  }
}

export default {
  createInvitation,
  validateInvitation,
  listInvitations,
  revokeInvitation,
  resendInvitation,
  submitDealerVerification,
  getPendingVerifications,
  reviewVerification
};
