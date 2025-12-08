import { ToolOutput } from '../../ai-elements/tool';
import type { ToolUIPart } from 'ai';
import {
  LinkIcon,
  CheckCircleIcon,
  XCircleIcon,
  LoaderIcon,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export interface LinkDataResult {
  url: string;
  status: 'success' | 'error' | 'pending';
  data?: unknown;
  error?: string;
  contentType?: string;
  size?: number;
}

export interface LinkDataReaderData {
  links: LinkDataResult[];
  totalLinks: number;
  successful: number;
  failed: number;
  pending: number;
}

function LinkDataReaderOutput({
  output,
  errorText,
}: {
  output: ToolUIPart['output'];
  errorText: ToolUIPart['errorText'];
}) {
  if (errorText) {
    return <ToolOutput output={output} errorText={errorText} />;
  }

  if (!output) {
    return <ToolOutput output={output} errorText={errorText} />;
  }

  let parsedOutput: unknown = output;
  if (typeof output === 'string') {
    try {
      parsedOutput = JSON.parse(output);
    } catch {
      return <ToolOutput output={output} errorText={errorText} />;
    }
  }

  if (
    parsedOutput &&
    typeof parsedOutput === 'object' &&
    !Array.isArray(parsedOutput) &&
    'links' in parsedOutput &&
    Array.isArray(parsedOutput.links)
  ) {
    try {
      const data = parsedOutput as LinkDataReaderData;
      const { links, totalLinks, successful, failed, pending } = data;

      return (
        <div className="min-w-0 space-y-4 p-4">
          {/* Summary Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <div className="border-foreground/10 flex size-9 shrink-0 items-center justify-center rounded-lg border-2">
                <LinkIcon className="text-foreground size-4.5" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <h3 className="text-foreground text-base font-semibold">
                  Link Data Reader
                </h3>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-muted-foreground text-sm">
                    {totalLinks} link{totalLinks !== 1 ? 's' : ''} processed
                  </span>
                  {successful > 0 && (
                    <span className="text-sm font-medium text-emerald-600">
                      {successful} successful
                    </span>
                  )}
                  {failed > 0 && (
                    <span className="text-destructive text-sm font-medium">
                      {failed} failed
                    </span>
                  )}
                  {pending > 0 && (
                    <span className="text-muted-foreground text-sm font-medium">
                      {pending} pending
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Links List */}
          <div className="space-y-2">
            {links.map((link, index) => (
              <div
                key={index}
                className={cn(
                  'rounded-lg border p-4 transition-colors',
                  link.status === 'success' &&
                    'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20',
                  link.status === 'error' &&
                    'border-destructive/20 bg-destructive/5',
                  link.status === 'pending' && 'border-border bg-muted/30',
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {link.status === 'success' && (
                      <CheckCircleIcon className="size-4 text-emerald-600" />
                    )}
                    {link.status === 'error' && (
                      <XCircleIcon className="text-destructive size-4" />
                    )}
                    {link.status === 'pending' && (
                      <LoaderIcon className="text-muted-foreground size-4 animate-spin" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-foreground text-sm font-medium break-all hover:underline"
                      >
                        {link.url}
                      </a>
                    </div>
                    {link.status === 'success' && (
                      <div className="space-y-1">
                        {link.contentType && (
                          <div className="text-muted-foreground text-xs">
                            Type: {link.contentType}
                          </div>
                        )}
                        {link.size !== undefined && (
                          <div className="text-muted-foreground text-xs">
                            Size: {(link.size / 1024).toFixed(2)} KB
                          </div>
                        )}
                        {link.data !== undefined && (
                          <div className="bg-background mt-2 rounded border p-2">
                            <pre className="overflow-x-auto font-mono text-xs">
                              {typeof link.data === 'string'
                                ? link.data
                                : typeof link.data === 'object' &&
                                    link.data !== null
                                  ? JSON.stringify(link.data, null, 2)
                                  : String(link.data ?? '')}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                    {link.status === 'error' && link.error && (
                      <div className="text-destructive text-sm">
                        {link.error}
                      </div>
                    )}
                    {link.status === 'pending' && (
                      <div className="text-muted-foreground text-sm">
                        Processing...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    } catch (error) {
      console.error('[LinkDataReaderOutput] Error:', error);
      return <ToolOutput output={output} errorText={errorText} />;
    }
  }

  return <ToolOutput output={output} errorText={errorText} />;
}

export { LinkDataReaderOutput };
