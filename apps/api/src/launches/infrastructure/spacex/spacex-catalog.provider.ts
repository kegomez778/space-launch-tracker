import { Injectable, Logger } from '@nestjs/common';
import type { CatalogSnapshot, LaunchCatalogProvider } from '../../domain/catalog-snapshot';
import { validateEach } from '../../../shared/infrastructure/record-validation';
import type { ResilientHttpClient } from '../../../shared/infrastructure/resilient-http.client';
import { toCatalogLaunch, toCatalogLaunchpad, toCatalogPayload, toCatalogRocket } from './spacex.mapper';
import {
  spaceXLaunchSchema,
  spaceXLaunchpadSchema,
  spaceXPayloadSchema,
  spaceXRocketSchema,
} from './spacex.schemas';

/**
 * Adaptador de la SpaceX API v4 (la v3 está deprecada).
 *
 * Se piden los cuatro recursos por separado y se cruzan aquí, en lugar de usar el
 * endpoint `/query` con populate: el resultado es el mismo, pero cada recurso falla
 * y se valida de forma independiente, así que un problema en `payloads` no impide
 * actualizar los lanzamientos.
 */
@Injectable()
export class SpaceXCatalogProvider implements LaunchCatalogProvider {
  readonly providerName = 'SpaceX API v4';
  private readonly logger = new Logger(SpaceXCatalogProvider.name);

  constructor(private readonly http: ResilientHttpClient) {}

  async fetchCatalog(): Promise<CatalogSnapshot> {
    const [launchesRaw, rocketsRaw, launchpadsRaw, payloadsRaw] = await Promise.all([
      this.http.getJsonCollection('/launches'),
      this.http.getJsonCollection('/rockets'),
      this.http.getJsonCollection('/launchpads'),
      this.http.getJsonCollection('/payloads'),
    ]);

    const launches = validateEach(spaceXLaunchSchema, launchesRaw);
    const rockets = validateEach(spaceXRocketSchema, rocketsRaw);
    const launchpads = validateEach(spaceXLaunchpadSchema, launchpadsRaw);
    const payloads = validateEach(spaceXPayloadSchema, payloadsRaw);

    const rejectedRecords =
      launches.rejected.length + rockets.rejected.length + launchpads.rejected.length + payloads.rejected.length;

    for (const rejected of [...launches.rejected, ...rockets.rejected, ...launchpads.rejected, ...payloads.rejected]) {
      this.logger.warn(`Registro descartado (${rejected.identifier ?? `índice ${rejected.index}`}): ${rejected.reason}`);
    }

    return {
      launches: launches.valid.map(toCatalogLaunch),
      rockets: rockets.valid.map(toCatalogRocket),
      launchpads: launchpads.valid.map(toCatalogLaunchpad),
      payloads: payloads.valid.map(toCatalogPayload).filter((payload) => payload !== null),
      rejectedRecords,
    };
  }
}
