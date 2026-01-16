/**
 * Mail Transfer Agent (MTA) Service
 * Supports multiple delivery methods:
 * - Amazon SES (recommended for cloud deployments)
 * - Local MTA (Postfix/Sendmail)
 * - Direct MX delivery
 * 
 * @module MTAService
 * @author DealersFace
 */

import * as net from 'net';
import * as tls from 'tls';
import * as dns from 'dns';
import { promisify } from 'util';
import { randomBytes } from 'crypto';
import { logger } from '@/utils/logger';
import prisma from '@/config/database';
import { DKIMService } from './dkim.service';

const dnsResolveMx = promisify(dns.resolveMx);
const dnsResolve4 = promisify(dns.resolve4);

// Delivery Method Types
type DeliveryMethod = 'ses' | 'smtp' | 'local' | 'direct';

// MTA Configuration
const MTA_CONFIG = {
  // Delivery Method: 'ses' | 'smtp' | 'local' | 'direct'
  deliveryMethod: (process.env.MTA_DELIVERY_METHOD || 'ses') as DeliveryMethod,
  
  // Amazon SES Settings
  ses: {
    host: process.env.SES_SMTP_HOST || 'email-smtp.us-east-1.amazonaws.com',
    port: parseInt(process.env.SES_SMTP_PORT || '587'),
    user: process.env.SES_SMTP_USER || '',
    pass: process.env.SES_SMTP_PASS || '',
    region: process.env.SES_REGION || 'us-east-1',
  },
  
  // Generic SMTP Relay Settings
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587'),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    secure: process.env.SMTP_SECURE === 'true',
  },
  
  // Local MTA Settings (Postfix/Sendmail)
  localMtaHost: process.env.LOCAL_MTA_HOST || 'localhost',
  localMtaPort: parseInt(process.env.LOCAL_MTA_PORT || '25'),
  useTls: process.env.MTA_USE_TLS === 'true',
  
  // Direct SMTP Settings (when bypassing local MTA)
  directDelivery: process.env.MTA_DIRECT_DELIVERY === 'true',
  
  // SMTP Auth for local MTA
  authEnabled: process.env.MTA_AUTH_ENABLED === 'true',
  authUser: process.env.MTA_AUTH_USER,
  authPass: process.env.MTA_AUTH_PASS,
  
  // Timeouts (ms)
  connectionTimeout: 30000,
  socketTimeout: 60000,
  
  // Retry Configuration
  maxRetries: 3,
  retryDelays: [60, 300, 1800], // 1min, 5min, 30min
  
  // Rate Limiting (SES has 14/sec default, 50k/day in sandbox)
  defaultHourlyLimit: 1000,
  defaultDailyLimit: 50000,
  
  // System Domain
  systemDomain: process.env.MAIL_DOMAIN || 'dealersface.com',
  heloHostname: process.env.MTA_HELO_HOSTNAME || 'mail.dealersface.com',
};

export interface MTAEmailOptions {
  from: string;
  fromName?: string;
  to: string | string[];
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  subject: string;
  html: string;
  text?: string;
  headers?: Record<string, string>;
  messageId?: string;
  trackingId?: string;
}

export interface MTASendResult {
  success: boolean;
  messageId: string;
  mtaMessageId?: string;
  mtaResponse?: string;
  error?: string;
  shouldRetry?: boolean;
  retryAfter?: number;
}

export interface MTAStatus {
  available: boolean;
  deliveryMethod: DeliveryMethod;
  host: string;
  port: number;
  tlsEnabled: boolean;
  directDelivery: boolean;
  lastCheck: Date;
  error?: string;
}

/**
 * Mail Transfer Agent Service
 * Handles email delivery via SES, SMTP relay, local MTA, or direct MX
 */
export class MTAService {
  private dkimService: DKIMService;
  private mtaStatus: MTAStatus;

  constructor() {
    this.dkimService = new DKIMService();
    this.mtaStatus = {
      available: false,
      deliveryMethod: MTA_CONFIG.deliveryMethod,
      host: this.getConfiguredHost(),
      port: this.getConfiguredPort(),
      tlsEnabled: MTA_CONFIG.useTls,
      directDelivery: MTA_CONFIG.directDelivery,
      lastCheck: new Date(),
    };
    
    // Check MTA on startup
    this.checkMTAAvailability().catch(err => {
      logger.warn('MTA availability check failed on startup:', err.message);
    });
  }

