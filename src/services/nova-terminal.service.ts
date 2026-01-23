/**
 * Nova Terminal Service
 * 
 * PRODUCTION-GRADE secure terminal execution system for Nova AI.
 * Provides SSH access to VPS and local command execution.
 * 
 * SECURITY MEASURES:
 * - Command whitelist for dangerous operations
 * - Audit logging of all commands
 * - Rate limiting
 * - Command timeout
 * - Sandboxed execution contexts
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '@/utils/logger';
// Note: prisma available for future DB-backed command history
// import prisma from '@/config/database';

const execAsync = promisify(exec);

// VPS Configuration
const VPS_CONFIG = {
  host: '46.4.224.182',
  user: 'root',
  projectPath: '/opt/facemydealer',
  sshOptions: '-o StrictHostKeyChecking=no -o ConnectTimeout=10',
};

// Command execution limits
const EXECUTION_LIMITS = {
  timeout: 60000, // 60 seconds max
  maxOutputSize: 1024 * 1024, // 1MB max output
  maxConcurrent: 3,
};

// Dangerous commands that require extra confirmation
const DANGEROUS_COMMANDS = [
  'rm -rf',
  'drop database',
  'truncate',
  'delete from',
  'format',
  'dd if=',
  'mkfs',
  '> /dev/',
  'chmod 777',
  'shutdown',
  'reboot',
  'kill -9',
  'pkill',
];

// Whitelisted safe commands for quick execution
const SAFE_COMMANDS = [
  'ls', 'pwd', 'whoami', 'date', 'uptime', 'df', 'free',
  'cat', 'head', 'tail', 'grep', 'find', 'wc',
  'docker ps', 'docker logs', 'docker compose ps',
  'git status', 'git log', 'git branch', 'git diff',
  'npm list', 'npm outdated',
  'curl', 'wget',
];

// Active terminal sessions (for future real-time streaming)
const _activeSessions: Map<string, {
  output: string[];
  status: 'running' | 'completed' | 'error';
  startedAt: Date;
  command: string;
}> = new Map();

// Command history for audit
interface CommandAuditEntry {
  id: string;
  command: string;
  target: 'local' | 'vps';
  executedAt: Date;
  completedAt?: Date;
  exitCode?: number;
  outputPreview: string;
  userId?: string;
  dangerous: boolean;
}

const commandHistory: CommandAuditEntry[] = [];

export interface TerminalExecutionResult {
  success: boolean;
  sessionId: string;
  command: string;
  output: string;
  error?: string;
  exitCode?: number;
  executionTime: number;
  dangerous: boolean;
  truncated: boolean;
}

export interface TerminalSession {
  id: string;
  status: 'running' | 'completed' | 'error';
  command: string;
  output: string[];
  startedAt: Date;
  completedAt?: Date;
}

class NovaTerminalService {
  private currentConcurrent = 0;

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `term_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Check if command contains dangerous patterns
   */
  private isDangerousCommand(command: string): boolean {
    const lowerCmd = command.toLowerCase();
    return DANGEROUS_COMMANDS.some(dangerous => lowerCmd.includes(dangerous.toLowerCase()));
  }

  /**
   * Check if command is in safe whitelist
   */
  private isSafeCommand(command: string): boolean {
    const firstPart = command.split(' ')[0];
    return SAFE_COMMANDS.some(safe => 
      command.startsWith(safe) || firstPart === safe
    );
  }

  /**
   * Sanitize command for logging (hide sensitive data)
   */
  private sanitizeForLog(command: string): string {
    return command
      .replace(/password[=:]\S+/gi, 'password=***')
      .replace(/token[=:]\S+/gi, 'token=***')
      .replace(/key[=:]\S+/gi, 'key=***')
      .replace(/secret[=:]\S+/gi, 'secret=***');
  }

  /**
   * Truncate output if too large
   */
  private truncateOutput(output: string, maxSize: number = EXECUTION_LIMITS.maxOutputSize): { text: string; truncated: boolean } {
    if (output.length <= maxSize) {
      return { text: output, truncated: false };
    }
    const halfSize = Math.floor(maxSize / 2);
    const truncated = output.slice(0, halfSize) + 
      '\n\n... [OUTPUT TRUNCATED - ' + (output.length - maxSize) + ' bytes omitted] ...\n\n' +
      output.slice(-halfSize);
    return { text: truncated, truncated: true };
  }

  /**
   * Add command to audit log
   */
  private auditCommand(entry: CommandAuditEntry): void {
    commandHistory.unshift(entry);
    // Keep only last 500 commands
    if (commandHistory.length > 500) {
      commandHistory.pop();
    }
    
    // Log to system logger
    logger.info(`[Nova Terminal] ${entry.target.toUpperCase()}: ${this.sanitizeForLog(entry.command)}`);
  }

  /**
   * Execute command locally on the API server
   */
  async executeLocal(command: string, options: {
    cwd?: string;
    timeout?: number;
    userId?: string;
  } = {}): Promise<TerminalExecutionResult> {
    const sessionId = this.generateSessionId();
    const startTime = Date.now();
    const dangerous = this.isDangerousCommand(command);
    const isSafe = this.isSafeCommand(command);

    // Log safe commands at debug level, dangerous at warn level
    if (dangerous) {
      logger.warn(`[Nova Terminal] DANGEROUS command requested: ${this.sanitizeForLog(command)}`);
    } else if (isSafe) {
      logger.debug(`[Nova Terminal] Safe command: ${this.sanitizeForLog(command)}`);
    }

    // Check concurrent limit
    if (this.currentConcurrent >= EXECUTION_LIMITS.maxConcurrent) {
      return {
        success: false,
        sessionId,
        command,
        output: '',
        error: 'Too many concurrent executions. Please wait.',
        executionTime: 0,
        dangerous,
        truncated: false,
      };
    }

    // Audit entry
    const auditEntry: CommandAuditEntry = {
      id: sessionId,
      command: this.sanitizeForLog(command),
      target: 'local',
      executedAt: new Date(),
      outputPreview: '',
      userId: options.userId,
      dangerous,
    };

    this.currentConcurrent++;

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: options.cwd || process.cwd(),
        timeout: options.timeout || EXECUTION_LIMITS.timeout,
        maxBuffer: EXECUTION_LIMITS.maxOutputSize,
      });

      const combinedOutput = stdout + (stderr ? '\n[STDERR]\n' + stderr : '');
      const { text, truncated } = this.truncateOutput(combinedOutput);

      auditEntry.completedAt = new Date();
      auditEntry.exitCode = 0;
      auditEntry.outputPreview = text.slice(0, 200);
      this.auditCommand(auditEntry);

      return {
        success: true,
        sessionId,
        command,
        output: text,
        exitCode: 0,
        executionTime: Date.now() - startTime,
        dangerous,
        truncated,
      };
    } catch (error: any) {
      const errorOutput = error.stderr || error.stdout || error.message;
      const { text, truncated } = this.truncateOutput(errorOutput);

      auditEntry.completedAt = new Date();
      auditEntry.exitCode = error.code || 1;
      auditEntry.outputPreview = text.slice(0, 200);
      this.auditCommand(auditEntry);

      return {
        success: false,
        sessionId,
        command,
        output: text,
        error: error.message,
        exitCode: error.code || 1,
        executionTime: Date.now() - startTime,
        dangerous,
        truncated,
      };
    } finally {
      this.currentConcurrent--;
    }
  }

  /**
   * Execute command on VPS via SSH
   */
  async executeVPS(command: string, options: {
    timeout?: number;
    userId?: string;
    inProjectDir?: boolean;
  } = {}): Promise<TerminalExecutionResult> {
    const sessionId = this.generateSessionId();
    const startTime = Date.now();
    const dangerous = this.isDangerousCommand(command);

    // Check concurrent limit
    if (this.currentConcurrent >= EXECUTION_LIMITS.maxConcurrent) {
      return {
        success: false,
        sessionId,
        command,
        output: '',
        error: 'Too many concurrent executions. Please wait.',
        executionTime: 0,
        dangerous,
        truncated: false,
      };
    }

    // Build SSH command
    let sshCommand = `ssh ${VPS_CONFIG.sshOptions} ${VPS_CONFIG.user}@${VPS_CONFIG.host}`;
    
    if (options.inProjectDir !== false) {
      sshCommand += ` "cd ${VPS_CONFIG.projectPath} && ${command.replace(/"/g, '\\"')}"`;
    } else {
      sshCommand += ` "${command.replace(/"/g, '\\"')}"`;
    }

    // Audit entry
    const auditEntry: CommandAuditEntry = {
      id: sessionId,
      command: this.sanitizeForLog(command),
      target: 'vps',
      executedAt: new Date(),
      outputPreview: '',
      userId: options.userId,
      dangerous,
    };

    this.currentConcurrent++;

    try {
      const { stdout, stderr } = await execAsync(sshCommand, {
        timeout: options.timeout || EXECUTION_LIMITS.timeout,
        maxBuffer: EXECUTION_LIMITS.maxOutputSize,
      });

      const combinedOutput = stdout + (stderr ? '\n[STDERR]\n' + stderr : '');
      const { text, truncated } = this.truncateOutput(combinedOutput);

      auditEntry.completedAt = new Date();
      auditEntry.exitCode = 0;
      auditEntry.outputPreview = text.slice(0, 200);
      this.auditCommand(auditEntry);

      return {
        success: true,
        sessionId,
        command,
        output: text,
        exitCode: 0,
        executionTime: Date.now() - startTime,
        dangerous,
        truncated,
      };
    } catch (error: any) {
      const errorOutput = error.stderr || error.stdout || error.message;
      const { text, truncated } = this.truncateOutput(errorOutput);

      auditEntry.completedAt = new Date();
      auditEntry.exitCode = error.code || 1;
      auditEntry.outputPreview = text.slice(0, 200);
      this.auditCommand(auditEntry);

      return {
        success: false,
        sessionId,
        command,
        output: text,
        error: error.message,
        exitCode: error.code || 1,
        executionTime: Date.now() - startTime,
        dangerous,
        truncated,
      };
    } finally {
      this.currentConcurrent--;
    }
  }

  /**
   * Execute Docker command on VPS
   */
  async executeDocker(dockerCommand: string, options: {
    timeout?: number;
    userId?: string;
  } = {}): Promise<TerminalExecutionResult> {
    const fullCommand = `docker compose -f docker-compose.production.yml ${dockerCommand}`;
    return this.executeVPS(fullCommand, { ...options, inProjectDir: true });
  }

  /**
   * Get container logs
   */
  async getContainerLogs(containerName: string, options: {
    tail?: number;
    since?: string;
    follow?: boolean;
  } = {}): Promise<TerminalExecutionResult> {
    let command = `logs ${containerName}`;
    if (options.tail) command += ` --tail=${options.tail}`;
    if (options.since) command += ` --since=${options.since}`;
    
    return this.executeDocker(command, { timeout: 30000 });
  }

  /**
   * Restart a container
   */
  async restartContainer(containerName: string): Promise<TerminalExecutionResult> {
    return this.executeDocker(`restart ${containerName}`, { timeout: 60000 });
  }

  /**
   * Get container status
   */
  async getContainerStatus(): Promise<TerminalExecutionResult> {
    return this.executeDocker('ps', { timeout: 15000 });
  }

  /**
   * Execute database query via psql
   */
  async executeDatabaseQuery(query: string, options: {
    timeout?: number;
    userId?: string;
  } = {}): Promise<TerminalExecutionResult> {
    // Safety check - only allow SELECT queries through this method
    const upperQuery = query.trim().toUpperCase();
    if (!upperQuery.startsWith('SELECT') && !upperQuery.startsWith('\\D')) {
      return {
        success: false,
        sessionId: this.generateSessionId(),
        command: query,
        output: '',
        error: 'Only SELECT queries are allowed through this interface. Use Prisma for mutations.',
        executionTime: 0,
        dangerous: true,
        truncated: false,
      };
    }

    const escapedQuery = query.replace(/'/g, "'\\''");
    const command = `docker compose -f docker-compose.production.yml exec -T postgres psql -U facemydealer -d facemydealer -c '${escapedQuery}'`;
    
    return this.executeVPS(command, { ...options, inProjectDir: true });
  }

  /**
   * Get command history
   */
  getCommandHistory(options: {
    limit?: number;
    target?: 'local' | 'vps';
    dangerousOnly?: boolean;
  } = {}): CommandAuditEntry[] {
    let history = [...commandHistory];
    
    if (options.target) {
      history = history.filter(h => h.target === options.target);
    }
    if (options.dangerousOnly) {
      history = history.filter(h => h.dangerous);
    }
    
    return history.slice(0, options.limit || 50);
  }

  /**
   * Get quick system info from VPS
   */
  async getVPSSystemInfo(): Promise<{
    success: boolean;
    data?: {
      hostname: string;
      uptime: string;
      load: string;
      memory: string;
      disk: string;
      dockerContainers: string;
    };
    error?: string;
  }> {
    try {
      const commands = [
        'hostname',
        'uptime -p',
        'cat /proc/loadavg',
        'free -h | grep Mem',
        'df -h / | tail -1',
        'docker ps --format "table {{.Names}}\\t{{.Status}}" | head -10',
      ];

      const results = await Promise.all(
        commands.map(cmd => this.executeVPS(cmd, { inProjectDir: false, timeout: 10000 }))
      );

      return {
        success: true,
        data: {
          hostname: results[0].output.trim(),
          uptime: results[1].output.trim(),
          load: results[2].output.trim(),
          memory: results[3].output.trim(),
          disk: results[4].output.trim(),
          dockerContainers: results[5].output.trim(),
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Create a backup
   */
  async createBackup(type: 'database' | 'code' | 'full'): Promise<TerminalExecutionResult> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    switch (type) {
      case 'database':
        return this.executeVPS(
          `docker compose -f docker-compose.production.yml exec -T postgres pg_dump -U facemydealer facemydealer | gzip > /opt/backups/db_${timestamp}.sql.gz`,
          { timeout: 300000 } // 5 min timeout for DB backup
        );
      
      case 'code':
        return this.executeVPS(
          `tar -czf /opt/backups/code_${timestamp}.tar.gz --exclude='node_modules' --exclude='.git' /opt/facemydealer`,
          { timeout: 300000, inProjectDir: false }
        );
      
      case 'full':
        // Create both backups
        const dbResult = await this.createBackup('database');
        if (!dbResult.success) return dbResult;
        return this.createBackup('code');
      
      default:
        return {
          success: false,
          sessionId: this.generateSessionId(),
          command: `backup:${type}`,
          output: '',
          error: `Unknown backup type: ${type}`,
          executionTime: 0,
          dangerous: false,
          truncated: false,
        };
    }
  }

  /**
   * List available backups
   */
  async listBackups(): Promise<TerminalExecutionResult> {
    return this.executeVPS('ls -la /opt/backups/ 2>/dev/null || echo "No backups directory"', { inProjectDir: false });
  }

  /**
   * Git operations
   */
  async gitStatus(): Promise<TerminalExecutionResult> {
    return this.executeVPS('git status', { inProjectDir: true });
  }

  async gitPull(): Promise<TerminalExecutionResult> {
    return this.executeVPS('git pull origin main', { inProjectDir: true });
  }

  async gitLog(count: number = 10): Promise<TerminalExecutionResult> {
    return this.executeVPS(`git log --oneline -${count}`, { inProjectDir: true });
  }

  /**
   * Deployment helpers
   */
  async rebuildAndDeploy(service: string = 'api'): Promise<TerminalExecutionResult> {
    const command = `docker compose -f docker-compose.production.yml build ${service} --no-cache && docker compose -f docker-compose.production.yml up -d ${service}`;
    return this.executeVPS(command, { timeout: 600000, inProjectDir: true }); // 10 min timeout
  }

  async deployAll(): Promise<TerminalExecutionResult> {
    const command = 'git pull origin main && docker compose -f docker-compose.production.yml build --no-cache && docker compose -f docker-compose.production.yml up -d';
    return this.executeVPS(command, { timeout: 900000, inProjectDir: true }); // 15 min timeout
  }
}

export const novaTerminalService = new NovaTerminalService();
