import type { ChartType } from '../types/chart.types';

/**
 * Color configuration for charts
 * This file is editable and can be customized per chart type
 */
export interface ChartColorConfig {
  /** Default colors for this chart type */
  defaultColors: string[];
  /** Alternative color schemes (optional) */
  alternativeSchemes?: {
    name: string;
    colors: string[];
  }[];
}

/**
 * Chart color configurations
 * Customize colors for each chart type here
 */
export const CHART_COLORS: Record<ChartType, ChartColorConfig> = {
  bar: {
    defaultColors: [
      '#8884d8', // Blue
      '#82ca9d', // Green
      '#ffc658', // Yellow
      '#ff7c7c', // Red
      '#8dd1e1', // Cyan
    ],
    alternativeSchemes: [
      {
        name: 'blue',
        colors: [
          'hsl(217, 91%, 60%)',
          'hsl(217, 91%, 70%)',
          'hsl(217, 91%, 80%)',
          'hsl(217, 91%, 90%)',
          'hsl(217, 91%, 95%)',
        ],
      },
    ],
  },
  line: {
    defaultColors: [
      '#8884d8', // Blue
      '#82ca9d', // Green
      '#ffc658', // Yellow
      '#ff7c7c', // Red
      '#8dd1e1', // Cyan
    ],
    alternativeSchemes: [
      {
        name: 'gradient',
        colors: [
          'hsl(142, 76%, 36%)',
          'hsl(217, 91%, 60%)',
          'hsl(280, 100%, 70%)',
          'hsl(0, 72%, 51%)',
          'hsl(38, 92%, 50%)',
        ],
      },
    ],
  },
  pie: {
    defaultColors: [
      '#8884d8', // Blue
      '#82ca9d', // Green
      '#ffc658', // Yellow
      '#ff7c7c', // Red
      '#8dd1e1', // Cyan
    ],
    alternativeSchemes: [
      {
        name: 'pastel',
        colors: [
          'hsl(142, 76%, 80%)',
          'hsl(217, 91%, 80%)',
          'hsl(280, 100%, 85%)',
          'hsl(0, 72%, 80%)',
          'hsl(38, 92%, 80%)',
        ],
      },
    ],
  },
};

/**
 * Get default colors for a chart type
 */
export function getChartColors(chartType: ChartType): string[] {
  return (
    CHART_COLORS[chartType]?.defaultColors || [
      '#8884d8', // Blue
      '#82ca9d', // Green
      '#ffc658', // Yellow
      '#ff7c7c', // Red
      '#8dd1e1', // Cyan
    ]
  );
}

/**
 * Get alternative color scheme for a chart type
 */
export function getAlternativeColorScheme(
  chartType: ChartType,
  schemeName: string,
): string[] | undefined {
  const chart = CHART_COLORS[chartType];
  if (!chart?.alternativeSchemes) {
    return undefined;
  }
  return chart.alternativeSchemes.find((s) => s.name === schemeName)?.colors;
}
