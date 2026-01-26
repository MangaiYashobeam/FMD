/**
 * ============================================
 * FaceMyDealer - Invitation Routes
 * ============================================
 * 
 * Routes for:
 * - Creating invitations (Admin)
 * - Validating invitation codes (Public)
 * - Managing invitations
 * - Dealer verification
 */

import { Router } from 'express';
import invitationController from '../controllers/invitation.controller';
import { authenticate } from '../middleware/auth';
import { setAccountContext } from '../middleware/account.middleware';

const router = Router();

// ============================================
// PUBLIC ROUTES (No auth required)
// ============================================

// Validate invitation code (used during registration)
router.get('/validate/:code', invitationController.validateInvitation);

// Submit dealer verification request
router.post('/dealer-verification', invitationController.submitDealerVerification);

// ============================================
// AUTHENTICATED ROUTES
// ============================================

// Create invitation (Admin+)
router.post(
  '/',
  authenticate,
  setAccountContext,
  invitationController.createInvitation
);

// List invitations (Admin+)
router.get(
  '/',
  authenticate,
  setAccountContext,
  invitationController.listInvitations
);

// Revoke invitation (Admin+)
router.delete(
  '/:code',
  authenticate,
  setAccountContext,
  invitationController.revokeInvitation
);

// Resend invitation email (Admin+)
router.post(
  '/resend/:code',
  authenticate,
  setAccountContext,
  invitationController.resendInvitation
);

// Get pending dealer verifications (Super Admin)
router.get(
  '/dealer-verification/pending',
  authenticate,
  setAccountContext,
  invitationController.getPendingVerifications
);

// Review dealer verification (Super Admin)
router.post(
  '/dealer-verification/:id/review',
  authenticate,
  setAccountContext,
  invitationController.reviewVerification
);

export default router;