  /**
   * Get the configured SMTP host based on delivery method
   */
  private getConfiguredHost(): string {
    switch (MTA_CONFIG.deliveryMethod) {
      case 'ses': return MTA_CONFIG.ses.host;
      case 'smtp': return MTA_CONFIG.smtp.host;
      case 'local': return MTA_CONFIG.localMtaHost;
      case 'direct': return 'direct-mx';
      default: return MTA_CONFIG.ses.host;
    }
  }

  /**
   * Get the configured SMTP port based on delivery method
   */
  private getConfiguredPort(): number {
    switch (MTA_CONFIG.deliveryMethod) {
      case 'ses': return MTA_CONFIG.ses.port;
      case 'smtp': return MTA_CONFIG.smtp.port;
      case 'local': return MTA_CONFIG.localMtaPort;
      case 'direct': return 25;
      default: return MTA_CONFIG.ses.port;
    }
  }

  /**
   * Check if the configured mail service is available
   */
  async checkMTAAvailability(): Promise<MTAStatus> {
    try {
      const host = this.getConfiguredHost();
      const port = this.getConfiguredPort();
      
      // For direct delivery, just mark as available
      if (MTA_CONFIG.deliveryMethod === 'direct') {
        this.mtaStatus = {
          available: true,
          deliveryMethod: 'direct',
          host: 'direct-mx',
          port: 25,
          tlsEnabled: true,
          directDelivery: true,
          lastCheck: new Date(),
        };
        logger.info('✅ Direct MX delivery mode enabled');
        return this.mtaStatus;
      }
      
      const socket = await this.createConnection(host, port, 5000);
      
      // Read greeting
      const greeting = await this.readLine(socket);
      
      if (!greeting.startsWith('220')) {
        throw new Error(`Unexpected greeting: ${greeting}`);
      }
      
      // Send QUIT
      await this.sendCommand(socket, 'QUIT');
      socket.destroy();
      
      this.mtaStatus = {
        available: true,
        deliveryMethod: MTA_CONFIG.deliveryMethod,
        host,
        port,
        tlsEnabled: MTA_CONFIG.deliveryMethod === 'ses' || MTA_CONFIG.smtp.secure,
        directDelivery: MTA_CONFIG.directDelivery,
        lastCheck: new Date(),
      };
      
      logger.info(`✅ ${MTA_CONFIG.deliveryMethod.toUpperCase()} available at ${host}:${port}`);
      
    } catch (error: any) {
      this.mtaStatus = {
        available: false,
        deliveryMethod: MTA_CONFIG.deliveryMethod,
        host: this.getConfiguredHost(),
        port: this.getConfiguredPort(),
        tlsEnabled: MTA_CONFIG.useTls,
        directDelivery: MTA_CONFIG.directDelivery,
        lastCheck: new Date(),
        error: error.message,
      };
      
      logger.warn(`❌ ${MTA_CONFIG.deliveryMethod.toUpperCase()} not available: ${error.message}`);
    }
    
    return this.mtaStatus;
  }

  /**
   * Get MTA status
   */
  getStatus(): MTAStatus {
    return this.mtaStatus;
  }

