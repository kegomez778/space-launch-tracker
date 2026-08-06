import { describe, expect, it } from 'vitest';
import { buildCountryLookupIndex, resolveNationality } from './nationality-resolver';

const index = buildCountryLookupIndex([
  { code: 'US', name: 'United States', nameOfficial: 'United States of America', altSpellings: ['US', 'USA'] },
  { code: 'DE', name: 'Germany', nameOfficial: 'Federal Republic of Germany', altSpellings: ['DE', 'Deutschland'] },
  { code: 'KR', name: 'South Korea', nameOfficial: 'Republic of Korea', altSpellings: ['KR', 'Korea, Republic of'] },
  { code: 'TR', name: 'Türkiye', nameOfficial: 'Republic of Türkiye', altSpellings: ['TR', 'Turkey'] },
  { code: 'CI', name: "Côte d'Ivoire", nameOfficial: "Republic of Côte d'Ivoire", altSpellings: ['CI'] },
]);

const resolve = (value: string) => resolveNationality(value, index);

describe('resolveNationality', () => {
  it('resuelve por nombre común y registra el paso usado', () => {
    expect(resolve('Germany')).toMatchObject({
      resolution: 'resolved',
      countryCode: 'DE',
      method: 'common_name',
    });
  });

  it('resuelve por nombre oficial cuando el común no coincide', () => {
    expect(resolve('Republic of Korea')).toMatchObject({
      resolution: 'resolved',
      countryCode: 'KR',
      method: 'official_name',
    });
  });

  it('resuelve por altSpellings de REST Countries', () => {
    expect(resolve('Deutschland')).toMatchObject({
      resolution: 'resolved',
      countryCode: 'DE',
      method: 'alt_spelling',
    });
  });

  it('resuelve por la tabla curada lo que ningún índice de la fuente cubre', () => {
    expect(resolve('UK')).toMatchObject({
      resolution: 'resolved',
      countryCode: 'GB',
      method: 'curated_alias',
    });
  });

  it('ignora mayúsculas, acentos y espacios sobrantes', () => {
    expect(resolve('  côte d IVOIRE ').countryCode).toBe(null);
    expect(resolve("  CÔTE D'IVOIRE ")).toMatchObject({ countryCode: 'CI', method: 'common_name' });
    expect(resolve('turkiye')).toMatchObject({ countryCode: 'TR', method: 'common_name' });
  });

  // El error más grave del puente B sería repartir un satélite de la ESA entre
  // países concretos. Se reconoce como entidad supranacional, no se fuerza.
  it('clasifica las entidades supranacionales como no-país en vez de forzarlas', () => {
    expect(resolve('European Union')).toMatchObject({
      resolution: 'not_a_country',
      countryCode: null,
      method: 'known_non_country',
    });
  });

  it('declara sin resolver lo que no encaja, sin adivinar por proximidad', () => {
    const result = resolve('Republic of Freedonia');

    expect(result.resolution).toBe('unresolved');
    expect(result.countryCode).toBe(null);
    expect(result.method).toBe(null);
  });

  it('conserva intacto el valor original para poder mostrarlo tal cual', () => {
    expect(resolve('  República de Freedonia  ').rawValue).toBe('  República de Freedonia  ');
  });

  it('trata el valor vacío como no resuelto y no como coincidencia', () => {
    expect(resolve('   ').resolution).toBe('unresolved');
  });

  it('mantiene el índice determinista cuando dos países comparten altSpelling', () => {
    const ambiguous = buildCountryLookupIndex([
      { code: 'AA', name: 'Alpha', nameOfficial: 'Alpha Republic', altSpellings: ['XX'] },
      { code: 'BB', name: 'Beta', nameOfficial: 'Beta Republic', altSpellings: ['XX'] },
    ]);

    expect(resolveNationality('XX', ambiguous).countryCode).toBe('AA');
  });
});
