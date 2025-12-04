import { join } from 'node:path';
import type { SimpleSchema } from '@qwery/domain/entities';

// Enhanced interfaces with confidence scoring
export interface BusinessEntity {
  name: string; // business concept name (e.g., "User", "Order")
  columns: string[]; // columns that represent this entity
  views: string[]; // view names containing this entity
  dataType: string; // inferred data type
  businessType: 'entity' | 'relationship' | 'attribute'; // type of business concept
  confidence: number; // 0-1, confidence in entity extraction
}

export interface Relationship {
  fromView: string;
  toView: string;
  fromColumn: string;
  toColumn: string;
  joinColumn: string; // common column name (for backward compatibility)
  type: 'one-to-one' | 'one-to-many' | 'many-to-many' | 'unknown';
  direction: 'forward' | 'reverse' | 'bidirectional';
  confidence: number; // 0-1, how confident we are about this relationship
  joinCondition: string; // suggested JOIN condition
}

export interface VocabularyEntry {
  businessTerm: string;
  technicalTerms: string[]; // all columns that map to this term
  confidence: number;
  synonyms: string[];
}

export interface DataPatterns {
  enums: Map<string, string[]>; // column → possible values
  ranges: Map<string, { min: number; max: number; avg: number }>;
  patterns: Map<string, string>; // column → detected pattern
  uniqueness: string[]; // columns that appear unique
}

export interface ViewMetadata {
  viewName: string;
  schema: SimpleSchema;
  entities: string[]; // business entities found in this view
  lastAnalyzed: string;
  dataPatterns?: DataPatterns;
}

export interface DomainInference {
  domain: string;
  confidence: number;
  keywords: string[];
  alternativeDomains: Array<{ domain: string; confidence: number }>;
}

export interface BusinessContext {
  entities: Map<string, BusinessEntity>; // entity name → business entity (FIXED: was column name)
  vocabulary: Map<string, VocabularyEntry>; // business term → vocabulary entry
  relationships: Relationship[]; // detected relationships between views
  entityGraph: Map<string, string[]>; // entity → connected entities
  domain: DomainInference; // inferred business domain with confidence
  views: Map<string, ViewMetadata>; // view name → metadata
  updatedAt: string;
}

const BUSINESS_CONTEXT_FILE = 'business-context.json';

// ============================================================================
// PERFORMANCE CONFIGURATION SYSTEM
// ============================================================================

export interface PerformanceConfig {
  // Dataset characteristics
  expectedViewCount: number;
  expectedRowsPerView: number;
  expectedColumnCount: number;

  // Performance targets
  maxSchemaExtractionTime: number; // ms per view
  maxContextUpdateTime: number; // ms per update
  maxVocabularyLookupTime: number; // ms per lookup
  maxMemoryUsage: number; // MB

  // Quality thresholds
  minEntityConfidence: number; // 0.0-1.0
  minRelationshipConfidence: number; // 0.0-1.0
  minVocabularyConfidence: number; // 0.0-1.0

  // Optimization strategy
  optimizationLevel: 'minimal' | 'balanced' | 'aggressive';
  enableBatchProcessing: boolean;
  enableLazyLoading: boolean;
  enableMemoization: boolean;
  enableStreaming: boolean;
  enablePruning: boolean;
}

export interface ParallelConfig {
  maxConcurrentViews: number; // 4-8
  maxConcurrentSchemas: number; // 4-8
  maxConcurrentContextUpdates: number; // 2-4 (CPU intensive)
  maxWorkerThreads: number; // 2-4
  enablePipelineParallelism: boolean;
  enableWorkerThreads: boolean;
  connectionPoolSize: number; // 4-8
}

const DEFAULT_CONFIGS = {
  small: {
    expectedViewCount: 5,
    expectedRowsPerView: 100,
    expectedColumnCount: 10,
    maxSchemaExtractionTime: 50,
    maxContextUpdateTime: 30,
    maxVocabularyLookupTime: 1,
    maxMemoryUsage: 50,
    minEntityConfidence: 0.6,
    minRelationshipConfidence: 0.5,
    minVocabularyConfidence: 0.7,
    optimizationLevel: 'balanced',
    enableBatchProcessing: true,
    enableLazyLoading: true,
    enableMemoization: true,
    enableStreaming: false,
    enablePruning: true,
  },
  medium: {
    expectedViewCount: 50,
    expectedRowsPerView: 10000,
    expectedColumnCount: 25,
    maxSchemaExtractionTime: 200,
    maxContextUpdateTime: 100,
    maxVocabularyLookupTime: 2,
    maxMemoryUsage: 200,
    minEntityConfidence: 0.7,
    minRelationshipConfidence: 0.6,
    minVocabularyConfidence: 0.8,
    optimizationLevel: 'aggressive',
    enableBatchProcessing: true,
    enableLazyLoading: true,
    enableMemoization: true,
    enableStreaming: true,
    enablePruning: true,
  },
  large: {
    expectedViewCount: 200,
    expectedRowsPerView: 100000,
    expectedColumnCount: 50,
    maxSchemaExtractionTime: 500,
    maxContextUpdateTime: 200,
    maxVocabularyLookupTime: 5,
    maxMemoryUsage: 500,
    minEntityConfidence: 0.8,
    minRelationshipConfidence: 0.7,
    minVocabularyConfidence: 0.9,
    optimizationLevel: 'aggressive',
    enableBatchProcessing: true,
    enableLazyLoading: true,
    enableMemoization: true,
    enableStreaming: true,
    enablePruning: true,
  },
} as const satisfies Record<string, PerformanceConfig>;

// Configuration cache per conversation
const configCache = new Map<string, PerformanceConfig>();

/**
 * Auto-detect configuration based on current state
 */
export function detectConfiguration(
  existingViews: number,
  sampleView?: { rowCount: number; columnCount: number },
): PerformanceConfig {
  const viewCount = existingViews;
  const rowCount = sampleView?.rowCount ?? 100;
  const columnCount = sampleView?.columnCount ?? 10;

  // Determine scale
  let baseConfig: PerformanceConfig;
  if (viewCount <= 10 && rowCount <= 1000) {
    baseConfig = { ...DEFAULT_CONFIGS.small };
  } else if (viewCount <= 100 && rowCount <= 100000) {
    baseConfig = { ...DEFAULT_CONFIGS.medium };
  } else {
    baseConfig = { ...DEFAULT_CONFIGS.large };
  }

  // Adjust based on actual characteristics
  return {
    ...baseConfig,
    expectedViewCount: viewCount,
    expectedRowsPerView: rowCount,
    expectedColumnCount: columnCount,
    // Tighten thresholds if dataset is large
    minEntityConfidence: viewCount > 50 ? 0.8 : baseConfig.minEntityConfidence,
    minRelationshipConfidence:
      viewCount > 50 ? 0.7 : baseConfig.minRelationshipConfidence,
  };
}

