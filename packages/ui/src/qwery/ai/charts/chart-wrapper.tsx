'use client';

import { useState, useRef, useCallback, useMemo, createContext } from 'react';
import * as React from 'react';
import { Download, Copy, Check, FileText } from 'lucide-react';
import { Button } from '../../../shadcn/button';
import { Checkbox } from '../../../shadcn/checkbox';
import { Label } from '../../../shadcn/label';
import { toast } from 'sonner';
import { cn } from '../../../lib/utils';

export interface ChartWrapperProps {
  title?: string;
  children: React.ReactNode;
  chartRef?: React.RefObject<HTMLDivElement | null>;
  className?: string;
  showAxisLabels?: boolean;
  onShowAxisLabelsChange?: (show: boolean) => void;
  hideAxisLabelsCheckbox?: boolean;
  chartData?: Array<Record<string, unknown>>;
}

// Context to pass axis label visibility to chart components
export const ChartContext = createContext<{
  showAxisLabels: boolean;
}>({
  showAxisLabels: true,
});

/**
 * Enhanced chart wrapper with title, download, and copy functionality
 */
/**
 * Converts chart data to CSV format
 */
function convertToCSV(data: Array<Record<string, unknown>>): string {
  if (!data || data.length === 0) {
    return '';
  }

  // Get all unique keys from all objects
  const allKeys = new Set<string>();
  data.forEach((row) => {
    Object.keys(row).forEach((key) => allKeys.add(key));
  });

  const headers = Array.from(allKeys);

  // Create CSV header row
  const csvRows: string[] = [
    headers.map((h) => `"${String(h).replace(/"/g, '""')}"`).join(','),
  ];

  // Create CSV data rows
  data.forEach((row) => {
    const values = headers.map((header) => {
      const value = row[header];
      if (value === null || value === undefined) {
        return '""';
      }
      // Convert value to string and escape quotes
      const stringValue = String(value).replace(/"/g, '""');
      return `"${stringValue}"`;
    });
    csvRows.push(values.join(','));
  });

  return csvRows.join('\n');
}

export function ChartWrapper({
  title,
  children,
  chartRef,
  className,
  showAxisLabels: controlledShowAxisLabels,
  onShowAxisLabelsChange,
  hideAxisLabelsCheckbox = false,
  chartData,
}: ChartWrapperProps) {
  const [copied, setCopied] = useState(false);
  const [internalShowAxisLabels, setInternalShowAxisLabels] = useState(true);
  const internalRef = useRef<HTMLDivElement>(null);
  const ref = chartRef || internalRef;

  // Use controlled or internal state
  const showAxisLabels =
    controlledShowAxisLabels !== undefined
      ? controlledShowAxisLabels
      : internalShowAxisLabels;

  const handleShowAxisLabelsChange = (checked: boolean) => {
    if (onShowAxisLabelsChange) {
      onShowAxisLabelsChange(checked);
    } else {
      setInternalShowAxisLabels(checked);
    }
  };

  const downloadAsPNG = useCallback(async () => {
    if (!ref.current) {
      toast.error('Chart element not found');
      return;
    }

    try {
      // Find the SVG element within the chart container
      const svgElement = ref.current.querySelector('svg');
      if (!svgElement) {
        toast.error('SVG element not found in chart');
        return;
      }

      // Clone the SVG to avoid modifying the original
      const clonedSvg = svgElement.cloneNode(true) as SVGElement;

      // Apply system font to all text elements in the SVG
      const textElements = clonedSvg.querySelectorAll('text, tspan');
      textElements.forEach((textEl) => {
        const element = textEl as SVGTextElement;
        const currentStyle = element.getAttribute('style') || '';
        const fontFamily =
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"';
        const newStyle = currentStyle
          ? `${currentStyle}; font-family: ${fontFamily};`
          : `font-family: ${fontFamily};`;
        element.setAttribute('style', newStyle);
      });

      // Get SVG viewBox or dimensions
      const viewBox = clonedSvg.getAttribute('viewBox');
      let width = 0;
      let height = 0;

      if (viewBox) {
        const parts = viewBox.split(' ');
        if (parts.length >= 4) {
          width = parseFloat(parts[2] || '0') || 0;
          height = parseFloat(parts[3] || '0') || 0;
        }
      } else {
        const widthAttr = clonedSvg.getAttribute('width');
        const heightAttr = clonedSvg.getAttribute('height');
        width = parseFloat(widthAttr || '0') || 0;
        height = parseFloat(heightAttr || '0') || 0;
      }

      // If no dimensions found, use bounding rect
      if (!width || !height) {
        const rect = svgElement.getBoundingClientRect();
        width = rect.width;
        height = rect.height;
      }

      // Ensure minimum dimensions
      if (width < 100) width = 800;
      if (height < 100) height = 600;

      const titleHeight = title ? 48 : 0;
      const titlePadding = 16;
      const totalHeight = height + titleHeight;

      // Set explicit dimensions on cloned SVG
      clonedSvg.setAttribute('width', width.toString());
      clonedSvg.setAttribute('height', height.toString());
      clonedSvg.setAttribute('style', 'background: transparent;');

      // Serialize SVG
      const svgData = new XMLSerializer().serializeToString(clonedSvg);
      const svgBlob = new Blob([svgData], {
        type: 'image/svg+xml;charset=utf-8',
      });
      const svgUrl = URL.createObjectURL(svgBlob);

      // Create canvas with space for title
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = totalHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        toast.error('Failed to create canvas context');
        URL.revokeObjectURL(svgUrl);
        return;
      }

      // Set transparent background
      ctx.clearRect(0, 0, width, totalHeight);

      // Draw title if it exists
      if (title) {
        // Get the actual title element to extract its computed color
        const titleElement = ref.current?.querySelector('h3');
        let titleColor = '#000000'; // Default to black
        if (titleElement) {
          const computedStyle = window.getComputedStyle(titleElement);
          titleColor = computedStyle.color || titleColor;
        } else {
          // Fallback: try to get from CSS variable
          const rootStyle = getComputedStyle(document.documentElement);
          const foregroundVar = rootStyle.getPropertyValue('--foreground');
          if (foregroundVar) {
            titleColor = foregroundVar.trim();
          }
        }

        ctx.fillStyle = titleColor;
        ctx.font =
          'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(title, width / 2, titlePadding + 16);
      }

      // Load SVG as image
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        // Draw SVG image below the title
        ctx.drawImage(img, 0, titleHeight, width, height);
        URL.revokeObjectURL(svgUrl);

        // Convert canvas to PNG with transparent background
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              toast.error('Failed to create image blob');
              return;
            }

            // Download the image
            const downloadUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = `${title || 'chart'}-${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(downloadUrl);

            toast.success('Chart downloaded as PNG');
          },
          'image/png',
          1.0,
        );
      };

      img.onerror = () => {
        toast.error('Failed to load SVG image');
        URL.revokeObjectURL(svgUrl);
      };

      img.src = svgUrl;
    } catch (error) {
      console.error('Error downloading chart:', error);
      toast.error('Failed to download chart');
    }
  }, [ref, title]);

  const copySVG = useCallback(async () => {
    if (!ref.current) {
      toast.error('Chart element not found');
      return;
    }

    try {
      const svgElement = ref.current.querySelector('svg');
      if (!svgElement) {
        toast.error('SVG element not found in chart');
        return;
      }

      // Get the SVG code
      const svgCode = new XMLSerializer().serializeToString(svgElement);

      // Copy to clipboard
      await navigator.clipboard.writeText(svgCode);
      setCopied(true);
      toast.success('SVG code copied to clipboard');

      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Error copying SVG:', error);
      toast.error('Failed to copy SVG code');
    }
  }, [ref]);

  const exportAsCSV = useCallback(() => {
    if (!chartData || chartData.length === 0) {
      toast.error('No data available to export');
      return;
    }

    try {
      const csvContent = convertToCSV(chartData);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${title || 'chart'}-data-${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Chart data exported as CSV');
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast.error('Failed to export CSV');
    }
  }, [chartData, title]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({ showAxisLabels }), [showAxisLabels]);

  return (
    <div className={cn('relative space-y-3', className)}>
      {/* Header with title centered and buttons on right */}
      <div className="relative mb-3 flex items-center justify-center">
        {title && (
          <h3 className="text-foreground text-base font-semibold">{title}</h3>
        )}
        {/* Buttons and controls in top right */}
        <div className="absolute top-0 right-0 flex items-center gap-2">
          {!hideAxisLabelsCheckbox && (
            <div className="flex items-center gap-1.5">
              <Checkbox
                id="show-axis-labels"
                checked={showAxisLabels}
                onCheckedChange={(checked) =>
                  handleShowAxisLabelsChange(checked === true)
                }
                className="h-4 w-4"
              />
              <Label
                htmlFor="show-axis-labels"
                className="text-muted-foreground cursor-pointer text-xs"
              >
                Show labels
              </Label>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={downloadAsPNG}
            className="h-7 w-7 p-0"
            title="Download PNG"
          >
            <Download className="h-3 w-3" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={copySVG}
            className="h-7 w-7 p-0"
            title={copied ? 'Copied!' : 'Copy SVG'}
          >
            {copied ? (
              <Check className="h-3 w-3" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
          {chartData && chartData.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={exportAsCSV}
              className="h-7 w-7 p-0"
              title="Export data as CSV"
            >
              <FileText className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
      <ChartContext.Provider value={contextValue}>
        <div ref={ref} className="w-full">
          {children}
        </div>
      </ChartContext.Provider>
    </div>
  );
}
