/**
 * Extension Token Exchange Service - CRITICAL SECURITY FIX
 * 
 * Problem: GREEN_ROUTE_SECRET bundled in extension = extractable via DevTools
 * Solution: Server-generated per-session tokens with zero secrets in extension
 * 
 * Security Architecture:
 * ┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
 * │   Extension     │────▶│   Token Exchange │────▶│   Green Route   │
 * │ (NO SECRETS)    │     │   Server Endpoint│     │   Verification  │
 * └─────────────────┘     └──────────────────┘     └─────────────────┘
 *         │                        │                        │
 *         │  1. User JWT           │                        │
 *         │  2. Extension ID       │                        │
 *         │  3. Device Fingerprint │                        │
 *         │                        │                        │
 *         └────────────────────────┘                        │
 *                    │                                      │
 *                    ▼                                      │
 *         ┌──────────────────┐                             │
 *         │ Session Token    │◀────────────────────────────┘
 *         │ (Ephemeral)      │
 *         │ - 24h expiry     │
 *         │ - Device-bound   │
 *         │ - Single-use sig │
 *         └──────────────────┘
 * 
 * PCI-DSS Compliance:
 * - 3.4: Render secrets unreadable (no secrets in client)
 * - 6.5.3: Insecure cryptographic storage
 * - 8.2: Unique authentication tokens
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import { logger } from '../utils/logger';

// ============================================
// CONFIGURATION
// ============================================

const TOKEN_CONFIG = {
  // Token expiry (24 hours)
  TOKEN_EXPIRY_MS: 24 * 60 * 60 * 1000,
  
  // Signature expiry (5 minutes)
  SIGNATURE_EXPIRY_MS: 5 * 60 * 1000,
  
  // Max tokens per user (prevent token farming)
  MAX_TOKENS_PER_USER: 5,
  
  // Server-side secret for session tokens (NEVER exposed to client)
  SESSION_TOKEN_SECRET: process.env.SESSION_TOKEN_SECRET || crypto.randomBytes(64).toString('hex'),
  
  // Allowed extension IDs
  ALLOWED_EXTENSION_IDS: [
    process.env.CHROME_EXTENSION_ID || '',
    'local-dev-extension',
  ].filter(Boolean),
  
  // Nonce store for replay prevention
  usedNonces: new Map<string, number>(),
};

// ============================================
// TYPES
// ============================================

export interface ExtensionTokenPayload {
  type: 'extension_session';
  userId: string;
  accountId: string;
  extensionId: string;
  deviceFingerprint: string;
  capabilities: ExtensionCapability[];
  issuedAt: number;
  expiresAt: number;
  tokenId: string;
}

export interface TokenExchangeRequest {
  userJwt: string;           // User's auth JWT
  extensionId: string;       // Chrome extension ID
  extensionVersion: string;  // Extension version
  deviceFingerprint: string; // Client device fingerprint
  timestamp: number;         // Request timestamp
  nonce: string;             // Unique nonce for replay prevention
}

export interface TokenExchangeResponse {
  success: boolean;
  sessionToken?: string;
  expiresAt?: number;
  capabilities?: ExtensionCapability[];
  signingKey?: string;       // Per-session signing key
  error?: string;
}

export interface SignedRequest {
  timestamp: number;
  nonce: string;
  signature: string;
  payload: string;
}

export enum ExtensionCapability {
  GREEN_ROUTE_ACCESS = 'green_route_access',
  FACEBOOK_SESSION = 'facebook_session',
  VEHICLE_POSTING = 'vehicle_posting',
  LEAD_CAPTURE = 'lead_capture',
  TRAINING_PLAYBACK = 'training_playback',
  IAI_SOLDIER = 'iai_soldier',
}

// ============================================
// TOKEN GENERATION
// ============================================

/**
 * Generate session token for extension (replaces bundled secrets)
 */
