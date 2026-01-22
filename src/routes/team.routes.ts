/**
 * Team Routes
 * 
 * Handles team member management for dealership accounts
 * These routes provide a cleaner API for team management without needing account IDs
 */

import { Router, Response } from 'express';
import { body, param } from 'express-validator';
import { authenticate, AuthRequest } from '@/middleware/auth';
import { asyncHandler } from '@/utils/asyncHandler';
import { validate } from '@/middleware/validation';
import prisma from '@/config/database';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { sendTeamInvitationEmail } from '@/services/email.service';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * Get team members for user's primary account
 */
router.get('/members', asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  // Get user's primary account
  const accountUser = await prisma.accountUser.findFirst({
    where: { userId },
    include: { account: true },
  });

  if (!accountUser) {
    throw new AppError('No account found', 404);
  }

  // Get all members of this account
  const members = await prisma.accountUser.findMany({
    where: { accountId: accountUser.accountId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          isActive: true,
          emailVerified: true,
          lastLoginAt: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Transform to team member format
  const teamMembers = members.map((m) => ({
    id: m.user.id,
    name: `${m.user.firstName || ''} ${m.user.lastName || ''}`.trim() || m.user.email.split('@')[0],
    email: m.user.email,
    role: m.role.toLowerCase() as 'owner' | 'admin' | 'manager' | 'sales',
    status: !m.user.isActive ? 'inactive' : (!m.user.emailVerified ? 'pending' : 'active') as 'active' | 'pending' | 'inactive',
    lastActive: m.user.lastLoginAt?.toISOString(),
    createdAt: m.createdAt.toISOString(),
  }));

  res.json({
    success: true,
    data: {
      members: teamMembers,
      total: teamMembers.length,
    },
  });
}));

/**
 * Get pending invitations
 */
router.get('/invites', asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  // Get user's primary account
  const accountUser = await prisma.accountUser.findFirst({
    where: { 
      userId,
      role: { in: ['SUPER_ADMIN', 'ACCOUNT_OWNER', 'ADMIN'] },
    },
  });

  if (!accountUser) {
    throw new AppError('No account found or insufficient permissions', 403);
  }

  // Get pending invitations - check if table exists
  let invitations: any[] = [];
  try {
    invitations = await prisma.teamInvitation.findMany({
      where: { 
        accountId: accountUser.accountId,
        status: 'PENDING',
      },
      include: {
        invitedBy: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  } catch (e) {
    // Table might not exist yet if migration hasn't run
    logger.warn('TeamInvitation table may not exist yet');
    invitations = [];
  }

  res.json({
    success: true,
    data: {
      invitations: invitations.map((inv: any) => ({
        id: inv.id,
        email: inv.email,
        firstName: inv.firstName,
        lastName: inv.lastName,
        role: inv.role.toLowerCase(),
        status: inv.status.toLowerCase(),
        invitedBy: `${inv.invitedBy?.firstName || ''} ${inv.invitedBy?.lastName || ''}`.trim() || inv.invitedBy?.email || 'Unknown',
        expiresAt: inv.expiresAt.toISOString(),
        createdAt: inv.createdAt.toISOString(),
      })),
    },
  });
}));

/**
 * Invite a new team member via email
 * Creates an invite record and sends invitation email
 */
router.post(
  '/invite',
  validate([
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('firstName').optional().isString().trim(),
    body('lastName').optional().isString().trim(),
    body('name').optional().isString().trim(),
    body('role').isIn(['admin', 'manager', 'sales', 'ADMIN', 'MANAGER', 'SALES']).withMessage('Valid role is required'),
  ]),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { email, firstName, lastName, name, role } = req.body;
    const userId = req.user!.id;

    // Get user's primary account with account details
    const accountUser = await prisma.accountUser.findFirst({
      where: { 
        userId,
        role: { in: ['SUPER_ADMIN', 'ACCOUNT_OWNER', 'ADMIN'] },
      },
      include: { 
        account: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!accountUser) {
      throw new AppError('You do not have permission to invite team members', 403);
    }

    const accountId = accountUser.accountId;
    const normalizedEmail = email.toLowerCase();

    // Parse name if firstName/lastName not provided
    let finalFirstName = firstName;
    let finalLastName = lastName;
    if (!firstName && name) {
      const parts = name.split(' ');
      finalFirstName = parts[0];
      finalLastName = parts.slice(1).join(' ');
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      // Check if already a member
      const existingMember = await prisma.accountUser.findFirst({
        where: {
          userId: existingUser.id,
          accountId,
        },
      });

      if (existingMember) {
        throw new AppError('This user is already a member of your team', 409);
      }

      // Add existing user to account directly
      await prisma.accountUser.create({
        data: {
          userId: existingUser.id,
          accountId,
          role: role.toUpperCase() as any,
        },
      });

      logger.info(`Existing user ${existingUser.id} added to account ${accountId} by ${userId}`);

      return res.json({
        success: true,
        message: 'User has been added to your team',
        data: {
          userId: existingUser.id,
          email: existingUser.email,
          status: 'added',
        },
      });
    }

    // Create new user with temporary password (fallback method if invitation table doesn't exist)
    const tempPassword = crypto.randomBytes(8).toString('hex');
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    const newUser = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash: hashedPassword,
        firstName: finalFirstName || 'Team',
        lastName: finalLastName || 'Member',
        isActive: true,
        emailVerified: false,
      },
    });

    // Add to account
    await prisma.accountUser.create({
      data: {
        userId: newUser.id,
        accountId,
        role: role.toUpperCase() as any,
      },
    });

    // Try to create invitation record (may fail if table doesn't exist)
    let invitationId: string | null = null;
    try {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      
      const invitation = await prisma.teamInvitation.create({
        data: {
          accountId,
          email: normalizedEmail,
          firstName: finalFirstName,
          lastName: finalLastName,
          role: role.toUpperCase() as any,
          token,
          invitedById: userId,
          expiresAt,
          status: 'ACCEPTED', // Already created the user
          acceptedAt: new Date(),
        },
      });
      invitationId = invitation.id;
    } catch (e) {
      logger.warn('Could not create invitation record (table may not exist)');
    }

    // Send invitation email
    const inviterName = `${accountUser.user.firstName || ''} ${accountUser.user.lastName || ''}`.trim() || accountUser.user.email;
    const accountName = accountUser.account.dealershipName || accountUser.account.name;
    
    try {
      await sendTeamInvitationEmail({
        to: normalizedEmail,
        inviterName,
        accountName,
        role: role.toLowerCase(),
        inviteLink: `${process.env.APP_URL || 'https://dealersface.com'}/login`,
        temporaryPassword: tempPassword,
      });
      logger.info(`Invitation email sent to ${normalizedEmail}`);
    } catch (emailError) {
      logger.error('Failed to send invitation email:', emailError);
    }

    logger.info(`New user ${newUser.id} created and invited to account ${accountId} by ${userId}`);

    return res.json({
      success: true,
      message: 'Invitation sent successfully',
      data: {
        userId: newUser.id,
        email: normalizedEmail,
        status: 'invited',
        invitationId,
        // In development, include temp password for testing
        ...(process.env.NODE_ENV === 'development' && { tempPassword }),
      },
    });
  })
);

