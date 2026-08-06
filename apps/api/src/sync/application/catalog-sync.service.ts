import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  LAUNCH_CATALOG_PROVIDER,
  type CatalogSnapshot,
  type LaunchCatalogProvider,
} from '../../launches/domain/catalog-snapshot';
import {
  COUNTRY_CATALOG_PROVIDER,
  type CountryCatalogProvider,
  type CountryCatalogSnapshot,
} from '../../countries/domain/country-catalog';
import {
  LAUNCHPAD_COUNTRY_BY_ID,
  LAUNCHPAD_COUNTRY_BY_REGION,
} from '../../countries/domain/curated-country-data';
import {
  buildCountryLookupIndex,
  resolveNationality,
  type CountryLookupIndex,
} from '../../countries/domain/nationality-resolver';
import { normalizeText } from '../../shared/domain/text-normalization';
import { PrismaService } from '../../shared/infrastructure/prisma.service';

export interface SyncOutcome {
  readonly resource: string;
  readonly processed: number;
  readonly rejected: number;
}

/**
 * Trae, normaliza y persiste el catálogo completo.
 *
 * Todas las escrituras son upserts por identificador de proveedor, de modo que la
 * sincronización puede repetirse sin duplicar y un fallo a mitad de camino es
 * seguro de reintentar.
 */
@Injectable()
export class CatalogSyncService {
  private readonly logger = new Logger(CatalogSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(LAUNCH_CATALOG_PROVIDER) private readonly launchProvider: LaunchCatalogProvider,
    @Inject(COUNTRY_CATALOG_PROVIDER) private readonly countryProvider: CountryCatalogProvider,
  ) {}

  async syncAll(): Promise<readonly SyncOutcome[]> {
    const countries = await this.runTracked('countries', () => this.syncCountries());
    const launches = await this.runTracked('launches', () => this.syncLaunches());
    return [countries, launches];
  }

  /**
   * Envuelve cada sincronización en su propio registro de bitácora. Si falla, el
   * error queda persistido y los datos anteriores siguen sirviéndose: la aplicación
   * se degrada de forma visible en lugar de romperse.
   */
  private async runTracked(resource: string, operation: () => Promise<SyncOutcome>): Promise<SyncOutcome> {
    const run = await this.prisma.syncRun.create({ data: { resource, status: 'running' } });

    try {
      const outcome = await operation();
      await this.prisma.syncRun.update({
        where: { id: run.id },
        data: {
          status: 'success',
          finishedAt: new Date(),
          recordsProcessed: outcome.processed,
          recordsRejected: outcome.rejected,
        },
      });
      this.logger.log(`Sincronización de ${resource}: ${outcome.processed} registros, ${outcome.rejected} descartados`);
      return outcome;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.prisma.syncRun.update({
        where: { id: run.id },
        data: { status: 'failed', finishedAt: new Date(), error: message },
      });
      this.logger.error(`Sincronización de ${resource} fallida: ${message}`);
      throw error;
    }
  }

  private async syncCountries(): Promise<SyncOutcome> {
    const snapshot: CountryCatalogSnapshot = await this.countryProvider.fetchCountries();

    for (const country of snapshot.countries) {
      const data = {
        code3: country.code3,
        name: country.name,
        nameOfficial: country.nameOfficial,
        nameNormalized: normalizeText(country.name),
        flagSvg: country.flagSvg,
        flagPng: country.flagPng,
        flagAlt: country.flagAlt,
        region: country.region,
        subregion: country.subregion,
        capital: country.capital,
        latitude: country.latitude,
        longitude: country.longitude,
      };

      await this.prisma.country.upsert({
        where: { code: country.code },
        create: { code: country.code, ...data },
        update: data,
      });

      for (const spelling of country.altSpellings) {
        const aliasNormalized = normalizeText(spelling);
        if (aliasNormalized.length === 0) {
          continue;
        }
        await this.prisma.countryAlias.upsert({
          where: { aliasNormalized },
          create: { aliasNormalized, countryCode: country.code, source: 'rest_countries' },
          update: {},
        });
      }
    }

    return { resource: 'countries', processed: snapshot.countries.length, rejected: snapshot.rejectedRecords };
  }

