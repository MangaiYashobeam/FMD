/**
 * DKIM (DomainKeys Identified Mail) Service
 * Signs outgoing emails for authentication and deliverability
 * 
 * @module DKIMService
 * @author DealersFace
 */

import * as crypto from 'crypto';
import { logger } from '@/utils/logger';
import prisma from '@/config/database';

// DKIM Configuration
const DKIM_CONFIG = {
  defaultSelector: process.env.DKIM_SELECTOR || 'mail',
  keyLength: 2048,
  algorithm: 'rsa-sha256' as const,
  canonicalization: 'relaxed/relaxed' as const,
};

// Headers to sign (order matters for consistency)
const HEADERS_TO_SIGN = [
  'from',
  'to',
  'subject',
  'date',
  'message-id',
  'content-type',
  'mime-version',
];

interface DKIMKeyPair {
  privateKey: string;
  publicKey: string;
  dnsRecord: string;
}

/**
 * DKIM Service for email signing
 */
export class DKIMService {
  private keyCache: Map<string, { privateKey: string; selector: string }> = new Map();

  constructor() {
    // Pre-load keys on startup
    this.loadDomainKeys().catch(err => {
      logger.warn('Failed to pre-load DKIM keys:', err.message);
    });
  }

  /**
   * Load DKIM keys for all active domains
   */
  private async loadDomainKeys(): Promise<void> {
    try {
      const domains = await prisma.emailDomain.findMany({
        where: {
          isActive: true,
          dkimEnabled: true,
          dkimPrivateKey: { not: null },
        },
        select: {
          domain: true,
          dkimSelector: true,
          dkimPrivateKey: true,
        },
      });

      for (const domain of domains) {
        if (domain.dkimPrivateKey) {
          this.keyCache.set(domain.domain, {
            privateKey: domain.dkimPrivateKey,
            selector: domain.dkimSelector,
          });
        }
      }

      logger.info(`📝 Loaded DKIM keys for ${domains.length} domain(s)`);
    } catch (error) {
      logger.warn('Could not load DKIM keys:', error);
    }
  }

  /**
   * Generate DKIM key pair for a domain
   */
  async generateKeyPair(_domain: string): Promise<DKIMKeyPair> {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: DKIM_CONFIG.keyLength,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    // Extract the base64 part of the public key for DNS record
    const publicKeyBase64 = publicKey
      .replace('-----BEGIN PUBLIC KEY-----', '')
      .replace('-----END PUBLIC KEY-----', '')
      .replace(/\s/g, '');

    // Generate DNS TXT record value
    const dnsRecord = `v=DKIM1; k=rsa; p=${publicKeyBase64}`;

    return {
      privateKey,
      publicKey,
      dnsRecord,
    };
  }

  /**
   * Setup DKIM for a domain
   */
  async setupDomain(domain: string): Promise<{
    selector: string;
    dnsRecord: string;
    spfRecord: string;
    dmarcRecord: string;
  }> {
    const { privateKey, publicKey, dnsRecord } = await this.generateKeyPair(domain);
    const selector = DKIM_CONFIG.defaultSelector;

    // Generate recommended SPF record
    const spfRecord = `v=spf1 a mx ip4:YOUR_SERVER_IP include:_spf.${domain} -all`;

    // Generate recommended DMARC record
    const dmarcRecord = `v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@${domain}; ruf=mailto:dmarc-forensic@${domain}; fo=1; adkim=r; aspf=r; pct=100`;

    // Store in database
    await prisma.emailDomain.upsert({
      where: { domain },
      update: {
        dkimSelector: selector,
        dkimPrivateKey: privateKey,
        dkimPublicKey: publicKey,
        dkimRecord: dnsRecord,
        spfRecord,
        dmarcRecord,
        dkimEnabled: true,
      },
      create: {
        domain,
        dkimSelector: selector,
        dkimPrivateKey: privateKey,
        dkimPublicKey: publicKey,
        dkimRecord: dnsRecord,
        spfRecord,
        dmarcRecord,
        dkimEnabled: true,
      },
    });

    // Update cache
    this.keyCache.set(domain, { privateKey, selector });

    logger.info(`✅ DKIM configured for domain: ${domain}`);

    return {
      selector,
      dnsRecord,
      spfRecord,
      dmarcRecord,
    };
  }