  /**
   * Send email via local MTA
   */
  async sendEmail(options: MTAEmailOptions): Promise<MTASendResult> {
    const messageId = options.messageId || this.generateMessageId();
    const trackingId = options.trackingId || this.generateTrackingId();
    
    try {
      // Check suppression list
      const recipients = this.normalizeRecipients(options.to);
      const suppressedEmails = await this.checkSuppressionList(recipients);
      
      if (suppressedEmails.length > 0) {
        logger.warn(`Skipping suppressed emails: ${suppressedEmails.join(', ')}`);
        const activeRecipients = recipients.filter(r => !suppressedEmails.includes(r));
        if (activeRecipients.length === 0) {
          return {
            success: false,
            messageId,
            error: 'All recipients are suppressed',
            shouldRetry: false,
          };
        }
        options.to = activeRecipients;
      }
      
      // Check rate limits
      const domain = this.extractDomain(options.from);
      const rateLimitOk = await this.checkRateLimit(domain);
      
      if (!rateLimitOk) {
        return {
          success: false,
          messageId,
          error: 'Rate limit exceeded',
          shouldRetry: true,
          retryAfter: 3600, // 1 hour
        };
      }
      
      // Build email message with DKIM signing
      const rawEmail = await this.buildEmailMessage(options, messageId, trackingId);
      
      // Send via appropriate method based on delivery method configuration
      let result: MTASendResult;
      
      switch (MTA_CONFIG.deliveryMethod) {
        case 'ses':
          result = await this.sendViaSES(options.from, options.to, rawEmail, messageId);
          break;
        case 'smtp':
          result = await this.sendViaSMTPRelay(options.from, options.to, rawEmail, messageId);
          break;
        case 'direct':
          result = await this.sendDirectToMX(options.from, options.to, rawEmail, messageId);
          break;
        case 'local':
        default:
          result = await this.sendViaLocalMTA(options.from, options.to, rawEmail, messageId);
          break;
      }
      
      // Update rate limit counters
      if (result.success) {
        await this.incrementRateLimitCounters(domain);
      }
      
      return result;
      
    } catch (error: any) {
      logger.error('MTA send error:', error);
      
      return {
        success: false,
        messageId,
        error: error.message,
        shouldRetry: this.isRetryableError(error),
        retryAfter: MTA_CONFIG.retryDelays[0],
      };
    }
  }

  /**
   * Send email via Amazon SES SMTP
   * Recommended for cloud deployments - excellent deliverability and analytics
   */
  private async sendViaSES(
    from: string,
    to: string | string[],
    rawEmail: string,
    messageId: string
  ): Promise<MTASendResult> {
    const { host, port, user, pass } = MTA_CONFIG.ses;
    
    if (!user || !pass) {
      return {
        success: false,
        messageId,
        error: 'SES credentials not configured (SES_SMTP_USER, SES_SMTP_PASS)',
        shouldRetry: false,
      };
    }
    
    const socket = await this.createConnection(host, port, MTA_CONFIG.connectionTimeout);
    
    try {
      // Read greeting
      const greeting = await this.readLine(socket);
      if (!greeting.startsWith('220')) {
        throw new Error(`SES greeting error: ${greeting}`);
      }
      
      // EHLO
      const ehloResponse = await this.sendCommand(socket, `EHLO ${MTA_CONFIG.heloHostname}`);
      const capabilities = this.parseEhloCapabilities(ehloResponse);
      
      // STARTTLS (required for SES)
      if (capabilities.includes('STARTTLS')) {
        const tlsResponse = await this.sendCommand(socket, 'STARTTLS');
        if (tlsResponse.startsWith('220')) {
          const tlsSocket = await this.upgradeToTls(socket, host);
          
          // Re-EHLO after TLS
          await this.sendCommand(tlsSocket, `EHLO ${MTA_CONFIG.heloHostname}`);
          
          // Authenticate with SES credentials
          await this.authenticateSMTPWithCredentials(tlsSocket, user, pass);
          
          return this.completeSmtpTransaction(tlsSocket, from, to, rawEmail, messageId);
        }
      }
      
      throw new Error('SES requires STARTTLS but server does not support it');
      
    } catch (error: any) {
      logger.error('SES send error:', error.message);
      return {
        success: false,
        messageId,
        error: `SES error: ${error.message}`,
        shouldRetry: this.isRetryableError(error),
        retryAfter: MTA_CONFIG.retryDelays[0],
      };
    } finally {
      socket.destroy();
    }
  }

