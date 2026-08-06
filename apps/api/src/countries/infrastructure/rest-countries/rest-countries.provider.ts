import { Injectable, Logger } from '@nestjs/common';
import type { CountryCatalogProvider, CountryCatalogSnapshot } from '../../domain/country-catalog';
import { validateEach } from '../../../shared/infrastructure/record-validation';
import type { ResilientHttpClient } from '../../../shared/infrastructure/resilient-http.client';
import { toCatalogCountry } from './rest-countries.mapper';
import { REST_COUNTRIES_FIELDS, restCountrySchema } from './rest-countries.schemas';

/** Adaptador de REST Countries v3.1 (la v2 fue descontinuada). */
@Injectable()
export class RestCountriesProvider implements CountryCatalogProvider {
  readonly providerName = 'REST Countries v3.1';
  private readonly logger = new Logger(RestCountriesProvider.name);

  constructor(private readonly http: ResilientHttpClient) {}

  async fetchCountries(): Promise<CountryCatalogSnapshot> {
    // `?fields=` no es una optimización: v3.1 rechaza /all sin él.
    const raw = await this.http.getJson<unknown[]>(`/all?fields=${REST_COUNTRIES_FIELDS}`);
    const outcome = validateEach(restCountrySchema, raw);

    for (const rejected of outcome.rejected) {
      this.logger.warn(`País descartado (índice ${rejected.index}): ${rejected.reason}`);
    }

    return {
      countries: outcome.valid.map(toCatalogCountry),
      rejectedRecords: outcome.rejected.length,
    };
  }
}
