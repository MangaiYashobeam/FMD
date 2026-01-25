/**
 * SQL Master Tooling Service
 * 
 * Enterprise-grade SQL operations for Nova AI agents
 * Provides deep database introspection, query optimization,
 * data analysis, and migration management
 * 
 * @version 1.0.0
 * @security ADMIN_ONLY - All operations require elevated privileges
 */

import prisma from '@/config/database';
import { logger } from '@/utils/logger';
import { Prisma } from '@prisma/client';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface TableSchema {
  name: string;
  columns: ColumnInfo[];
  primaryKey: string[];
  foreignKeys: ForeignKeyInfo[];
  indexes: IndexInfo[];
  rowCount: number;
  sizeBytes: number;
  lastAnalyzed?: Date;
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  references?: { table: string; column: string };
  comment?: string;
}

export interface ForeignKeyInfo {
  name: string;
  column: string;
  referencesTable: string;
  referencesColumn: string;
  onDelete: string;
  onUpdate: string;
}

export interface IndexInfo {
  name: string;
  columns: string[];
  isUnique: boolean;
  isPrimary: boolean;
  type: string;
}

export interface QueryAnalysis {
  query: string;
  executionPlan: string;
  estimatedCost: number;
  estimatedRows: number;
  recommendations: string[];
  indexes_used: string[];
  potential_issues: string[];
}

export interface DatabaseStats {
  totalTables: number;
  totalRows: number;
  totalSizeBytes: number;
  connectionPoolSize: number;
  activeConnections: number;
  slowQueryCount: number;
  cacheHitRatio: number;
  uptime: number;
}

export interface MigrationInfo {
  id: string;
  name: string;
  appliedAt: Date;
  checksum: string;
  status: 'applied' | 'pending' | 'failed';
}

export interface DataSnapshot {
  table: string;
  rowCount: number;
  sampleData: Record<string, any>[];
  columns: string[];
  generatedAt: Date;
}

// ============================================
// SQL MASTER SERVICE
// ============================================

class SQLMasterService {
  
  // ============================================
  // SCHEMA INTROSPECTION
  // ============================================

  /**
   * Get complete database schema
   */
  async getDatabaseSchema(): Promise<{
    tables: TableSchema[];
    enums: { name: string; values: string[] }[];
    views: string[];
    functions: string[];
  }> {
    try {
      // Get all tables
      const tables = await this.getAllTablesInfo();

      // Get enums
      const enums = await prisma.$queryRaw<{ typname: string; enumlabel: string }[]>`
        SELECT t.typname, e.enumlabel
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        ORDER BY t.typname, e.enumsortorder
      `;

      // Group enum values
      const enumMap = new Map<string, string[]>();
      for (const row of enums) {
        if (!enumMap.has(row.typname)) {
          enumMap.set(row.typname, []);
        }
        enumMap.get(row.typname)!.push(row.enumlabel);
      }

      // Get views
      const viewsResult = await prisma.$queryRaw<{ viewname: string }[]>`
        SELECT viewname FROM pg_views WHERE schemaname = 'public'
      `;

      // Get functions
      const functionsResult = await prisma.$queryRaw<{ proname: string }[]>`
        SELECT proname FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.prokind = 'f'
      `;

      return {
        tables,
        enums: Array.from(enumMap.entries()).map(([name, values]) => ({ name, values })),
        views: viewsResult.map(v => v.viewname),
        functions: functionsResult.map(f => f.proname),
      };
    } catch (error: any) {
      logger.error('[SQL Master] Failed to get database schema:', error);
      throw error;
    }
  }

