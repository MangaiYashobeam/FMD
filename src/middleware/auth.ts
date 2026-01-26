import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '@/middleware/errorHandler';
import prisma from '@/config/database';
import { UserRole } from './rbac';
import { logger } from '@/utils/logger';

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
      id?: string;
      userId?: string;  // Support both formats for compatibility
      email?: string;
    };

    // Support both 'id' and 'userId' in token payload
    const userId = decoded.id || decoded.userId;
    
    if (!userId) {
      logger.error('Token missing user ID', { decoded: { hasId: !!decoded.id, hasUserId: !!decoded.userId }, path: req.path });
      throw new AppError('Invalid token: missing user ID', 401);
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
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

    // Update last login (async, don't wait)
    prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    }).catch(() => {}); // Ignore errors

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

/**
 * Optional authentication middleware
 * Sets req.user if token is valid, but doesn't fail if no token
 */
export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token, continue without auth
      return next();
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return next();
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      id?: string;
      userId?: string;
    };

    const userId = decoded.id || decoded.userId;
    
    if (!userId) {
      return next();
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        accountUsers: {
          include: {
            account: true,
          },
        },
      },
    });

    if (user && user.isActive) {
      const isSuperAdmin = user.accountUsers.some(au => au.role === 'SUPER_ADMIN');
      
      req.user = {
        id: user.id,
        email: user.email,
        accountIds: user.accountUsers.map((au) => au.accountId),
        role: isSuperAdmin ? UserRole.SUPER_ADMIN : undefined,
      };
    }

    next();
  } catch (error) {
    // Token invalid, continue without auth
    next();
  }
};
