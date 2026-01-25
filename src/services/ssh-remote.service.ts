/**
 * SSH Remote Operations & Log Monitoring Service
 * 
 * Provides secure SSH command execution, log streaming,
 * and system notifications for Nova AI agents
 * 
 * @version 1.0.0
 * @security ADMIN_ONLY - SSH operations require elevated privileges
 */

import { logger } from '@/utils/logger';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface SSHConnectionConfig {
  host: string;
  port?: number;
  username: string;
  privateKeyPath?: string;
  password?: string;
  timeout?: number;
}

export interface SSHCommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;
  command: string;
  host: string;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug' | 'critical';
  source: string;
  message: string;
  metadata?: Record<string, any>;
  container?: string;
  service?: string;
}

export interface LogFilter {
  level?: LogEntry['level'][];
  source?: string;
  service?: string;
  container?: string;
  startTime?: Date;
  endTime?: Date;
  search?: string;
  limit?: number;
}

export interface NotificationConfig {
  type: 'error' | 'warning' | 'critical' | 'info';
  pattern: string | RegExp;
  message: string;
  cooldownMinutes?: number;
}

export interface SystemAlert {
  id: string;
  type: 'error' | 'warning' | 'critical' | 'info';
  title: string;
  message: string;
  source: string;
  timestamp: Date;
  acknowledged: boolean;
  metadata?: Record<string, any>;
}

export interface RemoteServerInfo {
  hostname: string;
  uptime: number;
  loadAverage: number[];
  memoryUsage: { total: number; used: number; free: number };
  diskUsage: { total: number; used: number; free: number };
  dockerContainers?: { name: string; status: string; ports: string }[];
}

// ============================================
// IN-MEMORY ALERT STORAGE
// ============================================

const alertStorage: SystemAlert[] = [];
const alertCooldowns: Map<string, Date> = new Map();

// Predefined notification patterns
const DEFAULT_NOTIFICATION_PATTERNS: NotificationConfig[] = [
  {
    type: 'critical',
    pattern: /FATAL|OOMKilled|panic|Segmentation fault/i,
    message: 'Critical system error detected',
    cooldownMinutes: 5,
  },
  {
    type: 'error',
    pattern: /Error:|ERROR:|Failed to|Connection refused|ECONNREFUSED/i,
    message: 'Application error detected',
    cooldownMinutes: 1,
  },
  {
    type: 'warning',
    pattern: /WARN:|Warning:|deprecated|rate.?limit/i,
    message: 'Warning condition detected',
    cooldownMinutes: 2,
  },
  {
    type: 'warning',
    pattern: /429|Too Many Requests|rate limit exceeded/i,
    message: 'Rate limiting detected',
    cooldownMinutes: 5,
  },
  {
    type: 'info',
    pattern: /Started|Listening|Connected|Ready/i,
    message: 'Service status update',
    cooldownMinutes: 10,
  },
];

// ============================================
// SSH REMOTE OPERATIONS SERVICE
// ============================================

class SSHRemoteService {
  private defaultConfig: Partial<SSHConnectionConfig> = {
    port: 22,
    timeout: 30000,
  };

  private productionServers: Map<string, SSHConnectionConfig> = new Map();

  constructor() {
    // Load server configurations from environment
    this.loadServerConfigs();
  }

  private loadServerConfigs(): void {
    // Production API server
    if (process.env.PROD_SSH_HOST) {
      this.productionServers.set('production', {
        host: process.env.PROD_SSH_HOST,
        port: parseInt(process.env.PROD_SSH_PORT || '22'),
        username: process.env.PROD_SSH_USER || 'root',
        privateKeyPath: process.env.PROD_SSH_KEY_PATH,
      });
    }

    // Worker server
    if (process.env.WORKER_SSH_HOST) {
      this.productionServers.set('worker', {
        host: process.env.WORKER_SSH_HOST,
        port: parseInt(process.env.WORKER_SSH_PORT || '22'),
        username: process.env.WORKER_SSH_USER || 'root',
        privateKeyPath: process.env.WORKER_SSH_KEY_PATH,
      });
    }

    logger.info('[SSH Service] Loaded server configurations', {
      servers: Array.from(this.productionServers.keys()),
    });
  }

