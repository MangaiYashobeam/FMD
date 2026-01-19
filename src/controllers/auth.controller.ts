import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { AppError } from '@/middleware/errorHandler';
import prisma from '@/config/database';
import { logger } from '@/utils/logger';
import { AuthRequest } from '@/middleware/auth';
import { emailService } from '@/services/email.service';

export class AuthController {
  /**
   * Register a new user and create account
   */
  async register(req: Request, res: Response) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400);
    }

    const { email, password, firstName, lastName, accountName } = req.body;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      throw new AppError('User already exists', 409);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user and account in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email: email.toLowerCase(),
          passwordHash,
          firstName,
          lastName,
        },
      });

      // Create account
      const account = await tx.account.create({
        data: {
          name: accountName,
        },
      });

      // Link user to account as owner
      await tx.accountUser.create({
        data: {
          userId: user.id,
          accountId: account.id,
          role: 'ACCOUNT_OWNER',
        },
      });

      // Create default account settings
      await tx.accountSettings.create({
        data: {
          accountId: account.id,
        },
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'USER_REGISTERED',
          entityType: 'user',
          entityId: user.id,
          metadata: {
            email: user.email,
            accountId: account.id,
          },
        },
      });

      return { user, account };
    });

    // Generate tokens
    const jwtSecret = process.env.JWT_SECRET || 'secret';
    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'refresh-secret';
    const accessTokenOptions: SignOptions = { expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as any };
    const refreshTokenOptions: SignOptions = { expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as any };

    const accessToken = jwt.sign(
      { id: result.user.id, email: result.user.email },
      jwtSecret,
      accessTokenOptions
    );

    const refreshToken = jwt.sign(
      { id: result.user.id },
      jwtRefreshSecret,
      refreshTokenOptions
    );

    // Save refresh token
    await prisma.refreshToken.create({
      data: {
        userId: result.user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    logger.info(`User registered: ${result.user.email}`);

    // Send welcome email (async, don't wait)
    emailService.sendWelcomeEmail(
      result.user.email,
      result.user.firstName || 'User'
    ).catch(err => logger.error('Failed to send welcome email:', err));

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
        },
        account: {
          id: result.account.id,
          name: result.account.name,
        },
        accessToken,
        refreshToken,
      },
    });
  }

  /**
   * Login user
   */
  async login(req: Request, res: Response) {
    try {
      logger.info('Login attempt started', { body: { email: req.body?.email } });
      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn('Login validation failed', { errors: errors.array() });
        throw new AppError('Validation failed', 400);
      }

      const { email, password } = req.body;
      logger.info(`Login step 1: Finding user: ${email}`);

      // Find user
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        include: {
          accountUsers: {
            include: {
              account: true,
            },
          },
        },
      });

      logger.info(`Login step 2: User lookup result`, { found: !!user, active: user?.isActive });

      if (!user || !user.isActive) {
        logger.warn(`Login failed - user not found or inactive: ${email}`);
        throw new AppError('Invalid credentials', 401);
      }

      logger.info(`Login step 3: Verifying password`);
      
      // Verify password
      const isPasswordValid = user.passwordHash 
        ? await bcrypt.compare(password, user.passwordHash)
        : false;

      logger.info(`Login step 4: Password check result`, { valid: isPasswordValid });

      if (!isPasswordValid) {
        logger.warn(`Login failed - invalid password: ${email}`);
        throw new AppError('Invalid credentials', 401);
      }

      logger.info(`Login step 5: Generating tokens`);

      // Generate tokens
      const jwtSecret = process.env.JWT_SECRET;
      const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
      
      if (!jwtSecret || !jwtRefreshSecret) {
        logger.error('JWT secrets not configured in environment variables');
        throw new AppError('Server configuration error', 500);
      }

      const accessTokenOptions: SignOptions = { expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as any };
      const refreshTokenOptions: SignOptions = { expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as any };

      const accessToken = jwt.sign(
        { id: user.id, email: user.email },
        jwtSecret,
        accessTokenOptions
      );

      const refreshToken = jwt.sign(
        { id: user.id },
        jwtRefreshSecret,
        refreshTokenOptions
      );

      logger.info(`Login step 6: Saving refresh token`);

      // Save refresh token
      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          token: refreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      logger.info(`Login step 7: Updating last login`);

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      logger.info(`Login step 8: Creating audit log`);

      // Log login
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'USER_LOGIN',
          entityType: 'user',
          entityId: user.id,
          ipAddress: req.ip || 'unknown',
          userAgent: req.get('user-agent') || 'unknown',
        },
      });

      logger.info(`Login step 9: Sending response for ${user.email}`);

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          },
          accounts: user.accountUsers.map((au) => ({
            id: au.account.id,
            name: au.account.name,
            role: au.role,
          })),
          accessToken,
          refreshToken,
        },
      });
    } catch (error: any) {
      logger.error('Login error at step:', { 
        message: error.message, 
        stack: error.stack,
        name: error.name 
      });
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(req: Request, res: Response) {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new AppError('Refresh token required', 400);
    }

    // Verify refresh token (throws if invalid)
    try {
      jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET || 'refresh-secret'
      );
    } catch (err) {
      throw new AppError('Invalid refresh token', 401);
    }

    // Check if token exists in database
    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
      throw new AppError('Invalid or expired refresh token', 401);
    }

    // Delete the old refresh token (rotation)
    await prisma.refreshToken.delete({
      where: { id: tokenRecord.id },
    });

    // Generate new access token
    const jwtSecret = process.env.JWT_SECRET || 'secret';
    const accessTokenOptions: SignOptions = { expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as any };
    const refreshTokenOptions: SignOptions = { expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as any };

    const accessToken = jwt.sign(
      { id: tokenRecord.user.id, email: tokenRecord.user.email },
      jwtSecret,
      accessTokenOptions
    );

    // Generate new refresh token (rotation for security)
    const newRefreshToken = jwt.sign(
      { id: tokenRecord.user.id },
      process.env.JWT_REFRESH_SECRET || 'refresh-secret',
      refreshTokenOptions
    );

    // Save new refresh token
    await prisma.refreshToken.create({
      data: {
        userId: tokenRecord.user.id,
        token: newRefreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    res.json({
      success: true,
      data: { 
        accessToken,
        refreshToken: newRefreshToken,
      },
    });
  }

  /**
   * Logout user
   */
  async logout(req: AuthRequest, res: Response) {
    const { refreshToken } = req.body;

    if (refreshToken) {
      // Delete refresh token
      await prisma.refreshToken.deleteMany({
        where: {
          token: refreshToken,
          userId: req.user!.id,
        },
      });
    }

    // Log logout
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'USER_LOGOUT',
        entityType: 'user',
        entityId: req.user!.id,
      },
    });

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  }

  /**
   * Get current user
   */
  async getCurrentUser(req: AuthRequest, res: Response) {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        accountUsers: {
          include: {
            account: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        emailVerified: user.emailVerified,
        accounts: user.accountUsers.map((au) => ({
          id: au.account.id,
          name: au.account.name,
          role: au.role,
        })),
      },
    });
  }

  /**
   * Forgot password
   */
  async forgotPassword(req: Request, res: Response) {
    const { email } = req.body;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // Don't reveal if user exists - but still log for debugging
      logger.info(`Password reset requested for non-existent email: ${email}`);
      res.json({
        success: true,
        message: 'If the email exists, a reset link has been sent',
      });
      return;
    }

    // Invalidate any existing reset tokens for this user
    await prisma.passwordResetToken.updateMany({
      where: { 
        userId: user.id,
        usedAt: null,
      },
      data: { usedAt: new Date() },
    });

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Save reset token (expires in 1 hour)
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    // Send password reset email
    const emailSent = await emailService.sendPasswordResetEmail(
      user.email,
      resetToken, // Send unhashed token in email
      user.firstName || 'User'
    );

    if (emailSent) {
      logger.info(`Password reset email sent to: ${user.email}`);
    } else {
      logger.warn(`Failed to send password reset email to: ${user.email}`);
    }

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'PASSWORD_RESET_REQUESTED',
        entityType: 'user',
        entityId: user.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      },
    });

    res.json({
      success: true,
      message: 'If the email exists, a reset link has been sent',
    });
  }

  /**
   * Reset password with token
   */
  async resetPassword(req: Request, res: Response) {
    const { token, password } = req.body;

    if (!token || !password) {
      throw new AppError('Token and new password are required', 400);
    }

    if (password.length < 8) {
      throw new AppError('Password must be at least 8 characters', 400);
    }

    // Hash the provided token to compare with stored hash
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find valid reset token
    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        token: tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!resetToken) {
      throw new AppError('Invalid or expired reset token', 400);
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 12);

    // Update password and mark token as used (transaction)
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      // Invalidate all refresh tokens for security
      prisma.refreshToken.deleteMany({
        where: { userId: resetToken.userId },
      }),
      prisma.auditLog.create({
        data: {
          userId: resetToken.userId,
          action: 'PASSWORD_RESET_COMPLETED',
          entityType: 'user',
          entityId: resetToken.userId,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        },
      }),
    ]);

    logger.info(`Password reset completed for user: ${resetToken.user.email}`);

    res.json({
      success: true,
      message: 'Password reset successfully. Please login with your new password.',
    });
  }

  /**
   * Super Admin Impersonation - Login as another user
   * Only available to SUPER_ADMIN users
   */
  async impersonateUser(req: AuthRequest, res: Response) {
    const userId = req.params.userId as string;
    const impersonatorId = req.user!.id;

    // Verify the requesting user is a SUPER_ADMIN
    const impersonator = await prisma.user.findUnique({
      where: { id: impersonatorId },
      include: {
        accountUsers: true,
      },
    });

    if (!impersonator) {
      throw new AppError('Impersonator not found', 404);
    }

    const isSuperAdmin = impersonator.accountUsers.some(au => au.role === 'SUPER_ADMIN');
    if (!isSuperAdmin) {
      throw new AppError('Only Super Admins can impersonate users', 403);
    }

    // Find the target user with their account associations
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        accountUsers: {
          include: {
            account: true,
          },
        },
      },
    });

    if (!targetUser || !targetUser.isActive) {
      throw new AppError('Target user not found or inactive', 404);
    }

    // Generate impersonation tokens (shorter expiry for security)
    const jwtSecret = process.env.JWT_SECRET || 'secret';
    const accessTokenOptions: SignOptions = { expiresIn: '2h' }; // Shorter for impersonation

    const accessToken = jwt.sign(
      { 
        id: targetUser.id, 
        email: targetUser.email,
        impersonatedBy: impersonatorId, // Track who is impersonating
      },
      jwtSecret,
      accessTokenOptions
    );

    // Log the impersonation action
    await prisma.auditLog.create({
      data: {
        userId: impersonatorId,
        action: 'USER_IMPERSONATION_STARTED',
        entityType: 'user',
        entityId: targetUser.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        metadata: {
          impersonatorEmail: impersonator.email,
          targetUserEmail: targetUser.email,
          targetUserId: targetUser.id,
        },
      },
    });

    logger.warn(`IMPERSONATION: ${impersonator.email} (${impersonatorId}) is impersonating ${targetUser.email} (${targetUser.id})`);

    res.json({
      success: true,
      data: {
        user: {
          id: targetUser.id,
          email: targetUser.email,
          firstName: targetUser.firstName,
          lastName: targetUser.lastName,
        },
        accounts: targetUser.accountUsers.map((au) => ({
          id: au.account.id,
          name: au.account.name,
          role: au.role,
        })),
        accessToken,
        // No refresh token for impersonation - must re-authenticate or end session
        isImpersonating: true,
        impersonator: {
          id: impersonator.id,
          email: impersonator.email,
        },
      },
    });
  }

  /**
   * End impersonation and restore original admin session
   */
  async endImpersonation(req: AuthRequest, res: Response) {
    const adminId = req.user!.id;

    // The admin should call this endpoint with their original token stored in frontend
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      include: {
        accountUsers: {
          include: {
            account: true,
          },
        },
      },
    });

    if (!admin) {
      throw new AppError('Admin not found', 404);
    }

    // Generate fresh token for admin
    const jwtSecret = process.env.JWT_SECRET || 'secret';
    const accessTokenOptions: SignOptions = { expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as any };

    const accessToken = jwt.sign(
      { id: admin.id, email: admin.email },
      jwtSecret,
      accessTokenOptions
    );

    // Log the impersonation end
    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: 'USER_IMPERSONATION_ENDED',
        entityType: 'user',
        entityId: admin.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      },
    });

    logger.info(`IMPERSONATION ENDED: Admin ${admin.email} restored their session`);

    res.json({
      success: true,
      data: {
        user: {
          id: admin.id,
          email: admin.email,
          firstName: admin.firstName,
          lastName: admin.lastName,
        },
        accounts: admin.accountUsers.map((au) => ({
          id: au.account.id,
          name: au.account.name,
          role: au.role,
        })),
        accessToken,
      },
    });
  }

  /**
   * Get list of all users for impersonation dropdown
   * Only available to SUPER_ADMIN users
   */
  async getImpersonationTargets(req: AuthRequest, res: Response) {
    const requesterId = req.user!.id;

    // Verify the requesting user is a SUPER_ADMIN
    const requester = await prisma.user.findUnique({
      where: { id: requesterId },
      include: {
        accountUsers: true,
      },
    });

    if (!requester) {
      throw new AppError('User not found', 404);
    }

    const isSuperAdmin = requester.accountUsers.some(au => au.role === 'SUPER_ADMIN');
    if (!isSuperAdmin) {
      throw new AppError('Only Super Admins can view impersonation targets', 403);
    }

    // Get all users with their accounts and roles
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        id: { not: requesterId }, // Exclude self
      },
      include: {
        accountUsers: {
          include: {
            account: true,
          },
        },
      },
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' },
      ],
    });

    const targets = users.map(user => ({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      accounts: user.accountUsers.map(au => ({
        id: au.account.id,
        name: au.account.name,
        role: au.role,
      })),
      highestRole: getHighestRole(user.accountUsers.map(au => au.role)),
      lastLoginAt: user.lastLoginAt,
    }));

    res.json({
      success: true,
      data: targets,
    });
  }

  /**
   * Update user profile (name, email, phone)
   */
  async updateProfile(req: AuthRequest, res: Response) {
    const userId = req.user!.id;
    const { firstName, lastName, email, phone } = req.body;

    // Check if email is being changed and if it's already taken
    if (email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email: email.toLowerCase(),
          id: { not: userId },
        },
      });

      if (existingUser) {
        throw new AppError('Email is already in use', 409);
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(email && { email: email.toLowerCase() }),
        ...(phone !== undefined && { phone }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        updatedAt: true,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'PROFILE_UPDATED',
        entityType: 'user',
        entityId: userId,
        metadata: { fields: Object.keys(req.body) },
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent'),
      },
    });

    res.json({
      success: true,
      data: updatedUser,
    });
  }

  /**
   * Change user password
   */
  async changePassword(req: AuthRequest, res: Response) {
    const userId = req.user!.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw new AppError('Current password and new password are required', 400);
    }

    if (newPassword.length < 8) {
      throw new AppError('New password must be at least 8 characters', 400);
    }

    // Get current user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user || !user.passwordHash) {
      throw new AppError('User not found', 404);
    }

    // Verify current password
    const isCurrentValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      throw new AppError('Current password is incorrect', 401);
    }

    // Hash and update new password
    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'PASSWORD_CHANGED',
        entityType: 'user',
        entityId: userId,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent'),
      },
    });

    // Optionally revoke all other sessions
    await prisma.refreshToken.deleteMany({
      where: { userId },
    });

    res.json({
      success: true,
      message: 'Password changed successfully. Please login again.',
    });
  }

  /**
   * Get active sessions for user
   */
  async getActiveSessions(req: AuthRequest, res: Response) {
    const userId = req.user!.id;

    const sessions = await prisma.refreshToken.findMany({
      where: {
        userId,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: sessions.map((s, index) => ({
        id: s.id,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        isCurrent: index === 0, // Most recently created is likely current
      })),
    });
  }

  /**
   * Revoke all other sessions (logout everywhere else)
   */
  async revokeOtherSessions(req: AuthRequest, res: Response) {
    const userId = req.user!.id;
    const currentToken = req.headers.authorization?.replace('Bearer ', '');

    // Get the current session to preserve it
    const decoded = jwt.verify(currentToken || '', process.env.JWT_SECRET || 'secret') as { sessionId?: string };

    // Delete all other refresh tokens except the current one
    const result = await prisma.refreshToken.deleteMany({
      where: {
        userId,
        ...(decoded.sessionId && { id: { not: decoded.sessionId } }),
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'SESSIONS_REVOKED',
        entityType: 'user',
        entityId: userId,
        metadata: { revokedCount: result.count },
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent'),
      },
    });

    res.json({
      success: true,
      message: `Revoked ${result.count} other session(s)`,
    });
  }
}

// Helper function to determine highest role
function getHighestRole(roles: string[]): string {
  const roleHierarchy = ['SUPER_ADMIN', 'ACCOUNT_OWNER', 'ADMIN', 'SALES_REP', 'VIEWER'];
  for (const role of roleHierarchy) {
    if (roles.includes(role)) return role;
  }
  return 'USER';
}
