/**
 * Datos curados que la SpaceX API no proporciona y REST Countries no cubre por sí
 * sola. Van versionados en el repositorio, no en la base de datos, porque son
 * decisiones de producto revisables en un diff y cubiertas por tests.
 */

/**
 * Puente A: `launchpad.id` -> ISO 3166-1 alpha-2.
 *
 * La SpaceX API v4 no expone país en ninguna parte: `launchpads` sólo tiene
 * `region` en texto libre ("Florida", "Marshall Islands"). El conjunto de pads es
 * cerrado y estable, así que un mapeo curado es más fiable que inferirlo.
 */
export const LAUNCHPAD_COUNTRY_BY_ID: Readonly<Record<string, string>> = {
  '5e9e4501f5090910d4566f83': 'US', // Kwajalein Atoll (Islas Marshall, territorio US para este dato)
  '5e9e4501f509094ba4566f84': 'US', // CCSFS SLC 40, Florida
  '5e9e4501f5090995de566f86': 'US', // VAFB SLC 4E, California
  '5e9e4502f5090927f8566f85': 'US', // STLS, Texas
  '5e9e4502f5090995de566f86': 'US', // Kennedy LC 39A, Florida
  '5e9e4502f509094188566f88': 'US', // CCSFS SLC 40 (identificador alternativo)
};

/**
 * Puente A por región, para pads que la fuente añada más adelante y que no estén
 * en el mapeo por id. Se consulta sobre `region` normalizada.
 */
export const LAUNCHPAD_COUNTRY_BY_REGION: Readonly<Record<string, string>> = {
  florida: 'US',
  california: 'US',
  texas: 'US',
  'marshall islands': 'MH',
  'new mexico': 'US',
};

/**
 * Puente B, paso 4: sinónimos que ni el nombre común, ni el oficial, ni los
 * `altSpellings` de REST Countries resuelven.
 *
 * Cada entrada existe porque un valor concreto aparece así en los datos de SpaceX
 * o es una variante lo bastante extendida como para anticiparla.
 */
export const CURATED_COUNTRY_ALIASES: Readonly<Record<string, string>> = {
  'united states of america': 'US',
  usa: 'US',
  'u.s.a.': 'US',
  us: 'US',
  america: 'US',
  uk: 'GB',
  'u.k.': 'GB',
  'great britain': 'GB',
  britain: 'GB',
  england: 'GB',
  scotland: 'GB',
  wales: 'GB',
  'republic of korea': 'KR',
  'korea, republic of': 'KR',
  'south korea': 'KR',
  'north korea': 'KP',
  "democratic people's republic of korea": 'KP',
  'czech republic': 'CZ',
  czechia: 'CZ',
  turkey: 'TR',
  holland: 'NL',
  'the netherlands': 'NL',
  russia: 'RU',
  'russian federation': 'RU',
  'ivory coast': 'CI',
  'cape verde': 'CV',
  burma: 'MM',
  macedonia: 'MK',
  swaziland: 'SZ',
  'east timor': 'TL',
  vatican: 'VA',
  'vatican city': 'VA',
  uae: 'AE',
  emirates: 'AE',
  'hong kong': 'HK',
  taiwan: 'TW',
  'republic of china': 'TW',
  "people's republic of china": 'CN',
  china: 'CN',
  'republic of ireland': 'IE',
  'south africa': 'ZA',
  'new zealand': 'NZ',
  'saudi arabia': 'SA',
  'sri lanka': 'LK',
  'costa rica': 'CR',
  'dominican republic': 'DO',
  'puerto rico': 'PR',
  'isle of man': 'IM',
  luxemburg: 'LU',
  bielorussia: 'BY',
  belarus: 'BY',
  moldavia: 'MD',
  persia: 'IR',
  iran: 'IR',
  syria: 'SY',
  laos: 'LA',
  brunei: 'BN',
  bolivia: 'BO',
  venezuela: 'VE',
  tanzania: 'TZ',
  'congo-brazzaville': 'CG',
  'congo-kinshasa': 'CD',
  drc: 'CD',
};

/**
 * Puente B, paso 5: valores que aparecen en `nationalities` pero **no son países**.
 *
 * Reconocerlos explícitamente es lo que evita el error más grave del puente B:
 * forzar una organización supranacional dentro de un país concreto. Un satélite
 * de la ESA no es alemán ni francés, y la interfaz debe poder decirlo.
 */
export const KNOWN_NON_COUNTRIES: ReadonlySet<string> = new Set([
  'european union',
  'europe',
  'european space agency',
  'esa',
  'eutelsat',
  'intelsat',
  'inmarsat',
  'ses',
  'nato',
  'united nations',
  'multinational',
  'international',
  'various',
  'unknown',
  'n/a',
]);
