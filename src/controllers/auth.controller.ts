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
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400);
    }

    const { email, password } = req.body;

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

    if (!user || !user.isActive) {
      throw new AppError('Invalid credentials', 401);
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new AppError('Invalid credentials', 401);
    }

    // Generate tokens
    const jwtSecret = process.env.JWT_SECRET || 'secret';
    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'refresh-secret';
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

    // Save refresh token
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Log login
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'USER_LOGIN',
        entityType: 'user',
        entityId: user.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      },
    });

    logger.info(`User logged in: ${user.email}`);

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
}