  /**
   * Sign an email with DKIM
   */
  async signEmail(rawEmail: string, domain: string): Promise<string> {
    try {
      // Get key for domain
      let keyData = this.keyCache.get(domain);

      if (!keyData) {
        // Try to load from database
        const domainRecord = await prisma.emailDomain.findUnique({
          where: { domain },
          select: {
            dkimPrivateKey: true,
            dkimSelector: true,
            dkimEnabled: true,
          },
        });

        if (domainRecord?.dkimEnabled && domainRecord.dkimPrivateKey) {
          keyData = {
            privateKey: domainRecord.dkimPrivateKey,
            selector: domainRecord.dkimSelector,
          };
          this.keyCache.set(domain, keyData);
        }
      }

      if (!keyData) {
        // No DKIM key configured - return email without signature
        logger.debug(`No DKIM key for domain ${domain}, skipping signature`);
        return rawEmail;
      }

      // Parse email headers and body
      const { headers, body } = this.parseEmail(rawEmail);

      // Create DKIM signature header
      const signatureHeader = this.createSignature(
        headers,
        body,
        domain,
        keyData.selector,
        keyData.privateKey
      );

      // Prepend DKIM-Signature to email
      return signatureHeader + '\r\n' + rawEmail;

    } catch (error) {
      logger.error('DKIM signing failed:', error);
      // Return unsigned email rather than failing
      return rawEmail;
    }
  }

  /**
   * Parse email into headers and body
   */
  private parseEmail(rawEmail: string): {
    headers: Map<string, string>;
    body: string;
  } {
    // Find header/body separator
    const separatorIndex = rawEmail.indexOf('\r\n\r\n');
    const headerSection = separatorIndex > 0 ? rawEmail.substring(0, separatorIndex) : rawEmail;
    const body = separatorIndex > 0 ? rawEmail.substring(separatorIndex + 4) : '';

    // Parse headers
    const headers = new Map<string, string>();
    const lines = headerSection.split('\r\n');
    let currentHeader = '';
    let currentValue = '';

    for (const line of lines) {
      if (line.match(/^\s/)) {
        // Continuation of previous header (folded)
        currentValue += line;
      } else {
        // New header
        if (currentHeader) {
          headers.set(currentHeader.toLowerCase(), currentValue);
        }
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          currentHeader = line.substring(0, colonIndex);
          currentValue = line.substring(colonIndex + 1).trim();
        }
      }
    }

    // Don't forget the last header
    if (currentHeader) {
      headers.set(currentHeader.toLowerCase(), currentValue);
    }

