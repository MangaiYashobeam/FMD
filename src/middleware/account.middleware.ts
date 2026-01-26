/**
 * Account Context Middleware
 * 
 * Sets account context for authenticated requests
 */

import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';

/**
 * Set account context for authenticated requests
 * Looks up the AccountUser relation for the current user
 */
export async function setAccountContext(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = (req as any).user;
    
    if (!user) {
      // No authenticated user, skip account context
      return next();
    }

    // Get accountId from params, query, body, or header
    let accountId = 
      req.params.accountId || 
      req.query.accountId || 
      (req.body && req.body.accountId) ||
      req.headers['x-account-id'];

    // If no accountId provided, use the first account the user has access to
    if (!accountId && user.accountIds && user.accountIds.length > 0) {
      accountId = user.accountIds[0];
    }

    if (!accountId) {
      // User has no accounts, skip account context
      return next();
    }

    // Get AccountUser for this user/account
    const accountUser = await prisma.accountUser.findUnique({
      where: {
        accountId_userId: {
          accountId: accountId as string,
          userId: user.id
        }
      },
      include: {
        account: {
          select: {
            id: true,
            name: true,
            dealershipName: true,
            isActive: true,
            subscriptionStatus: true,
            trialEndsAt: true
          }
        }
      }
    });

    if (accountUser) {
      // Attach account context to request
      (req as any).accountUser = {
        ...accountUser,
        accountId: accountUser.accountId,
        userId: accountUser.userId,
        role: accountUser.role
      };
      (req as any).account = accountUser.account;
    }

    next();
  } catch (error) {
    logger.error('Error setting account context:', error);
    next(error);
  }
}

/**
 * Require account context to be set
 */
export function requireAccountContext(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const accountUser = (req as any).accountUser;
  
  if (!accountUser) {
    res.status(403).json({ error: 'Account context required' });
    return;
  }

  const account = (req as any).account;
  if (account && !account.isActive) {
    res.status(403).json({ error: 'Account is inactive' });
    return;
  }

  next();
}

export default {
  setAccountContext,
  requireAccountContext
};
