import { z } from 'zod';
import {
  DEFAULT_PAGE_SIZE,
  LAUNCH_OUTCOME_FILTERS,
  LAUNCH_SORT_OPTIONS,
  LAUNCH_TIMING_FILTERS,
  MAX_PAGE_SIZE,
} from '@slt/shared';

const optionalTrimmed = z
  .string()
  .trim()
  .min(1)
  .optional()
  .catch(undefined);

/**
 * Los filtros llegan por query string, así que todo entra como texto. El tope de
 * `pageSize` no es decorativo: sin él, un cliente puede pedir la tabla entera en
 * una sola petición.
 */
export const launchQuerySchema = z.object({
  search: optionalTrimmed,
  timing: z.enum(LAUNCH_TIMING_FILTERS).default('all'),
  outcome: z.enum(LAUNCH_OUTCOME_FILTERS).default('all'),
  country: z.string().trim().length(2).toUpperCase().optional().catch(undefined),
  rocket: optionalTrimmed,
  year: z.coerce.number().int().min(1957).max(2100).optional().catch(undefined),
  sort: z.enum(LAUNCH_SORT_OPTIONS).default('date_desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export type LaunchQuery = z.infer<typeof launchQuerySchema>;
