import { Injectable } from '@nestjs/common';
import {
  DEFAULT_PAGE_SIZE,
  type LaunchDetailDto,
  type LaunchSummaryDto,
  type PaginatedDto,
} from '@slt/shared';
import { normalizeText } from '../../shared/domain/text-normalization';
import { LaunchNotFoundError } from '../../shared/domain/domain-errors';
import { PrismaService } from '../../shared/infrastructure/prisma.service';
import { DataFreshnessService } from '../../shared/application/data-freshness.service';
import type { LaunchQuery } from '../presentation/launch-query.schema';
import { toLaunchDetail, toLaunchSummary, type LaunchDetailRow, type LaunchRow } from './launch-dto.mapper';

const COUNTRY_SELECT = { code: true, name: true, flagSvg: true, flagAlt: true } as const;

const SUMMARY_SELECT = {
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
export class LaunchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly freshness: DataFreshnessService,
  ) {}

  async findPaginated(query: LaunchQuery): Promise<PaginatedDto<LaunchSummaryDto>> {
    const now = new Date();
    const where = this.buildWhere(query, now);
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;

    // La cuenta y la página se piden juntas: son dos consultas, pero evitan traer
    // el conjunto entero a memoria sólo para saber cuántos hay.
    const [totalItems, rows, freshness] = await Promise.all([
      this.prisma.launch.count({ where }),
      this.prisma.launch.findMany({
        where,
        select: SUMMARY_SELECT,
        orderBy: { dateUtc: query.sort === 'date_asc' ? 'asc' : 'desc' },
        skip: (query.page - 1) * pageSize,
        take: pageSize,
      }),
      this.freshness.forResource('launches'),
    ]);

    return {
      data: rows.map((row) => toLaunchSummary(row as LaunchRow, now)),
      pagination: {
        page: query.page,
        pageSize,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
      },
      freshness,
    };
  }

  async findById(id: string): Promise<LaunchDetailDto> {
    const row = await this.prisma.launch.findUnique({
      where: { id },
      select: {
        ...SUMMARY_SELECT,
        details: true,
        failureReason: true,
        patchLarge: true,
        webcast: true,
        wikipedia: true,
        article: true,
        launchpad: {
          select: {
            id: true,
            name: true,
            fullName: true,
            locality: true,
            region: true,
            countryCode: true,
            country: { select: COUNTRY_SELECT },
          },
        },
        payloads: {
          select: {
            id: true,
            name: true,
            type: true,
            massKg: true,
            orbit: true,
            customers: true,
            nationalities: {
              select: { rawValue: true, resolution: true, country: { select: COUNTRY_SELECT } },
            },
          },
        },
      },
    });

    if (row === null) {
      throw new LaunchNotFoundError(id);
    }

    return toLaunchDetail(row as unknown as LaunchDetailRow, new Date());
  }

  /**
   * El filtro temporal se aplica sobre la fecha y no sobre el flag `upcoming` de
   * la fuente, por la misma razón que el estado se deriva en el dominio: el flag
   * está desactualizado y llenaría de pasado la vista de próximos lanzamientos.
   */
  private buildWhere(query: LaunchQuery, now: Date) {
    const filters: Record<string, unknown>[] = [];

    if (query.search !== undefined) {
      filters.push({ nameNormalized: { contains: normalizeText(query.search) } });
    }

    if (query.timing === 'upcoming') {
      filters.push({ dateUtc: { gt: now } });
    } else if (query.timing === 'launched') {
      filters.push({ dateUtc: { lte: now } });
    }

    if (query.outcome === 'success') {
      filters.push({ success: true });
    } else if (query.outcome === 'failure') {
      filters.push({ success: false });
    } else if (query.outcome === 'pending') {
      filters.push({ success: null });
    }

    if (query.country !== undefined) {
      filters.push({ countries: { some: { countryCode: query.country.toUpperCase() } } });
    }

    if (query.rocket !== undefined) {
      filters.push({ rocketId: query.rocket });
    }

    if (query.year !== undefined) {
      filters.push({
        dateUtc: {
          gte: new Date(Date.UTC(query.year, 0, 1)),
          lt: new Date(Date.UTC(query.year + 1, 0, 1)),
        },
      });
    }

    return filters.length > 0 ? { AND: filters } : {};
  }
}
