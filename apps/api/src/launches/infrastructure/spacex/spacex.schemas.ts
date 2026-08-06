import { z } from 'zod';
import { DATE_PRECISIONS } from '@slt/shared';

/**
 * Forma de la SpaceX API v4 tal y como llega, sin interpretar.
 *
 * Una API de terceros es entrada no confiable: si mañana cambian un tipo, esto
 * debe fallar aquí y de forma ruidosa, no propagar datos corruptos a la base.
 * Todo lo que la fuente puede omitir se declara `nullish`, porque en la práctica
 * omite bastante.
 */

export const spaceXLaunchSchema = z.object({
  id: z.string().min(1),
  flight_number: z.number().int(),
  name: z.string().min(1),
  date_utc: z.iso.datetime(),
  date_precision: z.enum(DATE_PRECISIONS),
  upcoming: z.boolean(),
  tbd: z.boolean().nullish(),
  net: z.boolean().nullish(),
  // null mientras no ha volado: no es `false`, es "todavía no se sabe".
  success: z.boolean().nullish(),
  failures: z
    .array(z.object({ time: z.number().nullish(), altitude: z.number().nullish(), reason: z.string().nullish() }))
    .nullish(),
  details: z.string().nullish(),
  rocket: z.string().nullish(),
  launchpad: z.string().nullish(),
  payloads: z.array(z.string()).nullish(),
  links: z
    .object({
      patch: z.object({ small: z.string().nullish(), large: z.string().nullish() }).nullish(),
      webcast: z.string().nullish(),
      wikipedia: z.string().nullish(),
      article: z.string().nullish(),
    })
    .nullish(),
});

export const spaceXRocketSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.string(),
  active: z.boolean(),
  stages: z.number().int(),
  first_flight: z.string().nullish(),
  height: z.object({ meters: z.number().nullish() }).nullish(),
  mass: z.object({ kg: z.number().nullish() }).nullish(),
  description: z.string().nullish(),
});

export const spaceXLaunchpadSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  full_name: z.string(),
  locality: z.string().nullish(),
  region: z.string().nullish(),
  timezone: z.string().nullish(),
  latitude: z.number().nullish(),
  longitude: z.number().nullish(),
  status: z.string().nullish(),
});

export const spaceXPayloadSchema = z.object({
  id: z.string().min(1),
  name: z.string().nullish(),
  type: z.string().nullish(),
  launch: z.string().nullish(),
  mass_kg: z.number().nullish(),
  orbit: z.string().nullish(),
  customers: z.array(z.string()).nullish(),
  manufacturers: z.array(z.string()).nullish(),
  nationalities: z.array(z.string()).nullish(),
});

export type SpaceXLaunchDto = z.infer<typeof spaceXLaunchSchema>;
export type SpaceXRocketDto = z.infer<typeof spaceXRocketSchema>;
export type SpaceXLaunchpadDto = z.infer<typeof spaceXLaunchpadSchema>;
export type SpaceXPayloadDto = z.infer<typeof spaceXPayloadSchema>;
