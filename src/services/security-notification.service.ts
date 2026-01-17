/**
 * Security Notification Service
 * 
 * Handles real-time security alerts and notifications
 * to super admin email for:
 * - Attack detection
 * - Mitigation activation
 * - SQL Injection attempts
 * - XSS attempts
 * - Bot detection
 * - Honeypot triggers
 */

import { logger } from '@/utils/logger';
import prisma from '@/config/database';
import { emailTemplates } from './email-templates.service';
import { emailService } from './email.service';
import intelliceilService from './intelliceil.service';

// ============================================
// Configuration
// ============================================

interface NotificationConfig {
  enabled: boolean;
  superAdminEmail: string;
  notifyOnAttack: boolean;
  notifyOnMitigation: boolean;
  notifyOnSQLInjection: boolean;
  notifyOnXSS: boolean;
  notifyOnBot: boolean;
  notifyOnHoneypot: boolean;
  cooldownMinutes: number; // Prevent notification spam
}

let config: NotificationConfig = {
  enabled: true,
  superAdminEmail: process.env.SUPER_ADMIN_EMAIL || 'admin@dealersface.com',
  notifyOnAttack: true,
  notifyOnMitigation: true,
  notifyOnSQLInjection: true,
  notifyOnXSS: true,
  notifyOnBot: false, // Bots are common, disabled by default
  notifyOnHoneypot: true,
  cooldownMinutes: 5,
};

// Track last notification times to prevent spam
const lastNotifications: Map<string, Date> = new Map();

// ============================================
// Helper Functions
// ============================================

function shouldNotify(type: string): boolean {
  if (!config.enabled) return false;
  
  const lastNotified = lastNotifications.get(type);
  if (lastNotified) {
    const cooldownMs = config.cooldownMinutes * 60 * 1000;
    if (Date.now() - lastNotified.getTime() < cooldownMs) {
      return false; // Still in cooldown
    }
  }
  
  return true;
}

function recordNotification(type: string): void {
  lastNotifications.set(type, new Date());
}

async function sendSecurityEmail(subject: string, html: string): Promise<void> {
  try {
    await emailService.sendEmail({
      to: config.superAdminEmail,
      subject: `🚨 ${subject}`,
      html,
    });
    logger.info(`Security notification sent: ${subject}`);
  } catch (error) {
    logger.error(`Failed to send security notification: ${subject}`, error);
  }
}

// ============================================
// Notification Handlers
// ============================================

export async function notifyAttackDetected(data: {
  threatLevel: string;
  percentage: number;
  rps: number;
  blockedIPs: number;
  topAttackSources: { ip: string; requests: number }[];
}): Promise<void> {
  if (!config.notifyOnAttack || !shouldNotify('attack')) return;
  
  const html = emailTemplates.security.attackDetected({
    ...data,
    timestamp: new Date(),
  });
  
  await sendSecurityEmail(`ATTACK DETECTED - Threat Level: ${data.threatLevel}`, html);
  recordNotification('attack');
}

export async function notifyMitigationActivated(data: {
  threshold: number;
  currentLoad: number;
}): Promise<void> {
  if (!config.notifyOnMitigation || !shouldNotify('mitigation')) return;
  
  const html = emailTemplates.security.mitigationActivated({
    timestamp: new Date(),
    threshold: data.threshold,
    currentLoad: data.currentLoad,
    estimatedDuration: 'Until traffic normalizes',
  });
  
  await sendSecurityEmail('Mitigation Mode ACTIVATED', html);
  recordNotification('mitigation');
}

export async function notifySQLInjectionAttempt(data: {
  ip: string;
  endpoint: string;
  payload: string;
  blocked: boolean;
}): Promise<void> {
  if (!config.notifyOnSQLInjection || !shouldNotify(`sql_${data.ip}`)) return;
  
  const html = emailTemplates.security.sqlInjectionAttempt({
    ...data,
    timestamp: new Date(),
  });
  
  await sendSecurityEmail('SQL Injection Attempt Blocked', html);
  recordNotification(`sql_${data.ip}`);
}

export async function notifyXSSAttempt(data: {
  ip: string;
  endpoint: string;
  payload: string;
  blocked: boolean;
}): Promise<void> {
  if (!config.notifyOnXSS || !shouldNotify(`xss_${data.ip}`)) return;
  
  const html = emailTemplates.security.xssAttempt({
    ...data,
    timestamp: new Date(),
  });
  
  await sendSecurityEmail('XSS Attack Attempt Blocked', html);
  recordNotification(`xss_${data.ip}`);
}

export async function notifyBotDetected(data: {
  ip: string;
  userAgent: string;
  confidence: number;
  indicators: string[];
}): Promise<void> {
  if (!config.notifyOnBot || !shouldNotify(`bot_${data.ip}`)) return;
  
  const html = emailTemplates.security.botDetected({
    ...data,
    timestamp: new Date(),
  });
  
  await sendSecurityEmail('Bot Traffic Detected', html);
  recordNotification(`bot_${data.ip}`);
}

export async function notifyHoneypotTriggered(data: {
  ip: string;
  endpoint: string;
}): Promise<void> {
  if (!config.notifyOnHoneypot || !shouldNotify(`honeypot_${data.ip}`)) return;
  
  const html = emailTemplates.security.honeypotTriggered({
    ...data,
    timestamp: new Date(),
  });
  
  await sendSecurityEmail('Honeypot Trap Triggered - Attacker Blocked', html);
  recordNotification(`honeypot_${data.ip}`);
}

// ============================================
// Initialize Event Listeners
// ============================================

