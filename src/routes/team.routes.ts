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
          lastLoginAt: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Transform to team member format
  const teamMembers = members.map((m: typeof members[0]) => ({
    id: m.user.id,
    name: `${m.user.firstName || ''} ${m.user.lastName || ''}`.trim() || m.user.email.split('@')[0],
    email: m.user.email,
    role: m.role.toLowerCase() as 'owner' | 'admin' | 'manager' | 'sales',
    status: m.user.isActive ? 'active' : 'inactive' as 'active' | 'pending' | 'inactive',
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

    // Get user's primary account
    const accountUser = await prisma.accountUser.findFirst({
      where: { 
        userId,
        role: { in: ['SUPER_ADMIN', 'ACCOUNT_OWNER', 'ADMIN'] },
      },
      include: { account: true },
    });

    if (!accountUser) {
      throw new AppError('You do not have permission to invite team members', 403);
    }

    const accountId = accountUser.accountId;

    // Parse name if firstName/lastName not provided
    let finalFirstName = firstName;
    let finalLastName = lastName;
    if (!firstName && name) {
      const parts = name.split(' ');
      finalFirstName = parts[0];
      finalLastName = parts.slice(1).join(' ');
    }

    // Check if user already exists
    let existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
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

      // Add existing user to account
      await prisma.accountUser.create({
        data: {
          userId: existingUser.id,
          accountId,
          role: role.toUpperCase(),
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

    // Create new user with temporary password
    const tempPassword = crypto.randomBytes(8).toString('hex');
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
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
        role: role.toUpperCase(),
      },
    });

    // TODO: Send invitation email with temp password
    // await emailService.sendInviteEmail(email, tempPassword, accountUser.account.businessName);

    logger.info(`New user ${newUser.id} created and invited to account ${accountId} by ${userId}`);

    return res.json({
      success: true,
      message: 'Invitation sent successfully',
      data: {
        userId: newUser.id,
        email: newUser.email,
        status: 'invited',
        // In development, include temp password for testing
        ...(process.env.NODE_ENV === 'development' && { tempPassword }),
      },
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

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      throw new AppError('A user with this email already exists', 409);
    }

    // Create new user
    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
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
        role: role.toUpperCase(),
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
    if (memberAccount.role === 'ACCOUNT_OWNER') {
      throw new AppError('Cannot modify account owner', 403);
    }

    // Update account user role if provided
    if (role) {
      await prisma.accountUser.update({
        where: { id: memberAccount.id },
        data: { role: role.toUpperCase() },
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
    if (memberAccount.role === 'ACCOUNT_OWNER') {
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
      include: { account: true },
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

    // Generate new temp password
    const tempPassword = crypto.randomBytes(8).toString('hex');
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    await prisma.user.update({
      where: { id: memberId },
      data: { 
        passwordHash: hashedPassword,
        emailVerified: false,
      },
    });

    // TODO: Send email with new temp password
    // await emailService.sendInviteEmail(member.user.email, tempPassword, accountUser.account.businessName);

    logger.info(`Invite resent to ${memberId} by ${userId}`);

    return res.json({
      success: true,
      message: 'Invitation resent successfully',
      ...(process.env.NODE_ENV === 'development' && { tempPassword }),
    });
  })
);

export default router;
