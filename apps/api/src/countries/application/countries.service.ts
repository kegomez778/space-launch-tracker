import { Injectable } from '@nestjs/common';
import type { CountryDetailDto, CountryListItemDto, DataQualityDto, LaunchSummaryDto } from '@slt/shared';
import { CountryNotFoundError } from '../../shared/domain/domain-errors';
import { PrismaService } from '../../shared/infrastructure/prisma.service';
import { toLaunchSummary, type LaunchRow } from '../../launches/application/launch-dto.mapper';

const COUNTRY_SELECT = { code: true, name: true, flagSvg: true, flagAlt: true } as const;

const LAUNCH_SUMMARY_SELECT = {
  id: true,
  flightNumber: true,
  name: true,
  dateUtc: true,
  datePrecision: true,
  isProvisional: true,
  success: true,
  sourceUpcoming: true,
  patchSmall: true,
  rocket: { select: { id: true, name: true, type: true } },
  launchpad: { select: { countryCode: true, country: { select: COUNTRY_SELECT } } },
} as const;

@Injectable()
export class CountriesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sólo se listan países con algún vínculo real con un lanzamiento. Un directorio
   * de 250 banderas de las que 240 no llevan a ningún sitio no es un directorio,
   * es ruido.
   */
  async list(): Promise<readonly CountryListItemDto[]> {
    const countries = await this.prisma.country.findMany({
      where: { launchLinks: { some: {} } },
      select: { ...COUNTRY_SELECT, region: true, _count: { select: { launchLinks: true } } },
      orderBy: { name: 'asc' },
    });

    return countries.map((country) => ({
      code: country.code,
      name: country.name,
      flagSvg: country.flagSvg,
      flagAlt: country.flagAlt,
      region: country.region,
      launchCount: country._count.launchLinks,
    }));
  }

  async findByCode(code: string): Promise<CountryDetailDto> {
    const normalized = code.toUpperCase();
    const country = await this.prisma.country.findUnique({
      where: { code: normalized },
      select: {
        ...COUNTRY_SELECT,
        nameOfficial: true,
        region: true,
        subregion: true,
        capital: true,
      },
    });

    if (country === null) {
      throw new CountryNotFoundError(normalized);
    }

    const [fromSoil, withPayload] = await Promise.all([
      this.prisma.launchCountry.count({ where: { countryCode: normalized, relation: 'site' } }),
      this.prisma.launchCountry.count({ where: { countryCode: normalized, relation: 'payload' } }),
    ]);

    return {
      code: country.code,
      name: country.name,
      officialName: country.nameOfficial,
      flagSvg: country.flagSvg,
      flagAlt: country.flagAlt,
      region: country.region,
      subregion: country.subregion,
      capital: country.capital,
      launchesFromSoil: fromSoil,
      launchesWithPayload: withPayload,
    };
  }

  /** Consulta la proyección materializada: un único join sobre índice. */
  async launchesForCountry(code: string, relation: 'site' | 'payload'): Promise<readonly LaunchSummaryDto[]> {
    const now = new Date();
    const rows = await this.prisma.launch.findMany({
      where: { countries: { some: { countryCode: code.toUpperCase(), relation } } },
      select: LAUNCH_SUMMARY_SELECT,
      orderBy: { dateUtc: 'desc' },
      take: 50,
    });

    return rows.map((row) => toLaunchSummary(row as LaunchRow, now));
  }

  /**
   * Informe de calidad de datos. Existe porque el compromiso del alcance era que
   * lo no resuelto fuese visible en la interfaz, no que quedara en un log.
   */
  async dataQuality(): Promise<DataQualityDto> {
    const [total, resolved, notACountry, unresolved, unresolvedGroups, launches, contradictory, syncs] =
      await Promise.all([
        this.prisma.payloadNationality.count(),
        this.prisma.payloadNationality.count({ where: { resolution: 'resolved' } }),
        this.prisma.payloadNationality.count({ where: { resolution: 'not_a_country' } }),
        this.prisma.payloadNationality.count({ where: { resolution: 'unresolved' } }),
        this.prisma.payloadNationality.groupBy({
          by: ['rawValue'],
          where: { resolution: 'unresolved' },
          _count: { rawValue: true },
          orderBy: { _count: { rawValue: 'desc' } },
          take: 25,
        }),
        this.prisma.launch.count(),
        this.countContradictoryTimingFlags(),
        this.prisma.syncRun.findMany({ orderBy: { startedAt: 'desc' }, take: 10 }),
      ]);

    const classified = resolved + notACountry;

    return {
      nationalities: {
        total,
        resolved,
        notACountry,
        unresolved,
        coveragePercent: total === 0 ? 100 : Math.round((classified / total) * 1000) / 10,
        unresolvedValues: unresolvedGroups.map((group) => ({
          rawValue: group.rawValue,
          occurrences: group._count.rawValue,
        })),
      },
      launches: { total: launches, contradictoryTimingFlags: contradictory },
      syncs: syncs.map((run) => ({
        resource: run.resource,
        status: run.status === 'success' || run.status === 'failed' ? run.status : 'running',
        finishedAt: run.finishedAt?.toISOString() ?? null,
        recordsProcessed: run.recordsProcessed,
        recordsRejected: run.recordsRejected,
        error: run.error,
      })),
    };
  }

  /** Lanzamientos cuyo flag de la fuente contradice su propia fecha (riesgo R3). */
  private async countContradictoryTimingFlags(): Promise<number> {
    const now = new Date();
    const [flaggedUpcomingButPast, flaggedPastButUpcoming] = await Promise.all([
      this.prisma.launch.count({ where: { sourceUpcoming: true, dateUtc: { lt: now } } }),
      this.prisma.launch.count({ where: { sourceUpcoming: false, dateUtc: { gte: now } } }),
    ]);

    return flaggedUpcomingButPast + flaggedPastButUpcoming;
  }
}