/**
 * Cancel a pending invitation
 */
router.delete(
  '/invites/:inviteId',
  validate([
    param('inviteId').isUUID().withMessage('Invalid invitation ID'),
  ]),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const inviteId = req.params.inviteId as string;
    const userId = req.user!.id;

    // Get user's primary account
    const accountUser = await prisma.accountUser.findFirst({
      where: { 
        userId,
        role: { in: ['SUPER_ADMIN', 'ACCOUNT_OWNER', 'ADMIN'] },
      },
    });

    if (!accountUser) {
      throw new AppError('You do not have permission to cancel invitations', 403);
    }

    try {
      // Find the invitation
      const invitation = await prisma.teamInvitation.findFirst({
        where: {
          id: inviteId,
          accountId: accountUser.accountId,
          status: 'PENDING',
        },
      });

      if (!invitation) {
        throw new AppError('Invitation not found', 404);
      }

      // Cancel the invitation
      await prisma.teamInvitation.update({
        where: { id: inviteId },
        data: { status: 'CANCELED' },
      });

      logger.info(`Invitation ${inviteId} canceled by ${userId}`);
    } catch (e: any) {
      if (e.message === 'Invitation not found') throw e;
      throw new AppError('Could not cancel invitation', 500);
    }

    return res.json({
      success: true,
      message: 'Invitation canceled successfully',
    });
  })
);

