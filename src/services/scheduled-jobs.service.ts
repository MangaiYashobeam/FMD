/**
 * Scheduled Jobs Service
 * 
 * Handles automated tasks like:
 * - Daily security reports
 * - Weekly platform reports
 * - Monthly summary reports
 * - Automated email notifications
 */

import { logger } from '@/utils/logger';
import { reportService } from './report.service';
import { securityNotificationService } from './security-notification.service';

// ============================================
// Job Configuration
// ============================================

interface ScheduledJob {
  name: string;
  cronPattern: string;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  handler: () => Promise<void>;
}

const jobs: Map<string, ScheduledJob> = new Map();
const intervals: Map<string, NodeJS.Timeout> = new Map();

// ============================================
// Helper: Calculate next run time
// ============================================

function getNextRunTime(pattern: 'daily' | 'weekly' | 'monthly'): Date {
  const now = new Date();
  const next = new Date(now);
  
  switch (pattern) {
    case 'daily':
      // Run at 6 AM next day
      next.setDate(next.getDate() + 1);
      next.setHours(6, 0, 0, 0);
      break;
    case 'weekly':
      // Run Monday at 7 AM
      const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
      next.setDate(next.getDate() + daysUntilMonday);
      next.setHours(7, 0, 0, 0);
      break;
    case 'monthly':
      // Run 1st of next month at 8 AM
      next.setMonth(next.getMonth() + 1, 1);
      next.setHours(8, 0, 0, 0);
      break;
  }
  
  return next;
}

function getMsUntil(date: Date): number {
  return Math.max(0, date.getTime() - Date.now());
}

// ============================================
// Job Handlers
// ============================================

async function dailySecurityReportJob(): Promise<void> {
  logger.info('Running daily security report job...');
  try {
    await reportService.sendScheduledReports('daily');
    logger.info('Daily security report completed');
  } catch (error) {
    logger.error('Daily security report failed:', error);
  }
}

async function weeklyReportJob(): Promise<void> {
  logger.info('Running weekly report job...');
  try {
    await reportService.sendScheduledReports('weekly');
    logger.info('Weekly reports completed');
  } catch (error) {
    logger.error('Weekly reports failed:', error);
  }
}

async function monthlyReportJob(): Promise<void> {
  logger.info('Running monthly report job...');
  try {
    await reportService.sendScheduledReports('monthly');
    logger.info('Monthly reports completed');
  } catch (error) {
    logger.error('Monthly reports failed:', error);
  }
}

// ============================================
// Job Scheduler
// ============================================

function scheduleJob(job: ScheduledJob): void {
  if (!job.enabled) {
    logger.info(`Job "${job.name}" is disabled, skipping`);
    return;
  }

  // Clear existing interval if any
  const existing = intervals.get(job.name);
  if (existing) {
    clearTimeout(existing);
  }

  // Calculate next run
  const pattern = job.cronPattern as 'daily' | 'weekly' | 'monthly';
  job.nextRun = getNextRunTime(pattern);
  const msUntilRun = getMsUntil(job.nextRun);

  logger.info(`Scheduled "${job.name}" to run at ${job.nextRun.toISOString()} (in ${Math.round(msUntilRun / 1000 / 60)} minutes)`);

  // Schedule the job
  const timeoutId = setTimeout(async () => {
    logger.info(`Executing scheduled job: ${job.name}`);
    job.lastRun = new Date();
    
    try {
      await job.handler();
    } catch (error) {
      logger.error(`Job "${job.name}" failed:`, error);
    }

    // Reschedule for next run
    scheduleJob(job);
  }, msUntilRun);

  intervals.set(job.name, timeoutId);
  jobs.set(job.name, job);
}

// ============================================
// Initialize Scheduled Jobs
// ============================================

export function initScheduledJobs(): void {
  logger.info('Initializing scheduled jobs...');

  // Initialize security notifications listener
  securityNotificationService.init();

  // Define jobs
  const jobDefinitions: ScheduledJob[] = [
    {
      name: 'daily-security-report',
      cronPattern: 'daily',
      enabled: true,
      handler: dailySecurityReportJob,
    },
    {
      name: 'weekly-platform-report',
      cronPattern: 'weekly',
      enabled: true,
      handler: weeklyReportJob,
    },
    {
      name: 'monthly-summary-report',
      cronPattern: 'monthly',
      enabled: true,
      handler: monthlyReportJob,
    },
  ];

  // Schedule all jobs
  jobDefinitions.forEach(job => {
    scheduleJob(job);
  });

  logger.info(`Initialized ${jobDefinitions.length} scheduled jobs`);
}

// ============================================
// Job Management API
// ============================================

export function getScheduledJobs(): Array<{
  name: string;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  cronPattern: string;
}> {
  return Array.from(jobs.values()).map(job => ({
    name: job.name,
    enabled: job.enabled,
    lastRun: job.lastRun,
    nextRun: job.nextRun,
    cronPattern: job.cronPattern,
  }));
}

export function enableJob(name: string): boolean {
  const job = jobs.get(name);
  if (!job) return false;
  
  job.enabled = true;
  scheduleJob(job);
  return true;
}

export function disableJob(name: string): boolean {
  const job = jobs.get(name);
  if (!job) return false;
  
  job.enabled = false;
  const interval = intervals.get(name);
  if (interval) {
    clearTimeout(interval);
    intervals.delete(name);
  }
  return true;
}

export async function runJobNow(name: string): Promise<boolean> {
  const job = jobs.get(name);
  if (!job) return false;
  
  logger.info(`Manually triggering job: ${name}`);
  try {
    await job.handler();
    job.lastRun = new Date();
    return true;
  } catch (error) {
    logger.error(`Manual job execution failed for "${name}":`, error);
    return false;
  }
}

export function stopAllJobs(): void {
  logger.info('Stopping all scheduled jobs...');
  intervals.forEach((interval, name) => {
    clearTimeout(interval);
    logger.info(`Stopped job: ${name}`);
  });
  intervals.clear();
}

// ============================================
// Export Service
// ============================================

export const scheduledJobsService = {
  init: initScheduledJobs,
  getJobs: getScheduledJobs,
  enableJob,
  disableJob,
  runJobNow,
  stopAllJobs,
};

export default scheduledJobsService;
