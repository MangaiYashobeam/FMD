/**
 * ============================================
 * FaceMyDealer - Invitation Code Service
 * ============================================
 * 
 * Handles:
 * - Random invitation code generation
 * - Email invitations with beautiful templates
 * - Code validation during registration
 * - Dealer verification tracking
 * - Trial period management
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Configuration
const CODE_LENGTH = 8;
const CODE_EXPIRY_DAYS = 7;
const TRIAL_DAYS = 15;

// Alphanumeric charset (excluding confusing chars like 0, O, l, 1)
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

interface CreateInvitationParams {
  email: string;
  inviterType: 'admin' | 'super_admin' | 'root_admin';
  inviterId?: string;
  inviterEmail?: string;
  accountName?: string;
  companyDomain?: string;
  intendedRole?: string;
  isTrial?: boolean;
  trialDays?: number;
}

interface ValidateInvitationResult {
  valid: boolean;
  reason?: string;
  invitation?: any;
}

/**
 * Generate a cryptographically secure random invitation code
 */
function generateInvitationCode(): string {
  const randomBytes = crypto.randomBytes(CODE_LENGTH);
  let code = '';
  
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CHARSET[randomBytes[i] % CHARSET.length];
  }
  
  return code;
}

/**
 * Generate a unique invitation code (ensures no duplicates)
 */
async function generateUniqueCode(): Promise<string> {
  let code: string;
  let exists: boolean;
  let attempts = 0;
  const maxAttempts = 10;

  do {
    code = generateInvitationCode();
    const existing = await prisma.registrationInvitation.findUnique({
      where: { code }
    });
    exists = !!existing;
    attempts++;
  } while (exists && attempts < maxAttempts);

  if (attempts >= maxAttempts) {
    throw new Error('Failed to generate unique invitation code');
  }

  return code;
}

/**
 * Create a new registration invitation
 */
export async function createInvitation(params: CreateInvitationParams): Promise<any> {
  const {
    email,
    inviterType,
    inviterId,
    inviterEmail,
    accountName,
    companyDomain,
    intendedRole = 'NEW_USER',
    isTrial = true,
    trialDays = TRIAL_DAYS
  } = params;

  // Check for existing pending invitation
  const existingInvitation = await prisma.registrationInvitation.findFirst({
    where: {
      email: email.toLowerCase(),
      status: 'pending',
      expiresAt: { gt: new Date() }
    }
  });

  if (existingInvitation) {
    // Return existing invitation instead of creating new one
    return existingInvitation;
  }

  // Generate unique code
  const code = await generateUniqueCode();

  // Calculate expiry
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + CODE_EXPIRY_DAYS);

  // Create invitation
  const invitation = await prisma.registrationInvitation.create({
    data: {
      code,
      email: email.toLowerCase(),
      inviterType,
      inviterId,
      inviterEmail,
      accountName,
      companyDomain,
      intendedRole,
      isTrial,
      trialDays,
      status: 'pending',
      expiresAt
    }
  });

  return invitation;
}

/**
 * Validate an invitation code during registration
 */
export async function validateInvitationCode(code: string, email?: string): Promise<ValidateInvitationResult> {
  const invitation = await prisma.registrationInvitation.findUnique({
    where: { code: code.toUpperCase() }
  });

  if (!invitation) {
    return { valid: false, reason: 'Invalid invitation code' };
  }

  if (invitation.status === 'used') {
    return { valid: false, reason: 'This invitation code has already been used' };
  }

  if (invitation.status === 'revoked') {
    return { valid: false, reason: 'This invitation code has been revoked' };
  }

  if (invitation.status === 'expired' || invitation.expiresAt < new Date()) {
    // Update status if expired
    if (invitation.status !== 'expired') {
      await prisma.registrationInvitation.update({
        where: { id: invitation.id },
        data: { status: 'expired' }
      });
    }
    return { valid: false, reason: 'This invitation code has expired' };
  }

  // Optional: Check if email matches (if provided)
  if (email && invitation.email.toLowerCase() !== email.toLowerCase()) {
    return { 
      valid: false, 
      reason: 'This invitation code was issued for a different email address' 
    };
  }

  return { valid: true, invitation };
}

/**
 * Mark invitation as used after successful registration
 */
export async function markInvitationUsed(code: string, userId: string): Promise<void> {
  await prisma.registrationInvitation.update({
    where: { code: code.toUpperCase() },
    data: {
      status: 'used',
      usedAt: new Date(),
      usedByUserId: userId
    }
  });
}

/**
 * Revoke an invitation
 */
export async function revokeInvitation(code: string): Promise<void> {
  await prisma.registrationInvitation.update({
    where: { code: code.toUpperCase() },
    data: { status: 'revoked' }
  });
}

/**
 * Get all invitations (for admin)
 */
