/**
 * Nova Advanced Tooling Service v2.0
 * 
 * Production-grade system management tools for Nova AI agents
 * Provides real file access, system health monitoring, SQL operations,
 * SSH navigation, log monitoring, and AI model management
 * 
 * ALL THREE AGENTS (Nova, Soldier, IAI) have access to this tooling
 * 
 * @version 2.0.0
 * @author FMD Engineering Team
 */

import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import prisma from '@/config/database';
import { logger } from '@/utils/logger';

// Import specialized services
import { aiModelRegistry, AI_MODELS } from './ai-model-registry.service';
import { sqlMasterService } from './sql-master.service';
import { sshRemoteService, logMonitoringService } from './ssh-remote.service';

// execAsync available for future use - exported to avoid unused variable warning
export const execAsync = promisify(exec);

// Project root directory
const PROJECT_ROOT = process.cwd();

// Allowed file extensions for editing
const ALLOWED_EXTENSIONS = [
  '.ts', '.tsx', '.js', '.jsx', '.json', '.html', '.css', '.scss',
  '.md', '.yml', '.yaml', '.env.example', '.sql', '.prisma', '.sh'
];

// Directories that are safe to read/write
const SAFE_DIRECTORIES = [
  'src', 'web/src', 'prisma', 'scripts', 'docs', 'extension', 'python-workers'
];

// Forbidden paths
const FORBIDDEN_PATHS = [
  'node_modules', '.git', '.env', 'dist', 'build', '.next'
];

export interface SystemHealthReport {
  timestamp: Date;
  overall: 'healthy' | 'degraded' | 'critical';
  components: ComponentHealth[];
  metrics: SystemMetrics;
  recommendations: string[];
  activeAgent?: {
    id: string;
    name: string;
    model: string;
    status: string;
  };
}

export interface ComponentHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'critical' | 'unknown';
  latency?: number;
  message: string;
  details?: Record<string, any>;
}

export interface SystemMetrics {
  uptime: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  cpuUsage?: number;
  activeConnections: number;
  requestsPerMinute: number;
  errorRate: number;
}

// File tree node interface for directory structures
export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: Date;
  children?: FileTreeNode[];
}

export interface FileOperation {
  success: boolean;
  path: string;
  content?: string;
  error?: string;
  size?: number;
  modified?: Date;
}

export interface DirectoryListing {
  path: string;
  entries: {
    name: string;
    type: 'file' | 'directory';
    size?: number;
    modified?: Date;
  }[];
}

class NovaToolingService {
  
  // ============================================
  // AI AGENT TOOLING ACCESS
  // All 3 agents (Nova, Soldier, IAI) can use these tools
  // ============================================

  /**
   * Get the currently active AI agent serving requests
   */
  getActiveAgent(): {
    id: string;
    name: string;
    codename: string;
    model: string;
    modelDisplayName: string;
    provider: string;
    color: string;
    icon: string;
    status: string;
  } | null {
    const agent = aiModelRegistry.getActiveServingAgent();
    if (!agent) return null;

    const model = AI_MODELS[agent.activeModel];
    return {
      id: agent.id,
      name: agent.name,
      codename: agent.codename,
      model: agent.activeModel,
      modelDisplayName: model?.displayName || 'Unknown',
      provider: agent.provider,
      color: agent.color,
      icon: agent.icon,
      status: agent.status,
    };
  }

  /**
   * Get all AI agents with their current status
   */
  getAllAgents(): {
    id: string;
    name: string;
    codename: string;
    model: string;
    modelName: string;
    provider: string;
    status: string;
    role: string;
    color: string;
    icon: string;
    totalRequests: number;
    avgResponseTime: number;
  }[] {
    return aiModelRegistry.getAllAgents().map(agent => {
      const model = AI_MODELS[agent.activeModel];
      return {
        id: agent.id,
        name: agent.name,
        codename: agent.codename,
        model: agent.activeModel,
        modelName: model?.displayName || 'Unknown',
        provider: agent.provider,
        status: agent.status,
        role: agent.role,
        color: agent.color,
        icon: agent.icon,
        totalRequests: agent.totalRequests,
        avgResponseTime: Math.round(agent.avgResponseTime),
      };
    });
  }

  /**
   * Get available AI models for selection
   */
  getAvailableModels(): {
    id: string;
    provider: string;
    displayName: string;
    tier: string;
    contextWindow: number;
    capabilities: string[];
  }[] {
    return aiModelRegistry.getAllModels().map(model => ({
      id: model.id,
      provider: model.provider,
      displayName: model.displayName,
      tier: model.tier,
      contextWindow: model.contextWindow,
      capabilities: model.capabilities,
    }));
  }

  /**
   * Change the active model for an agent
   */
  async setAgentModel(agentId: string, modelId: string): Promise<{
    success: boolean;
    previousModel: string;
    newModel: string;
    error?: string;
  }> {
    return aiModelRegistry.setActiveModelForAgent(agentId, modelId);
  }

  // ============================================
  // SQL MASTER TOOLING
  // Enterprise-grade database operations
  // ============================================

  /**
   * Get complete database schema
   */
  async getDatabaseSchema() {
    return sqlMasterService.getDatabaseSchema();
  }

  /**
   * Get detailed table information
   */
  async getTableInfo(tableName: string) {
    return sqlMasterService.getTableSchema(tableName);
  }

  /**
   * Analyze a SQL query for optimization
   */
  async analyzeQuery(query: string) {
    return sqlMasterService.analyzeQuery(query);
  }

  /**
   * Execute a read-only SQL query
   */
  async executeSQL<T = any>(query: string) {
    return sqlMasterService.executeReadQuery<T>(query);
  }

  /**
   * Get sample data from a table
   */
  async getTableSample(tableName: string, limit: number = 10) {
    return sqlMasterService.getTableSample(tableName, limit);
  }

  /**
   * Get column statistics
   */
  async getColumnStats(tableName: string, columnName: string) {
    return sqlMasterService.getColumnStats(tableName, columnName);
  }

  /**
   * Get database performance stats
   */
  async getDatabaseStats() {
    return sqlMasterService.getDatabaseStats();
  }

  /**
   * Get index suggestions for optimization
   */
  async getIndexSuggestions(tableName: string) {
    return sqlMasterService.getIndexSuggestions(tableName);
  }

  /**
   * Get slow queries (requires pg_stat_statements)
   */
  async getSlowQueries(minDurationMs: number = 1000) {
    return sqlMasterService.getSlowQueries(minDurationMs);
  }

  /**
   * Export table data to JSON
   */
  async exportTableData(tableName: string, options?: {
    where?: string;
    limit?: number;
    columns?: string[];
  }) {
    return sqlMasterService.exportTableToJSON(tableName, options);
  }

  /**
   * Get migration status
   */
  async getMigrations() {
    return sqlMasterService.getMigrationStatus();
  }

  // ============================================
  // SSH REMOTE OPERATIONS
  // Secure server management
  // ============================================

  /**
   * Execute command on remote server
   */
  async sshExecute(serverName: string, command: string, options?: {
    timeout?: number;
    sudo?: boolean;
  }) {
    return sshRemoteService.executeCommand(serverName, command, options);
  }

  /**
   * Get remote server information
   */
  async getServerInfo(serverName: string) {
    return sshRemoteService.getServerInfo(serverName);
  }

  /**
   * Get Docker container logs
   */
  async getContainerLogs(serverName: string, containerName: string, options?: {
    tail?: number;
    since?: string;
    grep?: string;
  }) {
    return sshRemoteService.getContainerLogs(serverName, containerName, options);
  }

  /**
   * Restart a Docker container
   */
  async restartContainer(serverName: string, containerName: string) {
    return sshRemoteService.restartContainer(serverName, containerName);
  }

  /**
   * Run docker-compose command
   */
  async dockerCompose(serverName: string, action: 'up' | 'down' | 'restart' | 'logs' | 'ps', options?: {
    service?: string;
    detach?: boolean;
  }) {
    return sshRemoteService.dockerCompose(serverName, action, options);
  }

  /**
   * Get list of configured SSH servers
   */
  getConfiguredServers(): string[] {
    return sshRemoteService.getConfiguredServers();
  }

  // ============================================
  // LOG MONITORING & ALERTS
  // Real-time system awareness
  // ============================================