/**
 * Manually create a team member with password
 * For admins who want to create accounts directly
 */
router.post(
  '/members',
  validate([
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('firstName').isString().trim().notEmpty().withMessage('First name is required'),
    body('lastName').isString().trim().notEmpty().withMessage('Last name is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('role').isIn(['admin', 'manager', 'sales', 'ADMIN', 'MANAGER', 'SALES']).withMessage('Valid role is required'),
  ]),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { email, firstName, lastName, password, role } = req.body;
    const userId = req.user!.id;

    // Get user's primary account
    const accountUser = await prisma.accountUser.findFirst({
      where: { 
        userId,
        role: { in: ['SUPER_ADMIN', 'ACCOUNT_OWNER', 'ADMIN'] },
      },
      include: { account: true },
    });

    if (!accountUser) {
      throw new AppError('You do not have permission to add team members', 403);
    }

    const accountId = accountUser.accountId;
    const normalizedEmail = email.toLowerCase();

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      // Check if already a member of THIS account
      const existingMember = await prisma.accountUser.findFirst({
        where: {
          userId: existingUser.id,
          accountId,
        },
      });
      
      if (existingMember) {
        throw new AppError('This user is already a member of your team', 409);
      }
      
      // User exists but not in this account - add them
      await prisma.accountUser.create({
        data: {
          userId: existingUser.id,
          accountId,
          role: role.toUpperCase() as any,
        },
      });
      
      logger.info(`Existing user ${existingUser.id} added to account ${accountId} by ${userId}`);
      
      return res.json({
        success: true,
        message: 'Existing user added to your team successfully',
        data: {
          id: existingUser.id,
          email: existingUser.email,
          firstName: existingUser.firstName,
          lastName: existingUser.lastName,
          role: role.toLowerCase(),
          status: 'active',
        },
      });
    }

    // Create new user
    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash: hashedPassword,
        firstName,
        lastName,
        isActive: true,
        emailVerified: true, // Manual creation = verified
      },
    });

    // Add to account
    await prisma.accountUser.create({
      data: {
        userId: newUser.id,
        accountId,
        role: role.toUpperCase() as any,
      },
    });

    logger.info(`New user ${newUser.id} manually created in account ${accountId} by ${userId}`);

    return res.json({
      success: true,
      message: 'Team member created successfully',
      data: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: role.toLowerCase(),
        status: 'active',
      },
    });
  })
);

/**
 * Update a team member's role or status
 */
router.put(
  '/members/:memberId',
  validate([
    param('memberId').isUUID().withMessage('Invalid member ID'),
    body('role').optional().isIn(['admin', 'manager', 'sales', 'ADMIN', 'MANAGER', 'SALES']),
    body('isActive').optional().isBoolean(),
  ]),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const memberId = req.params.memberId as string;
    const { role, isActive } = req.body;
    const userId = req.user!.id;

    // Get user's primary account
    const accountUser = await prisma.accountUser.findFirst({
      where: { 
        userId,
        role: { in: ['SUPER_ADMIN', 'ACCOUNT_OWNER', 'ADMIN'] },
      },
    });

    if (!accountUser) {
      throw new AppError('You do not have permission to update team members', 403);
    }

    // Verify member belongs to same account
    const memberAccount = await prisma.accountUser.findFirst({
      where: {
        userId: memberId,
        accountId: accountUser.accountId,
      },
    });

    if (!memberAccount) {
      throw new AppError('Team member not found', 404);
    }

    // Can't modify owner
    if (memberAccount.role === 'ACCOUNT_OWNER' || memberAccount.role === 'SUPER_ADMIN') {
      throw new AppError('Cannot modify account owner', 403);
    }

    // Update account user role if provided
    if (role) {
      await prisma.accountUser.update({
        where: { id: memberAccount.id },
        data: { role: role.toUpperCase() as any },
      });
    }

    // Update user active status if provided
    if (typeof isActive === 'boolean') {
      await prisma.user.update({
        where: { id: memberId },
        data: { isActive },
      });
    }

    logger.info(`Team member ${memberId} updated by ${userId}`);

    return res.json({
      success: true,
      message: 'Team member updated successfully',
    });
  })
);

