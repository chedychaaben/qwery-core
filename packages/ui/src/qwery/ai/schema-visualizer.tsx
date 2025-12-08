'use client';

import * as React from 'react';
import { Database, Table2, Columns } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface SchemaColumn {
  columnName: string;
  columnType: string;
}

export interface SchemaTable {
  tableName: string;
  columns: SchemaColumn[];
}

export interface SchemaData {
  databaseName: string;
  schemaName: string;
  tables: SchemaTable[];
}

export interface SchemaVisualizerProps {
  schema: SchemaData;
  tableName?: string;
  className?: string;
}

/**
 * Specialized component for visualizing database schema information
 */
export function SchemaVisualizer({
  schema,
  tableName,
  className,
}: SchemaVisualizerProps) {
  const targetTableName =
    tableName ||
    (schema.tables.length > 0 ? schema.tables[0]?.tableName : undefined);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Schema Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Database className="text-muted-foreground h-4 w-4" />
          <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Table Schema
          </h4>
        </div>
        {targetTableName && (
          <div className="flex items-center gap-2 pl-6">
            <Table2 className="text-muted-foreground h-3.5 w-3.5" />
            <span className="text-foreground text-sm font-medium">
              {targetTableName}
            </span>
          </div>
        )}
        <div className="text-muted-foreground pl-6 text-xs">
          <span>Database: {schema.databaseName}</span>
          {schema.schemaName && schema.schemaName !== schema.databaseName && (
            <span> / Schema: {schema.schemaName}</span>
          )}
        </div>
      </div>

      {/* Tables */}
      {schema.tables.map((table, tableIndex) => (
        <div key={tableIndex} className="space-y-2">
          <div className="flex items-center gap-2">
            <Table2 className="text-muted-foreground h-4 w-4" />
            <h5 className="text-foreground text-sm font-semibold">
              {table.tableName}
            </h5>
            <span className="text-muted-foreground text-xs">
              ({table.columns.length} column
              {table.columns.length !== 1 ? 's' : ''})
            </span>
          </div>

          {/* Columns Table */}
          <div className="max-w-full min-w-0 overflow-hidden rounded-lg border">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-muted/30 border-b">
                    <th className="text-muted-foreground px-4 py-2 text-left text-xs font-medium">
                      <div className="flex items-center gap-2">
                        <Columns className="h-3 w-3" />
                        Column Name
                      </div>
                    </th>
                    <th className="text-muted-foreground px-4 py-2 text-left text-xs font-medium">
                      Data Type
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {table.columns.map((column, colIndex) => (
                    <tr
                      key={colIndex}
                      className="hover:bg-muted/20 border-b transition-colors"
                    >
                      <td className="px-4 py-2 text-sm font-medium">
                        {column.columnName}
                      </td>
                      <td className="text-muted-foreground px-4 py-2 font-mono text-sm">
                        {column.columnType}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