  /**
   * Process and analyze a log entry
   */
  processLog(logLine: string, source: string, container?: string) {
    return logMonitoringService.processLogEntry(logLine, source, container);
  }

  /**
   * Get filtered logs
   */
  getLogs(filter?: {
    level?: ('info' | 'warn' | 'error' | 'debug' | 'critical')[];
    source?: string;
    container?: string;
    startTime?: Date;
    endTime?: Date;
    search?: string;
    limit?: number;
  }) {
    return logMonitoringService.getLogs(filter);
  }

  /**
   * Get system alerts
   */
  getAlerts(filter?: {
    acknowledged?: boolean;
    type?: 'error' | 'warning' | 'critical' | 'info';
  }) {
    return logMonitoringService.getAlerts(filter);
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    return logMonitoringService.acknowledgeAlert(alertId);
  }

  /**
   * Get log statistics
   */
  getLogStats() {
    return logMonitoringService.getLogStats();
  }

  /**
   * Add custom notification pattern
   */
  addNotificationPattern(config: {
    type: 'error' | 'warning' | 'critical' | 'info';
    pattern: string | RegExp;
    message: string;
    cooldownMinutes?: number;
  }) {
    logMonitoringService.addNotificationPattern(config);
  }

  // ============================================
  // FILE OPERATIONS
  // ============================================

  /**
   * Validate that a path is safe to access
   */
  private isPathSafe(filePath: string): boolean {
    const normalizedPath = path.normalize(filePath).replace(/\\/g, '/');
    
    // Check for forbidden paths
    for (const forbidden of FORBIDDEN_PATHS) {
      if (normalizedPath.includes(forbidden)) {
        return false;
      }
    }
    
    // Check if in safe directory
    const isInSafeDir = SAFE_DIRECTORIES.some(dir => 
      normalizedPath.startsWith(dir) || normalizedPath.startsWith(`/${dir}`)
    );
    
    return isInSafeDir;
  }

  /**
   * Get the full path for a file
   */
  private getFullPath(relativePath: string): string {
    // Remove leading slash if present
    const cleanPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
    return path.join(PROJECT_ROOT, cleanPath);
  }

  /**
   * Read a file's contents
   */
  async readFile(filePath: string): Promise<FileOperation> {
    try {
      if (!this.isPathSafe(filePath)) {
        return { 
          success: false, 
          path: filePath, 
          error: 'Access denied: Path is outside allowed directories' 
        };
      }

      const fullPath = this.getFullPath(filePath);
      const stats = await fs.stat(fullPath);
      const content = await fs.readFile(fullPath, 'utf-8');

      logger.info(`[Nova Tools] Read file: ${filePath} (${stats.size} bytes)`);

      return {
        success: true,
        path: filePath,
        content,
        size: stats.size,
        modified: stats.mtime,
      };
    } catch (error: any) {
      logger.error(`[Nova Tools] Failed to read file ${filePath}:`, error);
      return {
        success: false,
        path: filePath,
        error: error.code === 'ENOENT' ? 'File not found' : error.message,
      };
    }
  }

