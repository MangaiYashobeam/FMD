import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { AppError } from './errorHandler';
import prisma from '@/config/database';
import { logger } from '@/utils/logger';

/**
 * Role hierarchy (higher = more permissions)
 */
export enum UserRole {
  VIEWER = 'VIEWER',
  SALES_REP = 'SALES_REP',
  ADMIN = 'ADMIN',
  ACCOUNT_OWNER = 'ACCOUNT_OWNER',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.VIEWER]: 0,
  [UserRole.SALES_REP]: 1,
  [UserRole.ADMIN]: 2,
  [UserRole.ACCOUNT_OWNER]: 3,
  [UserRole.SUPER_ADMIN]: 4,
};

/**
 * Permission matrix defining what each role can do
 */
export const PERMISSIONS = {
  // System-wide permissions (SUPER_ADMIN only)
  MANAGE_ALL_ACCOUNTS: [UserRole.SUPER_ADMIN],
  MANAGE_SUBSCRIPTION_PLANS: [UserRole.SUPER_ADMIN],
  VIEW_ALL_PAYMENTS: [UserRole.SUPER_ADMIN],
  MANAGE_SYSTEM_SETTINGS: [UserRole.SUPER_ADMIN],
  
  // Account management
  MANAGE_ACCOUNT_SETTINGS: [UserRole.SUPER_ADMIN, UserRole.ACCOUNT_OWNER, UserRole.ADMIN],
  MANAGE_USERS: [UserRole.SUPER_ADMIN, UserRole.ACCOUNT_OWNER, UserRole.ADMIN],
  VIEW_ACCOUNT_ANALYTICS: [UserRole.SUPER_ADMIN, UserRole.ACCOUNT_OWNER, UserRole.ADMIN, UserRole.VIEWER],
  
  // Subscription & Billing
  MANAGE_SUBSCRIPTION: [UserRole.SUPER_ADMIN, UserRole.ACCOUNT_OWNER],
  VIEW_PAYMENTS: [UserRole.SUPER_ADMIN, UserRole.ACCOUNT_OWNER, UserRole.ADMIN],
  
  // Vehicle management
  MANAGE_VEHICLES: [UserRole.SUPER_ADMIN, UserRole.ACCOUNT_OWNER, UserRole.ADMIN],
  VIEW_VEHICLES: [UserRole.SUPER_ADMIN, UserRole.ACCOUNT_OWNER, UserRole.ADMIN, UserRole.SALES_REP, UserRole.VIEWER],
  
  // Posting
  POST_TO_MARKETPLACE: [UserRole.SUPER_ADMIN, UserRole.ACCOUNT_OWNER, UserRole.ADMIN, UserRole.SALES_REP],
  MANAGE_ALL_POSTS: [UserRole.SUPER_ADMIN, UserRole.ACCOUNT_OWNER, UserRole.ADMIN],
  MANAGE_OWN_POSTS: [UserRole.SUPER_ADMIN, UserRole.ACCOUNT_OWNER, UserRole.ADMIN, UserRole.SALES_REP],
  
  // Templates & AI
  MANAGE_TEMPLATES: [UserRole.SUPER_ADMIN, UserRole.ACCOUNT_OWNER, UserRole.ADMIN],
  USE_TEMPLATES: [UserRole.SUPER_ADMIN, UserRole.ACCOUNT_OWNER, UserRole.ADMIN, UserRole.SALES_REP],
  MANAGE_AI_SETTINGS: [UserRole.SUPER_ADMIN, UserRole.ACCOUNT_OWNER, UserRole.ADMIN],
  
  // Facebook credentials (personal)
  MANAGE_OWN_FB_CREDENTIALS: [UserRole.SUPER_ADMIN, UserRole.ACCOUNT_OWNER, UserRole.ADMIN, UserRole.SALES_REP],
  VIEW_OTHERS_FB_CREDENTIALS: [UserRole.SUPER_ADMIN, UserRole.ACCOUNT_OWNER],
  
  // Sync operations
  TRIGGER_SYNC: [UserRole.SUPER_ADMIN, UserRole.ACCOUNT_OWNER, UserRole.ADMIN],
  VIEW_SYNC_STATUS: [UserRole.SUPER_ADMIN, UserRole.ACCOUNT_OWNER, UserRole.ADMIN, UserRole.SALES_REP, UserRole.VIEWER],
};

/**
 * Check if user has specific role in account
 */