  private async syncLaunches(): Promise<SyncOutcome> {
    const snapshot: CatalogSnapshot = await this.launchProvider.fetchCatalog();
    const index = await this.buildLookupIndex();

    for (const rocket of snapshot.rockets) {
      await this.prisma.rocket.upsert({ where: { id: rocket.id }, create: rocket, update: rocket });
    }

    for (const launchpad of snapshot.launchpads) {
      const data = { ...launchpad, countryCode: resolveLaunchpadCountry(launchpad.id, launchpad.region) };
      await this.prisma.launchpad.upsert({ where: { id: launchpad.id }, create: data, update: data });
    }

    const knownRockets = new Set(snapshot.rockets.map((rocket) => rocket.id));
    const knownLaunchpads = new Set(snapshot.launchpads.map((pad) => pad.id));

    for (const launch of snapshot.launches) {
      const data = {
        flightNumber: launch.flightNumber,
        name: launch.name,
        nameNormalized: normalizeText(launch.name),
        dateUtc: launch.dateUtc,
        datePrecision: launch.datePrecision,
        isProvisional: launch.isProvisional,
        success: launch.success,
        failureReason: launch.failureReason,
        details: launch.details,
        patchSmall: launch.patchSmall,
        patchLarge: launch.patchLarge,
        webcast: launch.webcast,
        wikipedia: launch.wikipedia,
        article: launch.article,
        sourceUpcoming: launch.sourceUpcoming,
        // Una referencia a un cohete o sitio que la fuente no entregó se guarda como
        // ausente en vez de romper la escritura por clave foránea.
        rocketId: launch.rocketId !== null && knownRockets.has(launch.rocketId) ? launch.rocketId : null,
        launchpadId:
          launch.launchpadId !== null && knownLaunchpads.has(launch.launchpadId) ? launch.launchpadId : null,
      };

      await this.prisma.launch.upsert({ where: { id: launch.id }, create: { id: launch.id, ...data }, update: data });
    }

    const knownLaunches = new Set(snapshot.launches.map((launch) => launch.id));
    const orphanPayloads = snapshot.payloads.filter((payload) => !knownLaunches.has(payload.launchId));

    for (const payload of snapshot.payloads) {
      if (!knownLaunches.has(payload.launchId)) {
        continue;
      }

      const data = {
        launchId: payload.launchId,
        name: payload.name,
        type: payload.type,
        massKg: payload.massKg,
        orbit: payload.orbit,
        customers: JSON.stringify(payload.customers),
        manufacturers: JSON.stringify(payload.manufacturers),
      };

      await this.prisma.payload.upsert({ where: { id: payload.id }, create: { id: payload.id, ...data }, update: data });

      // Las nacionalidades se recomponen enteras: es la única forma de que un
      // cambio en la tabla de alias se refleje sin arrastrar resoluciones viejas.
      await this.prisma.payloadNationality.deleteMany({ where: { payloadId: payload.id } });
      for (const rawValue of payload.nationalities) {
        const resolved = resolveNationality(rawValue, index);
        await this.prisma.payloadNationality.create({
          data: {
            payloadId: payload.id,
            rawValue: resolved.rawValue,
            resolution: resolved.resolution,
            method: resolved.method,
            countryCode: resolved.countryCode,
          },
        });
      }
    }

    await this.rebuildLaunchCountryProjection();

    return {
      resource: 'launches',
      processed: snapshot.launches.length,
      rejected: snapshot.rejectedRecords + orphanPayloads.length,
    };
  }

  private async buildLookupIndex(): Promise<CountryLookupIndex> {
    const countries = await this.prisma.country.findMany({
      select: { code: true, name: true, nameOfficial: true, aliases: { select: { aliasNormalized: true } } },
    });

    return buildCountryLookupIndex(
      countries.map((country) => ({
        code: country.code,
        name: country.name,
        nameOfficial: country.nameOfficial,
        altSpellings: country.aliases.map((alias) => alias.aliasNormalized),
      })),
    );
  }

  /**
   * Recompone la proyección país<->lanzamiento (docs/03-arquitectura.md §3.1).
   *
   * Se calcula aquí, en la escritura, para que la consulta por país sea un único
   * join sobre índice en vez de recorrer payloads y nacionalidades en cada lectura.
   */
  private async rebuildLaunchCountryProjection(): Promise<void> {
    await this.prisma.launchCountry.deleteMany();

    const bySite = await this.prisma.launch.findMany({
      where: { launchpad: { countryCode: { not: null } } },
      select: { id: true, launchpad: { select: { countryCode: true } } },
    });

    const byPayload = await this.prisma.payloadNationality.findMany({
      where: { countryCode: { not: null } },
      select: { countryCode: true, payload: { select: { launchId: true } } },
    });

    const links = new Map<string, { launchId: string; countryCode: string; relation: string }>();

    for (const launch of bySite) {
      const countryCode = launch.launchpad?.countryCode;
      if (countryCode) {
        links.set(`${launch.id}|${countryCode}|site`, { launchId: launch.id, countryCode, relation: 'site' });
      }
    }

    for (const nationality of byPayload) {
      const { countryCode } = nationality;
      const launchId = nationality.payload.launchId;
      if (countryCode) {
        links.set(`${launchId}|${countryCode}|payload`, { launchId, countryCode, relation: 'payload' });
      }
    }

    if (links.size > 0) {
      await this.prisma.launchCountry.createMany({ data: [...links.values()] });
    }
  }
}

/**
 * Puente A: la SpaceX API no expone país, así que se resuelve por mapeo curado de
 * identificador y, como respaldo para pads futuros, por región normalizada.
 */
export function resolveLaunchpadCountry(launchpadId: string, region: string | null): string | null {
  const byId = LAUNCHPAD_COUNTRY_BY_ID[launchpadId];
  if (byId !== undefined) {
    return byId;
  }

  if (region !== null) {
    return LAUNCHPAD_COUNTRY_BY_REGION[normalizeText(region)] ?? null;
  }

  return null;
}
