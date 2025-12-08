import type { ChartType } from '../types/chart.types';

/**
 * Chart configuration with description, selection criteria, and generation prompts
 * This file is editable and can be extended with new chart types in the future
 */
export interface ChartDefinition {
  /** Chart type identifier */
  type: ChartType;
  /** Human-readable description for chart type selection */
  description: string;
  /** Indicators that suggest this chart type should be used */
  indicators: string[];
  /** Data format description for this chart type */
  dataFormat: {
    description: string;
    example: unknown;
  };
  /** Chart-specific requirements for generation */
  requirements: {
    /** Required keys in the config object */
    requiredKeys: string[];
    /** Description of what each key represents */
    keyDescriptions: Record<string, string>;
    /** Data format template */
    dataFormatTemplate: string;
  };
  /** System prompt section for chart type selection */
  selectionPrompt: string;
  /** System prompt section for chart generation */
  generationPrompt: string;
}

/**
 * Supported chart types configuration
 * Add new chart types here by extending this object
 */
export const SUPPORTED_CHARTS: Record<ChartType, ChartDefinition> = {
  bar: {
    type: 'bar',
    description:
      'Bar charts are best for categorical data, comparisons, and aggregations',
    indicators: [
      'Categorical data (categories, groups, regions)',
      'Comparisons between discrete groups',
      'Aggregations (SUM, COUNT, AVG) grouped by category',
      'Rankings or top N lists',
    ],
    dataFormat: {
      description: 'Array of objects with category (xKey) and value (yKey)',
      example: [{ name: 'Category A', value: 100 }],
    },
    requirements: {
      requiredKeys: ['xKey', 'yKey'],
      keyDescriptions: {
        xKey: 'Column name for categories (X-axis)',
        yKey: 'Column name for values (Y-axis)',
      },
      dataFormatTemplate: '[{ name: "Category", value: number }]',
    },
    selectionPrompt: `**bar**: Best for categorical data, comparisons, and aggregations.
   - Use when: categorical data, comparisons between discrete groups, aggregations grouped by category, rankings or top N lists`,
    generationPrompt: `**Bar Chart Specific Requirements:**
- xKey: Column name for categories (X-axis)
- yKey: Column name for values (Y-axis)
- data format: [{ name: "Category", value: number }]`,
  },
  line: {
    type: 'line',
    description:
      'Line charts are best for time series, trends, and continuous data over time',
    indicators: [
      'Time series data (dates, timestamps)',
      'Trends over time',
      'Continuous data points',
      'Multiple series over the same time period',
    ],
    dataFormat: {
      description:
        'Array of objects with time/category (xKey) and value(s) (yKey)',
      example: [{ name: '2024-01', value: 100 }],
    },
    requirements: {
      requiredKeys: ['xKey', 'yKey'],
      keyDescriptions: {
        xKey: 'Column name for time/categories (X-axis)',
        yKey: 'Column name for values (Y-axis)',
      },
      dataFormatTemplate: '[{ name: "Time/Category", value: number }]',
    },
    selectionPrompt: `**line**: Best for time series, trends, and continuous data over time.
   - Use when: time series data (dates, timestamps), trends over time, continuous data points, multiple series over the same time period`,
    generationPrompt: `**Line Chart Specific Requirements:**
- xKey: Column name for time/categories (X-axis)
- yKey: Column name for values (Y-axis)
- data format: [{ name: "Time/Category", value: number }]`,
  },
  pie: {
    type: 'pie',
    description:
      'Pie charts are best for proportions, percentages, and part-to-whole relationships',
    indicators: [
      'Proportions or percentages',
      'Part-to-whole relationships',
      'Single dimension breakdown',
      'Distribution of a total',
    ],
    dataFormat: {
      description: 'Array of objects with name (nameKey) and value (valueKey)',
      example: [{ name: 'Category A', value: 100 }],
    },
    requirements: {
      requiredKeys: ['nameKey', 'valueKey'],
      keyDescriptions: {
        nameKey: 'Column name for labels',
        valueKey: 'Column name for values',
      },
      dataFormatTemplate: '[{ name: "Label", value: number }]',
    },
    selectionPrompt: `**pie**: Best for proportions, percentages, and part-to-whole relationships.
   - Use when: proportions or percentages, part-to-whole relationships, single dimension breakdown, distribution of a total`,
    generationPrompt: `**Pie Chart Specific Requirements:**
- nameKey: Column name for labels
- valueKey: Column name for values
- data format: [{ name: "Label", value: number }]`,
  },
};