  // ============================================
  // SSH COMMAND EXECUTION
  // ============================================

  /**
   * Execute SSH command on a configured server
   */
  async executeCommand(
    serverName: string,
    command: string,
    options?: { timeout?: number; sudo?: boolean }
  ): Promise<SSHCommandResult> {
    const config = this.productionServers.get(serverName);
    if (!config) {
      return {
        success: false,
        stdout: '',
        stderr: `Server "${serverName}" not configured`,
        exitCode: -1,
        executionTime: 0,
        command,
        host: serverName,
      };
    }

    return this.executeSSHCommand(config, command, options);
  }

  /**
   * Execute SSH command with custom configuration
   */
  async executeSSHCommand(
    config: SSHConnectionConfig,
    command: string,
    options?: { timeout?: number; sudo?: boolean }
  ): Promise<SSHCommandResult> {
    const mergedConfig = { ...this.defaultConfig, ...config };
    const timeout = options?.timeout || mergedConfig.timeout!;
    
    const start = Date.now();
    
    // Build SSH command
    let sshArgs = [
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'ConnectTimeout=10',
      '-p', String(mergedConfig.port),
    ];

    if (mergedConfig.privateKeyPath) {
      sshArgs.push('-i', mergedConfig.privateKeyPath);
    }

    sshArgs.push(`${mergedConfig.username}@${mergedConfig.host}`);
    
    const finalCommand = options?.sudo ? `sudo ${command}` : command;
    sshArgs.push(finalCommand);

    try {
      const { stdout, stderr } = await execAsync(`ssh ${sshArgs.join(' ')}`, {
        timeout,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      return {
        success: true,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: 0,
        executionTime: Date.now() - start,
        command,
        host: mergedConfig.host,
      };
    } catch (error: any) {
      return {
        success: false,
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        exitCode: error.code || -1,
        executionTime: Date.now() - start,
        command,
        host: mergedConfig.host,
      };
    }
  }

  /**
   * Get remote server system information
   */
  async getServerInfo(serverName: string): Promise<RemoteServerInfo | null> {
    const commands = {
      hostname: 'hostname',
      uptime: 'cat /proc/uptime | cut -d" " -f1',
      loadAvg: 'cat /proc/loadavg',
      memory: 'free -b | grep Mem',
      disk: 'df -B1 / | tail -1',
      docker: 'docker ps --format "{{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo ""',
    };

    try {
      const results = await Promise.all([
        this.executeCommand(serverName, commands.hostname),
        this.executeCommand(serverName, commands.uptime),
        this.executeCommand(serverName, commands.loadAvg),
        this.executeCommand(serverName, commands.memory),
        this.executeCommand(serverName, commands.disk),
        this.executeCommand(serverName, commands.docker),
      ]);

      const [hostname, uptime, loadAvg, memory, disk, docker] = results;

      // Parse load average
      const loadParts = loadAvg.stdout.split(' ');
      const loadAverage = loadParts.slice(0, 3).map(parseFloat);

      // Parse memory
      const memParts = memory.stdout.split(/\s+/);
      const memoryUsage = {
        total: parseInt(memParts[1]) || 0,
        used: parseInt(memParts[2]) || 0,
        free: parseInt(memParts[3]) || 0,
      };

      // Parse disk
      const diskParts = disk.stdout.split(/\s+/);
      const diskUsage = {
        total: parseInt(diskParts[1]) || 0,
        used: parseInt(diskParts[2]) || 0,
        free: parseInt(diskParts[3]) || 0,
      };

      // Parse docker containers
      const dockerContainers = docker.stdout
        .split('\n')
        .filter(Boolean)
        .map(line => {
          const [name, status, ports] = line.split('\t');
          return { name, status, ports: ports || '' };
        });

      return {
        hostname: hostname.stdout,
        uptime: parseFloat(uptime.stdout) || 0,
        loadAverage,
        memoryUsage,
        diskUsage,
        dockerContainers,
      };
    } catch (error: any) {
      logger.error('[SSH Service] Failed to get server info:', error);
      return null;
    }
  }

  /**
   * Get Docker container logs
   */
  async getContainerLogs(
    serverName: string,
    containerName: string,
    options?: { tail?: number; since?: string; grep?: string }
  ): Promise<SSHCommandResult> {
    let command = `docker logs ${containerName}`;
    
    if (options?.tail) {
      command += ` --tail ${options.tail}`;
    }
    
    if (options?.since) {
      command += ` --since "${options.since}"`;
    }
    
    command += ' 2>&1';
    
    if (options?.grep) {
      command += ` | grep -E "${options.grep}"`;
    }

    return this.executeCommand(serverName, command);
  }

  /**
   * Restart a Docker container
   */
  async restartContainer(serverName: string, containerName: string): Promise<SSHCommandResult> {
    return this.executeCommand(serverName, `docker restart ${containerName}`);
  }

  /**
   * Execute Docker compose command
   */
  async dockerCompose(
    serverName: string,
    action: 'up' | 'down' | 'restart' | 'logs' | 'ps',
    options?: { service?: string; detach?: boolean }
  ): Promise<SSHCommandResult> {
    let command = `cd /app && docker compose ${action}`;
    
    if (action === 'up' && options?.detach !== false) {
      command += ' -d';
    }
    
    if (options?.service) {
      command += ` ${options.service}`;
    }

    return this.executeCommand(serverName, command);
  }

  /**
   * Get list of configured servers
   */
  getConfiguredServers(): string[] {
    return Array.from(this.productionServers.keys());
  }
}

// ============================================
// LOG MONITORING SERVICE
// ============================================

class LogMonitoringService {
  private logBuffer: LogEntry[] = [];
  private maxBufferSize = 1000;
  private notificationPatterns: NotificationConfig[] = [...DEFAULT_NOTIFICATION_PATTERNS];

  /**
   * Parse and store a log entry
   */
  processLogEntry(raw: string, source: string, container?: string): LogEntry | null {
    try {
      const entry = this.parseLogEntry(raw, source, container);
      if (!entry) return null;

      // Add to buffer
      this.logBuffer.unshift(entry);
      if (this.logBuffer.length > this.maxBufferSize) {
        this.logBuffer = this.logBuffer.slice(0, this.maxBufferSize);
      }

      // Check notification patterns
      this.checkNotificationPatterns(entry);

      return entry;
    } catch (error) {
      return null;
    }
  }

  /**
   * Parse raw log line into structured entry
   */
  private parseLogEntry(raw: string, source: string, container?: string): LogEntry | null {
    if (!raw.trim()) return null;

    // Detect log level
    let level: LogEntry['level'] = 'info';
    const lowerRaw = raw.toLowerCase();
    
    if (lowerRaw.includes('error') || lowerRaw.includes('fatal') || lowerRaw.includes('critical')) {
      level = 'error';
    } else if (lowerRaw.includes('warn')) {
      level = 'warn';
    } else if (lowerRaw.includes('debug')) {
      level = 'debug';
    }

    // Try to parse timestamp
    let timestamp = new Date();
    const isoMatch = raw.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    if (isoMatch) {
      const parsed = new Date(isoMatch[0]);
      if (!isNaN(parsed.getTime())) {
        timestamp = parsed;
      }
    }

    // Extract JSON metadata if present
    let metadata: Record<string, any> | undefined;
    const jsonMatch = raw.match(/\{[^{}]+\}/);
    if (jsonMatch) {
      try {
        metadata = JSON.parse(jsonMatch[0]);
      } catch {
        // Not valid JSON
      }
    }

    return {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp,
      level,
      source,
      message: raw,
      metadata,
      container,
    };
  }

  /**
   * Check log entry against notification patterns
   */
  private checkNotificationPatterns(entry: LogEntry): void {
    for (const pattern of this.notificationPatterns) {
      const regex = typeof pattern.pattern === 'string' 
        ? new RegExp(pattern.pattern, 'i')
        : pattern.pattern;

      if (regex.test(entry.message)) {
        const cooldownKey = `${pattern.type}_${pattern.message}`;
        const lastAlert = alertCooldowns.get(cooldownKey);
        const now = new Date();

        // Check cooldown
        if (lastAlert && pattern.cooldownMinutes) {
          const cooldownMs = pattern.cooldownMinutes * 60 * 1000;
          if (now.getTime() - lastAlert.getTime() < cooldownMs) {
            continue; // Still in cooldown
          }
        }

        // Create alert
        const alert: SystemAlert = {
          id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: pattern.type,
          title: pattern.message,
          message: entry.message,
          source: entry.source,
          timestamp: now,
          acknowledged: false,
          metadata: entry.metadata,
        };

        alertStorage.unshift(alert);
        if (alertStorage.length > 100) {
          alertStorage.length = 100;
        }

        alertCooldowns.set(cooldownKey, now);

        logger.info(`[Log Monitor] Alert generated: ${pattern.type} - ${pattern.message}`);
      }
    }
  }

  /**
   * Get filtered logs
   */
  getLogs(filter?: LogFilter): LogEntry[] {
    let result = [...this.logBuffer];

    if (filter?.level?.length) {
      result = result.filter(e => filter.level!.includes(e.level));
    }

    if (filter?.source) {
      result = result.filter(e => e.source.includes(filter.source!));
    }

    if (filter?.container) {
      result = result.filter(e => e.container === filter.container);
    }

    if (filter?.startTime) {
      result = result.filter(e => e.timestamp >= filter.startTime!);
    }

    if (filter?.endTime) {
      result = result.filter(e => e.timestamp <= filter.endTime!);
    }

    if (filter?.search) {
      const searchLower = filter.search.toLowerCase();
      result = result.filter(e => e.message.toLowerCase().includes(searchLower));
    }

    if (filter?.limit) {
      result = result.slice(0, filter.limit);
    }

    return result;
  }

  /**
   * Get all alerts
   */
  getAlerts(filter?: { acknowledged?: boolean; type?: SystemAlert['type'] }): SystemAlert[] {
    let result = [...alertStorage];

    if (filter?.acknowledged !== undefined) {
      result = result.filter(a => a.acknowledged === filter.acknowledged);
    }

    if (filter?.type) {
      result = result.filter(a => a.type === filter.type);
    }

    return result;
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = alertStorage.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }

  /**
   * Add custom notification pattern
   */
  addNotificationPattern(config: NotificationConfig): void {
    this.notificationPatterns.push(config);
  }

  /**
   * Get log statistics
   */
  getLogStats(): {
    totalLogs: number;
    byLevel: Record<string, number>;
    bySource: Record<string, number>;
    errorRate: number;
    recentErrors: LogEntry[];
  } {
    const byLevel: Record<string, number> = {};
    const bySource: Record<string, number> = {};

    for (const entry of this.logBuffer) {
      byLevel[entry.level] = (byLevel[entry.level] || 0) + 1;
      bySource[entry.source] = (bySource[entry.source] || 0) + 1;
    }

    const errorCount = (byLevel.error || 0) + (byLevel.critical || 0);
    const errorRate = this.logBuffer.length > 0 ? errorCount / this.logBuffer.length : 0;

    const recentErrors = this.logBuffer
      .filter(e => e.level === 'error' || e.level === 'critical')
      .slice(0, 10);

    return {
      totalLogs: this.logBuffer.length,
      byLevel,
      bySource,
      errorRate,
      recentErrors,
    };
  }

  /**
   * Clear log buffer
   */
  clearLogs(): void {
    this.logBuffer = [];
  }
}

// ============================================
// EXPORTS
// ============================================

export const sshRemoteService = new SSHRemoteService();
export const logMonitoringService = new LogMonitoringService();
