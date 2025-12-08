import { z } from 'zod';

export const ChartTypeSchema = z.enum(['bar', 'line', 'pie']);

export type ChartType = z.infer<typeof ChartTypeSchema>;

export const ChartTypeSelectionSchema = z.object({
  chartType: ChartTypeSchema,
  reasoning: z.string(),
});

export type ChartTypeSelection = z.infer<typeof ChartTypeSelectionSchema>;

export const ChartConfigSchema = z.object({
  chartType: ChartTypeSchema,
  title: z.string().optional(),
  data: z.array(z.record(z.unknown())),
  config: z.object({
    colors: z.array(z.string()),
    labels: z.record(z.string()).optional(),
    xKey: z.string().optional(),
    yKey: z.string().optional(),
    nameKey: z.string().optional(),
    valueKey: z.string().optional(),
  }),
});

export type ChartConfig = z.infer<typeof ChartConfigSchema>;