  /**
   * Send email via generic SMTP relay (SendGrid, Mailgun, etc.)
   */
  private async sendViaSMTPRelay(
    from: string,
    to: string | string[],
    rawEmail: string,
    messageId: string
  ): Promise<MTASendResult> {
    const { host, port, user, pass, secure } = MTA_CONFIG.smtp;
    
    if (!host || !user || !pass) {
      return {
        success: false,
        messageId,
        error: 'SMTP relay credentials not configured (SMTP_HOST, SMTP_USER, SMTP_PASS)',
        shouldRetry: false,
      };
    }
    
    const socket = await this.createConnection(host, port, MTA_CONFIG.connectionTimeout);
    
    try {
      // Read greeting
      const greeting = await this.readLine(socket);
      if (!greeting.startsWith('220')) {
        throw new Error(`SMTP greeting error: ${greeting}`);
      }
      
      // EHLO
      const ehloResponse = await this.sendCommand(socket, `EHLO ${MTA_CONFIG.heloHostname}`);
      const capabilities = this.parseEhloCapabilities(ehloResponse);
      
      // STARTTLS if not already secure connection
      if (!secure && capabilities.includes('STARTTLS')) {
        const tlsResponse = await this.sendCommand(socket, 'STARTTLS');
        if (tlsResponse.startsWith('220')) {
          const tlsSocket = await this.upgradeToTls(socket, host);
          await this.sendCommand(tlsSocket, `EHLO ${MTA_CONFIG.heloHostname}`);
          await this.authenticateSMTPWithCredentials(tlsSocket, user, pass);
          return this.completeSmtpTransaction(tlsSocket, from, to, rawEmail, messageId);
        }
      }
      
      // Direct auth if secure or no STARTTLS
      await this.authenticateSMTPWithCredentials(socket, user, pass);
      return this.completeSmtpTransaction(socket, from, to, rawEmail, messageId);
      
    } catch (error: any) {
      logger.error('SMTP relay error:', error.message);
      return {
        success: false,
        messageId,
        error: `SMTP error: ${error.message}`,
        shouldRetry: this.isRetryableError(error),
        retryAfter: MTA_CONFIG.retryDelays[0],
      };
    } finally {
      socket.destroy();
    }
  }

  /**
   * Authenticate with SMTP server using provided credentials
   */
  private async authenticateSMTPWithCredentials(
    socket: net.Socket | tls.TLSSocket,
    user: string,
    pass: string
  ): Promise<void> {
    // Use AUTH LOGIN (widely supported including SES)
    const authResponse = await this.sendCommand(socket, 'AUTH LOGIN');
    if (!authResponse.startsWith('334')) {
      throw new Error(`AUTH LOGIN not supported: ${authResponse}`);
    }
    
    // Send username (base64 encoded)
    const userResponse = await this.sendCommand(socket, Buffer.from(user).toString('base64'));
    if (!userResponse.startsWith('334')) {
      throw new Error(`Username rejected: ${userResponse}`);
    }
    
    // Send password (base64 encoded)
    const passResponse = await this.sendCommand(socket, Buffer.from(pass).toString('base64'));
    if (!passResponse.startsWith('235')) {
      throw new Error(`Authentication failed: ${passResponse}`);
    }
    
    logger.debug('SMTP authentication successful');
  }

  /**
   * Send email via local MTA (Postfix/Sendmail)
   */
  private async sendViaLocalMTA(
    from: string,
    to: string | string[],
    rawEmail: string,
    messageId: string
  ): Promise<MTASendResult> {
    const socket = await this.createConnection(
      MTA_CONFIG.localMtaHost,
      MTA_CONFIG.localMtaPort,
      MTA_CONFIG.connectionTimeout
    );
    
    try {
      // Read greeting
      const greeting = await this.readLine(socket);
      if (!greeting.startsWith('220')) {
        throw new Error(`MTA greeting error: ${greeting}`);
      }
      
      // EHLO
      const ehloResponse = await this.sendCommand(socket, `EHLO ${MTA_CONFIG.heloHostname}`);
      const capabilities = this.parseEhloCapabilities(ehloResponse);
      
      // STARTTLS if available and configured
      if (MTA_CONFIG.useTls && capabilities.includes('STARTTLS')) {
        const tlsResponse = await this.sendCommand(socket, 'STARTTLS');
        if (tlsResponse.startsWith('220')) {
          // Upgrade to TLS
          const tlsSocket = await this.upgradeToTls(socket);
          // Re-EHLO after TLS
          await this.sendCommand(tlsSocket, `EHLO ${MTA_CONFIG.heloHostname}`);
          return this.completeSmtpTransaction(tlsSocket, from, to, rawEmail, messageId);
        }
      }
      
      // AUTH if configured
      if (MTA_CONFIG.authEnabled && capabilities.includes('AUTH')) {
        await this.authenticateSMTP(socket);
      }
      
      return this.completeSmtpTransaction(socket, from, to, rawEmail, messageId);
      
    } finally {
      socket.destroy();
    }
  }