  /**
   * Get detailed information about all tables
   */
  async getAllTablesInfo(): Promise<TableSchema[]> {
    const tablesResult = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `;

    const tables: TableSchema[] = [];

    for (const { tablename } of tablesResult) {
      try {
        const schema = await this.getTableSchema(tablename);
        tables.push(schema);
      } catch (error) {
        logger.warn(`[SQL Master] Failed to get schema for table ${tablename}:`, error);
      }
    }

    return tables;
  }

  /**
   * Get detailed schema for a specific table
   */
  async getTableSchema(tableName: string): Promise<TableSchema> {
    // Get columns
    const columns = await prisma.$queryRaw<{
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
    }[]>`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${tableName}
      ORDER BY ordinal_position
    `;

    // Get primary key
    const primaryKey = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT a.attname as column_name
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = ${tableName}::regclass AND i.indisprimary
    `;

    // Get foreign keys
    const foreignKeys = await prisma.$queryRaw<{
      constraint_name: string;
      column_name: string;
      foreign_table_name: string;
      foreign_column_name: string;
    }[]>`
      SELECT
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = ${tableName}
    `;

    // Get indexes
    const indexes = await prisma.$queryRaw<{
      indexname: string;
      indexdef: string;
    }[]>`
      SELECT indexname, indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = ${tableName}
    `;

    // Get row count and size
    const stats = await prisma.$queryRaw<{ row_count: bigint; size_bytes: bigint }[]>`
      SELECT 
        reltuples::bigint as row_count,
        pg_total_relation_size(${tableName}::regclass)::bigint as size_bytes
      FROM pg_class WHERE relname = ${tableName}
    `;

    const pkColumns = primaryKey.map(p => p.column_name);
    const fkColumns = foreignKeys.map(f => f.column_name);

    return {
      name: tableName,
      columns: columns.map(col => ({
        name: col.column_name,
        type: col.data_type,
        nullable: col.is_nullable === 'YES',
        defaultValue: col.column_default,
        isPrimaryKey: pkColumns.includes(col.column_name),
        isForeignKey: fkColumns.includes(col.column_name),
        references: foreignKeys.find(fk => fk.column_name === col.column_name)
          ? {
              table: foreignKeys.find(fk => fk.column_name === col.column_name)!.foreign_table_name,
              column: foreignKeys.find(fk => fk.column_name === col.column_name)!.foreign_column_name,
            }
          : undefined,
      })),
      primaryKey: pkColumns,
      foreignKeys: foreignKeys.map(fk => ({
        name: fk.constraint_name,
        column: fk.column_name,
        referencesTable: fk.foreign_table_name,
        referencesColumn: fk.foreign_column_name,
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      })),
      indexes: indexes.map(idx => ({
        name: idx.indexname,
        columns: this.parseIndexColumns(idx.indexdef),
        isUnique: idx.indexdef.includes('UNIQUE'),
        isPrimary: idx.indexname.includes('pkey'),
        type: idx.indexdef.includes('USING btree') ? 'btree' : 'other',
      })),
      rowCount: Number(stats[0]?.row_count || 0),
      sizeBytes: Number(stats[0]?.size_bytes || 0),
    };
  }

