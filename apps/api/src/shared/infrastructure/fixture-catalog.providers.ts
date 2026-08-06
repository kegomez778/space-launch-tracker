import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import type { CatalogSnapshot, LaunchCatalogProvider } from '../../launches/domain/catalog-snapshot';
import type { CountryCatalogProvider, CountryCatalogSnapshot } from '../../countries/domain/country-catalog';
import {
  toCatalogLaunch,
  toCatalogLaunchpad,
  toCatalogPayload,
  toCatalogRocket,
} from '../../launches/infrastructure/spacex/spacex.mapper';
import {
  spaceXLaunchSchema,
  spaceXLaunchpadSchema,
  spaceXPayloadSchema,
  spaceXRocketSchema,
} from '../../launches/infrastructure/spacex/spacex.schemas';
import { toCatalogCountry } from '../../countries/infrastructure/rest-countries/rest-countries.mapper';
import { restCountrySchema } from '../../countries/infrastructure/rest-countries/rest-countries.schemas';
import { validateEach } from './record-validation';

const FIXTURES_DIR = join(__dirname, '..', '..', '..', 'fixtures');

async function readFixture(name: string): Promise<unknown[]> {
  const contents = await readFile(join(FIXTURES_DIR, name), 'utf8');
  const parsed: unknown = JSON.parse(contents);
  if (!Array.isArray(parsed)) {
    throw new TypeError(`El fixture ${name} debe contener un array en la raíz`);
  }
  return parsed;
}

/**
 * Proveedores que leen los ficheros de `fixtures/` en lugar de la red.
 *
 * Implementan los mismos puertos que los adaptadores HTTP, así que la
 * sincronización, la validación y el mapeo recorren exactamente el mismo camino.
 * Eso es lo que permite sembrar la base sin conexión sin mantener una segunda ruta
 * de código que podría divergir de la real.
 */
@Injectable()
export class FixtureLaunchCatalogProvider implements LaunchCatalogProvider {
  readonly providerName = 'Fixtures locales (SpaceX v4)';
  private readonly logger = new Logger(FixtureLaunchCatalogProvider.name);

  async fetchCatalog(): Promise<CatalogSnapshot> {
    const [launchesRaw, rocketsRaw, launchpadsRaw, payloadsRaw] = await Promise.all([
      readFixture('launches.json'),
      readFixture('rockets.json'),
      readFixture('launchpads.json'),
      readFixture('payloads.json'),
    ]);

    const launches = validateEach(spaceXLaunchSchema, launchesRaw);
    const rockets = validateEach(spaceXRocketSchema, rocketsRaw);
    const launchpads = validateEach(spaceXLaunchpadSchema, launchpadsRaw);
    const payloads = validateEach(spaceXPayloadSchema, payloadsRaw);

    for (const rejected of [...launches.rejected, ...payloads.rejected]) {
      this.logger.warn(`Registro descartado (${rejected.identifier ?? `índice ${rejected.index}`}): ${rejected.reason}`);
    }

    return {
      launches: launches.valid.map(toCatalogLaunch),
      rockets: rockets.valid.map(toCatalogRocket),
      launchpads: launchpads.valid.map(toCatalogLaunchpad),
      payloads: payloads.valid.map(toCatalogPayload).filter((payload) => payload !== null),
      rejectedRecords:
        launches.rejected.length + rockets.rejected.length + launchpads.rejected.length + payloads.rejected.length,
    };
  }
}

@Injectable()
export class FixtureCountryCatalogProvider implements CountryCatalogProvider {
  readonly providerName = 'Fixtures locales (REST Countries v3.1)';

  async fetchCountries(): Promise<CountryCatalogSnapshot> {
    const outcome = validateEach(restCountrySchema, await readFixture('countries.json'));

    return {
      countries: outcome.valid.map(toCatalogCountry),
      rejectedRecords: outcome.rejected.length,
    };
  }
}
