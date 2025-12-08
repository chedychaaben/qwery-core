'use client';

import { useContext, useMemo } from 'react';
import * as React from 'react';
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  Label,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '../../../shadcn/chart';
import { getColorsForBarLine } from './chart-utils';
import { ChartContext } from './chart-wrapper';

export interface LineChartConfig {
  chartType: 'line';
  data: Array<Record<string, unknown>>;
  config: {
    colors: string[];
    labels?: Record<string, string>;
    xKey?: string;
    yKey?: string;
  };
}

export interface LineChartProps {
  chartConfig: LineChartConfig;
}

export function LineChart({ chartConfig }: LineChartProps) {
  const { data, config } = chartConfig;
  const { xKey = 'name', yKey = 'value', colors, labels } = config;
  const { showAxisLabels } = useContext(ChartContext);

  if (!data || data.length === 0) {
    return (
      <div className="text-muted-foreground p-4 text-center text-sm">
        No data available for chart
      </div>
    );
  }

  // Line charts use colors directly from config without default fallback
  const chartColors = useMemo(() => getColorsForBarLine(colors), [colors]);

  const chartConfigForContainer = useMemo(() => {
    const configObj: Record<string, { label?: string; color?: string }> = {};
    if (yKey) {
      configObj[yKey] = {
        label: labels?.[yKey] || yKey,
        color: chartColors[0],
      };
    }
    return configObj;
  }, [yKey, chartColors, labels]);

  // Get axis labels
  const xAxisLabel = labels?.[xKey] || labels?.name || xKey;
  const yAxisLabel = labels?.[yKey] || labels?.value || 'Value';

  return (
    <ChartContainer config={chartConfigForContainer}>
      <RechartsLineChart data={data} key={`line-${showAxisLabels}`}>
        <XAxis
          dataKey={xKey}
          tickLine={false}
          axisLine={showAxisLabels}
          tickMargin={8}
        >
          {showAxisLabels ? (
            <Label
              key="x-label"
              value={xAxisLabel}
              position="insideBottom"
              offset={-5}
              style={{ textAnchor: 'middle', fill: 'currentColor' }}
            />
          ) : null}
        </XAxis>
        <YAxis tickLine={false} axisLine={showAxisLabels} tickMargin={8}>
          {showAxisLabels ? (
            <Label
              key="y-label"
              value={yAxisLabel}
              angle={-90}
              position="insideLeft"
              style={{ textAnchor: 'middle', fill: 'currentColor' }}
            />
          ) : null}
        </YAxis>
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent indicator="line" />}
        />
        <Line
          type="monotone"
          dataKey={yKey}
          stroke={chartColors[0] || colors[0]}
          strokeWidth={2}
          dot={false}
        />
      </RechartsLineChart>
    </ChartContainer>
  );
}