  private parseIndexColumns(indexDef: string): string[] {
    const match = indexDef.match(/\(([^)]+)\)/);
    if (!match) return [];
    return match[1].split(',').map(c => c.trim().replace(/"/g, ''));
  }

  // ============================================
  // QUERY ANALYSIS & OPTIMIZATION
  // ============================================

  /**
   * Analyze a query and get execution plan
   */
  async analyzeQuery(query: string): Promise<QueryAnalysis> {
    try {
      // Get execution plan
      const plan = await prisma.$queryRawUnsafe<{ 'QUERY PLAN': string }[]>(
        `EXPLAIN (FORMAT JSON, ANALYZE false, COSTS true) ${query}`
      );

      const planData = JSON.parse(plan[0]['QUERY PLAN']);
      const planDetails = planData[0].Plan;

      const recommendations: string[] = [];
      const potential_issues: string[] = [];
      const indexes_used: string[] = [];

      // Analyze plan for issues
      this.analyzePlanNode(planDetails, recommendations, potential_issues, indexes_used);

      return {
        query,
        executionPlan: JSON.stringify(planData, null, 2),
        estimatedCost: planDetails['Total Cost'] || 0,
        estimatedRows: planDetails['Plan Rows'] || 0,
        recommendations,
        indexes_used,
        potential_issues,
      };
    } catch (error: any) {
      logger.error('[SQL Master] Query analysis failed:', error);
      return {
        query,
        executionPlan: 'Analysis failed',
        estimatedCost: -1,
        estimatedRows: -1,
        recommendations: ['Query analysis failed - check syntax'],
        indexes_used: [],
        potential_issues: [error.message],
      };
    }
  }

  private analyzePlanNode(
    node: any,
    recommendations: string[],
    issues: string[],
    indexes: string[]
  ): void {
    if (!node) return;

    // Check node type
    const nodeType = node['Node Type'];

    if (nodeType === 'Seq Scan') {
      issues.push(`Sequential scan on ${node['Relation Name']} - consider adding an index`);
      recommendations.push(`CREATE INDEX ON ${node['Relation Name']}(filter_column)`);
    }

    if (nodeType === 'Index Scan' || nodeType === 'Index Only Scan') {
      indexes.push(node['Index Name']);
    }

    if (node['Plan Rows'] > 10000) {
      recommendations.push('Large result set expected - consider pagination');
    }

    if (node['Total Cost'] > 1000) {
      recommendations.push('High cost query - review for optimization');
    }

    // Recurse into child plans
    if (node.Plans) {
      for (const child of node.Plans) {
        this.analyzePlanNode(child, recommendations, issues, indexes);
      }
    }
  }

  /**
   * Get index suggestions for a table
   */
  async getIndexSuggestions(tableName: string): Promise<{
    existingIndexes: IndexInfo[];
    suggestions: { column: string; reason: string; ddl: string }[];
  }> {
    const schema = await this.getTableSchema(tableName);

    const suggestions: { column: string; reason: string; ddl: string }[] = [];

    // Check foreign keys without indexes
    for (const fk of schema.foreignKeys) {
      const hasIndex = schema.indexes.some(idx => idx.columns.includes(fk.column));
      if (!hasIndex) {
        suggestions.push({
          column: fk.column,
          reason: 'Foreign key without index - JOIN performance will suffer',
          ddl: `CREATE INDEX idx_${tableName}_${fk.column} ON "${tableName}"("${fk.column}")`,
        });
      }
    }

    // Suggest indexes for commonly filtered columns (based on naming)
    const commonFilterCols = ['status', 'type', 'createdAt', 'updatedAt', 'userId', 'email'];
    for (const col of schema.columns) {
      if (commonFilterCols.some(c => col.name.toLowerCase().includes(c.toLowerCase()))) {
        const hasIndex = schema.indexes.some(idx => idx.columns.includes(col.name));
        if (!hasIndex) {
          suggestions.push({
            column: col.name,
            reason: `Commonly filtered column "${col.name}" lacks index`,
            ddl: `CREATE INDEX idx_${tableName}_${col.name} ON "${tableName}"("${col.name}")`,
          });
        }
      }
    }

    return {
      existingIndexes: schema.indexes,
      suggestions,
    };
  }

  // ============================================
  // DATA OPERATIONS
  // ============================================

  /**
   * Execute a read-only query safely
   */
  async executeReadQuery<T = any>(query: string): Promise<{
    success: boolean;
    data?: T[];
    rowCount: number;
    executionTime: number;
    error?: string;
  }> {
    // Safety check - only allow SELECT queries
    const normalizedQuery = query.trim().toUpperCase();
    if (!normalizedQuery.startsWith('SELECT') && !normalizedQuery.startsWith('WITH')) {
      return {
        success: false,
        rowCount: 0,
        executionTime: 0,
        error: 'Only SELECT queries are allowed in read mode',
      };
    }

    // Block dangerous patterns
    const dangerousPatterns = [
      /DELETE/i, /INSERT/i, /UPDATE/i, /DROP/i, /TRUNCATE/i,
      /ALTER/i, /CREATE/i, /GRANT/i, /REVOKE/i
    ];
    for (const pattern of dangerousPatterns) {
      if (pattern.test(query)) {
        return {
          success: false,
          rowCount: 0,
          executionTime: 0,
          error: 'Query contains forbidden operations',
        };
      }
    }

    const start = Date.now();
    try {
      const result = await prisma.$queryRawUnsafe<T[]>(query);
      const executionTime = Date.now() - start;

      logger.info('[SQL Master] Read query executed', {
        query: query.substring(0, 100),
        rowCount: result.length,
        executionTime,
      });

      return {
        success: true,
        data: result,
        rowCount: result.length,
        executionTime,
      };
    } catch (error: any) {
      return {
        success: false,
        rowCount: 0,
        executionTime: Date.now() - start,
        error: error.message,
      };
    }
  }

  /**
   * Get sample data from a table
   */
  async getTableSample(tableName: string, limit: number = 10): Promise<DataSnapshot> {
    // Validate table name
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ${tableName}
    `;

    if (tables.length === 0) {
      throw new Error(`Table "${tableName}" not found`);
    }

    const countResult = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) as count FROM "${tableName}"`
    );

    const sampleData = await prisma.$queryRawUnsafe<Record<string, any>[]>(
      `SELECT * FROM "${tableName}" ORDER BY 1 DESC LIMIT ${Math.min(limit, 100)}`
    );

    const columns = sampleData.length > 0 ? Object.keys(sampleData[0]) : [];

    return {
      table: tableName,
      rowCount: Number(countResult[0]?.count || 0),
      sampleData,
      columns,
      generatedAt: new Date(),
    };
  }

