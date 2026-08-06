export interface CatalogCountry {
  readonly code: string;
  readonly code3: string;
  readonly name: string;
  readonly nameOfficial: string;
  readonly altSpellings: readonly string[];
  readonly region: string | null;
  readonly subregion: string | null;
  readonly capital: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly flagSvg: string | null;
  readonly flagPng: string | null;
  readonly flagAlt: string | null;
}

export interface CountryCatalogSnapshot {
  readonly countries: readonly CatalogCountry[];
  readonly rejectedRecords: number;
}

/** Puerto de salida del catálogo de países. */
export interface CountryCatalogProvider {
  readonly providerName: string;
  fetchCountries(): Promise<CountryCatalogSnapshot>;
}

export const COUNTRY_CATALOG_PROVIDER = Symbol('CountryCatalogProvider');
