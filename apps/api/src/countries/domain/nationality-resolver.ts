import type { NationalityResolution } from '@slt/shared';
import { normalizeText } from '../../shared/domain/text-normalization';
import { CURATED_COUNTRY_ALIASES, KNOWN_NON_COUNTRIES } from './curated-country-data';

export type ResolutionMethod =
  | 'common_name'
  | 'official_name'
  | 'alt_spelling'
  | 'curated_alias'
  | 'known_non_country';

export interface NationalityResolutionResult {
  readonly rawValue: string;
  readonly resolution: NationalityResolution;
  readonly method: ResolutionMethod | null;
  readonly countryCode: string | null;
}

/**
 * Índices de búsqueda separados por procedencia. Mantenerlos distintos —en vez de
 * fundirlos en un único mapa— es lo que permite registrar *qué* paso resolvió cada
 * valor, y por tanto auditar la calidad del cruce.
 */
export interface CountryLookupIndex {
  readonly byCommonName: ReadonlyMap<string, string>;
  readonly byOfficialName: ReadonlyMap<string, string>;
  readonly byAltSpelling: ReadonlyMap<string, string>;
}

export interface CountryIndexSource {
  readonly code: string;
  readonly name: string;
  readonly nameOfficial: string;
  readonly altSpellings: readonly string[];
}

export function buildCountryLookupIndex(countries: readonly CountryIndexSource[]): CountryLookupIndex {
  const byCommonName = new Map<string, string>();
  const byOfficialName = new Map<string, string>();
  const byAltSpelling = new Map<string, string>();

  for (const country of countries) {
    byCommonName.set(normalizeText(country.name), country.code);
    byOfficialName.set(normalizeText(country.nameOfficial), country.code);

    for (const spelling of country.altSpellings) {
      const key = normalizeText(spelling);
      // Los altSpellings se solapan entre países (p. ej. códigos de dos letras
      // reutilizados). El primero gana y no se sobrescribe, para que el índice sea
      // determinista independientemente del orden de llegada de los datos.
      if (key.length > 0 && !byAltSpelling.has(key)) {
        byAltSpelling.set(key, country.code);
      }
    }
  }

  return { byCommonName, byOfficialName, byAltSpelling };
}

/**
 * Resuelve un valor de `payloads[].nationalities` a un país, recorriendo la cadena
 * de seis pasos documentada en docs/03-arquitectura.md §2.3.
 *
 * Nunca hay coincidencia difusa ni por proximidad: un valor que no encaja de forma
 * exacta en alguno de los índices se declara `unresolved` y se muestra como tal.
 * Un país inventado es peor que un hueco reconocido.
 */
export function resolveNationality(
  rawValue: string,
  index: CountryLookupIndex,
): NationalityResolutionResult {
  const normalized = normalizeText(rawValue);

  if (normalized.length === 0) {
    return { rawValue, resolution: 'unresolved', method: null, countryCode: null };
  }

  const directMatches: readonly [ReadonlyMap<string, string>, ResolutionMethod][] = [
    [index.byCommonName, 'common_name'],
    [index.byOfficialName, 'official_name'],
    [index.byAltSpelling, 'alt_spelling'],
  ];

  for (const [lookup, method] of directMatches) {
    const code = lookup.get(normalized);
    if (code !== undefined) {
      return { rawValue, resolution: 'resolved', method, countryCode: code };
    }
  }

  const curated = CURATED_COUNTRY_ALIASES[normalized];
  if (curated !== undefined) {
    return { rawValue, resolution: 'resolved', method: 'curated_alias', countryCode: curated };
  }

  if (KNOWN_NON_COUNTRIES.has(normalized)) {
    return {
      rawValue,
      resolution: 'not_a_country',
      method: 'known_non_country',
      countryCode: null,
    };
  }

  return { rawValue, resolution: 'unresolved', method: null, countryCode: null };
}