  /**
   * Get aggregate statistics for a column
   */
  async getColumnStats(tableName: string, columnName: string): Promise<{
    column: string;
    table: string;
    dataType: string;
    nullCount: number;
    distinctCount: number;
    minValue: any;
    maxValue: any;
    avgValue?: number;
    topValues: { value: any; count: number }[];
  }> {
    // Get column type
    const columnInfo = await prisma.$queryRaw<{ data_type: string }[]>`
      SELECT data_type FROM information_schema.columns
      WHERE table_name = ${tableName} AND column_name = ${columnName}
    `;

    if (columnInfo.length === 0) {
      throw new Error(`Column "${columnName}" not found in table "${tableName}"`);
    }

    const dataType = columnInfo[0].data_type;

    // Get stats
    const stats = await prisma.$queryRawUnsafe<{
      null_count: bigint;
      distinct_count: bigint;
      min_val: any;
      max_val: any;
    }[]>(`
      SELECT 
        COUNT(*) FILTER (WHERE "${columnName}" IS NULL) as null_count,
        COUNT(DISTINCT "${columnName}") as distinct_count,
        MIN("${columnName}") as min_val,
        MAX("${columnName}") as max_val
      FROM "${tableName}"
    `);

    // Get top values
    const topValues = await prisma.$queryRawUnsafe<{ value: any; count: bigint }[]>(`
      SELECT "${columnName}" as value, COUNT(*) as count
      FROM "${tableName}"
      WHERE "${columnName}" IS NOT NULL
      GROUP BY "${columnName}"
      ORDER BY count DESC
      LIMIT 10
    `);

    return {
      column: columnName,
      table: tableName,
      dataType,
      nullCount: Number(stats[0]?.null_count || 0),
      distinctCount: Number(stats[0]?.distinct_count || 0),
      minValue: stats[0]?.min_val,
      maxValue: stats[0]?.max_val,
      topValues: topValues.map(tv => ({ value: tv.value, count: Number(tv.count) })),
    };
  }

  // ============================================
  // DATABASE HEALTH & STATS
  // ============================================

