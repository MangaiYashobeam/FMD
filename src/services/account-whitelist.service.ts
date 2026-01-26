/**
 * ============================================
 * FaceMyDealer - Account Whitelist Service
 * ============================================
 * 
 * Manages API access whitelist for accounts
 * Controls which accounts can access:
 * - Green Route (secure internal APIs)
 * - API Key access
 * - Extension access
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface WhitelistOptions {
  greenRouteAccess?: boolean;
  apiKeyAccess?: boolean;
  extensionAccess?: boolean;
  customRateLimit?: number;
  reason?: string;
  notes?: string;
}

/**
 * Check if an account is whitelisted
 */
export async function isAccountWhitelisted(accountId: string): Promise<boolean> {
  const whitelist = await prisma.accountWhitelist.findUnique({
    where: { accountId }
  });

  return whitelist?.isWhitelisted ?? false;
}

/**
 * Check if account has Green Route access
 */
export async function hasGreenRouteAccess(accountId: string): Promise<boolean> {
  const whitelist = await prisma.accountWhitelist.findUnique({
    where: { accountId }
  });

  return Boolean(whitelist?.isWhitelisted && whitelist?.greenRouteAccess);
}

/**
 * Check if account has API Key access
 */
export async function hasApiKeyAccess(accountId: string): Promise<boolean> {
  const whitelist = await prisma.accountWhitelist.findUnique({
    where: { accountId }
  });

  return Boolean(whitelist?.isWhitelisted && whitelist?.apiKeyAccess);
}

/**
 * Check if account has Extension access
 */
export async function hasExtensionAccess(accountId: string): Promise<boolean> {
  const whitelist = await prisma.accountWhitelist.findUnique({
    where: { accountId }
  });

  // Extension access is default true, but account must be whitelisted
  return Boolean(whitelist?.isWhitelisted && whitelist?.extensionAccess !== false);
}

/**
 * Get account's custom rate limit
 */
export async function getCustomRateLimit(accountId: string): Promise<number | null> {
  const whitelist = await prisma.accountWhitelist.findUnique({
    where: { accountId }
  });

  return whitelist?.customRateLimit ?? null;
}

/**
 * Whitelist an account
 */
export async function whitelistAccount(
  accountId: string,
  whitelistedBy: string,
  options: WhitelistOptions = {}
): Promise<any> {
  const {
    greenRouteAccess = false,
    apiKeyAccess = false,
    extensionAccess = true,
    customRateLimit,
    reason,
    notes
  } = options;

  return prisma.accountWhitelist.upsert({
    where: { accountId },
    create: {
      accountId,
      isWhitelisted: true,
      whitelistedAt: new Date(),
      whitelistedBy,
      greenRouteAccess,
      apiKeyAccess,
      extensionAccess,
      customRateLimit,
      reason,
      notes
    },
    update: {
      isWhitelisted: true,
      whitelistedAt: new Date(),
      whitelistedBy,
      greenRouteAccess,
      apiKeyAccess,
      extensionAccess,
      customRateLimit,
      reason,
      notes
    }
  });
}

/**
 * Remove account from whitelist
 */
export async function removeFromWhitelist(
  accountId: string,
  removedBy: string,
  reason?: string
): Promise<any> {
  return prisma.accountWhitelist.update({
    where: { accountId },
    data: {
      isWhitelisted: false,
      notes: `Removed by ${removedBy}${reason ? `: ${reason}` : ''}`
    }
  });
}

/**
 * Update whitelist permissions
 */
export async function updateWhitelistPermissions(
  accountId: string,
  permissions: WhitelistOptions
): Promise<any> {
  return prisma.accountWhitelist.update({
    where: { accountId },
    data: {
      ...permissions,
      updatedAt: new Date()
    }
  });
}

/**
 * Get all whitelisted accounts
 */
export async function getWhitelistedAccounts(filters?: {
  greenRouteAccess?: boolean;
  apiKeyAccess?: boolean;
  limit?: number;
  offset?: number;
}): Promise<any[]> {
  const { greenRouteAccess, apiKeyAccess, limit = 50, offset = 0 } = filters || {};

  return prisma.accountWhitelist.findMany({
    where: {
      isWhitelisted: true,
      ...(greenRouteAccess !== undefined && { greenRouteAccess }),
      ...(apiKeyAccess !== undefined && { apiKeyAccess })
    },
    include: {
      account: {
        select: {
          id: true,
          name: true,
          dealershipName: true,
          isActive: true
        }
      }
    },
    orderBy: { whitelistedAt: 'desc' },
    take: limit,
    skip: offset
  });
}

/**
 * Get whitelist status for an account
 */
export async function getWhitelistStatus(accountId: string): Promise<any | null> {
  return prisma.accountWhitelist.findUnique({
    where: { accountId },
    include: {
      account: {
        select: {
          id: true,
          name: true,
          dealershipName: true,
          isActive: true
        }
      }
    }
  });
}

/**
 * Bulk whitelist accounts
 */
export async function bulkWhitelistAccounts(
  accountIds: string[],
  whitelistedBy: string,
  options: WhitelistOptions = {}
): Promise<number> {
  const {
    greenRouteAccess = false,
    apiKeyAccess = false,
    extensionAccess = true,
    reason
  } = options;

  let count = 0;

  for (const accountId of accountIds) {
    await prisma.accountWhitelist.upsert({
      where: { accountId },
      create: {
        accountId,
        isWhitelisted: true,
        whitelistedAt: new Date(),
        whitelistedBy,
        greenRouteAccess,
        apiKeyAccess,
        extensionAccess,
        reason
      },
      update: {
        isWhitelisted: true,
        whitelistedAt: new Date(),
        whitelistedBy,
        greenRouteAccess,
        apiKeyAccess,
        extensionAccess,
        reason
      }
    });
    count++;
  }

  return count;
}

/**
 * Get whitelist statistics
 */
export async function getWhitelistStats(): Promise<any> {
  const [total, withGreenRoute, withApiKey, withExtension] = await Promise.all([
    prisma.accountWhitelist.count({ where: { isWhitelisted: true } }),
    prisma.accountWhitelist.count({ where: { isWhitelisted: true, greenRouteAccess: true } }),
    prisma.accountWhitelist.count({ where: { isWhitelisted: true, apiKeyAccess: true } }),
    prisma.accountWhitelist.count({ where: { isWhitelisted: true, extensionAccess: true } })
  ]);

  return { total, withGreenRoute, withApiKey, withExtension };
}

/**
 * Auto-whitelist account after registration (with basic extension access)
 */
export async function autoWhitelistAfterRegistration(
  accountId: string,
  isVerifiedDealer: boolean
): Promise<any> {
  return prisma.accountWhitelist.create({
    data: {
      accountId,
      isWhitelisted: true,
      whitelistedAt: new Date(),
      whitelistedBy: 'system',
      greenRouteAccess: false, // Requires manual approval
      apiKeyAccess: false, // Requires manual approval
      extensionAccess: true, // Default enabled
      reason: isVerifiedDealer 
        ? 'Auto-whitelisted: Verified dealer registration' 
        : 'Auto-whitelisted: New registration (pending verification)'
    }
  });
}

export default {
  isAccountWhitelisted,
  hasGreenRouteAccess,
  hasApiKeyAccess,
  hasExtensionAccess,
  getCustomRateLimit,
  whitelistAccount,
  removeFromWhitelist,
  updateWhitelistPermissions,
  getWhitelistedAccounts,
  getWhitelistStatus,
  bulkWhitelistAccounts,
  getWhitelistStats,
  autoWhitelistAfterRegistration
};