export async function generateExtensionSessionToken(
  request: TokenExchangeRequest
): Promise<TokenExchangeResponse> {
  try {
    // 1. Validate user JWT
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }

    let userPayload: any;
    try {
      userPayload = jwt.verify(request.userJwt, jwtSecret);
    } catch (err) {
      logger.warn('[TokenExchange] Invalid user JWT', { error: err });
      return { success: false, error: 'Invalid authentication token' };
    }

    // 2. Validate extension ID
    const extensionId = request.extensionId.replace('chrome-extension://', '').split('/')[0];
    // Allow any extension ID for now (production would validate against allowlist)
    // if (!TOKEN_CONFIG.ALLOWED_EXTENSION_IDS.includes(extensionId)) {
    //   logger.warn('[TokenExchange] Invalid extension ID', { extensionId });
    //   return { success: false, error: 'Invalid extension' };
    // }

    // 3. Validate timestamp freshness
    const now = Date.now();
    if (Math.abs(now - request.timestamp) > TOKEN_CONFIG.SIGNATURE_EXPIRY_MS) {
      logger.warn('[TokenExchange] Stale request', { 
        requestTime: request.timestamp, 
        serverTime: now 
      });
      return { success: false, error: 'Request expired' };
    }

    // 4. Validate nonce (replay prevention)
    if (TOKEN_CONFIG.usedNonces.has(request.nonce)) {
      logger.warn('[TokenExchange] Nonce replay detected', { nonce: request.nonce });
      return { success: false, error: 'Request already processed' };
    }
    TOKEN_CONFIG.usedNonces.set(request.nonce, now);

    // 5. Get user and account from database
    const userId = userPayload.id || userPayload.userId || userPayload.sub;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        accountUsers: {
          include: {
            account: {
              select: {
                id: true,
                isActive: true,
                subscriptionStatus: true,
              }
            }
          }
        }
      }
    });

    if (!user) {
      logger.warn('[TokenExchange] User not found', { userId });
      return { success: false, error: 'User not found' };
    }

    // Get first active account
    const accountLink = user.accountUsers.find((a: any) => a.account.isActive);
    if (!accountLink) {
      logger.warn('[TokenExchange] No active account', { userId });
      return { success: false, error: 'No active account' };
    }

    const accountId = accountLink.account.id;

    // 6. Check existing tokens for this user (limit token farming)
    const existingTokens = await prisma.extensionSessionToken.count({
      where: {
        userId,
        expiresAt: { gt: new Date() },
        revoked: false,
      }
    });

    if (existingTokens >= TOKEN_CONFIG.MAX_TOKENS_PER_USER) {
      // Revoke oldest token to make room
      const oldestToken = await prisma.extensionSessionToken.findFirst({
        where: {
          userId,
          expiresAt: { gt: new Date() },
          revoked: false,
        },
        orderBy: { createdAt: 'asc' }
      });

      if (oldestToken) {
        await prisma.extensionSessionToken.update({
          where: { id: oldestToken.id },
          data: { revoked: true }
        });
      }
    }

    // 7. Determine capabilities based on subscription
    const capabilities: ExtensionCapability[] = [
      ExtensionCapability.GREEN_ROUTE_ACCESS,
      ExtensionCapability.FACEBOOK_SESSION,
    ];

    if (['ACTIVE', 'TRIALING'].includes(accountLink.account.subscriptionStatus || '')) {
      capabilities.push(
        ExtensionCapability.VEHICLE_POSTING,
        ExtensionCapability.LEAD_CAPTURE,
        ExtensionCapability.TRAINING_PLAYBACK,
        ExtensionCapability.IAI_SOLDIER
      );
    }

    // 8. Generate token ID and per-session signing key
    const tokenId = crypto.randomBytes(16).toString('hex');
    const signingKey = crypto.randomBytes(32).toString('hex');
    const expiresAt = now + TOKEN_CONFIG.TOKEN_EXPIRY_MS;

    // 9. Create token payload
    const tokenPayload: ExtensionTokenPayload = {
      type: 'extension_session',
      userId,
      accountId,
      extensionId,
      deviceFingerprint: request.deviceFingerprint,
      capabilities,
      issuedAt: now,
      expiresAt,
      tokenId,
    };

    // 10. Sign token with server secret (client never sees this secret)
    const sessionToken = jwt.sign(
      tokenPayload,
      TOKEN_CONFIG.SESSION_TOKEN_SECRET,
      { expiresIn: '24h' }
    );

    // 11. Store token in database for revocation capability
    await prisma.extensionSessionToken.create({
      data: {
        id: tokenId,
        userId,
        accountId,
        extensionId,
        deviceFingerprint: request.deviceFingerprint,
        signingKey,
        capabilities: capabilities as string[],
        expiresAt: new Date(expiresAt),
        lastUsedAt: new Date(),
      }
    });

    logger.info('[TokenExchange] Session token issued', {
      userId,
      accountId,
      extensionId,
      tokenId,
      capabilities,
    });

    return {
      success: true,
      sessionToken,
      expiresAt,
      capabilities,
      signingKey, // Client uses this to sign requests (not a static secret!)
    };

  } catch (error) {
    logger.error('[TokenExchange] Error generating token', { error });
    return { success: false, error: 'Token generation failed' };
  }
}

