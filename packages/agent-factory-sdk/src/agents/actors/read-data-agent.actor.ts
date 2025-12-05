import { z } from 'zod';
import {
  Experimental_Agent as Agent,
  convertToModelMessages,
  UIMessage,
  tool,
  validateUIMessages,
  stepCountIs,
} from 'ai';
import { fromPromise } from 'xstate/actors';
import { resolveModel } from '../../services';
import { testConnection } from '../../tools/test-connection';
import type { SimpleSchema } from '@qwery/domain/entities';
import { runQuery } from '../../tools/run-query';
import { READ_DATA_AGENT_PROMPT } from '../prompts/read-data-agent.prompt';
import type { BusinessContext } from '../../tools/types/business-context.types';
import { mergeBusinessContexts } from '../../tools/utils/business-context.storage';
import { getConfig } from '../../tools/utils/business-context.config';
import { buildBusinessContext } from '../../tools/build-business-context';
import { enhanceBusinessContextInBackground } from './enhance-business-context.actor';
import type { Repositories } from '@qwery/domain/repositories';
import { initializeDatasources } from '../../tools/datasource-initializer';
import {
  GetConversationService,
  GetConversationBySlugService,
} from '@qwery/domain/services';
import {
  loadDatasources,
  groupDatasourcesByType,
} from '../../tools/datasource-loader';
import { listAvailableSheets } from '../../tools/list-available-sheets';
import { viewSheet } from '../../tools/view-sheet';
import { generateChart, selectChartType } from '../tools/generate-chart';
import { renameSheet } from '../../tools/rename-sheet';
import { deleteSheet } from '../../tools/delete-sheet';
import { gsheetToDuckdb } from '../../tools/gsheet-to-duckdb';
import { extractSchema } from '../../tools/extract-schema';
import {
  registerSheetView,
  loadViewRegistry,
  generateSemanticViewName,
  validateTableExists,
  createViewFromTable,
  dropTable,
  cleanupOrphanedTempTables,
  withRetry,
  formatViewCreationError,
  type RegistryContext,
} from '../../tools/view-registry';
import { generateSheetName } from '../../services/generate-sheet-name.service';

// Lazy workspace resolution - only resolve when actually needed, not at module load time
// This prevents side effects when the module is imported in browser/SSR contexts
let WORKSPACE_CACHE: string | undefined;

function resolveWorkspaceDir(): string | undefined {
  const globalProcess =
    typeof globalThis !== 'undefined'
      ? (globalThis as { process?: NodeJS.Process }).process
      : undefined;
  const envValue =
    globalProcess?.env?.WORKSPACE ??
    globalProcess?.env?.VITE_WORKING_DIR ??
    globalProcess?.env?.WORKING_DIR;
  if (envValue) {
    return envValue;
  }

  try {
    return (import.meta as { env?: Record<string, string> })?.env
      ?.VITE_WORKING_DIR;
  } catch {
    return undefined;
  }
}

function getWorkspace(): string | undefined {
  if (WORKSPACE_CACHE === undefined) {
    WORKSPACE_CACHE = resolveWorkspaceDir();
  }
  return WORKSPACE_CACHE;
}