  /**
   * Get comprehensive database statistics
   */
  async getDatabaseStats(): Promise<DatabaseStats> {
    try {
      // Table count
      const tableCount = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count FROM pg_tables WHERE schemaname = 'public'
      `;

      // Database size
      const sizeResult = await prisma.$queryRaw<{ size: bigint }[]>`
        SELECT pg_database_size(current_database()) as size
      `;

      // Connection info
      const connInfo = await prisma.$queryRaw<{
        max_connections: string;
        active: bigint;
      }[]>`
        SELECT 
          current_setting('max_connections') as max_connections,
          (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active') as active
      `;

      // Cache hit ratio
      const cacheStats = await prisma.$queryRaw<{ ratio: number }[]>`
        SELECT 
          CASE 
            WHEN (blks_hit + blks_read) = 0 THEN 0
            ELSE round(100.0 * blks_hit / (blks_hit + blks_read), 2)
          END as ratio
        FROM pg_stat_database 
        WHERE datname = current_database()
      `;

      // Uptime
      const uptimeResult = await prisma.$queryRaw<{ uptime: number }[]>`
        SELECT EXTRACT(EPOCH FROM (now() - pg_postmaster_start_time()))::integer as uptime
      `;

      // Total rows (approximation)
      const rowsResult = await prisma.$queryRaw<{ total: bigint }[]>`
        SELECT SUM(reltuples::bigint) as total
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
      `;

      return {
        totalTables: Number(tableCount[0]?.count || 0),
        totalRows: Number(rowsResult[0]?.total || 0),
        totalSizeBytes: Number(sizeResult[0]?.size || 0),
        connectionPoolSize: parseInt(connInfo[0]?.max_connections || '100'),
        activeConnections: Number(connInfo[0]?.active || 0),
        slowQueryCount: 0, // Would need pg_stat_statements extension
        cacheHitRatio: cacheStats[0]?.ratio || 0,
        uptime: uptimeResult[0]?.uptime || 0,
      };
    } catch (error: any) {
      logger.error('[SQL Master] Failed to get database stats:', error);
      throw error;
    }
  }

  /**
   * Get slow query log (requires pg_stat_statements)
   */
  async getSlowQueries(minDuration: number = 1000): Promise<{
    query: string;
    calls: number;
    totalTime: number;
    meanTime: number;
    maxTime: number;
  }[]> {
    try {
      const result = await prisma.$queryRaw<{
        query: string;
        calls: bigint;
        total_time: number;
        mean_time: number;
        max_time: number;
      }[]>`
        SELECT 
          query,
          calls,
          total_exec_time as total_time,
          mean_exec_time as mean_time,
          max_exec_time as max_time
        FROM pg_stat_statements
        WHERE mean_exec_time > ${minDuration}
        ORDER BY total_exec_time DESC
        LIMIT 20
      `;

      return result.map(r => ({
        query: r.query,
        calls: Number(r.calls),
        totalTime: r.total_time,
        meanTime: r.mean_time,
        maxTime: r.max_time,
      }));
    } catch {
      // pg_stat_statements not enabled
      return [];
    }
  }

  // ============================================
  // BACKUP & EXPORT
  // ============================================

  /**
   * Export table data to JSON format
   */
  async exportTableToJSON(tableName: string, options?: {
    where?: string;
    limit?: number;
    columns?: string[];
  }): Promise<{
    success: boolean;
    data: Record<string, any>[];
    rowCount: number;
    exportedAt: Date;
    error?: string;
  }> {
    try {
      const columns = options?.columns?.length 
        ? options.columns.map(c => `"${c}"`).join(', ')
        : '*';
      
      let query = `SELECT ${columns} FROM "${tableName}"`;
      
      if (options?.where) {
        // Basic sanitization
        const safeWhere = options.where.replace(/;|--/g, '');
        query += ` WHERE ${safeWhere}`;
      }
      
      if (options?.limit) {
        query += ` LIMIT ${Math.min(options.limit, 10000)}`;
      }

      const data = await prisma.$queryRawUnsafe<Record<string, any>[]>(query);

      return {
        success: true,
        data,
        rowCount: data.length,
        exportedAt: new Date(),
      };
    } catch (error: any) {
      return {
        success: false,
        data: [],
        rowCount: 0,
        exportedAt: new Date(),
        error: error.message,
      };
    }
  }

  /**
   * Get migration status
   */
  async getMigrationStatus(): Promise<MigrationInfo[]> {
    try {
      const result = await prisma.$queryRaw<{
        id: string;
        migration_name: string;
        finished_at: Date;
        checksum: string;
      }[]>`
        SELECT id, migration_name, finished_at, checksum
        FROM _prisma_migrations
        ORDER BY finished_at DESC
      `;

      return result.map(r => ({
        id: r.id,
        name: r.migration_name,
        appliedAt: r.finished_at,
        checksum: r.checksum,
        status: 'applied' as const,
      }));
    } catch {
      return [];
    }
  }
}

export const sqlMasterService = new SQLMasterService();
