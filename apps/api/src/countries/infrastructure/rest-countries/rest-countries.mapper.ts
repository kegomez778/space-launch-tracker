import type { CatalogCountry } from '../../domain/country-catalog';
import type { RestCountryDto } from './rest-countries.schemas';

export function toCatalogCountry(dto: RestCountryDto): CatalogCountry {
  const [latitude, longitude] = dto.latlng ?? [];

  return {
    code: dto.cca2.toUpperCase(),
    code3: dto.cca3.toUpperCase(),
    name: dto.name.common,
    nameOfficial: dto.name.official,
    // Se filtran los códigos de dos letras: como alias son ambiguos entre países
    // y sólo añadirían ruido y falsos positivos al índice de resolución.
    altSpellings: (dto.altSpellings ?? []).filter((value) => value.trim().length > 2),
    region: emptyToNull(dto.region),
    subregion: emptyToNull(dto.subregion),
    capital: emptyToNull(dto.capital?.[0]),
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    flagSvg: emptyToNull(dto.flags?.svg),
    flagPng: emptyToNull(dto.flags?.png),
    flagAlt: emptyToNull(dto.flags?.alt),
  };
}

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed !== undefined && trimmed.length > 0 ? trimmed : null;
}
