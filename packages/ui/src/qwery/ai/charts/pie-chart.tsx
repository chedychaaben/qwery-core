'use client';

import { useMemo } from 'react';
import * as React from 'react';
import { PieChart as RechartsPieChart, Pie, Cell } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '../../../shadcn/chart';
import { getColors } from './chart-utils';

export interface PieChartConfig {
  chartType: 'pie';
  data: Array<Record<string, unknown>>;
  config: {
    colors: string[];
    labels?: Record<string, string>;
    nameKey?: string;
    valueKey?: string;
  };
}

export interface PieChartProps {
  chartConfig: PieChartConfig;
}

export function PieChart({ chartConfig }: PieChartProps) {
  const { data, config } = chartConfig;
  const { nameKey = 'name', valueKey = 'value', colors } = config;

  if (!data || data.length === 0) {
    return (
      <div className="text-muted-foreground p-4 text-center text-sm">
        No data available for chart
      </div>
    );
  }

  // Get colors (chart generation now uses direct hex colors)
  const chartColors = useMemo(() => getColors(colors), [colors]);

  // Create chart config for ChartContainer
  // ChartContainer uses this config to generate CSS variables (--color-${key})
  // which are used by ChartTooltipContent for consistent theming
  const chartConfigForContainer = useMemo(() => {
    const configObj: Record<string, { label?: string; color?: string }> = {};
    if (valueKey) {
      configObj[valueKey] = {
        label: config.labels?.[valueKey] || valueKey,
        color: chartColors[0],
      };
    }
    return configObj;
  }, [valueKey, chartColors, config.labels]);

  // Recharts color usage:
  // - Pie chart uses Cell components with `fill` prop for each slice
  // - We cycle through colors array: chartColors[index % chartColors.length]
  // - This ensures each slice gets a different color, cycling if there are more slices than colors
  return (
    <ChartContainer config={chartConfigForContainer}>
      <RechartsPieChart>
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent hideLabel />}
        />
        <Pie
          data={data}
          dataKey={valueKey}
          nameKey={nameKey}
          cx="50%"
          cy="50%"
          outerRadius={80}
          label
        >
          {data.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={chartColors[index % chartColors.length]}
            />
          ))}
        </Pie>
      </RechartsPieChart>
    </ChartContainer>
  );
}