  /**
   * Send directly to recipient's MX servers (for high-volume/advanced setups)
   */
  private async sendDirectToMX(
    from: string,
    to: string | string[],
    rawEmail: string,
    messageId: string
  ): Promise<MTASendResult> {
    const recipients = this.normalizeRecipients(to);
    const results: MTASendResult[] = [];
    
    // Group recipients by domain
    const byDomain = new Map<string, string[]>();
    for (const recipient of recipients) {
      const domain = this.extractDomain(recipient);
      const existing = byDomain.get(domain) || [];
      existing.push(recipient);
      byDomain.set(domain, existing);
    }
    
    // Send to each domain's MX servers
    for (const [domain, domainRecipients] of byDomain) {
      try {
        const mxRecords = await this.getMXRecords(domain);
        
        if (mxRecords.length === 0) {
          results.push({
            success: false,
            messageId,
            error: `No MX records for domain: ${domain}`,
            shouldRetry: false,
          });
          continue;
        }
        
        // Try MX servers in priority order
        let sent = false;
        for (const mx of mxRecords) {
          try {
            const result = await this.sendToMXServer(
              mx.exchange,
              from,
              domainRecipients,
              rawEmail,
              messageId
            );
            
            if (result.success) {
              results.push(result);
              sent = true;
              break;
            }
          } catch (error: any) {
            logger.warn(`Failed to send to MX ${mx.exchange}: ${error.message}`);
          }
        }
        
        if (!sent) {
          results.push({
            success: false,
            messageId,
            error: `Failed to deliver to any MX for ${domain}`,
            shouldRetry: true,
            retryAfter: MTA_CONFIG.retryDelays[0],
          });
        }
        
      } catch (error: any) {
        results.push({
          success: false,
          messageId,
          error: `MX lookup failed for ${domain}: ${error.message}`,
          shouldRetry: true,
        });
      }
    }
    
    // Aggregate results
    const allSuccess = results.every(r => r.success);
    const anySuccess = results.some(r => r.success);
    
    return {
      success: allSuccess,
      messageId,
      mtaResponse: results.map(r => r.mtaResponse).filter(Boolean).join('; '),
      error: allSuccess ? undefined : results.filter(r => !r.success).map(r => r.error).join('; '),
      shouldRetry: !allSuccess && anySuccess,
    };
  }

  /**
   * Send to a specific MX server
   */
  private async sendToMXServer(
    mxHost: string,
    from: string,
    to: string[],
    rawEmail: string,
    messageId: string
  ): Promise<MTASendResult> {
    // Resolve MX hostname to IP
    const ips = await dnsResolve4(mxHost);
    if (ips.length === 0) {
      throw new Error(`Cannot resolve MX hostname: ${mxHost}`);
    }
    
    const socket = await this.createConnection(mxHost, 25, MTA_CONFIG.connectionTimeout);
    
    try {
      const greeting = await this.readLine(socket);
      if (!greeting.startsWith('220')) {
        throw new Error(`MX greeting error: ${greeting}`);
      }
      
      const ehloResponse = await this.sendCommand(socket, `EHLO ${MTA_CONFIG.heloHostname}`);
      const capabilities = this.parseEhloCapabilities(ehloResponse);
      
      // STARTTLS if available (most MX servers support it)
      if (capabilities.includes('STARTTLS')) {
        const tlsResponse = await this.sendCommand(socket, 'STARTTLS');
        if (tlsResponse.startsWith('220')) {
          const tlsSocket = await this.upgradeToTls(socket, mxHost);
          await this.sendCommand(tlsSocket, `EHLO ${MTA_CONFIG.heloHostname}`);
          return this.completeSmtpTransaction(tlsSocket, from, to, rawEmail, messageId);
        }
      }
      
      return this.completeSmtpTransaction(socket, from, to, rawEmail, messageId);
      
    } finally {
      socket.destroy();
    }
  }