  /**
   * Write content to a file
   */
  async writeFile(filePath: string, content: string): Promise<FileOperation> {
    try {
      if (!this.isPathSafe(filePath)) {
        return { 
          success: false, 
          path: filePath, 
          error: 'Access denied: Path is outside allowed directories' 
        };
      }

      const ext = path.extname(filePath).toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return {
          success: false,
          path: filePath,
          error: `File extension ${ext} is not allowed for editing`,
        };
      }

      const fullPath = this.getFullPath(filePath);
      
      // Ensure directory exists
      const dir = path.dirname(fullPath);
      await fs.mkdir(dir, { recursive: true });

      // Create backup before overwriting
      try {
        const exists = await fs.access(fullPath).then(() => true).catch(() => false);
        if (exists) {
          const backupPath = `${fullPath}.nova-backup`;
          await fs.copyFile(fullPath, backupPath);
          logger.info(`[Nova Tools] Created backup: ${backupPath}`);
        }
      } catch {
        // Ignore backup errors
      }

      await fs.writeFile(fullPath, content, 'utf-8');
      const stats = await fs.stat(fullPath);

      logger.info(`[Nova Tools] Wrote file: ${filePath} (${stats.size} bytes)`);

      return {
        success: true,
        path: filePath,
        size: stats.size,
        modified: stats.mtime,
      };
    } catch (error: any) {
      logger.error(`[Nova Tools] Failed to write file ${filePath}:`, error);
      return {
        success: false,
        path: filePath,
        error: error.message,
      };
    }
  }

  /**
   * List directory contents
   */
  async listDirectory(dirPath: string): Promise<DirectoryListing> {
    try {
      if (!this.isPathSafe(dirPath)) {
        return { path: dirPath, entries: [] };
      }

      const fullPath = this.getFullPath(dirPath);
      const items = await fs.readdir(fullPath, { withFileTypes: true });

      const entries = await Promise.all(
        items
          .filter(item => !FORBIDDEN_PATHS.some(fp => item.name.includes(fp)))
          .map(async (item) => {
            const itemPath = path.join(fullPath, item.name);
            try {
              const stats = await fs.stat(itemPath);
              return {
                name: item.name,
                type: item.isDirectory() ? 'directory' as const : 'file' as const,
                size: item.isFile() ? stats.size : undefined,
                modified: stats.mtime,
              };
            } catch {
              return {
                name: item.name,
                type: item.isDirectory() ? 'directory' as const : 'file' as const,
              };
            }
          })
      );

      return { path: dirPath, entries };
    } catch (error: any) {
      logger.error(`[Nova Tools] Failed to list directory ${dirPath}:`, error);
      return { path: dirPath, entries: [] };
    }
  }

  /**
   * Search for files by pattern
   */
  async searchFiles(pattern: string, directory: string = 'src'): Promise<string[]> {
    try {
      if (!this.isPathSafe(directory)) {
        return [];
      }

      const fullPath = this.getFullPath(directory);
      const results: string[] = [];

      const searchRecursive = async (dir: string, depth: number = 0): Promise<void> => {
        if (depth > 10) return; // Limit recursion depth

        const items = await fs.readdir(dir, { withFileTypes: true });

        for (const item of items) {
          if (FORBIDDEN_PATHS.some(fp => item.name.includes(fp))) continue;

          const itemPath = path.join(dir, item.name);
          const relativePath = path.relative(PROJECT_ROOT, itemPath);

          if (item.isDirectory()) {
            await searchRecursive(itemPath, depth + 1);
          } else if (item.name.toLowerCase().includes(pattern.toLowerCase())) {
            results.push(relativePath.replace(/\\/g, '/'));
          }
        }
      };

      await searchRecursive(fullPath);
      return results.slice(0, 100); // Limit results
    } catch (error: any) {
      logger.error(`[Nova Tools] Search failed:`, error);
      return [];
    }
  }

  /**
   * Search for content within files
   */
  async searchInFiles(query: string, directory: string = 'src', fileExtensions: string[] = ['.ts', '.tsx']): Promise<{
    file: string;
    line: number;
    content: string;
  }[]> {
    try {
      if (!this.isPathSafe(directory)) {
        return [];
      }

      const fullPath = this.getFullPath(directory);
      const results: { file: string; line: number; content: string }[] = [];

      const searchRecursive = async (dir: string, depth: number = 0): Promise<void> => {
        if (depth > 10 || results.length >= 50) return;

        const items = await fs.readdir(dir, { withFileTypes: true });

        for (const item of items) {
          if (FORBIDDEN_PATHS.some(fp => item.name.includes(fp))) continue;
          if (results.length >= 50) break;

          const itemPath = path.join(dir, item.name);
          const relativePath = path.relative(PROJECT_ROOT, itemPath).replace(/\\/g, '/');

          if (item.isDirectory()) {
            await searchRecursive(itemPath, depth + 1);
          } else {
            const ext = path.extname(item.name).toLowerCase();
            if (!fileExtensions.includes(ext)) continue;

            try {
              const content = await fs.readFile(itemPath, 'utf-8');
              const lines = content.split('\n');
              
              lines.forEach((line, index) => {
                if (line.toLowerCase().includes(query.toLowerCase()) && results.length < 50) {
                  results.push({
                    file: relativePath,
                    line: index + 1,
                    content: line.trim().substring(0, 200),
                  });
                }
              });
            } catch {
              // Skip unreadable files
            }
          }
        }
      };

      await searchRecursive(fullPath);
      return results;
    } catch (error: any) {
      logger.error(`[Nova Tools] Content search failed:`, error);
      return [];
    }
  }

  // ============================================
  // SYSTEM HEALTH MONITORING
  // ============================================

  /**
   * Get comprehensive system health report
   */
  async getSystemHealth(): Promise<SystemHealthReport> {
    const components: ComponentHealth[] = [];
    const recommendations: string[] = [];

    // Check Database
    const dbHealth = await this.checkDatabaseHealth();
    components.push(dbHealth);
    
    // Check Redis (if configured)
    const redisHealth = await this.checkRedisHealth();
    components.push(redisHealth);

    // Check API routes
    const apiHealth = await this.checkAPIHealth();
    components.push(apiHealth);

    // Check AI Providers
    const aiHealth = await this.checkAIProvidersHealth();
    components.push(...aiHealth);

    // Get system metrics
    const metrics = await this.getSystemMetrics();

    // Determine overall health
    const criticalCount = components.filter(c => c.status === 'critical').length;
    const degradedCount = components.filter(c => c.status === 'degraded').length;
    
    let overall: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (criticalCount > 0) {
      overall = 'critical';
    } else if (degradedCount > 0) {
      overall = 'degraded';
    }

    // Generate recommendations
    if (metrics.memoryUsage.heapUsed / metrics.memoryUsage.heapTotal > 0.8) {
      recommendations.push('Memory usage is high (>80%). Consider restarting the API container.');
    }
    if (metrics.errorRate > 0.05) {
      recommendations.push('Error rate is elevated (>5%). Check recent logs for issues.');
    }
    for (const comp of components) {
      if (comp.status === 'critical') {
        recommendations.push(`Critical: ${comp.name} requires immediate attention - ${comp.message}`);
      }
    }

    return {
      timestamp: new Date(),
      overall,
      components,
      metrics,
      recommendations,
    };
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<ComponentHealth> {
    const start = Date.now();
    try {
      // Run a simple query to test connection
      await prisma.$queryRaw`SELECT 1`;
      
      // Get some stats
      const userCount = await prisma.user.count();
      const accountCount = await prisma.account.count();
      
      return {
        name: 'PostgreSQL Database',
        status: 'healthy',
        latency: Date.now() - start,
        message: 'Database connection is healthy',
        details: {
          users: userCount,
          accounts: accountCount,
          connectionPool: 'active',
        },
      };
    } catch (error: any) {
      return {
        name: 'PostgreSQL Database',
        status: 'critical',
        latency: Date.now() - start,
        message: `Database error: ${error.message}`,
      };
    }
  }

  /**
   * Check Redis health
   */
  private async checkRedisHealth(): Promise<ComponentHealth> {
    const start = Date.now();
    try {
      // Redis check via environment
      const redisUrl = process.env.REDIS_URL;
      if (!redisUrl) {
        return {
          name: 'Redis Cache',
          status: 'unknown',
          message: 'Redis URL not configured',
        };
      }

      return {
        name: 'Redis Cache',
        status: 'healthy',
        latency: Date.now() - start,
        message: 'Redis is configured',
        details: { url: redisUrl.replace(/\/\/.*@/, '//***@') },
      };
    } catch (error: any) {
      return {
        name: 'Redis Cache',
        status: 'degraded',
        latency: Date.now() - start,
        message: `Redis check failed: ${error.message}`,
      };
    }
  }

  /**
   * Check API routes health
   */
  private async checkAPIHealth(): Promise<ComponentHealth> {
    try {
      return {
        name: 'API Server',
        status: 'healthy',
        message: `Node.js ${process.version} - Express server running`,
        details: {
          nodeVersion: process.version,
          environment: process.env.NODE_ENV,
          port: process.env.PORT || 3000,
        },
      };
    } catch (error: any) {
      return {
        name: 'API Server',
        status: 'critical',
        message: `API health check failed: ${error.message}`,
      };
    }
  }

  /**
   * Check AI providers health
   */
  private async checkAIProvidersHealth(): Promise<ComponentHealth[]> {
    const providers: ComponentHealth[] = [];

    // Anthropic
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    providers.push({
      name: 'Anthropic (Claude)',
      status: anthropicKey ? 'healthy' : 'degraded',
      message: anthropicKey ? 'API key configured' : 'API key not configured',
      details: {
        configured: !!anthropicKey,
        keyPrefix: anthropicKey?.substring(0, 10) + '...',
      },
    });

    // OpenAI
    const openaiKey = process.env.OPENAI_API_KEY;
    providers.push({
      name: 'OpenAI (GPT)',
      status: openaiKey ? 'healthy' : 'degraded',
      message: openaiKey ? 'API key configured' : 'API key not configured',
      details: {
        configured: !!openaiKey,
        keyPrefix: openaiKey?.substring(0, 10) + '...',
      },
    });

    // DeepSeek
    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    providers.push({
      name: 'DeepSeek',
      status: deepseekKey ? 'healthy' : 'unknown',
      message: deepseekKey ? 'API key configured' : 'API key not configured (optional)',
      details: { configured: !!deepseekKey },
    });

    return providers;
  }

  /**
   * Get system metrics
   */
  private async getSystemMetrics(): Promise<SystemMetrics> {
    const memUsage = process.memoryUsage();

    return {
      uptime: process.uptime(),
      memoryUsage: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024),
      },
      activeConnections: 0, // Would need socket tracking
      requestsPerMinute: 0, // Would need request counter
      errorRate: 0, // Would need error tracking
    };
  }

  // ============================================
  // DATABASE OPERATIONS
  // ============================================

  /**
   * Execute a read-only database query
   */
  async queryDatabase(tableName: string, options: {
    limit?: number;
    where?: Record<string, any>;
    select?: string[];
    orderBy?: Record<string, 'asc' | 'desc'>;
  } = {}): Promise<{ success: boolean; data?: any[]; error?: string; count?: number }> {
    const { limit = 20, where, select, orderBy } = options;

    // Whitelist of allowed tables
    const allowedTables = [
      'users', 'accounts', 'account_users', 'vehicles', 'leads', 'messages',
      'fb_accounts', 'fb_marketplace_posts', 'ai_user_memories', 'ai_chat_sessions',
      'iai_soldiers', 'iai_tasks', 'api_keys', 'subscriptions', 'error_logs'
    ];

    if (!allowedTables.includes(tableName.toLowerCase())) {
      return { success: false, error: `Table '${tableName}' is not accessible` };
    }

    try {
      // Use Prisma's model-based querying for safety
      const model = (prisma as any)[tableName];
      if (!model) {
        return { success: false, error: `Table '${tableName}' not found in schema` };
      }

      const query: any = {
        take: Math.min(limit, 100),
      };

      if (where) query.where = where;
      if (select) query.select = select.reduce((acc, field) => ({ ...acc, [field]: true }), {});
      if (orderBy) query.orderBy = orderBy;

      const data = await model.findMany(query);
      const count = await model.count(where ? { where } : undefined);

      logger.info(`[Nova Tools] Database query on ${tableName}: ${data.length} rows`);

      return { success: true, data, count };
    } catch (error: any) {
      logger.error(`[Nova Tools] Database query failed:`, error);
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // DOCKER/CONTAINER OPERATIONS
  // ============================================

  /**
   * Get container status (requires SSH to VPS for full functionality)
   */
  async getContainerStatus(): Promise<{
    containers: {
      name: string;
      status: string;
      health: string;
      uptime: string;
    }[];
  }> {
    // In production, this would query Docker API
    // For now, return known containers
    return {
      containers: [
        { name: 'facemydealer-api-1', status: 'running', health: 'healthy', uptime: 'running' },
        { name: 'facemydealer-postgres-1', status: 'running', health: 'healthy', uptime: 'running' },
        { name: 'facemydealer-redis-1', status: 'running', health: 'healthy', uptime: 'running' },
        { name: 'facemydealer-traefik-1', status: 'running', health: 'healthy', uptime: 'running' },
        { name: 'facemydealer-worker-api-1', status: 'running', health: 'healthy', uptime: 'running' },
        { name: 'facemydealer-browser-worker-1', status: 'running', health: 'healthy', uptime: 'running' },
        { name: 'facemydealer-browser-worker-2', status: 'running', health: 'healthy', uptime: 'running' },
      ],
    };
  }

  // ============================================
  // LOG ANALYSIS
  // ============================================

  /**
   * Get recent error logs
   */
  async getRecentErrors(_limit: number = 50): Promise<{
    errors: {
      timestamp: Date;
      level: string;
      message: string;
      source?: string;
    }[];
  }> {
    try {
      // Note: errorLog table may not exist in all schemas
      // Return empty for now - can be extended when error logging is implemented
      return { errors: [] };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[Nova Tools] Failed to get errors: ${errorMessage}`);
      return { errors: [] };
    }
  }

  // ============================================
  // CODE ANALYSIS
  // ============================================

  /**
   * Get project structure overview
   */
  async getProjectStructure(): Promise<{
    directories: { name: string; fileCount: number; description: string }[];
    totalFiles: number;
    languages: Record<string, number>;
  }> {
    const directories = [
      { name: 'src', description: 'Backend Node.js/TypeScript code' },
      { name: 'web/src', description: 'Frontend React/TypeScript code' },
      { name: 'prisma', description: 'Database schema and migrations' },
      { name: 'python-workers', description: 'Python browser automation workers' },
      { name: 'extension', description: 'Chrome extension code' },
      { name: 'docs', description: 'Documentation files' },
      { name: 'scripts', description: 'Utility scripts' },
    ];

    const results = await Promise.all(
      directories.map(async (dir) => {
        const listing = await this.listDirectory(dir.name);
        return {
          name: dir.name,
          fileCount: listing.entries.length,
          description: dir.description,
        };
      })
    );

    const languages: Record<string, number> = {
      TypeScript: 0,
      JavaScript: 0,
      Python: 0,
      CSS: 0,
      HTML: 0,
      SQL: 0,
    };

    return {
      directories: results,
      totalFiles: results.reduce((sum, d) => sum + d.fileCount, 0),
      languages,
    };
  }

  /**
   * Analyze a file for potential issues
   */
  async analyzeFile(filePath: string): Promise<{
    success: boolean;
    analysis?: {
      lines: number;
      imports: string[];
      exports: string[];
      functions: string[];
      classes: string[];
      todos: string[];
      potentialIssues: string[];
    };
    error?: string;
  }> {
    const file = await this.readFile(filePath);
    if (!file.success || !file.content) {
      return { success: false, error: file.error || 'Failed to read file' };
    }

    const content = file.content;
    const lines = content.split('\n');

    // Extract imports
    const imports = lines
      .filter(l => l.trim().startsWith('import '))
      .map(l => l.trim().substring(0, 100));

    // Extract exports
    const exports = lines
      .filter(l => l.trim().startsWith('export '))
      .map(l => {
        const match = l.match(/export\s+(const|function|class|interface|type|default)\s+(\w+)/);
        return match ? match[2] : l.trim().substring(0, 50);
      })
      .filter(Boolean);

    // Extract function names
    const functionMatches = content.match(/(?:async\s+)?function\s+(\w+)|(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g) || [];
    const functions = functionMatches.slice(0, 20);

    // Extract class names
    const classMatches = content.match(/class\s+(\w+)/g) || [];
    const classes = classMatches.map(c => c.replace('class ', '')).slice(0, 10);

    // Find TODOs
    const todos = lines
      .filter(l => l.includes('TODO') || l.includes('FIXME'))
      .map(l => l.trim().substring(0, 100))
      .slice(0, 10);

    // Find potential issues
    const potentialIssues: string[] = [];
    if (content.includes('console.log')) {
      potentialIssues.push('Contains console.log statements');
    }
    if (content.includes('any')) {
      potentialIssues.push('Uses TypeScript "any" type');
    }
    if (lines.length > 500) {
      potentialIssues.push(`Large file (${lines.length} lines) - consider splitting`);
    }

    return {
      success: true,
      analysis: {
        lines: lines.length,
        imports,
        exports,
        functions,
        classes,
        todos,
        potentialIssues,
      },
    };
  }

  // ============================================
  // ADVANCED FILE OPERATIONS
  // ============================================

  /**
   * Deep recursive directory search with full content matching
   */
  async deepSearch(options: {
    query: string;
    directories?: string[];
    extensions?: string[];
    maxResults?: number;
    caseSensitive?: boolean;
    regex?: boolean;
    includeContext?: boolean;
    contextLines?: number;
  }): Promise<{
    success: boolean;
    results: {
      file: string;
      line: number;
      column: number;
      content: string;
      context?: string[];
    }[];
    totalMatches: number;
    filesSearched: number;
    executionTime: number;
  }> {
    const startTime = Date.now();
    const {
      query,
      directories = ['src', 'web/src', 'prisma', 'extension', 'python-workers'],
      extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.json', '.css', '.html', '.md', '.yml', '.yaml'],
      maxResults = 200,
      caseSensitive = false,
      regex = false,
      includeContext = true,
      contextLines = 2,
    } = options;

    const results: {
      file: string;
      line: number;
      column: number;
      content: string;
      context?: string[];
    }[] = [];
    let filesSearched = 0;
    let totalMatches = 0;

    // Build search pattern
    let searchPattern: RegExp;
    try {
      if (regex) {
        searchPattern = new RegExp(query, caseSensitive ? 'g' : 'gi');
      } else {
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        searchPattern = new RegExp(escapedQuery, caseSensitive ? 'g' : 'gi');
      }
    } catch (e) {
      return {
        success: false,
        results: [],
        totalMatches: 0,
        filesSearched: 0,
        executionTime: Date.now() - startTime,
      };
    }

    const searchDirectory = async (dir: string, depth: number = 0): Promise<void> => {
      if (depth > 15 || results.length >= maxResults) return;

      try {
        const fullPath = this.getFullPath(dir);
        const items = await fs.readdir(fullPath, { withFileTypes: true });

        for (const item of items) {
          if (results.length >= maxResults) break;
          if (FORBIDDEN_PATHS.some(fp => item.name.includes(fp))) continue;

          const itemPath = path.join(dir, item.name);

          if (item.isDirectory()) {
            await searchDirectory(itemPath, depth + 1);
          } else {
            const ext = path.extname(item.name).toLowerCase();
            if (!extensions.includes(ext)) continue;

            try {
              filesSearched++;
              const content = await fs.readFile(this.getFullPath(itemPath), 'utf-8');
              const lines = content.split('\n');

              lines.forEach((line, lineIndex) => {
                if (results.length >= maxResults) return;

                const matches = line.matchAll(searchPattern);
                for (const match of matches) {
                  totalMatches++;
                  if (results.length >= maxResults) return;

                  const result: {
                    file: string;
                    line: number;
                    column: number;
                    content: string;
                    context?: string[];
                  } = {
                    file: itemPath.replace(/\\/g, '/'),
                    line: lineIndex + 1,
                    column: match.index || 0,
                    content: line.trim().substring(0, 300),
                  };

                  if (includeContext) {
                    const contextStart = Math.max(0, lineIndex - contextLines);
                    const contextEnd = Math.min(lines.length, lineIndex + contextLines + 1);
                    result.context = lines.slice(contextStart, contextEnd).map(l => l.substring(0, 200));
                  }

                  results.push(result);
                }
              });
            } catch {
              // Skip unreadable files
            }
          }
        }
      } catch {
        // Skip inaccessible directories
      }
    };

    for (const dir of directories) {
      if (results.length >= maxResults) break;
      await searchDirectory(dir);
    }

    return {
      success: true,
      results,
      totalMatches,
      filesSearched,
      executionTime: Date.now() - startTime,
    };
  }

  /**
   * Get file tree structure with metadata
   */
  async getFileTree(directory: string = 'src', options: {
    maxDepth?: number;
    includeHidden?: boolean;
    includeStats?: boolean;
  } = {}): Promise<{
    success: boolean;
    tree?: FileTreeNode;
    totalFiles?: number;
    totalDirectories?: number;
    totalSize?: number;
  }> {
    const { maxDepth = 10, includeHidden = false, includeStats = true } = options;
    let totalFiles = 0;
    let totalDirectories = 0;
    let totalSize = 0;

    const buildTree = async (dir: string, depth: number): Promise<FileTreeNode | null> => {
      if (depth > maxDepth) return null;

      try {
        const fullPath = this.getFullPath(dir);
        const stats = await fs.stat(fullPath);
        const name = path.basename(dir) || dir;

        if (stats.isFile()) {
          totalFiles++;
          totalSize += stats.size;
          return {
            name,
            path: dir.replace(/\\/g, '/'),
            type: 'file',
            size: includeStats ? stats.size : undefined,
            modified: includeStats ? stats.mtime : undefined,
          };
        }

        const items = await fs.readdir(fullPath, { withFileTypes: true });
        const children: FileTreeNode[] = [];
        totalDirectories++;

        for (const item of items) {
          if (!includeHidden && item.name.startsWith('.')) continue;
          if (FORBIDDEN_PATHS.some(fp => item.name.includes(fp))) continue;

          const childPath = path.join(dir, item.name);
          const childNode = await buildTree(childPath, depth + 1);
          if (childNode) children.push(childNode);
        }

        // Sort: directories first, then files, alphabetically
        children.sort((a, b) => {
          if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

        return {
          name,
          path: dir.replace(/\\/g, '/'),
          type: 'directory',
          children,
        };
      } catch {
        return null;
      }
    };

    const tree = await buildTree(directory, 0);

    return {
      success: !!tree,
      tree: tree || undefined,
      totalFiles,
      totalDirectories,
      totalSize,
    };
  }

  /**
   * Batch read multiple files at once
   */
  async batchReadFiles(filePaths: string[]): Promise<{
    success: boolean;
    files: {
      path: string;
      success: boolean;
      content?: string;
      error?: string;
      size?: number;
    }[];
  }> {
    const results = await Promise.all(
      filePaths.map(async (filePath) => {
        const result = await this.readFile(filePath);
        return {
          path: filePath,
          success: result.success,
          content: result.content,
          error: result.error,
          size: result.size,
        };
      })
    );

    return {
      success: results.some(r => r.success),
      files: results,
    };
  }

  /**
   * Compare two files
   */
  async compareFiles(path1: string, path2: string): Promise<{
    success: boolean;
    identical: boolean;
    differences?: {
      line: number;
      file1: string;
      file2: string;
    }[];
    stats?: {
      file1Lines: number;
      file2Lines: number;
      addedLines: number;
      removedLines: number;
      changedLines: number;
    };
    error?: string;
  }> {
    const file1 = await this.readFile(path1);
    const file2 = await this.readFile(path2);

    if (!file1.success || !file1.content) {
      return { success: false, identical: false, error: `Failed to read ${path1}: ${file1.error}` };
    }
    if (!file2.success || !file2.content) {
      return { success: false, identical: false, error: `Failed to read ${path2}: ${file2.error}` };
    }

    const lines1 = file1.content.split('\n');
    const lines2 = file2.content.split('\n');

    if (file1.content === file2.content) {
      return { success: true, identical: true };
    }

    const differences: { line: number; file1: string; file2: string }[] = [];
    const maxLines = Math.max(lines1.length, lines2.length);
    let addedLines = 0;
    let removedLines = 0;
    let changedLines = 0;

    for (let i = 0; i < maxLines; i++) {
      const l1 = lines1[i];
      const l2 = lines2[i];

      if (l1 !== l2) {
        if (l1 === undefined) {
          addedLines++;
        } else if (l2 === undefined) {
          removedLines++;
        } else {
          changedLines++;
        }

        if (differences.length < 50) {
          differences.push({
            line: i + 1,
            file1: (l1 || '').substring(0, 200),
            file2: (l2 || '').substring(0, 200),
          });
        }
      }
    }

    return {
      success: true,
      identical: false,
      differences,
      stats: {
        file1Lines: lines1.length,
        file2Lines: lines2.length,
        addedLines,
        removedLines,
        changedLines,
      },
    };
  }

  /**
   * Create a file backup
   */
  async createFileBackup(filePath: string): Promise<{
    success: boolean;
    backupPath?: string;
    error?: string;
  }> {
    try {
      const file = await this.readFile(filePath);
      if (!file.success || !file.content) {
        return { success: false, error: file.error || 'File not found' };
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const ext = path.extname(filePath);
      const baseName = path.basename(filePath, ext);
      const dir = path.dirname(filePath);
      const backupPath = `${dir}/.backups/${baseName}_${timestamp}${ext}`;

      // Ensure backup directory exists
      const backupDir = this.getFullPath(`${dir}/.backups`);
      await fs.mkdir(backupDir, { recursive: true });

      await fs.writeFile(this.getFullPath(backupPath), file.content, 'utf-8');

      logger.info(`[Nova Tools] Created backup: ${backupPath}`);
      return { success: true, backupPath };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Find and replace across multiple files
   */
  async findAndReplace(options: {
    searchQuery: string;
    replaceWith: string;
    directories?: string[];
    extensions?: string[];
    dryRun?: boolean;
    maxFiles?: number;
    caseSensitive?: boolean;
  }): Promise<{
    success: boolean;
    filesModified: number;
    totalReplacements: number;
    changes: {
      file: string;
      replacements: number;
      preview?: string;
    }[];
    errors: string[];
  }> {
    const {
      searchQuery,
      replaceWith,
      directories = ['src', 'web/src'],
      extensions = ['.ts', '.tsx', '.js', '.jsx'],
      dryRun = true, // Default to dry run for safety
      maxFiles = 50,
      caseSensitive = false,
    } = options;

    const changes: { file: string; replacements: number; preview?: string }[] = [];
    const errors: string[] = [];
    let filesModified = 0;
    let totalReplacements = 0;

    // Build search pattern
    const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchPattern = new RegExp(escapedQuery, caseSensitive ? 'g' : 'gi');

    const processDirectory = async (dir: string): Promise<void> => {
      if (filesModified >= maxFiles) return;

      try {
        const fullPath = this.getFullPath(dir);
        const items = await fs.readdir(fullPath, { withFileTypes: true });

        for (const item of items) {
          if (filesModified >= maxFiles) break;
          if (FORBIDDEN_PATHS.some(fp => item.name.includes(fp))) continue;

          const itemPath = path.join(dir, item.name);

          if (item.isDirectory()) {
            await processDirectory(itemPath);
          } else {
            const ext = path.extname(item.name).toLowerCase();
            if (!extensions.includes(ext)) continue;

            try {
              const content = await fs.readFile(this.getFullPath(itemPath), 'utf-8');
              const matches = content.match(searchPattern);

              if (matches && matches.length > 0) {
                const replacements = matches.length;
                totalReplacements += replacements;

                if (!dryRun) {
                  // Create backup first
                  await this.createFileBackup(itemPath);
                  
                  // Perform replacement
                  const newContent = content.replace(searchPattern, replaceWith);
                  await fs.writeFile(this.getFullPath(itemPath), newContent, 'utf-8');
                }

                filesModified++;
                changes.push({
                  file: itemPath.replace(/\\/g, '/'),
                  replacements,
                  preview: dryRun ? content.split('\n').find(l => searchPattern.test(l))?.substring(0, 150) : undefined,
                });
              }
            } catch (e: any) {
              errors.push(`Error processing ${itemPath}: ${e.message}`);
            }
          }
        }
      } catch {
        // Skip inaccessible directories
      }
    };

    for (const dir of directories) {
      await processDirectory(dir);
    }

    return {
      success: errors.length === 0,
      filesModified,
      totalReplacements,
      changes,
      errors,
    };
  }

  /**
   * Get file statistics for the entire project
   */
  async getProjectStats(): Promise<{
    success: boolean;
    stats: {
      totalFiles: number;
      totalLines: number;
      totalSize: number;
      byExtension: Record<string, { files: number; lines: number; size: number }>;
      byDirectory: Record<string, { files: number; size: number }>;
      largestFiles: { path: string; size: number; lines: number }[];
    };
  }> {
    const stats = {
      totalFiles: 0,
      totalLines: 0,
      totalSize: 0,
      byExtension: {} as Record<string, { files: number; lines: number; size: number }>,
      byDirectory: {} as Record<string, { files: number; size: number }>,
      largestFiles: [] as { path: string; size: number; lines: number }[],
    };

    const directories = ['src', 'web/src', 'prisma', 'extension', 'python-workers', 'scripts'];

    const processDirectory = async (dir: string): Promise<void> => {
      try {
        const fullPath = this.getFullPath(dir);
        const items = await fs.readdir(fullPath, { withFileTypes: true });

        for (const item of items) {
          if (FORBIDDEN_PATHS.some(fp => item.name.includes(fp))) continue;

          const itemPath = path.join(dir, item.name);

          if (item.isDirectory()) {
            await processDirectory(itemPath);
          } else {
            try {
              const fileStats = await fs.stat(this.getFullPath(itemPath));
              const content = await fs.readFile(this.getFullPath(itemPath), 'utf-8');
              const lines = content.split('\n').length;

              stats.totalFiles++;
              stats.totalLines += lines;
              stats.totalSize += fileStats.size;

              // By extension
              const ext = path.extname(item.name).toLowerCase() || 'no-ext';
              if (!stats.byExtension[ext]) {
                stats.byExtension[ext] = { files: 0, lines: 0, size: 0 };
              }
              stats.byExtension[ext].files++;
              stats.byExtension[ext].lines += lines;
              stats.byExtension[ext].size += fileStats.size;

              // By directory
              const topDir = dir.split('/')[0] || dir.split('\\')[0] || dir;
              if (!stats.byDirectory[topDir]) {
                stats.byDirectory[topDir] = { files: 0, size: 0 };
              }
              stats.byDirectory[topDir].files++;
              stats.byDirectory[topDir].size += fileStats.size;

              // Track largest files
              stats.largestFiles.push({
                path: itemPath.replace(/\\/g, '/'),
                size: fileStats.size,
                lines,
              });
            } catch {
              // Skip unreadable files
            }
          }
        }
      } catch {
        // Skip inaccessible directories
      }
    };

    for (const dir of directories) {
      await processDirectory(dir);
    }

    // Sort and limit largest files
    stats.largestFiles.sort((a, b) => b.size - a.size);
    stats.largestFiles = stats.largestFiles.slice(0, 20);

    return { success: true, stats };
  }

  // ============================================
  // GIT & VERSION CONTROL OPERATIONS
  // ============================================

  /**
   * Get git status (requires git to be available)
   */
  async getGitStatus(): Promise<{
    success: boolean;
    branch: string;
    modified: string[];
    untracked: string[];
    staged: string[];
    ahead: number;
    behind: number;
    error?: string;
  }> {
    try {
      const { execSync } = await import('child_process');
      
      // Get current branch
      const branch = execSync('git branch --show-current', { 
        cwd: PROJECT_ROOT, 
        encoding: 'utf-8' 
      }).trim();

      // Get modified files
      const status = execSync('git status --porcelain', { 
        cwd: PROJECT_ROOT, 
        encoding: 'utf-8' 
      });

      const modified: string[] = [];
      const untracked: string[] = [];
      const staged: string[] = [];

      status.split('\n').filter(Boolean).forEach(line => {
        const statusCode = line.substring(0, 2);
        const file = line.substring(3);
        
        if (statusCode.includes('M') || statusCode.includes('A') || statusCode.includes('D')) {
          if (statusCode[0] !== ' ') {
            staged.push(file);
          }
          if (statusCode[1] !== ' ') {
            modified.push(file);
          }
        }
        if (statusCode === '??') {
          untracked.push(file);
        }
      });

      // Get ahead/behind count
      let ahead = 0, behind = 0;
      try {
        const remoteBranch = `origin/${branch}`;
        const counts = execSync(`git rev-list --left-right --count ${branch}...${remoteBranch}`, {
          cwd: PROJECT_ROOT,
          encoding: 'utf-8'
        }).trim().split('\t');
        ahead = parseInt(counts[0]) || 0;
        behind = parseInt(counts[1]) || 0;
      } catch {
        // Remote might not exist
      }

      return { success: true, branch, modified, untracked, staged, ahead, behind };
    } catch (error: any) {
      return { 
        success: false, 
        branch: '', 
        modified: [], 
        untracked: [], 
        staged: [], 
        ahead: 0, 
        behind: 0,
        error: error.message 
      };
    }
  }

  /**
   * Get recent git commits
   */
  async getGitLog(limit: number = 20): Promise<{
    success: boolean;
    commits: {
      hash: string;
      shortHash: string;
      author: string;
      date: string;
      message: string;
    }[];
    error?: string;
  }> {
    try {
      const { execSync } = await import('child_process');
      
      const log = execSync(
        `git log --pretty=format:"%H|%h|%an|%ci|%s" -n ${limit}`,
        { cwd: PROJECT_ROOT, encoding: 'utf-8' }
      );

      const commits = log.split('\n').filter(Boolean).map(line => {
        const [hash, shortHash, author, date, message] = line.split('|');
        return { hash, shortHash, author, date, message };
      });

      return { success: true, commits };
    } catch (error: any) {
      return { success: false, commits: [], error: error.message };
    }
  }

  /**
   * Get diff for a specific file or all changes
   */
  async getGitDiff(filePath?: string, staged: boolean = false): Promise<{
    success: boolean;
    diff: string;
    additions: number;
    deletions: number;
    error?: string;
  }> {
    try {
      const { execSync } = await import('child_process');
      
      let cmd = 'git diff';
      if (staged) cmd += ' --staged';
      if (filePath) cmd += ` -- ${filePath}`;

      const diff = execSync(cmd, { cwd: PROJECT_ROOT, encoding: 'utf-8' });

      // Count additions and deletions
      const lines = diff.split('\n');
      const additions = lines.filter(l => l.startsWith('+') && !l.startsWith('+++')).length;
      const deletions = lines.filter(l => l.startsWith('-') && !l.startsWith('---')).length;

      return { success: true, diff, additions, deletions };
    } catch (error: any) {
      return { success: false, diff: '', additions: 0, deletions: 0, error: error.message };
    }
  }

  /**
   * Create a commit (stages all changes and commits)
   */
  async createCommit(message: string, files?: string[]): Promise<{
    success: boolean;
    commitHash?: string;
    error?: string;
  }> {
    try {
      const { execSync } = await import('child_process');
      
      // Stage files
      if (files && files.length > 0) {
        for (const file of files) {
          execSync(`git add "${file}"`, { cwd: PROJECT_ROOT });
        }
      } else {
        execSync('git add -A', { cwd: PROJECT_ROOT });
      }

      // Commit
      execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: PROJECT_ROOT });

      // Get the commit hash
      const hash = execSync('git rev-parse HEAD', { 
        cwd: PROJECT_ROOT, 
        encoding: 'utf-8' 
      }).trim();

      logger.info(`[Nova Tools] Created commit: ${hash.substring(0, 7)} - ${message}`);
      return { success: true, commitHash: hash };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // DATABASE BACKUP & RESTORE
  // ============================================

  /**
   * Create a database dump (PostgreSQL)
   * This creates a SQL file backup of the database
   */
  async createDatabaseDump(options: {
    tables?: string[];
    outputPath?: string;
    includeData?: boolean;
  } = {}): Promise<{
    success: boolean;
    dumpPath?: string;
    size?: number;
    tables?: string[];
    error?: string;
  }> {
    try {
      const { execSync } = await import('child_process');
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const dumpFileName = options.outputPath || `backup_${timestamp}.sql`;
      const dumpPath = path.join(PROJECT_ROOT, 'backups', dumpFileName);

      // Ensure backups directory exists
      await fs.mkdir(path.join(PROJECT_ROOT, 'backups'), { recursive: true });

      // Build pg_dump command
      const dbUrl = process.env.DATABASE_URL;
      if (!dbUrl) {
        return { success: false, error: 'DATABASE_URL not configured' };
      }

      // Parse database URL for connection info
      let pgDumpCmd = `pg_dump "${dbUrl}"`;
      
      if (options.tables && options.tables.length > 0) {
        pgDumpCmd += options.tables.map(t => ` -t "${t}"`).join('');
      }
      
      if (!options.includeData) {
        pgDumpCmd += ' --schema-only';
      }

      pgDumpCmd += ` -f "${dumpPath}"`;

      execSync(pgDumpCmd, { cwd: PROJECT_ROOT });

      const stats = await fs.stat(dumpPath);

      logger.info(`[Nova Tools] Database dump created: ${dumpPath} (${stats.size} bytes)`);

      return { 
        success: true, 
        dumpPath: `backups/${dumpFileName}`, 
        size: stats.size,
        tables: options.tables || ['all']
      };
    } catch (error: any) {
      logger.error(`[Nova Tools] Database dump failed:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get list of database backups
   */
  async listDatabaseBackups(): Promise<{
    success: boolean;
    backups: {
      name: string;
      path: string;
      size: number;
      created: Date;
    }[];
  }> {
    try {
      const backupsDir = path.join(PROJECT_ROOT, 'backups');
      
      try {
        await fs.access(backupsDir);
      } catch {
        return { success: true, backups: [] };
      }

      const files = await fs.readdir(backupsDir);
      const backups = await Promise.all(
        files
          .filter(f => f.endsWith('.sql') || f.endsWith('.dump'))
          .map(async (file) => {
            const stats = await fs.stat(path.join(backupsDir, file));
            return {
              name: file,
              path: `backups/${file}`,
              size: stats.size,
              created: stats.birthtime,
            };
          })
      );

      backups.sort((a, b) => b.created.getTime() - a.created.getTime());

      return { success: true, backups };
    } catch (error: any) {
      return { success: false, backups: [] };
    }
  }

  /**
   * Export table data to JSON
   */
  async exportTableToJSON(tableName: string, options: {
    where?: Record<string, any>;
    limit?: number;
    outputPath?: string;
  } = {}): Promise<{
    success: boolean;
    path?: string;
    rowCount?: number;
    error?: string;
  }> {
    try {
      const query = await this.queryDatabase(tableName, {
        where: options.where,
        limit: options.limit || 1000,
      });

      if (!query.success) {
        return { success: false, error: query.error };
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = options.outputPath || `export_${tableName}_${timestamp}.json`;
      const outputPath = path.join(PROJECT_ROOT, 'backups', fileName);

      await fs.mkdir(path.join(PROJECT_ROOT, 'backups'), { recursive: true });
      await fs.writeFile(outputPath, JSON.stringify(query.data, null, 2), 'utf-8');

      logger.info(`[Nova Tools] Exported ${query.data?.length || 0} rows from ${tableName}`);

      return { 
        success: true, 
        path: `backups/${fileName}`, 
        rowCount: query.data?.length || 0 
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // CODEBASE NAVIGATION & UNDERSTANDING
  // ============================================

  /**
   * Get comprehensive codebase architecture overview
   */
  async getCodebaseArchitecture(): Promise<{
    success: boolean;
    architecture: {
      overview: string;
      backend: {
        entryPoint: string;
        routesDirectory: string;
        servicesDirectory: string;
        middlewareDirectory: string;
        configDirectory: string;
        keyFiles: { path: string; description: string }[];
      };
      frontend: {
        entryPoint: string;
        pagesDirectory: string;
        componentsDirectory: string;
        servicesDirectory: string;
        keyFiles: { path: string; description: string }[];
      };
      database: {
        schemaFile: string;
        migrationsDirectory: string;
        seedFiles: string[];
      };
      extensions: {
        mainExtension: string;
        recorderExtension: string;
      };
      workers: {
        pythonWorkers: string;
        keyFiles: string[];
      };
      deploymentFiles: string[];
    };
  }> {
    return {
      success: true,
      architecture: {
        overview: `
FaceMyDealer (FMD) is a comprehensive Facebook Marketplace automation platform.

TECH STACK:
- Backend: Node.js + Express + TypeScript
- Frontend: React + TypeScript + Vite + TailwindCSS
- Database: PostgreSQL with Prisma ORM
- Workers: Python with Playwright for browser automation
- AI: Multiple providers (Anthropic Claude, OpenAI GPT, DeepSeek)
- Extensions: Chrome MV3 extensions for FB automation
- Deployment: Docker + Docker Compose on VPS with Traefik

KEY FEATURES:
- Facebook Marketplace listing automation
- AI-powered inventory analysis (Nova AI)
- IAI (Intelligent Automation Interface) training system
- Multi-account Facebook management
- Lead management and CRM
- Chrome extension for FB interaction
        `,
        backend: {
          entryPoint: 'src/index.ts',
          routesDirectory: 'src/routes/',
          servicesDirectory: 'src/services/',
          middlewareDirectory: 'src/middleware/',
          configDirectory: 'src/config/',
          keyFiles: [
            { path: 'src/index.ts', description: 'Express server entry point' },
            { path: 'src/routes/index.ts', description: 'Route aggregator' },
            { path: 'src/routes/ai.routes.ts', description: 'Nova AI chat & analysis endpoints' },
            { path: 'src/routes/training.routes.ts', description: 'IAI training system routes' },
            { path: 'src/routes/facebook.routes.ts', description: 'Facebook automation routes' },
            { path: 'src/routes/vehicles.routes.ts', description: 'Vehicle/inventory management' },
            { path: 'src/services/ai-service.ts', description: 'Multi-provider AI service' },
            { path: 'src/services/nova-tooling.service.ts', description: 'Nova advanced tools' },
            { path: 'src/config/database.ts', description: 'Prisma client initialization' },
          ],
        },
        frontend: {
          entryPoint: 'web/src/main.tsx',
          pagesDirectory: 'web/src/pages/',
          componentsDirectory: 'web/src/components/',
          servicesDirectory: 'web/src/services/',
          keyFiles: [
            { path: 'web/src/App.tsx', description: 'Main React app with routing' },
            { path: 'web/src/pages/admin/AICenterPage.tsx', description: 'Nova AI command center' },
            { path: 'web/src/pages/admin/IAITrainingPanel.tsx', description: 'IAI training management' },
            { path: 'web/src/pages/FacebookAccountsPage.tsx', description: 'FB account management' },
            { path: 'web/src/pages/VehiclesPage.tsx', description: 'Vehicle inventory' },
            { path: 'web/src/lib/api.ts', description: 'API client configuration' },
          ],
        },
        database: {
          schemaFile: 'prisma/schema.prisma',
          migrationsDirectory: 'prisma/migrations/',
          seedFiles: ['prisma/seed-plans.ts', 'prisma/seeds/'],
        },
        extensions: {
          mainExtension: 'extension/ - Main IAI Chrome extension',
          recorderExtension: 'extension-recorder/ - Training recorder extension',
        },
        workers: {
          pythonWorkers: 'python-workers/',
          keyFiles: [
            'python-workers/worker.py - Main browser worker',
            'python-workers/fb_marketplace.py - FB Marketplace automation',
            'python-workers/image_processor.py - Image handling',
          ],
        },
        deploymentFiles: [
          'docker-compose.production.yml',
          'Dockerfile',
          'deploy.ps1',
          'railway.json',
          'Procfile',
        ],
      },
    };
  }

  /**
   * Find all usages of a function/class/variable
   */
  async findUsages(symbolName: string, options: {
    directories?: string[];
    extensions?: string[];
  } = {}): Promise<{
    success: boolean;
    definition?: { file: string; line: number; content: string };
    usages: { file: string; line: number; content: string; type: 'import' | 'call' | 'reference' }[];
    totalCount: number;
  }> {
    const {
      directories = ['src', 'web/src'],
      extensions = ['.ts', '.tsx', '.js', '.jsx'],
    } = options;

    // Search for the symbol
    const searchResult = await this.deepSearch({
      query: symbolName,
      directories,
      extensions,
      maxResults: 100,
      includeContext: true,
    });

    if (!searchResult.success) {
      return { success: false, usages: [], totalCount: 0 };
    }

    // Categorize results
    let definition: { file: string; line: number; content: string } | undefined;
    const usages: { file: string; line: number; content: string; type: 'import' | 'call' | 'reference' }[] = [];

    for (const result of searchResult.results) {
      const content = result.content.toLowerCase();
      
      // Check if it's a definition
      if (
        content.includes(`function ${symbolName.toLowerCase()}`) ||
        content.includes(`const ${symbolName.toLowerCase()}`) ||
        content.includes(`class ${symbolName.toLowerCase()}`) ||
        content.includes(`interface ${symbolName.toLowerCase()}`) ||
        content.includes(`export default function ${symbolName.toLowerCase()}`)
      ) {
        if (!definition) {
          definition = { file: result.file, line: result.line, content: result.content };
        }
      }
      
      // Categorize usage type
      let type: 'import' | 'call' | 'reference' = 'reference';
      if (content.includes('import')) {
        type = 'import';
      } else if (result.content.includes(`${symbolName}(`)) {
        type = 'call';
      }

      usages.push({
        file: result.file,
        line: result.line,
        content: result.content,
        type,
      });
    }

    return {
      success: true,
      definition,
      usages,
      totalCount: usages.length,
    };
  }

  /**
   * Get API route documentation
   */
  async getAPIRoutesDocs(): Promise<{
    success: boolean;
    routes: {
      method: string;
      path: string;
      file: string;
      line: number;
      authenticated: boolean;
      description?: string;
    }[];
  }> {
    const routeFiles = await this.searchFiles('routes', 'src/routes');
    const routes: {
      method: string;
      path: string;
      file: string;
      line: number;
      authenticated: boolean;
      description?: string;
    }[] = [];

    for (const filePath of routeFiles) {
      if (!filePath.endsWith('.ts')) continue;

      const file = await this.readFile(filePath);
      if (!file.success || !file.content) continue;

      const content = file.content;
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        // Match route definitions
        const routeMatch = line.match(/router\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/i);
        if (routeMatch) {
          const [, method, routePath] = routeMatch;
          
          // Check if route requires auth
          const authenticated = 
            content.includes('authenticate') &&
            index > content.split('\n').findIndex(l => l.includes('router.use(authenticate)'));

          // Look for JSDoc comment above
          let description: string | undefined;
          if (index > 0 && lines[index - 1].includes('*/')) {
            for (let i = index - 2; i >= 0; i--) {
              if (lines[i].includes('/**')) {
                description = lines.slice(i + 1, index - 1)
                  .map(l => l.replace(/^\s*\*\s*/, '').trim())
                  .filter(Boolean)
                  .join(' ');
                break;
              }
            }
          }

          routes.push({
            method: method.toUpperCase(),
            path: routePath,
            file: filePath,
            line: index + 1,
            authenticated,
            description,
          });
        }
      });
    }

    return { success: true, routes };
  }

  // ============================================
  // NOVA CHROMIUM BROWSER CONTROL
  // AI-controlled browser automation
  // ============================================

  /**
   * Execute a natural language goal using Nova AI agent
   * This is the primary method for fluent communication with soldiers
   */
  async executeNaturalLanguageGoal(
    sessionId: string,
    goal: string,
    context?: Record<string, any>,
    maxSteps?: number
  ): Promise<{
    success: boolean;
    goal: string;
    steps: Array<{
      stepNumber: number;
      thought: string;
      action?: string;
      result?: Record<string, any>;
      error?: string;
    }>;
    finalState: string;
    totalDurationMs: number;
    error?: string;
  }> {
    try {
      const { novaChromiumService } = await import('./nova-chromium.service');
      const result = await novaChromiumService.executeGoal(sessionId, goal, context, maxSteps);
      
      return {
        success: result.success,
        goal: result.goal,
        steps: result.steps,
        finalState: result.finalState,
        totalDurationMs: result.totalDurationMs,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        goal,
        steps: [],
        finalState: 'error',
        totalDurationMs: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create a new browser session for Nova to control
   */
  async createBrowserSession(accountId: string, options?: {
    headless?: boolean;
    loadSession?: boolean;
  }): Promise<{
    success: boolean;
    session?: {
      sessionId: string;
      browserId: string;
      accountId: string;
      status: string;
      hasSavedSession: boolean;
    };
    error?: string;
  }> {
    try {
      const { novaChromiumService } = await import('./nova-chromium.service');
      const session = await novaChromiumService.createSession(accountId, options);
      
      return {
        success: true,
        session: {
          sessionId: session.sessionId,
          browserId: session.browserId,
          accountId: session.accountId,
          status: session.status,
          hasSavedSession: session.hasSavedSession,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Execute an action in a browser session
   */
  async executeBrowserAction(sessionId: string, action: {
    action: string;
    selector?: string;
    url?: string;
    value?: string;
    options?: Record<string, any>;
  }): Promise<{
    success: boolean;
    action: string;
    data: Record<string, any>;
    error?: string;
    durationMs: number;
    screenshot?: string;
  }> {
    try {
      const { novaChromiumService } = await import('./nova-chromium.service');
      const result = await novaChromiumService.executeAction(sessionId, action);
      
      return {
        success: result.success,
        action: result.action,
        data: result.data,
        error: result.error,
        durationMs: result.durationMs,
        screenshot: result.screenshot,
      };
    } catch (error) {
      return {
        success: false,
        action: action.action,
        data: {},
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs: 0,
      };
    }
  }

  /**
   * Navigate browser to a URL
   */
  async browserNavigate(sessionId: string, url: string): Promise<{
    success: boolean;
    url?: string;
    error?: string;
  }> {
    const result = await this.executeBrowserAction(sessionId, {
      action: 'navigate',
      url,
    });
    
    return {
      success: result.success,
      url: result.data?.url,
      error: result.error,
    };
  }

  /**
   * Click an element in the browser
   */
  async browserClick(sessionId: string, selector: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    const result = await this.executeBrowserAction(sessionId, {
      action: 'click',
      selector,
    });
    
    return {
      success: result.success,
      error: result.error,
    };
  }

  /**
   * Type text into an input field
   */
  async browserType(sessionId: string, selector: string, value: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    const result = await this.executeBrowserAction(sessionId, {
      action: 'type',
      selector,
      value,
    });
    
    return {
      success: result.success,
      error: result.error,
    };
  }

  /**
   * Capture a screenshot for vision analysis
   */
  async browserScreenshot(sessionId: string, fullPage = false): Promise<{
    success: boolean;
    screenshot?: string;
    url?: string;
    title?: string;
    error?: string;
  }> {
    try {
      const { novaChromiumService } = await import('./nova-chromium.service');
      const result = await novaChromiumService.captureScreenshot(sessionId, fullPage);
      
      return {
        success: true,
        screenshot: result.screenshot,
        url: result.url,
        title: result.title,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get page HTML for analysis
   */
  async browserGetHtml(sessionId: string, selector = 'body'): Promise<{
    success: boolean;
    html?: string;
    error?: string;
  }> {
    try {
      const { novaChromiumService } = await import('./nova-chromium.service');
      const result = await novaChromiumService.getPageHtml(sessionId, selector);
      
      return {
        success: true,
        html: result.html,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send a Facebook message via browser
   */
  async browserSendFacebookMessage(
    sessionId: string,
    conversationUrl: string,
    message: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const { novaChromiumService } = await import('./nova-chromium.service');
      const result = await novaChromiumService.sendFacebookMessage(
        sessionId,
        conversationUrl,
        message
      );
      
      return {
        success: result.success,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create a Facebook Marketplace listing via browser
   */
  async browserCreateListing(
    sessionId: string,
    listing: {
      year: number;
      make: string;
      model: string;
      price: number;
      mileage?: number;
      description?: string;
      location: string;
      photos?: string[];
    }
  ): Promise<{
    success: boolean;
    listingId?: string;
    error?: string;
  }> {
    try {
      const { novaChromiumService } = await import('./nova-chromium.service');
      const result = await novaChromiumService.createMarketplaceListing(sessionId, listing);
      
      return {
        success: result.success,
        listingId: result.data?.listingId,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Close a browser session
   */
  async closeBrowserSession(sessionId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const { novaChromiumService } = await import('./nova-chromium.service');
      const success = await novaChromiumService.closeSession(sessionId);
      
      return { success };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * List all active browser sessions
   */
  async listBrowserSessions(): Promise<{
    success: boolean;
    sessions?: Array<{
      sessionId: string;
      accountId: string;
      status: string;
    }>;
    error?: string;
  }> {
    try {
      const { novaChromiumService } = await import('./nova-chromium.service');
      const sessions = await novaChromiumService.listSessions();
      
      return {
        success: true,
        sessions: sessions.map(s => ({
          sessionId: s.sessionId,
          accountId: s.accountId,
          status: s.status,
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if browser worker is available
   */
  async isBrowserWorkerAvailable(): Promise<boolean> {
    try {
      const { novaChromiumService } = await import('./nova-chromium.service');
      return novaChromiumService.isWorkerAvailable();
    } catch {
      return false;
    }
  }
}

export const novaToolingService = new NovaToolingService();
