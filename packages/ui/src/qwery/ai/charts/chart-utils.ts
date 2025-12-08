/**
 * Chart color utilities
 * Chart generation now uses direct hex colors, so no CSS variable resolution needed
 */

// Default color palette for fallback
export const DEFAULT_CHART_COLORS = [
  '#8884d8', // Blue
  '#82ca9d', // Green
  '#ffc658', // Yellow
  '#ff7c7c', // Red
  '#8dd1e1', // Cyan
];

/**
 * Gets colors array, using defaults if empty (only for pie charts)
 * Bar and line charts should use colors directly from config without fallback
 */
export function getColors(colors: string[]): string[] {
  return colors.length > 0 ? colors : DEFAULT_CHART_COLORS;
}

/**
 * Gets colors for bar/line charts without default fallback
 */
export function getColorsForBarLine(colors: string[]): string[] {
  return colors;
}