/**
 * Remove a team member from the account
 */
router.delete(
  '/members/:memberId',
  validate([
    param('memberId').isUUID().withMessage('Invalid member ID'),
  ]),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const memberId = req.params.memberId as string;
    const userId = req.user!.id;

    // Get user's primary account
    const accountUser = await prisma.accountUser.findFirst({
      where: { 
        userId,
        role: { in: ['SUPER_ADMIN', 'ACCOUNT_OWNER', 'ADMIN'] },
      },
    });

    if (!accountUser) {
      throw new AppError('You do not have permission to remove team members', 403);
    }

    // Can't remove yourself
    if (memberId === userId) {
      throw new AppError('Cannot remove yourself from the team', 400);
    }

    // Verify member belongs to same account
    const memberAccount = await prisma.accountUser.findFirst({
      where: {
        userId: memberId,
        accountId: accountUser.accountId,
      },
    });

    if (!memberAccount) {
      throw new AppError('Team member not found', 404);
    }

    // Can't remove owner
    if (memberAccount.role === 'ACCOUNT_OWNER' || memberAccount.role === 'SUPER_ADMIN') {
      throw new AppError('Cannot remove account owner', 403);
    }

    // Remove from account
    await prisma.accountUser.delete({
      where: { id: memberAccount.id },
    });

    logger.info(`Team member ${memberId} removed from account by ${userId}`);

    return res.json({
      success: true,
      message: 'Team member removed successfully',
    });
  })
);

/**
 * Resend invitation to a pending member
 */
router.post(
  '/members/:memberId/resend-invite',
  validate([
    param('memberId').isUUID().withMessage('Invalid member ID'),
  ]),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const memberId = req.params.memberId as string;
    const userId = req.user!.id;

    // Get user's primary account
    const accountUser = await prisma.accountUser.findFirst({
      where: { 
        userId,
        role: { in: ['SUPER_ADMIN', 'ACCOUNT_OWNER', 'ADMIN'] },
      },
      include: { 
        account: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!accountUser) {
      throw new AppError('You do not have permission to resend invites', 403);
    }

    // Get the member
    const member = await prisma.accountUser.findFirst({
      where: {
        userId: memberId,
        accountId: accountUser.accountId,
      },
      include: { user: true },
    });

    if (!member) {
      throw new AppError('Team member not found', 404);
    }

    // Generate new temp password and send email
    const tempPassword = crypto.randomBytes(8).toString('hex');
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    await prisma.user.update({
      where: { id: memberId },
      data: { 
        passwordHash: hashedPassword,
        emailVerified: false,
      },
    });

    // Send email with new credentials
    const inviterName = `${accountUser.user.firstName || ''} ${accountUser.user.lastName || ''}`.trim() || accountUser.user.email;
    const accountName = accountUser.account.dealershipName || accountUser.account.name;

    try {
      await sendTeamInvitationEmail({
        to: member.user.email,
        inviterName,
        accountName,
        role: member.role.toLowerCase(),
        inviteLink: `${process.env.APP_URL || 'https://dealersface.com'}/login`,
        temporaryPassword: tempPassword,
      });
      logger.info(`Invite resent to ${member.user.email}`);
    } catch (emailError) {
      logger.error('Failed to resend invitation email:', emailError);
    }

    logger.info(`Invite resent to ${memberId} by ${userId}`);

    return res.json({
      success: true,
      message: 'Invitation resent successfully',
      ...(process.env.NODE_ENV === 'development' && { tempPassword }),
    });
  })
);

export default router;