/**
 * Get configuration for conversation (with caching)
 */
export async function getConfig(
  conversationDir: string,
): Promise<PerformanceConfig> {
  const cacheKey = conversationDir;

  if (!configCache.has(cacheKey)) {
    // Load view registry to determine scale
    const { loadViewRegistry } = await import('../tools/view-registry');
    const views = await loadViewRegistry({
      conversationDir,
    });
    const config = detectConfiguration(views.length);
    configCache.set(cacheKey, config);
  }

  return configCache.get(cacheKey)!;
}

// ============================================================================
// MEMOIZATION CACHE
// ============================================================================

class MemoizationCache {
  private cache = new Map<string, { value: unknown; timestamp: number }>();
  private readonly TTL = 3600000; // 1 hour

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  set<T>(key: string, value: T): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    });
  }

  invalidate(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

const memoCache = new MemoizationCache();

// ============================================================================
// PARALLEL PROCESSING UTILITIES
// ============================================================================

/**
 * Process items with controlled concurrency
 */
export async function processWithConcurrency<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number = 4,
): Promise<R[]> {
  const results: R[] = [];
  let executing: Promise<void>[] = [];

  for (const item of items) {
    const promise = processor(item)
      .then((result) => {
        results.push(result);
      })
      .catch((error) => {
        // Store error in results array to maintain order
        results.push(error as unknown as R);
      });

    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      // Remove completed promises - filter out undefined
      executing = executing.filter((p) => p !== undefined);
    }
  }

  await Promise.all(executing);
  return results;
}

/**
 * Process items in parallel batches
 */
export async function processInBatches<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  batchSize: number = 4,
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((item) => processor(item).catch((error) => error as unknown as R)),
    );
    results.push(...batchResults);
  }

  return results;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Synonym mappings for common business terms
const BUSINESS_SYNONYMS: Record<string, string[]> = {
  customer: ['client', 'user', 'buyer', 'purchaser'],
  order: ['purchase', 'transaction', 'sale'],
  product: ['item', 'goods', 'merchandise'],
  employee: ['staff', 'worker', 'personnel'],
  department: ['dept', 'division', 'unit'],
  revenue: ['sales', 'income', 'amount', 'total'],
  status: ['state', 'condition'],
  date: ['timestamp', 'time', 'created_at', 'updated_at'],
};

// Plural to singular mappings
const PLURAL_TO_SINGULAR: Record<string, string> = {
  customers: 'customer',
  users: 'user',
  orders: 'order',
  products: 'product',
  employees: 'employee',
  departments: 'department',
  items: 'item',
  transactions: 'transaction',
  sales: 'sale',
};

/**
 * Convert plural to singular
 */
function toSingular(word: string): string {
  const lower = word.toLowerCase();
  const singular = PLURAL_TO_SINGULAR[lower];
  if (singular) {
    return singular;
  }
  // Simple rules
  if (lower.endsWith('ies')) {
    return lower.slice(0, -3) + 'y';
  }
  if (lower.endsWith('es') && lower.length > 3) {
    return lower.slice(0, -2);
  }
  if (lower.endsWith('s') && lower.length > 1) {
    return lower.slice(0, -1);
  }
  return word;
}

/**
 * Infer business entity name from column name (enhanced)
 */
function inferBusinessEntity(columnName: string): string {
  let name = columnName.toLowerCase();

  // Remove ID suffixes
  name = name.replace(/_id$|id$/, '');

  // Remove common prefixes
  name = name.replace(/^user_|^customer_|^order_|^product_|^dept_|^item_/, '');

  // Handle compound entities: "order_item" → "Order Item"
  const words = name.split('_').filter((w) => w.length > 0);
  if (words.length === 0) return columnName;

  // Convert to Title Case
  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Detect business type from column name and data type (enhanced)
 */
function detectBusinessType(
  columnName: string,
  dataType: string,
): BusinessEntity['businessType'] {
  const name = columnName.toLowerCase();

  // Relationship indicators
  if (name.endsWith('_id') || name === 'id') {
    return 'relationship';
  }

  // Entity indicators (primary keys or main identifiers)
  if (
    name === 'id' ||
    name.includes('user') ||
    name.includes('customer') ||
    name.includes('order') ||
    (name.endsWith('_key') && dataType.includes('INTEGER'))
  ) {
    return 'entity';
  }

  // Attributes (everything else)
  return 'attribute';
}

/**
 * Calculate entity confidence based on naming patterns and data types
 */
function calculateEntityConfidence(
  columnName: string,
  dataType: string,
  businessType: BusinessEntity['businessType'],
): number {
  let confidence = 0.5; // base confidence

  const name = columnName.toLowerCase();

  // High confidence indicators
  if (name === 'id' && dataType.includes('INTEGER')) {
    confidence = 0.95;
  } else if (name.endsWith('_id') && dataType.includes('INTEGER')) {
    confidence = 0.9;
  } else if (businessType === 'entity' && name.match(/^(user|customer|order|product)/)) {
    confidence = 0.85;
  } else if (businessType === 'relationship') {
    confidence = 0.8;
  } else if (dataType.includes('VARCHAR') && name.match(/(name|title|description)/)) {
    confidence = 0.75;
  } else if (dataType.includes('DATE') || dataType.includes('TIMESTAMP')) {
    confidence = 0.7;
  }

  return Math.min(confidence, 1.0);
}

/**
 * Group related columns into entities (e.g., user_id, user_name, user_email → User entity)
 */
function groupRelatedColumns(
  columns: Array<{ columnName: string; columnType: string }>,
  tableName: string,
): BusinessEntity[] {
  const entityMap = new Map<string, BusinessEntity>();

  for (const column of columns) {
    const entityName = inferBusinessEntity(column.columnName);
    const businessType = detectBusinessType(column.columnName, column.columnType);
    const confidence = calculateEntityConfidence(
      column.columnName,
      column.columnType,
      businessType,
    );

    const existing = entityMap.get(entityName);
    if (existing) {
      // Merge columns into existing entity
      if (!existing.columns.includes(column.columnName)) {
        existing.columns.push(column.columnName);
      }
      // Update confidence if higher
      existing.confidence = Math.max(existing.confidence, confidence);
    } else {
      entityMap.set(entityName, {
        name: entityName,
        columns: [column.columnName],
        views: [tableName],
        dataType: column.columnType,
        businessType,
        confidence,
      });
    }
  }

  return Array.from(entityMap.values());
}

/**
 * Check if table name is a system or temp table
 */
function isSystemOrTempTable(tableName: string): boolean {
  const name = tableName.toLowerCase();
  return (
    name.startsWith('temp_') ||
    name.startsWith('pragma_') ||
    name === 'information_schema' ||
    name.includes('_temp') ||
    name.includes('_tmp') ||
    name.startsWith('pg_') ||
    name.startsWith('sqlite_') ||
    name.startsWith('duckdb_') ||
    name.startsWith('main.') ||
    name.startsWith('temp.')
  );
}

/**
 * Analyze a single schema to extract business entities (enhanced with pruning)
 * Filters out system and temp tables
 */
function analyzeSchema(
  schema: SimpleSchema,
  options: {
    skipExisting?: boolean;
    existingEntities?: Map<string, BusinessEntity>;
    confidenceThreshold?: number;
    maxEntities?: number;
  } = {},
): BusinessEntity[] {
  const {
    skipExisting = false,
    existingEntities = new Map(),
    confidenceThreshold = 0.6,
    maxEntities = Infinity,
  } = options;

  const entityMap = new Map<string, BusinessEntity>(); // Group by entity name

  for (const table of schema.tables) {
    // SKIP system and temp tables
    if (isSystemOrTempTable(table.tableName)) {
      continue;
    }

    for (const column of table.columns) {
      // EARLY TERMINATION: Skip if already processed
      if (skipExisting) {
        const entityKey = inferBusinessEntity(column.columnName).toLowerCase();
        if (existingEntities.has(entityKey)) {
          continue;
        }
      }

      const entities = groupRelatedColumns(
        [{ columnName: column.columnName, columnType: column.columnType }],
        table.tableName,
      );

      for (const entity of entities) {
        // PRUNING: Skip if confidence too low
        if (entity.confidence < confidenceThreshold) {
          continue;
        }

        // Group columns by entity name
        const existing = entityMap.get(entity.name);
        if (existing) {
          if (!existing.columns.includes(column.columnName)) {
            existing.columns.push(column.columnName);
          }
          if (!existing.views.includes(table.tableName)) {
            existing.views.push(table.tableName);
          }
          // Update confidence if higher
          existing.confidence = Math.max(existing.confidence, entity.confidence);
        } else {
          entityMap.set(entity.name, entity);
        }
      }
    }
  }

  // Limit total entities (prevent explosion)
  const result = Array.from(entityMap.values())
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, maxEntities);

  return result;
}