export async function getUserRole(userId: string, accountId: string): Promise<UserRole | null> {
  const accountUser = await prisma.accountUser.findUnique({
    where: {
      accountId_userId: {
        accountId,
        userId,
      },
    },
  });

  return accountUser?.role as UserRole || null;
}

/**
 * Check if user has permission
 */
export function hasPermission(userRole: UserRole, permission: keyof typeof PERMISSIONS): boolean {
  const allowedRoles = PERMISSIONS[permission];
  return allowedRoles.includes(userRole);
}

/**
 * Check if role1 is higher or equal to role2
 */
export function isRoleHigherOrEqual(role1: UserRole, role2: UserRole): boolean {
  return ROLE_HIERARCHY[role1] >= ROLE_HIERARCHY[role2];
}

/**
 * Middleware: Require specific role
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      const accountId = req.params.accountId || req.body.accountId;
      
      if (!accountId) {
        // Super admin can access without account context
        if (req.user.role === UserRole.SUPER_ADMIN && allowedRoles.includes(UserRole.SUPER_ADMIN)) {
          return next();
        }
        throw new AppError('Account ID required', 400);
      }

      const userRole = await getUserRole(req.user.id, accountId as string);

      if (!userRole) {
        throw new AppError('Not a member of this account', 403);
      }

      // Check if user has required role
      const hasRequiredRole = allowedRoles.some(role => 
        isRoleHigherOrEqual(userRole, role)
      );

      if (!hasRequiredRole) {
        logger.warn(`Access denied: User ${req.user.id} (${userRole}) attempted to access ${req.path} requiring [${allowedRoles.join(', ')}]`);
        throw new AppError('Insufficient permissions', 403);
      }

      // Add role to request for downstream use
      req.userRole = userRole;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware: Require specific permission
 */
export function requirePermission(...permissions: (keyof typeof PERMISSIONS)[]) {
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      const accountId = req.params.accountId || req.body.accountId;

      // Super admin always has all permissions
      if (req.user.role === UserRole.SUPER_ADMIN) {
        req.userRole = UserRole.SUPER_ADMIN;
        return next();
      }

      if (!accountId) {
        throw new AppError('Account ID required', 400);
      }

      const userRole = await getUserRole(req.user.id, accountId as string);

      if (!userRole) {
        throw new AppError('Not a member of this account', 403);
      }

      // Check if user has ALL required permissions
      const hasAllPermissions = permissions.every(permission =>
        hasPermission(userRole, permission)
      );

      if (!hasAllPermissions) {
        logger.warn(`Permission denied: User ${req.user.id} (${userRole}) lacks permissions [${permissions.join(', ')}]`);
        throw new AppError('Insufficient permissions', 403);
      }

      req.userRole = userRole;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware: Require super admin
 */
export const requireSuperAdmin = requireRole(UserRole.SUPER_ADMIN);

/**
 * Middleware: Require account owner
 */
export const requireAccountOwner = requireRole(UserRole.ACCOUNT_OWNER, UserRole.SUPER_ADMIN);

/**
 * Middleware: Require admin
 */
export const requireAdmin = requireRole(UserRole.ADMIN, UserRole.ACCOUNT_OWNER, UserRole.SUPER_ADMIN);

/**
 * Middleware: Require sales rep or higher
 */
export const requireSalesRep = requireRole(UserRole.SALES_REP, UserRole.ADMIN, UserRole.ACCOUNT_OWNER, UserRole.SUPER_ADMIN);

/**
 * Check if user can access resource owned by another user
 */
export async function canAccessUserResource(
  requestingUserId: string,
  resourceOwnerId: string,
  accountId: string
): Promise<boolean> {
  // Can always access own resources
  if (requestingUserId === resourceOwnerId) {
    return true;
  }

  const userRole = await getUserRole(requestingUserId, accountId);

  if (!userRole) {
    return false;
  }

  // Admins and above can access all user resources in their account
  return isRoleHigherOrEqual(userRole, UserRole.ADMIN);
}

/**
 * Audit log for permission checks
 */
export async function logPermissionCheck(
  userId: string,
  action: string,
  accountId: string,
  granted: boolean,
  reason?: string
) {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      entityType: 'PERMISSION_CHECK',
      entityId: accountId,
      metadata: {
        granted,
        reason: reason || (granted ? 'Permission granted' : 'Permission denied'),
      },
    },
  });
}