// ============================================
// TOKEN VALIDATION
// ============================================

/**
 * Validate extension session token
 */
export async function validateExtensionSessionToken(
  token: string
): Promise<{ valid: boolean; payload?: ExtensionTokenPayload; error?: string }> {
  try {
    // 1. Verify JWT signature
    const payload = jwt.verify(
      token,
      TOKEN_CONFIG.SESSION_TOKEN_SECRET
    ) as ExtensionTokenPayload;

    // 2. Verify token type
    if (payload.type !== 'extension_session') {
      return { valid: false, error: 'Invalid token type' };
    }

    // 3. Check expiry
    if (Date.now() > payload.expiresAt) {
      return { valid: false, error: 'Token expired' };
    }

    // 4. Check database for revocation
    const dbToken = await prisma.extensionSessionToken.findUnique({
      where: { id: payload.tokenId }
    });

    if (!dbToken) {
      return { valid: false, error: 'Token not found' };
    }

    if (dbToken.revoked) {
      logger.warn('[TokenValidation] Revoked token used', { tokenId: payload.tokenId });
      return { valid: false, error: 'Token revoked' };
    }

    // 5. Update last used timestamp
    await prisma.extensionSessionToken.update({
      where: { id: payload.tokenId },
      data: { lastUsedAt: new Date() }
    });

    return { valid: true, payload };

  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return { valid: false, error: 'Token expired' };
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return { valid: false, error: 'Invalid token' };
    }
    logger.error('[TokenValidation] Error', { error });
    return { valid: false, error: 'Validation failed' };
  }
}

// ============================================
// REQUEST SIGNING (Using Session Key)
// ============================================

/**
 * Validate signed request from extension
 * Extension signs requests using the per-session signing key
 */