export function initSecurityNotifications(): void {
  // Load config from database
  loadConfig().then(() => {
    logger.info('Security notification service initialized');
  });

  // Listen to Intelliceil events
  intelliceilService.on('attack-detected', (data) => {
    const status = intelliceilService.getStatus();
    notifyAttackDetected({
      threatLevel: data.threatLevel || status.threatLevel.level,
      percentage: data.percentage,
      rps: data.rps,
      blockedIPs: status.config.blockedIPs.length,
      topAttackSources: status.geoLocations
        .filter(g => !g.isTrusted)
        .sort((a, b) => b.requestCount - a.requestCount)
        .slice(0, 5)
        .map(g => ({ ip: g.ip, requests: g.requestCount })),
    });
  });

  intelliceilService.on('mitigation-activated', () => {
    const status = intelliceilService.getStatus();
    notifyMitigationActivated({
      threshold: status.config.mitigationThreshold,
      currentLoad: status.threatLevel.percentage,
    });
  });

  intelliceilService.on('threat-level-changed', (threatLevel) => {
    if (threatLevel.level === 'CRITICAL') {
      const status = intelliceilService.getStatus();
      notifyAttackDetected({
        threatLevel: threatLevel.level,
        percentage: threatLevel.percentage,
        rps: status.currentRps,
        blockedIPs: status.config.blockedIPs.length,
        topAttackSources: status.geoLocations
          .filter(g => !g.isTrusted)
          .sort((a, b) => b.requestCount - a.requestCount)
          .slice(0, 5)
          .map(g => ({ ip: g.ip, requests: g.requestCount })),
      });
    }
  });

  logger.info('Registered Intelliceil event listeners for security notifications');
}

// ============================================
// Configuration Management
// ============================================

async function loadConfig(): Promise<void> {
  try {
    const settings = await prisma.systemSettings.findFirst({
      where: { key: 'security_notifications' }
    });
    
    if (settings?.value) {
      config = { ...config, ...(settings.value as any) };
    }

    // Also try to get super admin email from separate setting
    const emailSetting = await prisma.systemSettings.findFirst({
      where: { key: 'super_admin_email' }
    });
    
    if (emailSetting?.value) {
      config.superAdminEmail = emailSetting.value as string;
    }
  } catch (error) {
    logger.warn('Could not load security notification config, using defaults');
  }
}

export async function updateConfig(newConfig: Partial<NotificationConfig>): Promise<void> {
  config = { ...config, ...newConfig };
  
  try {
    await prisma.systemSettings.upsert({
      where: { key: 'security_notifications' },
      create: {
        key: 'security_notifications',
        value: config as any,
      },
      update: {
        value: config as any,
      },
    });
    logger.info('Security notification config updated');
  } catch (error) {
    logger.error('Failed to save security notification config:', error);
  }
}

export function getConfig(): NotificationConfig {
  return { ...config };
}

// ============================================
// Manual Triggers (for testing/admin use)
// ============================================

export async function sendTestNotification(type: string): Promise<{ success: boolean; message: string }> {
  const testData = {
    attack: {
      threatLevel: 'ELEVATED',
      percentage: 35,
      rps: 150,
      blockedIPs: 5,
      topAttackSources: [
        { ip: '192.168.1.100', requests: 500 },
        { ip: '10.0.0.50', requests: 350 },
      ],
    },
    mitigation: {
      threshold: 30,
      currentLoad: 45,
    },
    sql: {
      ip: '192.168.1.100',
      endpoint: '/api/users',
      payload: "'; DROP TABLE users; --",
      blocked: true,
    },
    xss: {
      ip: '192.168.1.100',
      endpoint: '/api/comments',
      payload: '<script>alert("xss")</script>',
      blocked: true,
    },
    bot: {
      ip: '192.168.1.100',
      userAgent: 'Python-urllib/3.9',
      confidence: 85,
      indicators: ['Known bot user agent', 'High request rate', 'No cookies'],
    },
    honeypot: {
      ip: '192.168.1.100',
      endpoint: '/wp-admin',
    },
  };

  // Temporarily disable cooldown for test
  const originalCooldown = config.cooldownMinutes;
  config.cooldownMinutes = 0;

  try {
    switch (type) {
      case 'attack':
        await notifyAttackDetected(testData.attack);
        break;
      case 'mitigation':
        await notifyMitigationActivated(testData.mitigation);
        break;
      case 'sql':
        config.notifyOnSQLInjection = true;
        await notifySQLInjectionAttempt(testData.sql);
        break;
      case 'xss':
        config.notifyOnXSS = true;
        await notifyXSSAttempt(testData.xss);
        break;
      case 'bot':
        config.notifyOnBot = true;
        await notifyBotDetected(testData.bot);
        break;
      case 'honeypot':
        await notifyHoneypotTriggered(testData.honeypot);
        break;
      default:
        return { success: false, message: `Unknown notification type: ${type}` };
    }

    return { success: true, message: `Test ${type} notification sent to ${config.superAdminEmail}` };
  } catch (error) {
    return { success: false, message: `Failed to send test notification: ${error}` };
  } finally {
    config.cooldownMinutes = originalCooldown;
  }
}

// ============================================
// Export Service
// ============================================

export const securityNotificationService = {
  init: initSecurityNotifications,
  notifyAttackDetected,
  notifyMitigationActivated,
  notifySQLInjectionAttempt,
  notifyXSSAttempt,
  notifyBotDetected,
  notifyHoneypotTriggered,
  updateConfig,
  getConfig,
  sendTestNotification,
};

export default securityNotificationService;
