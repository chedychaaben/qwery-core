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
import { gsheetToDuckdb } from '../../tools/gsheet-to-duckdb';
import { extractSchema } from '../../tools/extract-schema';
import { runQuery } from '../../tools/run-query';
import {
  registerSheetView,
  loadViewRegistry,
  updateViewUsage,
  type RegistryContext,
} from '../../tools/view-registry';
import { READ_DATA_AGENT_PROMPT } from '../prompts/read-data-agent.prompt';
import {
  analyzeSchemaAndUpdateContext,
  loadBusinessContext,
} from '../../services/business-context.service';

// Support both import.meta.env (Vite/browser) and process.env (Node.js)
const WORKSPACE = resolveWorkspaceDir();

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

export const readDataAgent = async (
  conversationId: string,
  messages: UIMessage[],
) => {
  const result = new Agent({
    model: await resolveModel('azure/gpt-5-mini'),
    system: READ_DATA_AGENT_PROMPT,
    tools: {
      testConnection: tool({
        description:
          'Test the connection to the database to check if the database is accessible',
        inputSchema: z.object({}),
        execute: async () => {
          if (!WORKSPACE) {
            throw new Error('WORKSPACE environment variable is not set');
          }
          const { join } = await import('node:path');
          const dbPath = join(WORKSPACE, conversationId, 'database.db');
          const result = await testConnection({
            dbPath: dbPath,
          });
          return result.toString();
        },
      }),
      createDbViewFromSheet: tool({
        description: 'Create a View from a Google Sheet. IMPORTANT: Only use this when the user explicitly provides a NEW Google Sheet URL that is not already in the registry. Always call listViews first to check if the sheet already exists.',
        inputSchema: z.object({
          sharedLink: z.string(),
        }),
        execute: async ({ sharedLink }) => {
          if (!WORKSPACE) {
            throw new Error('WORKSPACE environment variable is not set');
          }
          const { join } = await import('node:path');
          const { mkdir } = await import('node:fs/promises');
          await mkdir(WORKSPACE, { recursive: true });
          const fileDir = join(WORKSPACE, conversationId);
          await mkdir(fileDir, { recursive: true });
          const dbPath = join(fileDir, 'database.db');

          // Register the sheet view to get a unique view name
          const context: RegistryContext = {
            conversationDir: fileDir,
          };
          const { record, isNew } = await registerSheetView(
            context,
            sharedLink,
          );

          // Only recreate the view if it's new, otherwise just return existing info
          if (isNew) {
            console.debug(
              `[ReadDataAgent:${conversationId}] Creating DuckDB view from sheet: ${sharedLink}`,
            );

            const message = await gsheetToDuckdb({
              dbPath,
              sharedLink,
              viewName: record.viewName,
            });

            // Extract schema and build business context
            const schema = await extractSchema({
              dbPath,
              viewName: record.viewName,
            });
            await analyzeSchemaAndUpdateContext(fileDir, record.viewName, schema);

            return {
              content: message,
              viewName: record.viewName,
              sharedLink: record.sharedLink,
            };
          } else {
            console.debug(
              `[ReadDataAgent:${conversationId}] View already exists, skipping recreation: ${record.viewName}`,
            );
            return {
              content: `View '${record.viewName}' already exists in the registry. Use listViews to see all available views, then use the viewName directly in queries.`,
              viewName: record.viewName,
              sharedLink: record.sharedLink,
            };
          }
        },
      }),
      listViews: tool({
        description:
          'List all available views (sheets) in the database. Use this to see what data sources are available when the user asks about multiple sheets or when you need to know which view to query.',
        inputSchema: z.object({}),
        execute: async () => {
          if (!WORKSPACE) {
            throw new Error('WORKSPACE environment variable is not set');
          }
          const { join } = await import('node:path');
          const fileDir = join(WORKSPACE, conversationId);
          const context: RegistryContext = {
            conversationDir: fileDir,
          };
          const registry = await loadViewRegistry(context);
          return {
            views: registry.map((record) => ({
              viewName: record.viewName,
              sharedLink: record.sharedLink,
              sourceId: record.sourceId,
              createdAt: record.createdAt,
              lastUsedAt: record.lastUsedAt,
            })),
          };
        },
      }),
      getSchema: tool({
        description:
          'Get the schema of one or all Google Sheet views. If viewName is provided, returns schema for that specific view. If not provided, returns schemas for all available views. Use this to understand the data structure before writing queries. This also updates the business context automatically.',
        inputSchema: z.object({
          viewName: z.string().optional(),
        }),
        execute: async ({ viewName }) => {
          if (!WORKSPACE) {
            throw new Error('WORKSPACE environment variable is not set');
          }
          const { join } = await import('node:path');
          const dbPath = join(WORKSPACE, conversationId, 'database.db');
          const fileDir = join(WORKSPACE, conversationId);

          const schema = await extractSchema({ dbPath, viewName });

          // Update business context if a specific view is requested
          if (viewName) {
            await analyzeSchemaAndUpdateContext(fileDir, viewName, schema);
          } else {
            // If no viewName, update context for all views
            for (const table of schema.tables) {
              await analyzeSchemaAndUpdateContext(fileDir, table.tableName, {
                ...schema,
                tables: [table],
              });
            }
          }

          // Load and include business context in response
          const businessContext = await loadBusinessContext(fileDir);

          return {
            schema: schema,
            businessContext: businessContext
              ? {
                  domain: businessContext.domain,
                  entities: Array.from(businessContext.entities.values()).slice(
                    0,
                    10,
                  ), // Limit for response size
                  relationships: businessContext.relationships.slice(0, 10),
                  vocabulary: Object.fromEntries(
                    Array.from(businessContext.vocabulary.entries()).slice(
                      0,
                      20,
                    ),
                  ),
                }
              : null,
          };
        },
      }),
      runQuery: tool({
        description:
          'Run a SQL query against the Google Sheet views. You can query a single view by name, or join multiple views together. Use listViews first to see available view names. When querying, reference views by their exact viewName from the registry.',
        inputSchema: z.object({
          query: z.string(),
        }),
        execute: async ({ query }) => {
          if (!WORKSPACE) {
            throw new Error('WORKSPACE environment variable is not set');
          }
          const { join } = await import('node:path');
          const dbPath = join(WORKSPACE, conversationId, 'database.db');

          const result = await runQuery({
            dbPath,
            query,
          });

          // Try to extract view names from the query to update usage
          const fileDirPath = join(WORKSPACE, conversationId);
          const context: RegistryContext = {
            conversationDir: fileDirPath,
          };
          const registry = await loadViewRegistry(context);
          const viewNamesInQuery = registry
            .map((r) => r.viewName)
            .filter((vn) => query.includes(vn));
          for (const viewName of viewNamesInQuery) {
            await updateViewUsage(context, viewName);
          }

          return {
            result: result,
          };
        },
      }),
    },
    stopWhen: stepCountIs(20),
  });

  return result.stream({
    messages: convertToModelMessages(await validateUIMessages({ messages })),
  });
};

export const readDataAgentActor = fromPromise(
  async ({
    input,
  }: {
    input: {
      conversationId: string;
      previousMessages: UIMessage[];
    };
  }) => {
    return readDataAgent(input.conversationId, input.previousMessages);
  },
);
