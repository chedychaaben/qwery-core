'use client';

import { useState, useCallback } from 'react';
import * as React from 'react';
import { Database, Table2, Copy, Check } from 'lucide-react';
import { Button } from '../../shadcn/button';
import { CodeBlock } from '../../ai-elements/code-block';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { DataGrid } from './data-grid';

export interface SQLQueryResult {
  result: {
    columns: string[];
    rows: Array<Record<string, unknown>>;
  };
}

export interface SQLQueryVisualizerProps {
  query?: string;
  result?: SQLQueryResult;
  className?: string;
}

/**
 * Specialized component for visualizing SQL queries and their results in the chat interface
 */
export function SQLQueryVisualizer({
  query,
  result,
  className,
}: SQLQueryVisualizerProps) {
  const [copied, setCopied] = useState(false);

  const copyQuery = useCallback(async () => {
    if (!query) return;

    try {
      await navigator.clipboard.writeText(query);
      setCopied(true);
      toast.success('SQL query copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Error copying query:', error);
      toast.error('Failed to copy query');
    }
  }, [query]);

  return (
    <div className={cn('space-y-4', className)}>
      {/* SQL Query Section */}
      {query && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Database className="text-muted-foreground h-4 w-4" />
              <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                SQL Query
              </h4>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={copyQuery}
              className="h-7 gap-1.5"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3" />
                  <span className="text-xs">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span className="text-xs">Copy</span>
                </>
              )}
            </Button>
          </div>
          <div className="max-w-full min-w-0 overflow-hidden rounded-md">
            <CodeBlock code={query} language="sql" />
          </div>
        </div>
      )}

      {/* Query Results Section */}
      {result && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Table2 className="text-muted-foreground h-4 w-4" />
            <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Query Results
            </h4>
            {result.result.columns && (
              <span className="text-muted-foreground text-xs">
                ({result.result.rows.length} row
                {result.result.rows.length !== 1 ? 's' : ''})
              </span>
            )}
          </div>
          <DataGrid
            columns={result.result.columns}
            rows={result.result.rows}
            pageSize={50}
          />
        </div>
      )}
    </div>
  );
}