  /**
   * Complete SMTP transaction (MAIL FROM, RCPT TO, DATA)
   */
  private async completeSmtpTransaction(
    socket: net.Socket | tls.TLSSocket,
    from: string,
    to: string | string[],
    rawEmail: string,
    messageId: string
  ): Promise<MTASendResult> {
    const recipients = this.normalizeRecipients(to);
    
    // MAIL FROM
    const mailFromResponse = await this.sendCommand(socket, `MAIL FROM:<${from}>`);
    if (!mailFromResponse.startsWith('250')) {
      throw new Error(`MAIL FROM rejected: ${mailFromResponse}`);
    }
    
    // RCPT TO for each recipient
    const acceptedRecipients: string[] = [];
    for (const recipient of recipients) {
      const rcptResponse = await this.sendCommand(socket, `RCPT TO:<${recipient}>`);
      if (rcptResponse.startsWith('250')) {
        acceptedRecipients.push(recipient);
      } else {
        logger.warn(`RCPT TO rejected for ${recipient}: ${rcptResponse}`);
      }
    }
    
    if (acceptedRecipients.length === 0) {
      throw new Error('All recipients rejected');
    }
    
    // DATA
    const dataResponse = await this.sendCommand(socket, 'DATA');
    if (!dataResponse.startsWith('354')) {
      throw new Error(`DATA command rejected: ${dataResponse}`);
    }
    
    // Send email content
    socket.write(rawEmail);
    socket.write('\r\n.\r\n');
    
    // Read final response
    const finalResponse = await this.readLine(socket);
    
    // QUIT
    await this.sendCommand(socket, 'QUIT');
    
    if (finalResponse.startsWith('250')) {
      // Extract MTA message ID if available
      const mtaMessageIdMatch = finalResponse.match(/queued as ([A-Za-z0-9]+)/i);
      const mtaMessageId = mtaMessageIdMatch ? mtaMessageIdMatch[1] : undefined;
      
      return {
        success: true,
        messageId,
        mtaMessageId,
        mtaResponse: finalResponse,
      };
    } else {
      // Check for temporary failure (4xx) vs permanent failure (5xx)
      const isTemporary = finalResponse.startsWith('4');
      
      return {
        success: false,
        messageId,
        mtaResponse: finalResponse,
        error: finalResponse,
        shouldRetry: isTemporary,
        retryAfter: isTemporary ? MTA_CONFIG.retryDelays[0] : undefined,
      };
    }
  }

  /**
   * Build complete email message with headers
   */
  private async buildEmailMessage(
    options: MTAEmailOptions,
    messageId: string,
    trackingId: string
  ): Promise<string> {
    const recipients = this.normalizeRecipients(options.to);
    const now = new Date();
    
    // Build headers
    const headers: string[] = [];
    
    // Required headers
    headers.push(`Message-ID: <${messageId}>`);
    headers.push(`Date: ${now.toUTCString()}`);
    headers.push(`From: ${options.fromName ? `"${options.fromName}" <${options.from}>` : options.from}`);
    headers.push(`To: ${recipients.join(', ')}`);
    headers.push(`Subject: ${this.encodeHeader(options.subject)}`);
    
    // Optional headers
    if (options.cc && options.cc.length > 0) {
      headers.push(`Cc: ${options.cc.join(', ')}`);
    }
    if (options.replyTo) {
      headers.push(`Reply-To: ${options.replyTo}`);
    }
    
    // Standard headers for deliverability
    headers.push('MIME-Version: 1.0');
    headers.push(`X-Mailer: DealersFace-MTA/1.0`);
    headers.push(`X-Tracking-ID: ${trackingId}`);
    
    // Custom headers
    if (options.headers) {
      for (const [key, value] of Object.entries(options.headers)) {
        headers.push(`${key}: ${value}`);
      }
    }
    
    // Build body
    const boundary = `----=_Part_${randomBytes(16).toString('hex')}`;
    let body: string;
    
    if (options.text && options.html) {
      // Multipart alternative
      headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
      
      body = [
        '',
        `--${boundary}`,
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: quoted-printable',
        '',
        this.encodeQuotedPrintable(options.text),
        '',
        `--${boundary}`,
        'Content-Type: text/html; charset=UTF-8',
        'Content-Transfer-Encoding: quoted-printable',
        '',
        this.encodeQuotedPrintable(options.html),
        '',
        `--${boundary}--`,
      ].join('\r\n');
    } else if (options.html) {
      headers.push('Content-Type: text/html; charset=UTF-8');
      headers.push('Content-Transfer-Encoding: quoted-printable');
      body = '\r\n' + this.encodeQuotedPrintable(options.html);
    } else {
      headers.push('Content-Type: text/plain; charset=UTF-8');
      headers.push('Content-Transfer-Encoding: quoted-printable');
      body = '\r\n' + this.encodeQuotedPrintable(options.text || '');
    }
    
    // Combine headers and body
    let rawEmail = headers.join('\r\n') + '\r\n' + body;
    
    // Add DKIM signature
    const domain = this.extractDomain(options.from);
    rawEmail = await this.dkimService.signEmail(rawEmail, domain);
    
    return rawEmail;
  }