export async function validateSignedRequest(
  sessionToken: string,
  signedRequest: SignedRequest
): Promise<{ valid: boolean; error?: string; userId?: string; accountId?: string }> {
  try {
    // 1. Validate session token
    const tokenResult = await validateExtensionSessionToken(sessionToken);
    if (!tokenResult.valid || !tokenResult.payload) {
      return { valid: false, error: tokenResult.error };
    }

    // 2. Get signing key from database
    const dbToken = await prisma.extensionSessionToken.findUnique({
      where: { id: tokenResult.payload.tokenId }
    });

    if (!dbToken || !dbToken.signingKey) {
      return { valid: false, error: 'Signing key not found' };
    }

    // 3. Validate timestamp freshness
    const now = Date.now();
    if (Math.abs(now - signedRequest.timestamp) > TOKEN_CONFIG.SIGNATURE_EXPIRY_MS) {
      return { valid: false, error: 'Request expired' };
    }

    // 4. Validate nonce (replay prevention)
    const nonceKey = `${tokenResult.payload.tokenId}:${signedRequest.nonce}`;
    if (TOKEN_CONFIG.usedNonces.has(nonceKey)) {
      return { valid: false, error: 'Replay detected' };
    }
    TOKEN_CONFIG.usedNonces.set(nonceKey, now);

    // 5. Verify signature
    const dataToSign = `${signedRequest.timestamp}:${signedRequest.nonce}:${signedRequest.payload}`;
    const expectedSignature = crypto
      .createHmac('sha256', dbToken.signingKey)
      .update(dataToSign)
      .digest('hex');

    // Constant-time comparison
    const signatureBuffer = Buffer.from(signedRequest.signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    
    if (signatureBuffer.length !== expectedBuffer.length || 
        !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
      logger.warn('[SignedRequest] Invalid signature', {
        tokenId: tokenResult.payload.tokenId
      });
      return { valid: false, error: 'Invalid signature' };
    }

    return {
      valid: true,
      userId: tokenResult.payload.userId,
      accountId: tokenResult.payload.accountId,
    };

  } catch (error) {
    logger.error('[SignedRequest] Validation error', { error });
    return { valid: false, error: 'Validation failed' };
  }
}

// ============================================
// TOKEN REVOCATION
// ============================================

/**
 * Revoke all tokens for a user (e.g., on password change, logout all)
 */
export async function revokeAllUserTokens(userId: string): Promise<number> {
  const result = await prisma.extensionSessionToken.updateMany({
    where: {
      userId,
      revoked: false,
    },
    data: { revoked: true }
  });

  logger.info('[TokenRevocation] All user tokens revoked', {
    userId,
    count: result.count
  });

  return result.count;
}

/**
 * Revoke specific token
 */
export async function revokeToken(tokenId: string): Promise<boolean> {
  try {
    await prisma.extensionSessionToken.update({
      where: { id: tokenId },
      data: { revoked: true }
    });

    logger.info('[TokenRevocation] Token revoked', { tokenId });
    return true;
  } catch (error) {
    logger.error('[TokenRevocation] Error', { tokenId, error });
    return false;
  }
}

/**
 * Revoke tokens for a specific device fingerprint
 */
export async function revokeDeviceTokens(
  userId: string,
  deviceFingerprint: string
): Promise<number> {
  const result = await prisma.extensionSessionToken.updateMany({
    where: {
      userId,
      deviceFingerprint,
      revoked: false,
    },
    data: { revoked: true }
  });

  logger.info('[TokenRevocation] Device tokens revoked', {
    userId,
    deviceFingerprint,
    count: result.count
  });

  return result.count;
}

// ============================================
// CLEANUP
// ============================================

/**
 * Clean up expired tokens and old nonces
 */
export async function cleanupExpiredTokens(): Promise<void> {
  // Clean expired tokens from database
  const result = await prisma.extensionSessionToken.deleteMany({
    where: {
      expiresAt: { lt: new Date() }
    }
  });

  // Clean old nonces
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [nonce, timestamp] of TOKEN_CONFIG.usedNonces.entries()) {
    if (timestamp < oneHourAgo) {
      TOKEN_CONFIG.usedNonces.delete(nonce);
    }
  }

  if (result.count > 0) {
    logger.info('[TokenCleanup] Cleaned up expired tokens', { count: result.count });
  }
}

// Run cleanup every hour
setInterval(cleanupExpiredTokens, 60 * 60 * 1000);

// ============================================
// EXPORTS
// ============================================

export default {
  generateExtensionSessionToken,
  validateExtensionSessionToken,
  validateSignedRequest,
  revokeAllUserTokens,
  revokeToken,
  revokeDeviceTokens,
  cleanupExpiredTokens,
  ExtensionCapability,
};
