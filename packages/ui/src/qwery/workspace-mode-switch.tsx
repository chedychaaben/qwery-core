'use client';

import * as React from 'react';
import { Zap, Code2, Check, HelpCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '../shadcn/popover';
import { Button } from '../shadcn/button';
import { Card, CardContent } from '../shadcn/card';
import { Badge } from '../shadcn/badge';

export type WorkspaceMode = 'simple' | 'advanced';

type WorkspaceModeSwitchProps = {
  simpleLabel?: string;
  advancedLabel?: string;
  defaultMode?: WorkspaceMode | string;
  onChange?: (mode: WorkspaceMode) => void;
  className?: string;
};

function normalizeMode(mode?: string): WorkspaceMode {
  const m = mode?.toLowerCase();
  if (m === 'advanced') return 'advanced';
  return 'simple'; // Default fallback
}

export function WorkspaceModeSwitch({
  simpleLabel = 'Simple mode',
  advancedLabel = 'Advanced mode',
  defaultMode = 'simple',
  onChange,
  className,
}: WorkspaceModeSwitchProps = {}) {
  const [open, setOpen] = React.useState(false);
  const currentMode = normalizeMode(defaultMode);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleModeChange = (newMode: WorkspaceMode) => {
    if (currentMode === newMode) {
      setOpen(false);
      return;
    }
    onChange?.(newMode);
    setOpen(false);
  };

  const toggleMode = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newMode = currentMode === 'simple' ? 'advanced' : 'simple';
    onChange?.(newMode);
    setOpen(false);
  };

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setOpen(false);
    }, 150);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={toggleMode}
          className={cn(
            'hover:bg-accent/50 flex h-9 cursor-pointer items-center gap-2 border-2 border-[#ffcb51] px-3 font-medium shadow-sm transition-all dark:border-[#ffcb51]/70',
            className,
          )}
        >
          {currentMode === 'simple' ? (
            <Zap className="h-4 w-4 fill-[#ffcb51]/20 text-[#ffcb51]" />
          ) : currentMode === 'advanced' ? (
            <Code2 className="h-4 w-4 text-[#ffcb51]" />
          ) : (
            <HelpCircle className="text-muted-foreground h-4 w-4" />
          )}
          <span>
            {currentMode === 'simple'
              ? simpleLabel
              : currentMode === 'advanced'
                ? advancedLabel
                : 'Select mode'}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={8}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="w-[320px] space-y-2 p-2"
      >
        <div className="px-2 py-1.5">
          <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Switch mode
          </p>
        </div>
        <div className="grid gap-2">
          <Card
            className={cn(
              'group relative cursor-pointer overflow-hidden border-2 transition-all hover:border-[#ffcb51]/50',
              currentMode === 'simple'
                ? 'border-[#ffcb51] bg-[#ffcb51]/5'
                : 'bg-muted/30 border-transparent',
            )}
            onClick={() => handleModeChange('simple')}
          >
            <CardContent className="flex items-start gap-3 p-3">
              <div
                className={cn(
                  'mt-0.5 rounded-lg p-1.5 transition-colors',
                  currentMode === 'simple'
                    ? 'bg-[#ffcb51]/20'
                    : 'bg-muted group-hover:bg-[#ffcb51]/10',
                )}
              >
                <Zap
                  className={cn(
                    'h-4 w-4 transition-colors',
                    currentMode === 'simple'
                      ? 'fill-[#ffcb51] text-[#ffcb51]'
                      : 'text-muted-foreground group-hover:text-[#ffcb51]',
                  )}
                />
              </div>
              <div className="flex-1 space-y-0.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">{simpleLabel}</h4>
                  {currentMode === 'simple' && (
                    <Badge
                      variant="default"
                      className="h-4.5 gap-1 border-none bg-[#ffcb51] px-1 text-[10px] font-bold text-black hover:bg-[#ffcb51]/90"
                    >
                      <Check className="h-2.5 w-2.5" />
                      Active
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground text-[11px] leading-tight">
                  Automated analysis and AI insights.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card
            className={cn(
              'group relative cursor-pointer overflow-hidden border-2 transition-all hover:border-[#ffcb51]/50',
              currentMode === 'advanced'
                ? 'border-[#ffcb51] bg-[#ffcb51]/5'
                : 'bg-muted/30 border-transparent',
            )}
            onClick={() => handleModeChange('advanced')}
          >
            <CardContent className="flex items-start gap-3 p-3">
              <div
                className={cn(
                  'mt-0.5 rounded-lg p-1.5 transition-colors',
                  currentMode === 'advanced'
                    ? 'bg-[#ffcb51]/20'
                    : 'bg-muted group-hover:bg-[#ffcb51]/10',
                )}
              >
                <Code2
                  className={cn(
                    'h-4 w-4 transition-colors',
                    currentMode === 'advanced'
                      ? 'text-[#ffcb51]'
                      : 'text-muted-foreground group-hover:text-[#ffcb51]',
                  )}
                />
              </div>
              <div className="flex-1 space-y-0.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">{advancedLabel}</h4>
                  {currentMode === 'advanced' && (
                    <Badge
                      variant="default"
                      className="h-4.5 gap-1 border-none bg-[#ffcb51] px-1 text-[10px] font-bold text-black hover:bg-[#ffcb51]/90"
                    >
                      <Check className="h-2.5 w-2.5" />
                      Active
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground text-[11px] leading-tight">
                  SQL notebooks and data exploration.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </PopoverContent>
    </Popover>
  );
}
