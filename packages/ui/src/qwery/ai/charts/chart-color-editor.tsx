'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Palette, X } from 'lucide-react';
import { Button } from '../../../shadcn/button';
import { Input } from '../../../shadcn/input';
import { Label } from '../../../shadcn/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../../shadcn/card';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../../shadcn/popover';
import { cn } from '../../../lib/utils';

export interface ChartColorEditorProps {
  colors: string[];
  onChange: (colors: string[]) => void;
  maxColors?: number;
  className?: string;
}

/**
 * Validates if a string is a valid hex color
 */
function isValidHexColor(color: string): boolean {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
}

/**
 * Color customization component for charts
 * Allows users to edit chart colors in real-time with a user-friendly interface
 */
export function ChartColorEditor({
  colors,
  onChange,
  maxColors,
  className,
}: ChartColorEditorProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Determine the actual number of colors to show
  const colorCount = maxColors !== undefined ? maxColors : colors.length;

  // Compute display colors (trimmed and padded if needed)
  const computeDisplayColors = useCallback(
    (colorArray: string[]) => {
      const limited = colorArray.slice(0, colorCount);
      if (limited.length < colorCount) {
        const defaultColors = [
          '#8884d8',
          '#82ca9d',
          '#ffc658',
          '#ff7c7c',
          '#8dd1e1',
        ];
        return [...limited, ...defaultColors.slice(limited.length, colorCount)];
      }
      return limited;
    },
    [colorCount],
  );

  const [localColors, setLocalColors] = useState<string[]>(() =>
    computeDisplayColors(colors),
  );
  const prevColorsStrRef = useRef<string>('');

  // Sync local colors when prop changes, but only if values actually changed
  useEffect(() => {
    const displayColors = computeDisplayColors(colors);
    const displayColorsStr = JSON.stringify(displayColors);

    // Only update if the display colors actually changed
    if (prevColorsStrRef.current !== displayColorsStr) {
      prevColorsStrRef.current = displayColorsStr;
      setLocalColors((prev: string[]) => {
        const prevStr = JSON.stringify(prev);
        if (prevStr === displayColorsStr) {
          return prev; // No change needed
        }
        return displayColors;
      });
    }
  }, [colors, computeDisplayColors]);

  const handleColorChange = (index: number, newColor: string) => {
    setLocalColors((prev: string[]) => {
      const updated = [...prev];
      updated[index] = newColor;
      const trimmed = updated.slice(0, colorCount);
      // Update the ref to prevent useEffect from re-triggering
      prevColorsStrRef.current = JSON.stringify(trimmed);
      // Call onChange with trimmed colors
      onChange(trimmed);
      return updated;
    });
  };

  const handleHexInputChange = (index: number, value: string) => {
    // Allow typing and update when valid
    if (value.startsWith('#') || value === '') {
      setLocalColors((prev: string[]) => {
        const updated = [...prev];
        updated[index] = value;

        // If it's a valid hex color, update immediately
        if (isValidHexColor(value)) {
          const trimmed = updated.slice(0, colorCount);
          prevColorsStrRef.current = JSON.stringify(trimmed);
          onChange(trimmed);
        }
        return updated;
      });
    }
  };

  const handleHexInputBlur = (index: number, value: string) => {
    setLocalColors((prev: string[]) => {
      // On blur, ensure we have a valid color
      if (!isValidHexColor(value)) {
        // Reset to previous valid color from props
        const updated = [...prev];
        updated[index] = colors[index] || '#8884d8';
        const trimmed = updated.slice(0, colorCount);
        prevColorsStrRef.current = JSON.stringify(trimmed);
        onChange(trimmed);
        return updated;
      } else if (value !== prev[index]) {
        // Only update if value actually changed
        const trimmed = prev.slice(0, colorCount);
        prevColorsStrRef.current = JSON.stringify(trimmed);
        onChange(trimmed);
      }
      return prev;
    });
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('h-8 gap-2', className)}
        >
          <Palette className="h-3.5 w-3.5" />
          <span className="text-xs">Customize Colors</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Card className="border-0 shadow-none">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">
                Chart Colors
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-6 w-6 p-0"
                title="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {localColors
              .slice(0, colorCount)
              .map((color: string, index: number) => (
                <div key={index} className="space-y-2">
                  <Label
                    htmlFor={`color-${index}`}
                    className="text-xs font-medium"
                  >
                    {colorCount === 1 ? 'Color' : `Color ${index + 1}`}
                  </Label>
                  <div className="flex items-center gap-2">
                    <div className="group relative">
                      <div
                        className="border-border h-10 w-10 cursor-pointer rounded-md border-2 shadow-sm transition-all hover:scale-105 hover:shadow-md"
                        style={{ backgroundColor: color }}
                        onClick={() => {
                          const input = document.getElementById(
                            `color-picker-${index}`,
                          );
                          input?.click();
                        }}
                      />
                      <input
                        type="color"
                        id={`color-picker-${index}`}
                        value={color}
                        onChange={(e) =>
                          handleColorChange(index, e.target.value)
                        }
                        className="absolute inset-0 cursor-pointer opacity-0"
                      />
                    </div>
                    <div className="flex-1">
                      <Input
                        id={`color-${index}`}
                        type="text"
                        value={color}
                        onChange={(e) =>
                          handleHexInputChange(index, e.target.value)
                        }
                        onBlur={(e) =>
                          handleHexInputBlur(index, e.target.value)
                        }
                        className="h-10 font-mono text-xs"
                        placeholder="#8884d8"
                      />
                    </div>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}
