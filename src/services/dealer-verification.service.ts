/**
 * ============================================
 * FaceMyDealer - Dealer Verification Service
 * ============================================
 * 
 * Handles:
 * - Dealer domain verification
 * - Dealer license upload verification
 * - Verification request management
 * - Admin approval workflow
 */

import { PrismaClient } from '@prisma/client';
// crypto reserved for future verification token generation
// import crypto from 'crypto';

const prisma = new PrismaClient();

// Known automotive dealer domain patterns
const KNOWN_DEALER_DOMAINS = [
  // Major DMS providers
  'dealertrack.com',
  'cdk.com',
  'reynoldsandreynolds.com',
  'dealer.com',
  'vauto.com',
  'dealersocket.com',
  'eleadscrm.com',
  'vinmanagersolutions.com',
  
  // Common dealer email patterns
  // Will match: *@[dealername].com where dealername contains auto, motors, cars, etc.
];

const DEALER_KEYWORDS = [
  'auto', 'motor', 'car', 'vehicle', 'dealership', 'dealer', 
  'automotive', 'ford', 'chevy', 'chevrolet', 'honda', 'toyota',
  'nissan', 'dodge', 'jeep', 'ram', 'chrysler', 'bmw', 'mercedes',
  'audi', 'volkswagen', 'kia', 'hyundai', 'mazda', 'subaru',
  'lexus', 'acura', 'infiniti', 'cadillac', 'buick', 'gmc'
];

interface CreateVerificationParams {
  email: string;
  companyName: string;
  companyDomain?: string;
  verificationType: 'domain' | 'license' | 'ticket';
  dealerLicenseUrl?: string;
  dealerLicenseNumber?: string;
}

interface VerificationResult {
  verified: boolean;
  confidence: number; // 0-100
  method: string;
  details?: string;
}

/**
 * Check if email domain appears to be a dealer domain
 */
export function checkDealerDomain(email: string): VerificationResult {
  const domain = email.split('@')[1]?.toLowerCase();
  
  if (!domain) {
    return { verified: false, confidence: 0, method: 'domain', details: 'Invalid email' };
  }

  // Check known dealer domains
  if (KNOWN_DEALER_DOMAINS.some(d => domain.includes(d))) {
    return { 
      verified: true, 
      confidence: 95, 
      method: 'domain',
      details: 'Known automotive industry domain'
    };
  }

  // Check for dealer keywords in domain
  const keywordMatches = DEALER_KEYWORDS.filter(k => domain.includes(k));
  if (keywordMatches.length > 0) {
    const confidence = Math.min(70 + (keywordMatches.length * 10), 90);
    return {
      verified: true,
      confidence,
      method: 'domain',
      details: `Domain contains dealer keywords: ${keywordMatches.join(', ')}`
    };
  }

  // Not a recognizable dealer domain - requires manual verification
  return {
    verified: false,
    confidence: 0,
    method: 'domain',
    details: 'Domain not recognized as automotive dealer'
  };
}

/**
 * Create a new dealer verification request
 */
export async function createVerificationRequest(params: CreateVerificationParams): Promise<any> {
  const {
    email,
    companyName,
    companyDomain,
    verificationType,
    dealerLicenseUrl,
    dealerLicenseNumber
  } = params;

  // Check for existing pending request
  const existing = await prisma.dealerVerificationRequest.findFirst({
    where: {
      email: email.toLowerCase(),
      status: 'pending'
    }
  });

  if (existing) {
    return existing;
  }

  // Auto-verify if domain check passes with high confidence
  let status = 'pending';
  if (verificationType === 'domain') {
    const domainCheck = checkDealerDomain(email);
    if (domainCheck.verified && domainCheck.confidence >= 90) {
      status = 'approved';
    }
  }

  const request = await prisma.dealerVerificationRequest.create({
    data: {
      email: email.toLowerCase(),
      companyName,
      companyDomain,
      verificationType,
      dealerLicenseUrl,
      dealerLicenseNumber,
      status,
      ...(status === 'approved' && { 
        reviewedAt: new Date(),
        reviewNotes: 'Auto-approved via domain verification'
      })
    }
  });

  return request;
}

/**
 * Review a verification request (admin action)
 */
export async function reviewVerificationRequest(
  requestId: string,
  approved: boolean,
  reviewerId: string,
  notes?: string,
  rejectionReason?: string
): Promise<any> {
  return prisma.dealerVerificationRequest.update({
    where: { id: requestId },
    data: {
      status: approved ? 'approved' : 'rejected',
      reviewedAt: new Date(),
      reviewedByUserId: reviewerId,
      reviewNotes: notes,
      rejectionReason: approved ? null : rejectionReason
    }
  });
}

/**
 * Get pending verification requests (for admin)
 */
export async function getPendingVerifications(limit: number = 50): Promise<any[]> {
  return prisma.dealerVerificationRequest.findMany({
    where: { status: 'pending' },
    orderBy: { createdAt: 'asc' },
    take: limit
  });
}

/**
 * Get all verification requests with filters
 */
export async function getVerificationRequests(filters?: {
  status?: string;
  email?: string;
  verificationType?: string;
  limit?: number;
  offset?: number;
}): Promise<any[]> {
  const { status, email, verificationType, limit = 50, offset = 0 } = filters || {};

  return prisma.dealerVerificationRequest.findMany({
    where: {
      ...(status && { status }),
      ...(email && { email: { contains: email.toLowerCase() } }),
      ...(verificationType && { verificationType })
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset
  });
}

/**
 * Get verification statistics
 */
export async function getVerificationStats(): Promise<any> {
  const [total, pending, approved, rejected] = await Promise.all([
    prisma.dealerVerificationRequest.count(),
    prisma.dealerVerificationRequest.count({ where: { status: 'pending' } }),
    prisma.dealerVerificationRequest.count({ where: { status: 'approved' } }),
    prisma.dealerVerificationRequest.count({ where: { status: 'rejected' } })
  ]);

  return { total, pending, approved, rejected };
}

/**
 * Verify dealer by uploading license
 */
export async function submitLicenseVerification(
  email: string,
  companyName: string,
  licenseUrl: string,
  licenseNumber?: string
): Promise<any> {
  return createVerificationRequest({
    email,
    companyName,
    verificationType: 'license',
    dealerLicenseUrl: licenseUrl,
    dealerLicenseNumber: licenseNumber
  });
}

/**
 * Check if an email is from a verified dealer
 */
export async function isVerifiedDealer(email: string): Promise<boolean> {
  const verification = await prisma.dealerVerificationRequest.findFirst({
    where: {
      email: email.toLowerCase(),
      status: 'approved'
    }
  });

  return !!verification;
}

export default {
  checkDealerDomain,
  createVerificationRequest,
  reviewVerificationRequest,
  getPendingVerifications,
  getVerificationRequests,
  getVerificationStats,
  submitLicenseVerification,
  isVerifiedDealer
};