/**
 * Extract data patterns from actual data (sample first 100 rows)
 */
export async function extractDataPatterns(
  dbPath: string,
  viewName: string,
  schema: SimpleSchema,
): Promise<DataPatterns> {
  const patterns: DataPatterns = {
    enums: new Map(),
    ranges: new Map(),
    patterns: new Map(),
    uniqueness: [],
  };

  try {
    const { DuckDBInstance } = await import('@duckdb/node-api');
    const instance = await DuckDBInstance.create(dbPath);
    const conn = await instance.connect();

    try {
      const escapedViewName = viewName.replace(/"/g, '""');

      // Sample first 100 rows
      const sampleReader = await conn.runAndReadAll(
        `SELECT * FROM "${escapedViewName}" LIMIT 100`,
      );
      await sampleReader.readAll();
      const rows = sampleReader.getRowObjectsJS() as Array<Record<string, unknown>>;
      const columnNames = sampleReader.columnNames();

      if (rows.length === 0) {
        return patterns;
      }

      // Analyze each column
      for (const columnName of columnNames) {
        const column = schema.tables[0]?.columns.find(
          (c) => c.columnName === columnName,
        );
        if (!column) continue;

        const values = rows
          .map((row) => row[columnName])
          .filter((v) => v !== null && v !== undefined);

        if (values.length === 0) continue;

        // Detect enums (categorical values)
        if (column.columnType.includes('VARCHAR')) {
          const uniqueValues = new Set(values.map(String));
          if (uniqueValues.size <= 10 && uniqueValues.size < values.length * 0.5) {
            patterns.enums.set(columnName, Array.from(uniqueValues));
          }

          // Detect patterns (email, phone, etc.)
          const stringValues = values.map(String);
          if (stringValues.some((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))) {
            patterns.patterns.set(columnName, 'email');
          } else if (stringValues.some((v) => /^\d{10,}$/.test(v))) {
            patterns.patterns.set(columnName, 'phone');
          }
        }

        // Detect ranges for numeric columns
        if (
          column.columnType.includes('INTEGER') ||
          column.columnType.includes('DOUBLE') ||
          column.columnType.includes('DECIMAL')
        ) {
          const numericValues = values
            .map((v) => Number(v))
            .filter((n) => !isNaN(n));

          if (numericValues.length > 0) {
            const min = Math.min(...numericValues);
            const max = Math.max(...numericValues);
            const avg =
              numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
            patterns.ranges.set(columnName, { min, max, avg });
          }
        }

        // Detect uniqueness (all values are unique)
        const uniqueCount = new Set(values).size;
        if (uniqueCount === values.length && values.length > 1) {
          patterns.uniqueness.push(columnName);
        }
      }
    } finally {
      conn.closeSync();
      instance.closeSync();
    }
  } catch {
    // If data extraction fails, return empty patterns
    return patterns;
  }

  return patterns;
}

/**
 * Validate relationship with actual data (check cardinality)
 */
async function validateRelationship(
  dbPath: string,
  fromView: string,
  toView: string,
  fromColumn: string,
  toColumn: string,
): Promise<{ confidence: number; type: Relationship['type']; direction: Relationship['direction'] }> {
  try {
    const { DuckDBInstance } = await import('@duckdb/node-api');
    const instance = await DuckDBInstance.create(dbPath);
    const conn = await instance.connect();

    try {
      const escapedFromView = fromView.replace(/"/g, '""');
      const escapedToView = toView.replace(/"/g, '""');
      const escapedFromCol = fromColumn.replace(/"/g, '""');
      const escapedToCol = toColumn.replace(/"/g, '""');

      // Sample cardinality check
      const cardinalityQuery = `
        SELECT 
          COUNT(DISTINCT f."${escapedFromCol}") as from_unique,
          COUNT(DISTINCT t."${escapedToCol}") as to_unique,
          COUNT(*) as total
        FROM "${escapedFromView}" f
        JOIN "${escapedToView}" t ON f."${escapedFromCol}" = t."${escapedToCol}"
        LIMIT 1000
      `;

      const resultReader = await conn.runAndReadAll(cardinalityQuery);
      await resultReader.readAll();
      const results = resultReader.getRowObjectsJS() as Array<{
        from_unique: number;
        to_unique: number;
        total: number;
      }>;

      if (results.length === 0) {
        return { confidence: 0.5, type: 'unknown', direction: 'bidirectional' };
      }

      const result = results[0];
      if (!result) {
        return { confidence: 0.5, type: 'unknown', direction: 'bidirectional' };
      }

      const fromUnique = Number(result.from_unique) || 0;
      const toUnique = Number(result.to_unique) || 0;
      const total = Number(result.total) || 0;

      if (total === 0) {
        return { confidence: 0.3, type: 'unknown', direction: 'bidirectional' };
      }

      let type: Relationship['type'] = 'unknown';
      let direction: Relationship['direction'] = 'bidirectional';
      let confidence = 0.7;

      // Determine relationship type based on cardinality
      if (fromUnique === toUnique && fromUnique === total) {
        type = 'one-to-one';
        confidence = 0.9;
      } else if (fromUnique < toUnique) {
        type = 'one-to-many';
        direction = 'forward';
        confidence = 0.85;
      } else if (toUnique < fromUnique) {
        type = 'one-to-many';
        direction = 'reverse';
        confidence = 0.85;
      } else if (fromUnique < total && toUnique < total) {
        type = 'many-to-many';
        confidence = 0.8;
      }

      return { confidence, type, direction };
    } finally {
      conn.closeSync();
      instance.closeSync();
    }
  } catch {
    // If validation fails, return low confidence
    return { confidence: 0.5, type: 'unknown', direction: 'bidirectional' };
  }
}

/**
 * Find common columns across multiple schemas (enhanced with validation)
 * Filters out system and temp tables
 */
async function findCommonColumns(
  dbPath: string | null,
  schemas: Array<{ viewName: string; schema: SimpleSchema }>,
): Promise<Relationship[]> {
  const relationships: Relationship[] = [];
  const columnMap = new Map<string, Array<{ view: string; column: string }>>();

  // Filter out system/temp tables
  const validSchemas = schemas.filter(
    (s) => !isSystemOrTempTable(s.viewName),
  );

  // Build a map of column names to their views
  for (const { viewName, schema } of validSchemas) {
    for (const table of schema.tables) {
      for (const column of table.columns) {
        const colName = column.columnName.toLowerCase();
        if (!columnMap.has(colName)) {
          columnMap.set(colName, []);
        }
        columnMap
          .get(colName)!
          .push({ view: viewName, column: column.columnName });
      }
    }
  }

  // Find columns that appear in multiple views (potential relationships)
  for (const [colName, occurrences] of columnMap.entries()) {
    if (occurrences.length >= 2) {
      for (let i = 0; i < occurrences.length; i++) {
        for (let j = i + 1; j < occurrences.length; j++) {
          const from = occurrences[i];
          const to = occurrences[j];

          if (!from || !to) continue;

          // Determine relationship type based on column name
          let type: Relationship['type'] = 'unknown';
          let direction: Relationship['direction'] = 'bidirectional';
          let confidence = 0.7;

          if (colName.endsWith('_id') || colName === 'id') {
            type = 'one-to-many';
            direction = 'forward';
            confidence = 0.8;
          }

          // Validate with actual data if dbPath is available
          if (dbPath) {
            const validation = await validateRelationship(
              dbPath,
              from.view,
              to.view,
              from.column,
              to.column,
            );
            type = validation.type;
            direction = validation.direction;
            confidence = validation.confidence;
          }

          const joinCondition = `${from.view}."${from.column}" = ${to.view}."${to.column}"`;

          relationships.push({
            fromView: from.view,
            toView: to.view,
            fromColumn: from.column,
            toColumn: to.column,
            joinColumn: colName, // for backward compatibility
            type,
            direction,
            confidence,
            joinCondition,
          });
        }
      }
    }
  }

  return relationships;
}

/**
 * Normalize term for deduplication
 */
function normalizeTerm(term: string): string {
  return term
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Build enhanced vocabulary with synonyms, plurals, and confidence
 */
function buildVocabulary(
  entities: BusinessEntity[],
  config?: PerformanceConfig,
): Map<string, VocabularyEntry> {
  const minConfidence = config?.minVocabularyConfidence ?? 0.7;
  const vocabulary = new Map<string, VocabularyEntry>();
  const normalizedMap = new Map<string, string>(); // normalized -> original

  for (const entity of entities) {
    // Skip low-confidence entities
    if (entity.confidence < minConfidence) continue;

    const entityNameLower = entity.name.toLowerCase();

    // Create or update vocabulary entry
    let entry = vocabulary.get(entityNameLower);
    if (!entry) {
      entry = {
        businessTerm: entity.name,
        technicalTerms: [],
        confidence: entity.confidence,
        synonyms: BUSINESS_SYNONYMS[entityNameLower] || [],
      };
      vocabulary.set(entityNameLower, entry);
    }

    // Add all columns for this entity
    for (const column of entity.columns) {
      if (!entry.technicalTerms.includes(column)) {
        entry.technicalTerms.push(column);
      }
    }

    // Map technical column names to business terms
    for (const column of entity.columns) {
      const colLower = column.toLowerCase();
      const normalized = normalizeTerm(column);

      // DEDUPLICATION: Use existing entry if normalized term exists
      if (normalizedMap.has(normalized)) {
        const existingKey = normalizedMap.get(normalized)!;
        const existing = vocabulary.get(existingKey)!;

        // Merge technical terms
        if (!existing.technicalTerms.includes(column)) {
          existing.technicalTerms.push(column);
        }
        continue;
      }

      // Exact match - highest confidence
      normalizedMap.set(normalized, colLower);
      if (!vocabulary.has(colLower)) {
        vocabulary.set(colLower, {
          businessTerm: entity.name,
          technicalTerms: [column],
          confidence: 1.0,
          synonyms: BUSINESS_SYNONYMS[entityNameLower] || [],
        });
      }

      // Variations with lower confidence
      const variations = [
        column.replace(/_id$/, ''),
        column.replace(/^user_/, ''),
        column.replace(/^customer_/, ''),
        column.replace(/^order_/, ''),
        toSingular(column),
      ];

      for (const variation of variations) {
        if (variation && variation !== column && variation.length > 0) {
          const varLower = variation.toLowerCase();
          const varNormalized = normalizeTerm(variation);
          if (!normalizedMap.has(varNormalized) && !vocabulary.has(varLower)) {
            normalizedMap.set(varNormalized, varLower);
            vocabulary.set(varLower, {
              businessTerm: entity.name,
              technicalTerms: [column],
              confidence: 0.8,
              synonyms: BUSINESS_SYNONYMS[entityNameLower] || [],
            });
          }
        }
      }
    }
  }

  return vocabulary;
}

/**
 * Build entity relationship graph
 */
function buildEntityGraph(
  entities: BusinessEntity[],
  relationships: Relationship[],
): Map<string, string[]> {
  const graph = new Map<string, string[]>();

  // Initialize graph with all entities
  for (const entity of entities) {
    if (!graph.has(entity.name)) {
      graph.set(entity.name, []);
    }
  }

  // Add relationships to graph
  for (const rel of relationships) {
    // Find entities for the views involved in the relationship
    const fromEntities = entities.filter((e) => e.views.includes(rel.fromView));
    const toEntities = entities.filter((e) => e.views.includes(rel.toView));

    for (const fromEntity of fromEntities) {
      for (const toEntity of toEntities) {
        if (fromEntity.name !== toEntity.name) {
          const connections = graph.get(fromEntity.name) || [];
          if (!connections.includes(toEntity.name)) {
            connections.push(toEntity.name);
            graph.set(fromEntity.name, connections);
          }
        }
      }
    }
  }

  return graph;
}

/**
 * Infer business domain from all schemas (enhanced with confidence)
 */
function inferDomain(schemas: SimpleSchema[]): DomainInference {
  const allColumns = new Set<string>();
  const keywords = new Map<string, number>();

  for (const schema of schemas) {
    for (const table of schema.tables) {
      for (const column of table.columns) {
        const colName = column.columnName.toLowerCase();
        allColumns.add(colName);

        // Extract keywords
        const words = colName.split('_');
        for (const word of words) {
          if (word.length > 2) {
            keywords.set(word, (keywords.get(word) || 0) + 1);
          }
        }
      }
    }
  }

  // Common business domain keywords (extended)
  const domainKeywords: Record<string, string[]> = {
    ecommerce: ['order', 'product', 'cart', 'payment', 'customer', 'purchase', 'shipping'],
    hr: ['employee', 'department', 'position', 'salary', 'hr', 'staff', 'personnel'],
    crm: ['customer', 'contact', 'lead', 'account', 'opportunity', 'client'],
    analytics: ['metric', 'kpi', 'dashboard', 'report', 'analytics', 'measure'],
    finance: ['transaction', 'payment', 'invoice', 'revenue', 'expense', 'budget'],
    inventory: ['product', 'stock', 'warehouse', 'supply', 'item'],
    general: [], // fallback
  };

  const domainScores: Array<{ domain: string; score: number; matchedKeywords: string[] }> = [];

  for (const [domain, keywords_list] of Object.entries(domainKeywords)) {
    let score = 0;
    const matched: string[] = [];

    for (const keyword of keywords_list) {
      const count = keywords.get(keyword) || 0;
      if (count > 0) {
        score += count;
        matched.push(keyword);
      }
    }

    domainScores.push({ domain, score, matchedKeywords: matched });
  }

  // Sort by score
  domainScores.sort((a, b) => b.score - a.score);

  const maxScore = domainScores[0]?.score || 0;
  const totalPossible = Object.values(domainKeywords).flat().length;
  const confidence = maxScore > 0 ? Math.min(maxScore / (totalPossible * 0.3), 1.0) : 0.5;

  const primary = domainScores[0] || { domain: 'general', score: 0, matchedKeywords: [] };
  const alternatives = domainScores
    .slice(1, 4)
    .filter((d) => d.score > 0)
    .map((d) => ({
      domain: d.domain,
      confidence: Math.min(d.score / (totalPossible * 0.3), 1.0),
    }));

  return {
    domain: primary.domain,
    confidence,
    keywords: primary.matchedKeywords,
    alternativeDomains: alternatives,
  };
}

/**
 * Load business context from file
 */
export async function loadBusinessContext(
  conversationDir: string,
): Promise<BusinessContext | null> {
  const { readFile } = await import('node:fs/promises');
  const contextPath = join(conversationDir, BUSINESS_CONTEXT_FILE);

  try {
    const content = await readFile(contextPath, 'utf-8');
    const data = JSON.parse(content);

    // Reconstruct Maps from JSON with proper types
    const entities = new Map<string, BusinessEntity>();
    if (data.entities) {
      for (const [key, value] of data.entities) {
        entities.set(key, value as BusinessEntity);
      }
    }

    const vocabulary = new Map<string, VocabularyEntry>();
    if (data.vocabulary) {
      // Handle both old format (Map<string, string>) and new format (Map<string, VocabularyEntry>)
      for (const [key, value] of data.vocabulary) {
        if (typeof value === 'string') {
          // Old format - convert to new format
          vocabulary.set(key, {
            businessTerm: value,
            technicalTerms: [key],
            confidence: 0.8,
            synonyms: [],
          });
        } else {
          vocabulary.set(key, value as VocabularyEntry);
        }
      }
    }

    const views = new Map<string, ViewMetadata>();
    if (data.views) {
      for (const [key, value] of data.views) {
        views.set(key, value as ViewMetadata);
      }
    }

    return {
      entities,
      vocabulary,
      relationships: data.relationships || [],
      entityGraph: new Map(data.entityGraph || []),
      domain: data.domain || { domain: 'general', confidence: 0.5, keywords: [], alternativeDomains: [] },
      views,
      updatedAt: data.updatedAt || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Save business context to file
 */
export async function saveBusinessContext(
  conversationDir: string,
  context: BusinessContext,
): Promise<void> {
  const { mkdir, writeFile } = await import('node:fs/promises');
  await mkdir(conversationDir, { recursive: true });

  const contextPath = join(conversationDir, BUSINESS_CONTEXT_FILE);

  // Convert Maps to arrays for JSON serialization
  const serializable = {
    entities: Array.from(context.entities.entries()),
    vocabulary: Array.from(context.vocabulary.entries()),
    relationships: context.relationships,
    entityGraph: Array.from(context.entityGraph.entries()),
    domain: context.domain,
    views: Array.from(context.views.entries()),
    updatedAt: new Date().toISOString(),
  };

  await writeFile(contextPath, JSON.stringify(serializable, null, 2), 'utf-8');
}

/**
 * Analyze multiple schemas and update context in parallel
 * This is the parallel version that processes multiple views concurrently
 */
export async function analyzeSchemasAndUpdateContextParallel(
  conversationDir: string,
  schemas: Map<string, SimpleSchema>,
  dbPath?: string,
): Promise<BusinessContext> {
  const startTime = Date.now();
  const config = await getConfig(conversationDir);

  // Load existing context once
  let context = await loadBusinessContext(conversationDir);
  if (!context) {
    context = {
      entities: new Map(),
      vocabulary: new Map(),
      relationships: [],
      entityGraph: new Map(),
      domain: { domain: 'general', confidence: 0.5, keywords: [], alternativeDomains: [] },
      views: new Map(),
      updatedAt: new Date().toISOString(),
    };
  }

  // PARALLEL: Extract entities from all schemas concurrently
  const entityExtractions = Array.from(schemas.entries()).map(
    async ([viewName, schema]) => {
      // Filter temp tables
      const filteredSchema = {
        ...schema,
        tables: schema.tables.filter((t) => !isSystemOrTempTable(t.tableName)),
      };

      if (filteredSchema.tables.length === 0) {
        return { viewName, entities: [], schema: filteredSchema };
      }

      const entities = analyzeSchema(filteredSchema, {
        skipExisting: config.enablePruning,
        existingEntities: context?.entities || new Map(),
        confidenceThreshold: config.minEntityConfidence,
        maxEntities: config.expectedColumnCount * 2,
      });

      return { viewName, entities, schema: filteredSchema };
    },
  );

  const extracted = await Promise.all(entityExtractions);

  // Merge entities (sequential but fast)
  for (const { viewName, entities, schema } of extracted) {
    for (const entity of entities) {
      const entityKey = entity.name.toLowerCase();
      const existing = context.entities.get(entityKey);

      if (existing) {
        for (const col of entity.columns) {
          if (!existing.columns.includes(col)) {
            existing.columns.push(col);
          }
        }
        if (!existing.views.includes(viewName)) {
          existing.views.push(viewName);
        }
        existing.confidence = Math.max(existing.confidence, entity.confidence);
      } else {
        context.entities.set(entityKey, entity);
      }
    }

    // Update view metadata
    context.views.set(viewName, {
      viewName,
      schema,
      entities: entities.map((e) => e.name),
      lastAnalyzed: new Date().toISOString(),
    });
  }

  // PARALLEL: Find relationships
  if (schemas.size >= 2) {
    context.relationships = await findRelationshipsParallel(
      context,
      schemas,
      dbPath || null,
      config,
    );
  }

  // Build vocabulary (optimized)
  const allEntities = Array.from(context.entities.values());
  context.vocabulary = buildVocabulary(allEntities, config);

  // Build entity graph
  context.entityGraph = buildEntityGraph(allEntities, context.relationships);

  // Infer domain
  const allSchemasForDomain = Array.from(context.views.entries())
    .filter(([name]) => !isSystemOrTempTable(name))
    .map(([name, meta]) => meta.schema);
  context.domain = inferDomain(allSchemasForDomain);

  await saveBusinessContext(conversationDir, context);

  const elapsed = Date.now() - startTime;
  if (elapsed > config.maxContextUpdateTime) {
    console.warn(
      `[BusinessContext] Parallel update took ${elapsed}ms (target: ${config.maxContextUpdateTime}ms) for ${schemas.size} views`,
    );
  }

  return context;
}

/**
 * Check if schema is unchanged
 */
function isSchemaUnchanged(
  oldSchema: SimpleSchema,
  newSchema: SimpleSchema,
): boolean {
  if (oldSchema.tables.length !== newSchema.tables.length) return false;

  for (let i = 0; i < oldSchema.tables.length; i++) {
    const oldTable = oldSchema.tables[i];
    const newTable = newSchema.tables[i];

    if (!oldTable || !newTable) return false;
    if (oldTable.columns.length !== newTable.columns.length) return false;

    for (let j = 0; j < oldTable.columns.length; j++) {
      const oldCol = oldTable.columns[j];
      const newCol = newTable.columns[j];

      if (!oldCol || !newCol) return false;
      if (
        oldCol.columnName !== newCol.columnName ||
        oldCol.columnType !== newCol.columnType
      ) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Find relationships in parallel for all view pairs
 */
async function findRelationshipsParallel(
  context: BusinessContext,
  schemas: Map<string, SimpleSchema>,
  dbPath: string | null,
  config: PerformanceConfig,
): Promise<Relationship[]> {
  const schemaArray = Array.from(schemas.entries());
  const pairs: Array<[string, SimpleSchema, string, SimpleSchema]> = [];

  // Generate all pairs
  for (let i = 0; i < schemaArray.length; i++) {
    for (let j = i + 1; j < schemaArray.length; j++) {
      const entry1 = schemaArray[i];
      const entry2 = schemaArray[j];
      if (entry1 && entry2) {
        pairs.push([entry1[0], entry1[1], entry2[0], entry2[1]]);
      }
    }
  }

  // PARALLEL: Compare all pairs concurrently
  const relationshipPromises = pairs.map(async ([view1, schema1, view2, schema2]) => {
    return findRelationshipsBetween(
      { viewName: view1, schema: schema1 },
      { viewName: view2, schema: schema2 },
      dbPath,
      config,
    );
  });

  const relationshipArrays = await Promise.all(relationshipPromises);

  // Flatten and filter
  const allRelationships = relationshipArrays.flat();
  return allRelationships
    .filter((r) => r.confidence >= config.minRelationshipConfidence)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, config.expectedViewCount * 3);
}

/**
 * Find relationships between two views (incremental)
 */
async function findRelationshipsBetween(
  view1: { viewName: string; schema: SimpleSchema },
  view2: { viewName: string; schema: SimpleSchema },
  dbPath: string | null,
  config: PerformanceConfig,
): Promise<Relationship[]> {
  const relationships: Relationship[] = [];
  const columnMap = new Map<string, Array<{ view: string; column: string }>>();

  // Build column maps for both views
  for (const { viewName, schema } of [view1, view2]) {
    if (!schema || !schema.tables) continue;
    for (const table of schema.tables) {
      if (!table || !table.columns) continue;
      for (const column of table.columns) {
        if (!column) continue;
        const colName = column.columnName.toLowerCase();
        if (!columnMap.has(colName)) {
          columnMap.set(colName, []);
        }
        const colList = columnMap.get(colName);
        if (colList) {
          colList.push({ view: viewName, column: column.columnName });
        }
      }
    }
  }

  // Find common columns
  for (const [colName, occurrences] of columnMap.entries()) {
    if (occurrences.length >= 2) {
      const from = occurrences.find((o) => o.view === view1.viewName);
      const to = occurrences.find((o) => o.view === view2.viewName);

      if (from && to) {
        let type: Relationship['type'] = 'unknown';
        let direction: Relationship['direction'] = 'bidirectional';
        let confidence = 0.7;

        if (colName.endsWith('_id') || colName === 'id') {
          type = 'one-to-many';
          direction = 'forward';
          confidence = 0.8;
        }

        // Validate with actual data if dbPath is available
        if (dbPath && config.enablePruning) {
          const validation = await validateRelationship(
            dbPath,
            from.view,
            to.view,
            from.column,
            to.column,
          );
          type = validation.type;
          direction = validation.direction;
          confidence = validation.confidence;
        }

        if (confidence >= config.minRelationshipConfidence) {
          const joinCondition = `${from.view}."${from.column}" = ${to.view}."${to.column}"`;

          relationships.push({
            fromView: from.view,
            toView: to.view,
            fromColumn: from.column,
            toColumn: to.column,
            joinColumn: colName,
            type,
            direction,
            confidence,
            joinCondition,
          });
        }
      }
    }
  }

  return relationships;
}

/**
 * Analyze schema and update business context (FIXED: entity merging bug)
 * Validates view name is not a temp table
 * Now with incremental updates and performance optimizations
 */
export async function analyzeSchemaAndUpdateContext(
  conversationDir: string,
  viewName: string,
  schema: SimpleSchema,
  dbPath?: string,
): Promise<BusinessContext> {
  const startTime = Date.now();

  // Get performance configuration
  const config = await getConfig(conversationDir);

  // Validate view name is not a temp table
  if (isSystemOrTempTable(viewName)) {
    throw new Error(`Cannot build business context for system/temp table: ${viewName}`);
  }

  // Filter schema to exclude system tables
  const filteredSchema = {
    ...schema,
    tables: schema.tables.filter((t) => !isSystemOrTempTable(t.tableName)),
  };

  if (filteredSchema.tables.length === 0) {
    throw new Error(`No valid tables found in schema for view: ${viewName}`);
  }

  // Load existing context or create new one
  let context = await loadBusinessContext(conversationDir);

  if (!context) {
    context = {
      entities: new Map(),
      vocabulary: new Map(),
      relationships: [],
      entityGraph: new Map(),
      domain: { domain: 'general', confidence: 0.5, keywords: [], alternativeDomains: [] },
      views: new Map(),
      updatedAt: new Date().toISOString(),
    };
  }

  // Check if view already analyzed (skip if unchanged) - INCREMENTAL OPTIMIZATION
  const existingView = context.views.get(viewName);
  if (existingView && isSchemaUnchanged(existingView.schema, filteredSchema)) {
    // No changes - return cached context immediately
    return context;
  }

  // Analyze the filtered schema with pruning
  const newEntities = analyzeSchema(filteredSchema, {
    skipExisting: config.enablePruning,
    existingEntities: context.entities,
    confidenceThreshold: config.minEntityConfidence,
    maxEntities: config.expectedColumnCount * 2, // Limit entity explosion
  });

  // FIXED: Use entity name as key, not column name
  for (const entity of newEntities) {
    const entityKey = entity.name.toLowerCase();
    const existing = context.entities.get(entityKey);

    if (existing) {
      // Merge with existing entity
      for (const col of entity.columns) {
        if (!existing.columns.includes(col)) {
          existing.columns.push(col);
        }
      }
      if (!existing.views.includes(viewName)) {
        existing.views.push(viewName);
      }
      // Update confidence if higher
      existing.confidence = Math.max(existing.confidence, entity.confidence);
    } else {
      context.entities.set(entityKey, entity);
    }
  }

  // Extract data patterns if dbPath is available
  let dataPatterns: DataPatterns | undefined;
  if (dbPath) {
    try {
      dataPatterns = await extractDataPatterns(dbPath, viewName, schema);
    } catch {
      // If extraction fails, continue without patterns
    }
  }

  // Update view metadata (use filtered schema)
  const viewMetadata: ViewMetadata = {
    viewName,
    schema: filteredSchema,
    entities: newEntities.map((e) => e.name),
    lastAnalyzed: new Date().toISOString(),
    dataPatterns,
  };
  context.views.set(viewName, viewMetadata);

  // Update vocabulary incrementally (only new terms) - OPTIMIZED
  const allEntities = Array.from(context.entities.values());
  context.vocabulary = buildVocabulary(allEntities, config);
  
  // Invalidate relevant cache entries
  memoCache.invalidate(`vocab:${viewName}`);
  memoCache.invalidate(`entities:${viewName}`);

  // If we have multiple views, do cross-view analysis
  // Filter out system/temp tables
  // INCREMENTAL: Only rebuild relationships if new view added or relationships changed
  const shouldRebuildRelationships =
    !existingView || context.views.size >= 2;

  if (shouldRebuildRelationships && context.views.size >= 2) {
    // INCREMENTAL: Only find relationships with NEW view (not all pairs)
    const existingViews = Array.from(context.views.entries())
      .filter(([name]) => name !== viewName && !isSystemOrTempTable(name))
      .map(([name, meta]) => ({
        viewName: name,
        schema: meta.schema,
      }));

    // Only find relationships between new view and existing views
    const newRelationships: Relationship[] = [];
    for (const existing of existingViews) {
      const rels = await findRelationshipsBetween(
        { viewName, schema: filteredSchema },
        existing,
        dbPath || null,
        config,
      );
      newRelationships.push(...rels);
    }

    // Add existing relationships (don't recompute)
    const existingRels = context.relationships.filter(
      (r) => r.fromView !== viewName && r.toView !== viewName,
    );

    // PRUNING: Filter and limit
    context.relationships = [...existingRels, ...newRelationships]
      .filter((r) => r.confidence >= config.minRelationshipConfidence)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, config.expectedViewCount * 3); // Limit total relationships

    // Build entity graph
    context.entityGraph = buildEntityGraph(
      Array.from(context.entities.values()),
      context.relationships,
    );

    // Infer domain from all schemas
    const allSchemasForDomain = Array.from(context.views.entries())
      .filter(([name]) => !isSystemOrTempTable(name))
      .map(([name, meta]) => meta.schema);
    context.domain = inferDomain(allSchemasForDomain);
  }

  // Save updated context
  await saveBusinessContext(conversationDir, context);

  // Performance monitoring
  const elapsed = Date.now() - startTime;
  if (elapsed > config.maxContextUpdateTime) {
    console.warn(
      `[BusinessContext] Update took ${elapsed}ms (target: ${config.maxContextUpdateTime}ms) for view: ${viewName}`,
    );
  }

  return context;
}

// ============================================================================
// LAZY LOADING ARCHITECTURE
// ============================================================================

/**
 * Lazy Business Context Loader - loads only what's needed, when needed
 */
export class LazyBusinessContextLoader {
  private context: BusinessContext | null = null;
  private loadedComponents = new Set<string>();
  private config: PerformanceConfig;
  private conversationDir: string;
  private dbPath?: string;

  constructor(config: PerformanceConfig, conversationDir: string, dbPath?: string) {
    this.config = config;
    this.conversationDir = conversationDir;
    this.dbPath = dbPath;
  }

  async getFullContext(): Promise<BusinessContext> {
    if (!this.context) {
      this.context = await loadBusinessContext(this.conversationDir);
      if (!this.context) {
        this.context = {
          entities: new Map(),
          vocabulary: new Map(),
          relationships: [],
          entityGraph: new Map(),
          domain: { domain: 'general', confidence: 0.5, keywords: [], alternativeDomains: [] },
          views: new Map(),
          updatedAt: new Date().toISOString(),
        };
      }
    }
    return this.context;
  }

  async getEntities(viewName?: string): Promise<BusinessEntity[]> {
    if (!this.config.enableLazyLoading) {
      const context = await this.getFullContext();
      return this.filterEntities(context, viewName);
    }

    // Lazy load entities only
    if (!this.loadedComponents.has('entities')) {
      await this.loadEntities();
    }

    const context = await this.getFullContext();
    return this.filterEntities(context, viewName);
  }

  async getRelationships(viewName?: string): Promise<Relationship[]> {
    if (!this.config.enableLazyLoading) {
      const context = await this.getFullContext();
      return this.filterRelationships(context, viewName);
    }

    // Only load relationships if actually needed
    if (!this.loadedComponents.has('relationships')) {
      await this.loadRelationships();
    }

    const context = await this.getFullContext();
    return this.filterRelationships(context, viewName);
  }

  async getVocabulary(term?: string): Promise<Map<string, VocabularyEntry>> {
    if (!this.config.enableLazyLoading) {
      const context = await this.getFullContext();
      return this.filterVocabulary(context, term);
    }

    if (!this.loadedComponents.has('vocabulary')) {
      await this.loadVocabulary();
    }

    const context = await this.getFullContext();
    return this.filterVocabulary(context, term);
  }

  async getDomain(): Promise<DomainInference> {
    const context = await this.getFullContext();
    return context.domain;
  }

  private async loadEntities(): Promise<void> {
    if (!this.context) {
      this.context = await loadBusinessContext(this.conversationDir);
    }
    this.loadedComponents.add('entities');
  }

  private async loadRelationships(): Promise<void> {
    if (!this.context) {
      this.context = await loadBusinessContext(this.conversationDir);
    }
    this.loadedComponents.add('relationships');
  }

  private async loadVocabulary(): Promise<void> {
    if (!this.context) {
      this.context = await loadBusinessContext(this.conversationDir);
    }
    this.loadedComponents.add('vocabulary');
  }

  private filterEntities(context: BusinessContext, viewName?: string): BusinessEntity[] {
    const entities = Array.from(context.entities.values());
    return viewName
      ? entities.filter((e) => e.views.includes(viewName))
      : entities;
  }

  private filterRelationships(context: BusinessContext, viewName?: string): Relationship[] {
    const relationships = context.relationships;
    return viewName
      ? relationships.filter(
          (r) => r.fromView === viewName || r.toView === viewName,
        )
      : relationships;
  }

  private filterVocabulary(
    context: BusinessContext,
    term?: string,
  ): Map<string, VocabularyEntry> {
    const vocabulary = context.vocabulary;
    if (!term) return vocabulary;

    const filtered = new Map<string, VocabularyEntry>();
    const termLower = term.toLowerCase();
    for (const [key, entry] of vocabulary.entries()) {
      if (
        key.includes(termLower) ||
        entry.businessTerm.toLowerCase().includes(termLower) ||
        entry.technicalTerms.some((t) => t.toLowerCase().includes(termLower))
      ) {
        filtered.set(key, entry);
      }
    }
    return filtered;
  }

  invalidate(): void {
    this.context = null;
    this.loadedComponents.clear();
  }
}

// ============================================================================
// ACTIVE TRANSLATION FUNCTIONS FOR SQL GENERATION
// ============================================================================

/**
 * Translate business term to column(s) with confidence scores
 */
export function translateBusinessTermToColumn(
  context: BusinessContext,
  term: string,
  viewName?: string,
): Array<{ column: string; view: string; confidence: number }> {
  const results: Array<{ column: string; view: string; confidence: number }> = [];
  const termLower = term.toLowerCase();
  const singularTerm = toSingular(termLower);

  // Direct vocabulary lookup
  const entry = context.vocabulary.get(termLower) || context.vocabulary.get(singularTerm);
  if (entry) {
    for (const techTerm of entry.technicalTerms) {
      // Find which view(s) contain this column
      for (const entity of context.entities.values()) {
        if (entity.columns.includes(techTerm)) {
          for (const view of entity.views) {
            if (!viewName || view === viewName) {
              results.push({
                column: techTerm,
                view,
                confidence: entry.confidence,
              });
            }
          }
        }
      }
    }
  }

  // Synonym lookup
  for (const [vocabTerm, vocabEntry] of context.vocabulary.entries()) {
    if (vocabEntry.synonyms.includes(termLower) || vocabEntry.synonyms.includes(singularTerm)) {
      for (const techTerm of vocabEntry.technicalTerms) {
        for (const entity of context.entities.values()) {
          if (entity.columns.includes(techTerm)) {
            for (const view of entity.views) {
              if (!viewName || view === viewName) {
                results.push({
                  column: techTerm,
                  view,
                  confidence: vocabEntry.confidence * 0.8, // Lower confidence for synonyms
                });
              }
            }
          }
        }
      }
    }
  }

  // Partial match (fuzzy)
  for (const [vocabTerm, vocabEntry] of context.vocabulary.entries()) {
    if (vocabTerm.includes(termLower) || termLower.includes(vocabTerm)) {
      for (const techTerm of vocabEntry.technicalTerms) {
        for (const entity of context.entities.values()) {
          if (entity.columns.includes(techTerm)) {
            for (const view of entity.views) {
              if (!viewName || view === viewName) {
                results.push({
                  column: techTerm,
                  view,
                  confidence: vocabEntry.confidence * 0.6, // Lower confidence for partial matches
                });
              }
            }
          }
        }
      }
    }
  }

  // Sort by confidence descending
  results.sort((a, b) => b.confidence - a.confidence);

  // Remove duplicates
  const seen = new Set<string>();
  return results.filter((r) => {
    const key = `${r.view}.${r.column}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Suggest JOIN conditions for multiple views
 */
export function suggestJoins(
  context: BusinessContext,
  viewNames: string[],
): Relationship[] {
  return context.relationships.filter(
    (rel) => viewNames.includes(rel.fromView) && viewNames.includes(rel.toView),
  );
}

/**
 * Get all columns belonging to an entity across views
 */
export function getEntityColumns(
  context: BusinessContext,
  entityName: string,
): Array<{ column: string; view: string }> {
  const results: Array<{ column: string; view: string }> = [];
  const entityKey = entityName.toLowerCase();

  const entity = context.entities.get(entityKey);
  if (entity) {
    for (const column of entity.columns) {
      for (const view of entity.views) {
        results.push({ column, view });
      }
    }
  }

  return results;
}


