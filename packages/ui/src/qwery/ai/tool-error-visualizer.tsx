import { AlertCircleIcon } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../shadcn/card';

export interface ToolErrorVisualizerProps {
  errorText: string;
  title?: string;
  description?: string | React.ReactNode;
  children?: React.ReactNode;
}

/**
 * Generic error visualizer component for tool errors.
 * Provides a consistent error UI that can be customized for specific use cases.
 */
export function ToolErrorVisualizer({
  errorText,
  title = 'Error',
  description = 'An error occurred while executing this operation.',
  children,
}: ToolErrorVisualizerProps) {
  return (
    <Card className="border-destructive/20 bg-destructive/5">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="bg-destructive/10 flex size-10 shrink-0 items-center justify-center rounded-full">
            <AlertCircleIcon className="text-destructive size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="mt-1">
              {typeof description === 'string' ? description : description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {children}
        <div className="border-destructive/20 bg-background rounded-lg border p-4">
          <pre className="text-destructive text-sm break-words whitespace-pre-wrap">
            {errorText}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}
