'use client';

import * as React from 'react';
import { cn } from '../../../lib/utils';
import { BarChart3, TrendingUp, PieChart as PieChartIcon } from 'lucide-react';
export type ChartType = 'bar' | 'line' | 'pie';

export interface ChartTypeSelection {
  chartType: ChartType;
  reasoning: string;
}

export interface ChartTypeCard {
  type: ChartType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const CHART_TYPE_CARDS: ChartTypeCard[] = [
  {
    type: 'bar',
    label: 'Bar Chart',
    description: 'Best for categorical data and comparisons',
    icon: BarChart3,
    color: '#8884d8', // Blue
  },
  {
    type: 'line',
    label: 'Line Chart',
    description: 'Best for trends and time series data',
    icon: TrendingUp,
    color: '#82ca9d', // Green
  },
  {
    type: 'pie',
    label: 'Pie Chart',
    description: 'Best for proportions and part-to-whole',
    icon: PieChartIcon,
    color: '#ffc658', // Yellow
  },
];

export interface ChartTypeSelectorProps {
  selection: ChartTypeSelection;
  className?: string;
}

/**
 * Displays chart type selection with cards showing all supported types
 * Highlights the selected chart type
 */
export function ChartTypeSelector({
  selection,
  className,
}: ChartTypeSelectorProps) {
  const selectedType = selection.chartType;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Prominent Reasoning Section */}
      <div className="border-primary/20 bg-primary/5 rounded-lg border p-4">
        <div className="flex items-start gap-3">
          <div className="bg-primary/10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
            <svg
              className="text-primary h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
          </div>
          <div className="flex-1 space-y-1">
            <h4 className="text-foreground text-sm font-semibold">
              Why this chart type?
            </h4>
            <p className="text-foreground/90 text-sm leading-relaxed">
              {selection.reasoning}
            </p>
          </div>
        </div>
      </div>

      {/* Chart Type Cards */}
      <div className="space-y-3">
        <h4 className="text-foreground text-sm font-semibold">
          Available Chart Types
        </h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {CHART_TYPE_CARDS.map((card) => {
            const isSelected = card.type === selectedType;
            const Icon = card.icon;

            return (
              <div
                key={card.type}
                className={cn(
                  'group relative flex flex-col rounded-lg border-2 p-5 transition-all duration-200',
                  isSelected
                    ? 'border-primary bg-primary/10 shadow-primary/10 shadow-md'
                    : 'border-border bg-card hover:border-primary/30 hover:bg-accent/30 hover:shadow-sm',
                )}
              >
                {isSelected && (
                  <div className="absolute top-3 right-3">
                    <div className="bg-primary text-primary-foreground flex h-6 w-6 items-center justify-center rounded-full shadow-sm">
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  </div>
                )}

                {/* Large Icon */}
                <div
                  className={cn(
                    'mb-4 flex h-16 w-16 items-center justify-center rounded-xl transition-all duration-200',
                    isSelected
                      ? 'shadow-primary/20 shadow-lg'
                      : 'shadow-md group-hover:shadow-lg',
                  )}
                  style={{
                    backgroundColor: isSelected
                      ? card.color
                      : `${card.color}15`,
                  }}
                >
                  <div
                    className={cn(
                      'transition-all duration-200',
                      isSelected
                        ? 'h-8 w-8'
                        : 'h-7 w-7 group-hover:h-8 group-hover:w-8',
                    )}
                    style={{
                      color: isSelected ? 'white' : card.color,
                    }}
                  >
                    <Icon className="h-full w-full" />
                  </div>
                </div>

                {/* Card Content */}
                <div className="space-y-2">
                  <h5
                    className={cn(
                      'text-base font-semibold',
                      isSelected ? 'text-primary' : 'text-foreground',
                    )}
                  >
                    {card.label}
                  </h5>
                  <p
                    className={cn(
                      'text-sm leading-relaxed',
                      isSelected
                        ? 'text-foreground/80'
                        : 'text-muted-foreground',
                    )}
                  >
                    {card.description}
                  </p>
                </div>

                {/* Selection Indicator */}
                {isSelected && (
                  <div className="border-primary/20 mt-4 border-t pt-4">
                    <div className="text-primary flex items-center gap-2 text-xs font-medium">
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span>Selected</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