export async function getAllInvitations(filters?: {
  status?: string;
  email?: string;
  limit?: number;
  offset?: number;
}): Promise<any[]> {
  const { status, email, limit = 50, offset = 0 } = filters || {};

  return prisma.registrationInvitation.findMany({
    where: {
      ...(status && { status }),
      ...(email && { email: { contains: email.toLowerCase() } })
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset
  });
}

/**
 * Get invitation statistics
 */
export async function getInvitationStats(): Promise<any> {
  const [total, pending, used, expired, revoked] = await Promise.all([
    prisma.registrationInvitation.count(),
    prisma.registrationInvitation.count({ where: { status: 'pending' } }),
    prisma.registrationInvitation.count({ where: { status: 'used' } }),
    prisma.registrationInvitation.count({ where: { status: 'expired' } }),
    prisma.registrationInvitation.count({ where: { status: 'revoked' } })
  ]);

  return { total, pending, used, expired, revoked };
}

/**
 * Expire old invitations (run as cron job)
 */
export async function expireOldInvitations(): Promise<number> {
  const result = await prisma.registrationInvitation.updateMany({
    where: {
      status: 'pending',
      expiresAt: { lt: new Date() }
    },
    data: { status: 'expired' }
  });

  return result.count;
}

/**
 * Generate invitation email HTML template
 */
export function generateInvitationEmailHtml(params: {
  code: string;
  inviterEmail?: string;
  accountName?: string;
  expiresAt: Date;
  isTrial: boolean;
  trialDays: number;
  registrationUrl: string;
}): string {
  const { code, inviterEmail, accountName, expiresAt, isTrial, trialDays, registrationUrl } = params;
  
  const expiryDate = expiresAt.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're Invited to FaceMyDealer</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f7;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px 16px 0 0;">
              <img src="https://i.imgur.com/JMBfST8.png" alt="FaceMyDealer" style="height: 60px; margin-bottom: 20px;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">You're Invited! 🎉</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                ${inviterEmail ? `<strong>${inviterEmail}</strong> has invited you` : 'You have been invited'} to join 
                ${accountName ? `<strong>${accountName}</strong> on ` : ''}FaceMyDealer - the ultimate platform for automotive dealers to manage Facebook Marketplace inventory and leads.
              </p>
              
              <!-- Invitation Code Box -->
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0;">
                <p style="color: rgba(255,255,255,0.9); font-size: 14px; margin: 0 0 10px; text-transform: uppercase; letter-spacing: 2px;">Your Invitation Code</p>
                <div style="background: rgba(255,255,255,0.2); border-radius: 8px; padding: 15px 25px; display: inline-block;">
                  <span style="color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: 4px; font-family: 'Courier New', monospace;">${code}</span>
                </div>
                <p style="color: rgba(255,255,255,0.8); font-size: 13px; margin: 15px 0 0;">Valid until ${expiryDate}</p>
              </div>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${registrationUrl}?code=${code}" style="display: inline-block; background: linear-gradient(135deg, #00d2ff 0%, #3a7bd5 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 50px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 15px rgba(58, 123, 213, 0.4);">
                  Accept Invitation & Register
                </a>
              </div>
              
              ${isTrial ? `
              <!-- Trial Info -->
              <div style="background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 15px 20px; border-radius: 0 8px 8px 0; margin: 20px 0;">
                <p style="color: #1e40af; font-size: 14px; margin: 0;">
                  <strong>🎁 Free Trial:</strong> You'll get ${trialDays} days free to explore all features!
                </p>
              </div>
              ` : ''}
              
              <!-- Features List -->
              <div style="margin: 30px 0;">
                <p style="color: #333; font-size: 14px; font-weight: 600; margin: 0 0 15px;">What you'll get access to:</p>
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #555; font-size: 14px;">✅ AI-Powered Facebook Marketplace Posting</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #555; font-size: 14px;">✅ Automated Inventory Management</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #555; font-size: 14px;">✅ Lead Capture & ADF Integration</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #555; font-size: 14px;">✅ Chrome Extension for Easy Posting</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #555; font-size: 14px;">✅ Multi-User Team Management</td>
                  </tr>
                </table>
              </div>
              
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
              
              <p style="color: #6b7280; font-size: 13px; line-height: 1.5; margin: 0;">
                If you didn't expect this invitation, you can safely ignore this email. This invitation code will expire on ${expiryDate}.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px 30px; text-align: center; background: #f9fafb; border-radius: 0 0 16px 16px;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0 0 10px;">
                © ${new Date().getFullYear()} FaceMyDealer. All rights reserved.
              </p>
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                Questions? Contact us at support@facemydealer.com
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generate plain text version of invitation email
 */
export function generateInvitationEmailText(params: {
  code: string;
  inviterEmail?: string;
  accountName?: string;
  expiresAt: Date;
  isTrial: boolean;
  trialDays: number;
  registrationUrl: string;
}): string {
  const { code, inviterEmail, accountName, expiresAt, isTrial, trialDays, registrationUrl } = params;
  
  return `
You're Invited to FaceMyDealer!

${inviterEmail ? `${inviterEmail} has invited you` : 'You have been invited'} to join ${accountName ? `${accountName} on ` : ''}FaceMyDealer - the ultimate platform for automotive dealers.

YOUR INVITATION CODE: ${code}

Register here: ${registrationUrl}?code=${code}

${isTrial ? `FREE TRIAL: You'll get ${trialDays} days free!` : ''}

What you'll get:
- AI-Powered Facebook Marketplace Posting
- Automated Inventory Management
- Lead Capture & ADF Integration
- Chrome Extension for Easy Posting
- Multi-User Team Management

This code expires on ${expiresAt.toLocaleDateString()}.

Questions? Contact support@facemydealer.com

© ${new Date().getFullYear()} FaceMyDealer
  `.trim();
}

export default {
  createInvitation,
  validateInvitationCode,
  markInvitationUsed,
  revokeInvitation,
  getAllInvitations,
  getInvitationStats,
  expireOldInvitations,
  generateInvitationEmailHtml,
  generateInvitationEmailText,
  generateInvitationCode
};