/**
 * Get all supported chart types
 */
export function getSupportedChartTypes(): ChartType[] {
  return Object.keys(SUPPORTED_CHARTS) as ChartType[];
}

export function getChartTypesUnionString(): string {
  return getSupportedChartTypes()
    .map((type) => `"${type}"`)
    .join(' | ');
}

/**
 * Get chart definition by type
 */
export function getChartDefinition(
  chartType: ChartType,
): ChartDefinition | undefined {
  return SUPPORTED_CHARTS[chartType];
}

/**
 * Get chart selection prompt text for all charts
 */
export function getChartSelectionPrompts(): string {
  return Object.values(SUPPORTED_CHARTS)
    .map(
      (chart, index) =>
        `${index + 1}. ${chart.selectionPrompt}\n   - Indicators: ${chart.indicators.join(', ')}`,
    )
    .join('\n\n');
}

/**
 * Get chart generation prompt for a specific chart type
 */
export function getChartGenerationPrompt(chartType: ChartType): string {
  const chart = SUPPORTED_CHARTS[chartType];
  if (!chart) {
    throw new Error(`Unsupported chart type: ${chartType}`);
  }
  return chart.generationPrompt;
}

/**
 * Get comprehensive chart information for system prompts
 * Includes all supported chart types with their descriptions and use cases
 */
export function getChartsInfoForPrompt(): string {
  return Object.values(SUPPORTED_CHARTS)
    .map(
      (chart) => `
**${chart.type.toUpperCase()} Chart** (${chart.type})
- Description: ${chart.description}
- Best for: ${chart.indicators.join(', ')}
- Data format: ${chart.dataFormat.description}
- Required keys: ${chart.requirements.requiredKeys.join(', ')}
- Key descriptions: ${Object.entries(chart.requirements.keyDescriptions)
        .map(([key, desc]) => `  - ${key}: ${desc}`)
        .join('\n')}
`,
    )
    .join('\n');
}

/**
 * Get axes and labels precision guidelines
 */
export function getAxesLabelsPrecisionGuidelines(): string {
  return `
**Axes Naming and Labels Precision Guidelines:**

1. **Axis Labels (config.labels):**
   - Always provide human-readable labels for all axes and data keys
   - Use proper capitalization (Title Case for labels)
   - Remove underscores and replace with spaces
   - Make labels descriptive and clear
   - Examples:
     * "students_count" → "Students Count"
     * "major" → "Major"
     * "sales_amount" → "Sales Amount"
     * "date" → "Date"
     * "revenue" → "Revenue"

2. **X-Axis Labels (for bar/line charts):**
   - Should clearly describe the categorical dimension
   - Use singular or plural appropriately based on context
   - Examples: "Major", "Month", "Region", "Product Category"

3. **Y-Axis Labels (for bar/line charts):**
   - Should clearly describe the numerical dimension
   - Include units if applicable (e.g., "Sales (USD)", "Count", "Percentage")
   - Use descriptive names that indicate what is being measured
   - Examples: "Number of Students", "Total Sales", "Average Score", "Count"

4. **Pie Chart Labels:**
   - nameKey label: Describes the category dimension (e.g., "Category", "Region", "Type")
   - valueKey label: Describes the value dimension (e.g., "Count", "Percentage", "Amount")

5. **Label Mapping (config.labels):**
   - Map ALL data keys to human-readable labels
   - Include mappings for both the original column names AND the transformed keys
   - Example: If data has keys "name" and "value", provide labels for both:
     {
       "name": "Category Name",
       "value": "Count",
       "major": "Major",  // original column
       "students_count": "Students Count"  // original column
     }

6. **Precision Rules:**
   - Be consistent with terminology throughout
   - Use domain-appropriate terms (e.g., "Students" not "Users" for education data)
   - Avoid abbreviations unless they're standard (e.g., "USD" is fine, but "Num" should be "Number")
   - Keep labels concise but descriptive (aim for 2-4 words)
`;
}
