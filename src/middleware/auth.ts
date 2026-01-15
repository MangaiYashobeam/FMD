import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '@/middleware/errorHandler';
import prisma from '@/config/database';
import { UserRole } from './rbac';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    accountIds: string[];
    role?: UserRole; // Global role (SUPER_ADMIN if applicable)
  };
  userRole?: UserRole; // Context-specific role within an account
}

export const authenticate = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No token provided', 401);
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      throw new AppError('Invalid token format', 401);
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: string;
      email: string;
    };

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: {
        accountUsers: {
          include: {
            account: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new AppError('User not found or inactive', 401);
    }

    // Check if user is super admin (has SUPER_ADMIN role in any account)
    const isSuperAdmin = user.accountUsers.some(au => au.role === 'SUPER_ADMIN');

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      accountIds: user.accountUsers.map((au) => au.accountId),
      role: isSuperAdmin ? UserRole.SUPER_ADMIN : undefined,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(new AppError('Token expired', 401));
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new AppError('Invalid token', 401));
    }
    next(error);
  }
};

export const authorize = (...roles: string[]) => {
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
      const accountId = req.params.accountId || req.body.accountId;

      if (!accountId) {
        throw new AppError('Account ID required', 400);
      }

      const accountUser = await prisma.accountUser.findUnique({
        where: {
          accountId_userId: {
            accountId,
            userId: req.user!.id,
          },
        },
      });

      if (!accountUser) {
        throw new AppError('Access denied', 403);
      }

      if (roles.length && !roles.includes(accountUser.role)) {
        throw new AppError('Insufficient permissions', 403);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
