import { z } from 'zod';

/**
 * REST Countries v3.1. Sólo se declaran los campos que se piden vía `?fields=`,
 * obligatorio en v3.1: la API rechaza `/all` sin él.
 */
export const restCountrySchema = z.object({
  name: z.object({
    common: z.string().min(1),
    official: z.string().min(1),
  }),
  cca2: z.string().length(2),
  cca3: z.string().length(3),
  altSpellings: z.array(z.string()).nullish(),
  region: z.string().nullish(),
  subregion: z.string().nullish(),
  capital: z.array(z.string()).nullish(),
  latlng: z.array(z.number()).nullish(),
  flags: z
    .object({
      png: z.string().nullish(),
      svg: z.string().nullish(),
      alt: z.string().nullish(),
    })
    .nullish(),
});

export type RestCountryDto = z.infer<typeof restCountrySchema>;

/** Campos solicitados a la API. Se declara aquí para que la petición y el esquema
 *  no puedan desincronizarse en silencio. */
export const REST_COUNTRIES_FIELDS = [
  'name',
  'cca2',
  'cca3',
  'altSpellings',
  'region',
  'subregion',
  'capital',
  'latlng',
  'flags',
].join(',');