  /**
   * Create TCP connection
   */
  private createConnection(
    host: string,
    port: number,
    timeout: number
  ): Promise<net.Socket> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host, port });
      
      socket.setTimeout(timeout);
      
      socket.on('connect', () => {
        socket.setTimeout(MTA_CONFIG.socketTimeout);
        resolve(socket);
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error(`Connection timeout to ${host}:${port}`));
      });
      
      socket.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Upgrade connection to TLS
   */
  private upgradeToTls(
    socket: net.Socket,
    servername?: string
  ): Promise<tls.TLSSocket> {
    return new Promise((resolve, reject) => {
      const tlsSocket = tls.connect({
        socket,
        servername: servername || MTA_CONFIG.localMtaHost,
        rejectUnauthorized: false, // Allow self-signed certs for local MTA
      });
      
      tlsSocket.on('secureConnect', () => {
        resolve(tlsSocket);
      });
      
      tlsSocket.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Read a line from socket
   */
  private readLine(socket: net.Socket | tls.TLSSocket): Promise<string> {
    return new Promise((resolve, reject) => {
      let buffer = '';
      
      const onData = (data: Buffer) => {
        buffer += data.toString();
        
        // Check for complete response (may be multiline)
        const lines = buffer.split('\r\n');
        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i];
          // Check if this is the last line of a multiline response
          // Format: "250-..." for continuation, "250 ..." for final
          if (line.length >= 4 && line[3] !== '-') {
            socket.removeListener('data', onData);
            socket.removeListener('error', onError);
            socket.removeListener('timeout', onTimeout);
            resolve(buffer.trim());
            return;
          }
        }
      };
      
      const onError = (err: Error) => {
        socket.removeListener('data', onData);
        socket.removeListener('timeout', onTimeout);
        reject(err);
      };
      
      const onTimeout = () => {
        socket.removeListener('data', onData);
        socket.removeListener('error', onError);
        reject(new Error('Socket timeout while reading'));
      };
      
      socket.on('data', onData);
      socket.once('error', onError);
      socket.once('timeout', onTimeout);
    });
  }

  /**
   * Send SMTP command and read response
   */
  private async sendCommand(
    socket: net.Socket | tls.TLSSocket,
    command: string
  ): Promise<string> {
    socket.write(command + '\r\n');
    return this.readLine(socket);
  }

  /**
   * Parse EHLO response capabilities
   */
  private parseEhloCapabilities(response: string): string[] {
    const lines = response.split('\r\n');
    const capabilities: string[] = [];
    
    for (const line of lines) {
      // Skip greeting line
      if (line.match(/^250[\s-]/)) {
        const capability = line.substring(4).trim().split(' ')[0].toUpperCase();
        if (capability) {
          capabilities.push(capability);
        }
      }
    }
    
    return capabilities;
  }

  /**
   * Authenticate with SMTP server
   */
  private async authenticateSMTP(socket: net.Socket | tls.TLSSocket): Promise<void> {
    if (!MTA_CONFIG.authUser || !MTA_CONFIG.authPass) {
      throw new Error('SMTP auth credentials not configured');
    }
    
    // AUTH PLAIN
    const authString = Buffer.from(
      `\0${MTA_CONFIG.authUser}\0${MTA_CONFIG.authPass}`
    ).toString('base64');
    
    const response = await this.sendCommand(socket, `AUTH PLAIN ${authString}`);
    
    if (!response.startsWith('235')) {
      throw new Error(`SMTP authentication failed: ${response}`);
    }
  }

  /**
   * Get MX records for domain
   */
  private async getMXRecords(domain: string): Promise<dns.MxRecord[]> {
    try {
      const records = await dnsResolveMx(domain);
      // Sort by priority (lower is higher priority)
      return records.sort((a, b) => a.priority - b.priority);
    } catch (error) {
      logger.warn(`Failed to resolve MX for ${domain}:`, error);
      return [];
    }
  }

  /**
   * Check suppression list
   */
  private async checkSuppressionList(emails: string[]): Promise<string[]> {
    const suppressions = await prisma.emailSuppression.findMany({
      where: {
        email: { in: emails.map(e => e.toLowerCase()) },
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      select: { email: true },
    });
    
    return suppressions.map(s => s.email);
  }

  /**
   * Check rate limits for domain
   */
  private async checkRateLimit(domain: string): Promise<boolean> {
    const emailDomain = await prisma.emailDomain.findUnique({
      where: { domain },
    });
    
    if (!emailDomain) {
      // Use defaults
      return true;
    }
    
    const now = new Date();
    
    // Reset counters if needed
    if (emailDomain.hourResetAt && now > emailDomain.hourResetAt) {
      await prisma.emailDomain.update({
        where: { domain },
        data: {
          currentHourCount: 0,
          hourResetAt: new Date(now.getTime() + 3600000),
        },
      });
      return true;
    }
    
    if (emailDomain.dayResetAt && now > emailDomain.dayResetAt) {
      await prisma.emailDomain.update({
        where: { domain },
        data: {
          currentDayCount: 0,
          dayResetAt: new Date(now.getTime() + 86400000),
        },
      });
      return true;
    }
    
    // Check limits
    if (emailDomain.currentHourCount >= emailDomain.hourlyLimit) {
      return false;
    }
    if (emailDomain.currentDayCount >= emailDomain.dailyLimit) {
      return false;
    }
    
    return true;
  }

  /**
   * Increment rate limit counters
   */
  private async incrementRateLimitCounters(domain: string): Promise<void> {
    await prisma.emailDomain.upsert({
      where: { domain },
      update: {
        currentHourCount: { increment: 1 },
        currentDayCount: { increment: 1 },
        totalSent: { increment: 1 },
      },
      create: {
        domain,
        currentHourCount: 1,
        currentDayCount: 1,
        totalSent: 1,
        hourResetAt: new Date(Date.now() + 3600000),
        dayResetAt: new Date(Date.now() + 86400000),
      },
    });
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    const timestamp = Date.now().toString(36);
    const random = randomBytes(8).toString('hex');
    return `${timestamp}.${random}@${MTA_CONFIG.systemDomain}`;
  }

  /**
   * Generate tracking ID
   */
  private generateTrackingId(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Extract domain from email
   */
  private extractDomain(email: string): string {
    return email.split('@')[1] || MTA_CONFIG.systemDomain;
  }

  /**
   * Normalize recipients to array
   */
  private normalizeRecipients(to: string | string[]): string[] {
    if (Array.isArray(to)) {
      return to.map(e => e.trim().toLowerCase());
    }
    return [to.trim().toLowerCase()];
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    const message = error.message || '';
    
    // Connection errors are retryable
    if (message.includes('ECONNREFUSED') || 
        message.includes('ETIMEDOUT') ||
        message.includes('timeout')) {
      return true;
    }
    
    // 4xx SMTP errors are retryable
    if (/^4\d{2}/.test(message)) {
      return true;
    }
    
    // Rate limit errors
    if (message.includes('rate limit')) {
      return true;
    }
    
    return false;
  }

  /**
   * Encode header for non-ASCII characters
   */
  private encodeHeader(text: string): string {
    // Check if encoding is needed
    if (/^[\x00-\x7F]*$/.test(text)) {
      return text;
    }
    
    // RFC 2047 encoding
    return `=?UTF-8?B?${Buffer.from(text).toString('base64')}?=`;
  }

  /**
   * Encode body as quoted-printable
   */
  private encodeQuotedPrintable(text: string): string {
    const lines: string[] = [];
    let currentLine = '';
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const code = char.charCodeAt(0);
      
      let encoded: string;
      
      if (char === '\r' || char === '\n') {
        lines.push(currentLine);
        currentLine = '';
        continue;
      } else if (code === 9 || (code >= 32 && code <= 126 && char !== '=')) {
        encoded = char;
      } else {
        // Encode as =XX
        encoded = '=' + code.toString(16).toUpperCase().padStart(2, '0');
      }
      
      // Line length limit (76 chars, with soft break)
      if (currentLine.length + encoded.length > 75) {
        lines.push(currentLine + '=');
        currentLine = encoded;
      } else {
        currentLine += encoded;
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines.join('\r\n');
  }
}

// Export singleton
export const mtaService = new MTAService();