export const readDataAgent = async (
  conversationId: string,
  messages: UIMessage[],
  model: string,
  repositories?: Repositories,
) => {
  // Initialize datasources if repositories are provided
  if (repositories) {
    const workspace = getWorkspace();
    if (workspace) {
      try {
        // Get conversation to find datasources
        // conversationId is the actual conversation ID (UUID), not a slug
        const getConversationService = new GetConversationService(
          repositories.conversation,
        );
        const conversation =
          await getConversationService.execute(conversationId);

        if (conversation?.datasources && conversation.datasources.length > 0) {
          // Initialize all datasources
          const initResults = await initializeDatasources({
            conversationId,
            datasourceIds: conversation.datasources,
            datasourceRepository: repositories.datasource,
            workspace,
          });

          // Log initialization results for debugging
          const successful = initResults.filter((r) => r.success);
          const failed = initResults.filter((r) => !r.success);

          if (successful.length > 0) {
            console.log(
              `[ReadDataAgent] Initialized ${successful.length} datasource(s) with ${successful.reduce((sum, r) => sum + r.viewsCreated, 0)} view(s)`,
            );
          }

          if (failed.length > 0) {
            console.warn(
              `[ReadDataAgent] Failed to initialize ${failed.length} datasource(s):`,
              failed.map((f) => `${f.datasourceName} (${f.error})`).join(', '),
            );
          }
        } else {
          console.log(
            `[ReadDataAgent] No datasources found in conversation ${conversationId}`,
          );
        }
      } catch (error) {
        // Log but don't fail - datasources might not be available yet
        console.warn(
          `[ReadDataAgent] Failed to initialize datasources:`,
          error,
        );
      }
    }
  }

  const result = new Agent({
    model: await resolveModel(model),
    system: READ_DATA_AGENT_PROMPT,
    tools: {
      testConnection: tool({
        description:
          'Test the connection to the database to check if the database is accessible',
        inputSchema: z.object({}),
        execute: async () => {
          const workspace = getWorkspace();
          if (!workspace) {
            throw new Error('WORKSPACE environment variable is not set');
          }
          const { join } = await import('node:path');
          const dbPath = join(workspace, conversationId, 'database.db');
          const result = await testConnection({
            dbPath: dbPath,
          });
          return result.toString();
        },
      }),
      getSchema: tool({
        description:
          'Discover available data structures directly from DuckDB (views + attached databases). If viewName is provided, returns schema for that specific view/table (accepts fully qualified paths). If not provided, returns schemas for everything discovered in DuckDB. This updates the business context automatically.',
        inputSchema: z.object({
          viewName: z.string().optional(),
        }),
        execute: async ({ viewName }) => {
          const workspace = getWorkspace();
          if (!workspace) {
            throw new Error('WORKSPACE environment variable is not set');
          }
          const { join } = await import('node:path');
          const dbPath = join(workspace, conversationId, 'database.db');
          const fileDir = join(workspace, conversationId);

          // Helper to describe a single table/view
          const describeObject = async (
            db: string,
            schemaName: string,
            tableName: string,
          ): Promise<SimpleSchema | null> => {
            const { DuckDBInstance } = await import('@duckdb/node-api');
            const instance = await DuckDBInstance.create(dbPath);
            const conn = await instance.connect();
            try {
              const escapedDb = db.replace(/"/g, '""');
              const escapedSchema = schemaName.replace(/"/g, '""');
              const escapedTable = tableName.replace(/"/g, '""');
              const describeQuery = `DESCRIBE "${escapedDb}"."${escapedSchema}"."${escapedTable}"`;
              const reader = await conn.runAndReadAll(describeQuery);
              await reader.readAll();
              const rows = reader.getRowObjectsJS() as Array<{
                column_name: string;
                column_type: string;
              }>;
              return {
                databaseName: db,
                schemaName,
                tables: [
                  {
                    tableName,
                    columns: rows.map((row) => ({
                      columnName: row.column_name,
                      columnType: row.column_type,
                    })),
                  },
                ],
              };
            } catch {
              return null;
            } finally {
              conn.closeSync();
              instance.closeSync();
            }
          };

          // Enumerate all databases/schemas/tables/views from DuckDB
          const { DuckDBInstance } = await import('@duckdb/node-api');
          const instance = await DuckDBInstance.create(dbPath);
          const conn = await instance.connect();

          const collectedSchemas: Map<string, SimpleSchema> = new Map();

          try {
            // Re-attach foreign datasources for this connection (attachments are session-scoped)
            if (repositories) {
              try {
                const getConversationService = new GetConversationService(
                  repositories.conversation,
                );
                const conversation =
                  await getConversationService.execute(conversationId);
                if (conversation?.datasources?.length) {
                  const loaded = await loadDatasources(
                    conversation.datasources,
                    repositories.datasource,
                  );
                  const { foreignDatabases } = groupDatasourcesByType(loaded);
                  for (const { datasource } of foreignDatabases) {
                    const provider =
                      datasource.datasource_provider.toLowerCase();
                    const config = datasource.config as Record<string, unknown>;
                    const attachedDatabaseName = `ds_${datasource.id.replace(
                      /-/g,
                      '_',
                    )}`;
                    try {
                      if (
                        provider === 'postgresql' ||
                        provider === 'neon' ||
                        provider === 'supabase'
                      ) {
                        await conn.run('INSTALL postgres');
                        await conn.run('LOAD postgres');
                        const connectionUrl = config.connectionUrl as string;
                        if (!connectionUrl) continue;
                        await conn.run(
                          `ATTACH '${connectionUrl.replace(/'/g, "''")}' AS "${attachedDatabaseName}" (TYPE POSTGRES)`,
                        );
                        console.log(
                          `[ReadDataAgent] Attached ${attachedDatabaseName} with query: ${connectionUrl.replace(/'/g, "''")}`,
                        );
                      } else if (provider === 'mysql') {
                        await conn.run('INSTALL mysql');
                        await conn.run('LOAD mysql');
                        const connectionUrl =
                          (config.connectionUrl as string) ||
                          `host=${(config.host as string) || 'localhost'} port=${
                            (config.port as number) || 3306
                          } user=${(config.user as string) || 'root'} password=${
                            (config.password as string) || ''
                          } database=${(config.database as string) || ''}`;
                        await conn.run(
                          `ATTACH '${connectionUrl.replace(/'/g, "''")}' AS "${attachedDatabaseName}" (TYPE MYSQL)`,
                        );
                      } else if (provider === 'sqlite') {
                        const sqlitePath =
                          (config.path as string) ||
                          (config.connectionUrl as string);
                        if (!sqlitePath) continue;
                        await conn.run(
                          `ATTACH '${sqlitePath.replace(/'/g, "''")}' AS "${attachedDatabaseName}"`,
                        );
                      }
                    } catch (error) {
                      const msg =
                        error instanceof Error ? error.message : String(error);
                      if (
                        !msg.includes('already attached') &&
                        !msg.includes('already exists')
                      ) {
                        console.warn(
                          `[ReadDataAgent] Failed to attach datasource ${datasource.id}: ${msg}`,
                        );
                      }
                    }
                  }
                }
              } catch (error) {
                console.warn(
                  '[ReadDataAgent] attachForeignForConnection failed:',
                  error,
                );
              }
            }

            const dbReader = await conn.runAndReadAll(
              'SELECT name FROM pragma_database_list;',
            );
            await dbReader.readAll();
            const dbRows = dbReader.getRowObjectsJS() as Array<{
              name: string;
            }>;
            const databases = dbRows.map((r) => r.name);

            const targets: Array<{
              db: string;
              schema: string;
              table: string;
            }> = [];

            for (const db of databases) {
              const escapedDb = db.replace(/"/g, '""');
              const tablesReader = await conn.runAndReadAll(`
                SELECT table_schema, table_name, table_type
                FROM information_schema.tables
                WHERE table_catalog = '${escapedDb}'
                  AND table_type IN ('BASE TABLE', 'VIEW')
              `);
              await tablesReader.readAll();
              const tableRows = tablesReader.getRowObjectsJS() as Array<{
                table_schema: string;
                table_name: string;
                table_type: string;
              }>;
              for (const row of tableRows) {
                targets.push({
                  db,
                  schema: row.table_schema || 'main',
                  table: row.table_name,
                });
              }
            }

            if (viewName) {
              // Describe only the requested object
              const viewId = viewName as string;
              let db = 'main';
              let schemaName = 'main';
              let tableName = viewId;
              if (viewId.includes('.')) {
                const parts = viewId.split('.').filter(Boolean);
                if (parts.length === 3) {
                  db = parts[0] ?? db;
                  schemaName = parts[1] ?? schemaName;
                  tableName = parts[2] ?? tableName;
                } else if (parts.length === 2) {
                  schemaName = parts[0] ?? schemaName;
                  tableName = parts[1] ?? tableName;
                } else if (parts.length === 1) {
                  tableName = parts[0] ?? tableName;
                }
              }
              const schema = await describeObject(db, schemaName, tableName);
              if (!schema) {
                throw new Error(`Object "${viewId}" not found in DuckDB`);
              }
              collectedSchemas.set(viewId, schema);
            } else {
              // Describe everything discovered
              for (const target of targets) {
                const fullName = `${target.db}.${target.schema}.${target.table}`;
                const schema = await describeObject(
                  target.db,
                  target.schema,
                  target.table,
                );
                if (schema) {
                  collectedSchemas.set(fullName, schema);
                }
              }
            }
          } finally {
            conn.closeSync();
            instance.closeSync();
          }

          // Get performance configuration
          const perfConfig = await getConfig(fileDir);

          // Build schemasMap and primary schema
          const schemasMap = collectedSchemas;
          const schema = (viewName && collectedSchemas.get(viewName)) ||
            collectedSchemas.values().next().value || {
              databaseName: 'main',
              schemaName: 'main',
              tables: [],
            };

          // Build fast context (synchronous, < 100ms)
          let fastContext: BusinessContext;
          if (viewName) {
            // Single view - build fast context
            fastContext = await buildBusinessContext({
              conversationDir: fileDir,
              viewName,
              schema,
            });

            // Start enhancement in background (don't await)
            enhanceBusinessContextInBackground({
              conversationDir: fileDir,
              viewName,
              schema,
              dbPath,
            });
          } else {
            // Multiple views - build fast context for each
            const fastContexts: BusinessContext[] = [];
            for (const [vName, vSchema] of schemasMap.entries()) {
              const ctx = await buildBusinessContext({
                conversationDir: fileDir,
                viewName: vName,
                schema: vSchema,
              });
              fastContexts.push(ctx);

              // Start enhancement in background for each view
              enhanceBusinessContextInBackground({
                conversationDir: fileDir,
                viewName: vName,
                schema: vSchema,
                dbPath,
              });
            }
            // Merge all fast contexts into one
            fastContext = mergeBusinessContexts(fastContexts);
          }

          // Use fast context for immediate response
          const entities = Array.from(fastContext.entities.values()).slice(
            0,
            perfConfig.expectedViewCount * 2,
          );
          const relationships = fastContext.relationships.slice(
            0,
            perfConfig.expectedViewCount * 3,
          );
          const vocabulary = Object.fromEntries(
            Array.from(fastContext.vocabulary.entries())
              .slice(0, perfConfig.expectedViewCount * 10)
              .map(([key, entry]) => [key, entry]),
          );

          // Return schema and data insights (hide technical jargon)
          return {
            schema: schema,
            businessContext: {
              domain: fastContext.domain.domain, // Just the domain name string
              entities: entities.map((e) => ({
                name: e.name,
                columns: e.columns,
              })), // Simplified - just name and columns
              relationships: relationships.map((r) => ({
                from: r.fromView,
                to: r.toView,
                join: r.joinCondition,
              })), // Simplified - just connection info
              vocabulary: vocabulary, // Keep for internal use but don't expose structure
            },
          };
        },
      }),
      createDbViewFromSheet: tool({
        description:
          'Create a View from a Google Sheet. Can handle single or multiple sheets. IMPORTANT: Only use this when the user explicitly provides NEW Google Sheet URLs that are not already in the registry. Always call listAvailableSheets first to check if sheets already exist. This tool works alongside the datasource initialization system - use it for ad-hoc imports during conversation.',
        inputSchema: z.object({
          sharedLink: z.union([z.string(), z.array(z.string())]),
        }),
        execute: async ({ sharedLink }) => {
          const workspace = getWorkspace();
          if (!workspace) {
            throw new Error('WORKSPACE environment variable is not set');
          }
          const { join } = await import('node:path');
          const { mkdir } = await import('node:fs/promises');
          await mkdir(workspace, { recursive: true });
          const fileDir = join(workspace, conversationId);
          await mkdir(fileDir, { recursive: true });
          const dbPath = join(fileDir, 'database.db');

          await cleanupOrphanedTempTables(dbPath);

          const context: RegistryContext = {
            conversationDir: fileDir,
          };

          // Handle single or multiple links
          const links = Array.isArray(sharedLink) ? sharedLink : [sharedLink];
          const results: Array<{
            success: boolean;
            viewName?: string;
            displayName?: string;
            error?: string;
            link: string;
          }> = [];

          // Process sequentially to avoid race conditions
          for (const link of links) {
            try {
              const result = await withRetry(
                async () => {
                  // Check if view already exists
                  const existing = await loadViewRegistry(context);
                  const sourceId = link.match(
                    /https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
                  )?.[1];
                  const existingRecord = sourceId
                    ? existing.find((rec) => rec.sourceId === sourceId)
                    : null;

                  if (existingRecord) {
                    // Validate view exists in database
                    const exists = await validateTableExists(
                      dbPath,
                      existingRecord.viewName,
                    );
                    if (!exists) {
                      // View in registry but not in DB - recreate it
                      console.debug(
                        `[ReadDataAgent:${conversationId}] View in registry but missing in DB, recreating: ${existingRecord.viewName}`,
                      );
                      await gsheetToDuckdb({
                        dbPath,
                        sharedLink: link,
                        viewName: existingRecord.viewName,
                      });
                      // Validate it was created
                      const recreated = await validateTableExists(
                        dbPath,
                        existingRecord.viewName,
                      );
                      if (!recreated) {
                        throw new Error('Failed to recreate view in database');
                      }
                    }

                    return {
                      viewName: existingRecord.viewName,
                      displayName:
                        existingRecord.displayName || existingRecord.viewName,
                      sharedLink: existingRecord.sharedLink,
                    };
                  }

                  const tempViewName = `temp_${Date.now()}_${Math.random()
                    .toString(36)
                    .substring(2, 8)}`;

                  let finalViewName: string | null = null;
                  let schema: SimpleSchema | null = null;

                  try {
                    // Step 1: Create temp view to extract schema for semantic naming
                    console.debug(
                      `[ReadDataAgent:${conversationId}] Creating temp view to extract schema for naming: ${link}`,
                    );

                    await gsheetToDuckdb({
                      dbPath,
                      sharedLink: link,
                      viewName: tempViewName,
                    });

                    // Step 2: Extract schema from temp view (for semantic naming only)
                    schema = await extractSchema({
                      dbPath,
                      viewName: tempViewName,
                      allowTempTables: true,
                    });

                    // Step 3: Generate semantic view name
                    const existingNames = existing.map((rec) => rec.viewName);
                    finalViewName = generateSemanticViewName(
                      schema,
                      existingNames,
                    );

                    // Step 4: Create final view directly from source (MATCHES NEW ARCHITECTURE)
                    // This matches datasource-to-duckdb.ts lines 152-156 exactly
                    await gsheetToDuckdb({
                      dbPath,
                      sharedLink: link,
                      viewName: finalViewName,
                    });

                    // Step 5: Verify final view was created (MATCHES NEW ARCHITECTURE)
                    // This matches datasource-to-duckdb.ts lines 198-208 pattern
                    const { DuckDBInstance } = await import('@duckdb/node-api');
                    const verifyInstance = await DuckDBInstance.create(dbPath);
                    const verifyConn = await verifyInstance.connect();
                    try {
                      const escapedFinalName = finalViewName.replace(/"/g, '""');
                      const verifyReader = await verifyConn.runAndReadAll(
                        `SELECT 1 FROM "${escapedFinalName}" LIMIT 1`,
                      );
                      await verifyReader.readAll();
                    } catch (error) {
                      const errorMsg =
                        error instanceof Error ? error.message : String(error);
                      throw new Error(
                        `Failed to create or verify view "${finalViewName}": ${errorMsg}`,
                      );
                    } finally {
                      verifyConn.closeSync();
                      verifyInstance.closeSync();
                    }

                    // Step 6: Extract schema from final view using new connection (MATCHES NEW ARCHITECTURE)
                    // This matches datasource-to-duckdb.ts lines 215-220 exactly
                    schema = await extractSchema({
                      dbPath,
                      viewName: finalViewName,
                    });

                    // Step 7: Drop temp view (cleanup)
                    await dropTable(dbPath, tempViewName);

                    // Step 8: Register in registry (for tracking - new architecture doesn't use registry)
                    const { record } = await registerSheetView(
                      context,
                      link,
                      finalViewName,
                      finalViewName,
                      schema,
                    );

                    return {
                      viewName: record.viewName,
                      displayName: record.displayName,
                      sharedLink: record.sharedLink,
                    };
                  } catch (error) {
                    // Cleanup temp view on error
                    try {
                      await dropTable(dbPath, tempViewName);
                    } catch {
                      // Ignore cleanup errors
                    }
                    throw error;
                  }
                },
                {
                  maxRetries: 3,
                  retryDelay: 100,
                  shouldRetry: (error) => {
                    const msg = error.message;
                    return (
                      msg.includes('timeout') ||
                      msg.includes('network') ||
                      msg.includes('fetch') ||
                      msg.includes('Catalog Error')
                    );
                  },
                },
              );

              results.push({
                success: true,
                viewName: result.viewName,
                displayName: result.displayName,
                link,
              });
            } catch (error) {
              const errorMsg =
                error instanceof Error
                  ? formatViewCreationError(error, link)
                  : String(error);
              results.push({
                success: false,
                error: errorMsg,
                link,
              });
            }
          }

          const successful = results.filter((r) => r.success);
          const failed = results.filter((r) => !r.success);

          if (successful.length === 0) {
            throw new Error(
              `Failed to create views from Google Sheets:\n${failed
                .map((f) => `- ${f.link}: ${f.error}`)
                .join('\n')}`,
            );
          }

          const response: Array<{
            viewName: string;
            displayName: string;
            link: string;
          }> = successful.map((s) => ({
            viewName: s.viewName!,
            displayName: s.displayName || s.viewName!,
            link: s.link,
          }));

          if (failed.length > 0) {
            return {
              success: true,
              views: response,
              warnings: failed.map((f) => ({
                link: f.link,
                error: f.error,
              })),
              message: `Successfully created ${successful.length} view(s), but ${failed.length} failed.`,
            };
          }

          return {
            success: true,
            views: response,
            message: `Successfully created ${successful.length} view(s) from Google Sheet(s).`,
          };
        },
      }),
      runQuery: tool({
        description:
          'Run a SQL query against the DuckDB instance (views from file-based datasources or attached database tables). Query views by name (e.g., "customers") or attached tables by full path (e.g., ds_x.public.users). DuckDB enables federated queries across PostgreSQL, MySQL, Google Sheets, and other datasources.',
        inputSchema: z.object({
          query: z.string(),
        }),
        execute: async ({ query }) => {
          const workspace = getWorkspace();
          if (!workspace) {
            throw new Error('WORKSPACE environment variable is not set');
          }
          const { join } = await import('node:path');
          const dbPath = join(workspace, conversationId, 'database.db');

          const result = await runQuery({
            dbPath,
            query,
          });

          return {
            result: result,
          };
        },
      }),
      listAvailableSheets: tool({
        description:
          'List all available views and tables in the database. Use this when the user asks which sheets are available, or when you need to remind the user which data sources are available.',
        inputSchema: z.object({}),
        execute: async () => {
          const workspace = getWorkspace();
          if (!workspace) {
            throw new Error('WORKSPACE environment variable is not set');
          }
          const { join } = await import('node:path');
          const dbPath = join(workspace, conversationId, 'database.db');

          const result = await listAvailableSheets({ dbPath });
          return {
            sheets: result.sheets,
            message: result.message,
          };
        },
      }),
      viewSheet: tool({
        description:
          'View/display the contents of a view/table. This is a convenient way to quickly see what data is in a view without writing a SQL query. Shows the first 50 rows by default.',
        inputSchema: z.object({
          sheetName: z
            .string()
            .optional()
            .describe('Name of the view/table to view (defaults to first available)'),
          limit: z
            .number()
            .optional()
            .describe('Maximum number of rows to display (defaults to 50)'),
        }),
        execute: async ({ sheetName, limit }) => {
          const workspace = getWorkspace();
          if (!workspace) {
            throw new Error('WORKSPACE environment variable is not set');
          }
          const { join } = await import('node:path');
          const dbPath = join(workspace, conversationId, 'database.db');

          const result = await viewSheet({
            dbPath,
            sheetName,
            limit,
          });
          return {
            sheetName: result.sheetName,
            totalRows: result.totalRows,
            displayedRows: result.displayedRows,
            columns: result.columns,
            rows: result.rows,
            message: result.message,
          };
        },
      }),
      selectChartType: tool({
        description:
          'Select the best chart type (bar, line, or pie) for visualizing the query results. This should be called before generateChart.',
        inputSchema: z.object({
          queryResults: z.object({
            rows: z.array(z.record(z.unknown())),
            columns: z.array(z.string()),
          }),
          sqlQuery: z.string(),
          userInput: z.string(),
        }),
        execute: async ({ queryResults, sqlQuery, userInput }) => {
          const selection = await selectChartType(
            queryResults,
            sqlQuery,
            userInput,
          );
          return selection;
        },
      }),
      generateChart: tool({
        description:
          'Generate chart configuration JSON for the selected chart type. Call selectChartType first to determine the chart type.',
        inputSchema: z.object({
          chartType: z.enum(['bar', 'line', 'pie']),
          queryResults: z.object({
            rows: z.array(z.record(z.unknown())),
            columns: z.array(z.string()),
          }),
          sqlQuery: z.string(),
          userInput: z.string(),
        }),
        execute: async ({ chartType, queryResults, sqlQuery, userInput }) => {
          const chartConfig = await generateChart({
            queryResults,
            sqlQuery,
            userInput,
            chartType, // Pass the pre-selected chart type
          });
          return chartConfig;
        },
      }),
      renameSheet: tool({
        description:
          'Rename a sheet/view to a more meaningful name. Use this when you want to give a sheet a better name based on its content, schema, or user context.',
        inputSchema: z.object({
          oldSheetName: z
            .string()
            .describe('Current name of the sheet/view to rename'),
          newSheetName: z
            .string()
            .describe(
              'New meaningful name for the sheet (use lowercase, numbers, underscores only)',
            ),
        }),
        execute: async ({ oldSheetName, newSheetName }) => {
          const workspace = getWorkspace();
          if (!workspace) {
            throw new Error('WORKSPACE environment variable is not set');
          }
          const { join } = await import('node:path');
          const dbPath = join(workspace, conversationId, 'database.db');

          const result = await renameSheet({
            dbPath,
            oldSheetName,
            newSheetName,
          });
          return result;
        },
      }),
      deleteSheet: tool({
        description:
          'Delete one or more sheets/views from the database. This permanently removes the views and all their data. Supports batch deletion of multiple sheets. Only use this when the user explicitly requests to delete sheet(s).',
        inputSchema: z.object({
          sheetNames: z
            .array(z.string())
            .describe(
              'Array of sheet/view names to delete. Can delete one or more sheets at once. Use listAvailableSheets to see available sheets.',
            ),
        }),
        execute: async ({ sheetNames }) => {
          const workspace = getWorkspace();
          if (!workspace) {
            throw new Error('WORKSPACE environment variable is not set');
          }
          const { join } = await import('node:path');
          const dbPath = join(workspace, conversationId, 'database.db');

          const result = await deleteSheet({
            dbPath,
            sheetNames,
          });
          return result;
        },
      }),
    },
    stopWhen: stepCountIs(20),
  });

  return result.stream({
    messages: convertToModelMessages(await validateUIMessages({ messages })),
    providerOptions: {
      openai: {
        reasoningSummary: 'auto', // 'auto' for condensed or 'detailed' for comprehensive
        reasoningEffort: 'medium',
        reasoningDetailedSummary: true,
        reasoningDetailedSummaryLength: 'long',
      },
    },
  });
};

export const readDataAgentActor = fromPromise(
  async ({
    input,
  }: {
    input: {
      conversationId: string;
      previousMessages: UIMessage[];
      model: string;
      repositories?: Repositories;
    };
  }) => {
    return readDataAgent(
      input.conversationId,
      input.previousMessages,
      input.model,
      input.repositories,
    );
  },
);