    return { headers, body };
  }

  /**
   * Create DKIM signature
   */
  private createSignature(
    headers: Map<string, string>,
    body: string,
    domain: string,
    selector: string,
    privateKey: string
  ): string {
    // Canonicalize body (relaxed)
    const canonicalBody = this.canonicalizeBody(body);

    // Calculate body hash
    const bodyHash = crypto
      .createHash('sha256')
      .update(canonicalBody)
      .digest('base64');

    // Determine which headers to sign
    const signedHeaders: string[] = [];
    const canonicalHeaders: string[] = [];

    for (const headerName of HEADERS_TO_SIGN) {
      if (headers.has(headerName)) {
        signedHeaders.push(headerName);
        const canonicalHeader = this.canonicalizeHeader(headerName, headers.get(headerName)!);
        canonicalHeaders.push(canonicalHeader);
      }
    }

    // Build DKIM-Signature header (without b= value initially)
    const timestamp = Math.floor(Date.now() / 1000);
    const expiration = timestamp + (7 * 24 * 60 * 60); // 7 days

    const dkimParams = [
      `v=1`,
      `a=${DKIM_CONFIG.algorithm}`,
      `c=${DKIM_CONFIG.canonicalization}`,
      `d=${domain}`,
      `s=${selector}`,
      `t=${timestamp}`,
      `x=${expiration}`,
      `bh=${bodyHash}`,
      `h=${signedHeaders.join(':')}`,
      `b=`,
    ];

    const dkimHeaderValue = dkimParams.join('; ');

    // Add DKIM-Signature to headers for signing
    const canonicalDkimHeader = this.canonicalizeHeader('dkim-signature', dkimHeaderValue);
    canonicalHeaders.push(canonicalDkimHeader);

    // Create signature input
    const signatureInput = canonicalHeaders.join('\r\n');

    // Sign with RSA-SHA256
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signatureInput);
    const signature = signer.sign(privateKey, 'base64');

    // Format signature with line wrapping
    const wrappedSignature = this.wrapBase64(signature);

    // Build final DKIM-Signature header
    return `DKIM-Signature: ${dkimParams.slice(0, -1).join('; ')}; b=${wrappedSignature}`;
  }

  /**
   * Canonicalize header (relaxed)
   */
  private canonicalizeHeader(name: string, value: string): string {
    // Lowercase header name
    const canonicalName = name.toLowerCase();

    // Unfold header, compress whitespace
    let canonicalValue = value
      .replace(/\r?\n/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return `${canonicalName}:${canonicalValue}`;
  }

  /**
   * Canonicalize body (relaxed)
   */
  private canonicalizeBody(body: string): string {
    if (!body) {
      return '\r\n';
    }

    // Split into lines
    let lines = body.split(/\r?\n/);

    // Process each line
    lines = lines.map(line => {
      // Replace sequence of whitespace with single space
      line = line.replace(/[\t ]+/g, ' ');
      // Remove trailing whitespace
      line = line.replace(/[\t ]+$/, '');
      return line;
    });

    // Remove trailing empty lines
    while (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }

    // Join with CRLF and add trailing CRLF
    return lines.join('\r\n') + '\r\n';
  }

  /**
   * Wrap base64 string for header
   */
  private wrapBase64(base64: string, lineLength: number = 64): string {
    const lines: string[] = [];
    for (let i = 0; i < base64.length; i += lineLength) {
      lines.push(base64.substring(i, i + lineLength));
    }
    return lines.join('\r\n\t');
  }

  /**
   * Verify DKIM configuration for a domain
   */
  async verifyDomain(domain: string): Promise<{
    dkimConfigured: boolean;
    dkimDnsVerified: boolean;
    spfConfigured: boolean;
    dmarcConfigured: boolean;
    recommendations: string[];
  }> {
    const recommendations: string[] = [];
    let dkimConfigured = false;
    let dkimDnsVerified = false;
    let spfConfigured = false;
    let dmarcConfigured = false;

    const domainRecord = await prisma.emailDomain.findUnique({
      where: { domain },
    });

    if (!domainRecord) {
      recommendations.push('Domain not configured. Run setupDomain() first.');
      return { dkimConfigured, dkimDnsVerified, spfConfigured, dmarcConfigured, recommendations };
    }

    dkimConfigured = !!(domainRecord.dkimPrivateKey && domainRecord.dkimEnabled);

    if (!dkimConfigured) {
      recommendations.push('Generate and enable DKIM keys for this domain.');
    }

    // Note: In production, you would verify DNS records via DNS lookup
    // For now, we'll use the stored verification status
    dkimDnsVerified = domainRecord.dkimVerified;
    spfConfigured = domainRecord.spfVerified;
    dmarcConfigured = domainRecord.dmarcVerified;

    if (!dkimDnsVerified) {
      recommendations.push(
        `Add DKIM DNS record:\n  Name: ${domainRecord.dkimSelector}._domainkey.${domain}\n  Type: TXT\n  Value: ${domainRecord.dkimRecord}`
      );
    }

    if (!spfConfigured) {
      recommendations.push(
        `Add SPF DNS record:\n  Name: ${domain}\n  Type: TXT\n  Value: ${domainRecord.spfRecord}`
      );
    }

    if (!dmarcConfigured) {
      recommendations.push(
        `Add DMARC DNS record:\n  Name: _dmarc.${domain}\n  Type: TXT\n  Value: ${domainRecord.dmarcRecord}`
      );
    }

    return {
      dkimConfigured,
      dkimDnsVerified,
      spfConfigured,
      dmarcConfigured,
      recommendations,
    };
  }

  /**
   * Get DNS records needed for a domain
   */
  async getDnsRecords(domain: string): Promise<{
    dkim: { name: string; type: string; value: string } | null;
    spf: { name: string; type: string; value: string } | null;
    dmarc: { name: string; type: string; value: string } | null;
  }> {
    const domainRecord = await prisma.emailDomain.findUnique({
      where: { domain },
    });

    if (!domainRecord) {
      return { dkim: null, spf: null, dmarc: null };
    }

    return {
      dkim: domainRecord.dkimRecord ? {
        name: `${domainRecord.dkimSelector}._domainkey.${domain}`,
        type: 'TXT',
        value: domainRecord.dkimRecord,
      } : null,
      spf: domainRecord.spfRecord ? {
        name: domain,
        type: 'TXT',
        value: domainRecord.spfRecord,
      } : null,
      dmarc: domainRecord.dmarcRecord ? {
        name: `_dmarc.${domain}`,
        type: 'TXT',
        value: domainRecord.dmarcRecord,
      } : null,
    };
  }

  /**
   * Clear cached key for domain (after key rotation)
   */
  clearCache(domain?: string): void {
    if (domain) {
      this.keyCache.delete(domain);
    } else {
      this.keyCache.clear();
    }
  }
}

// Export singleton
export const dkimService = new DKIMService();
