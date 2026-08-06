import { Injectable } from '@nestjs/common';
import type { DataFreshnessDto } from '@slt/shared';
import { PrismaService } from '../infrastructure/prisma.service';

/** Pasado este margen, los datos se marcan como envejecidos en la interfaz. */
const STALE_AFTER_SECONDS = 60 * 60 * 6;

/**
 * Calcula la antigüedad de los datos replicados.
 *
 * Acompaña a toda respuesta de catálogo porque la aplicación sirve una copia, no
 * la fuente: decir "datos de hace 3 h" es la diferencia entre una degradación
 * honesta y aparentar una actualidad que no se tiene.
 */
@Injectable()
export class DataFreshnessService {
  constructor(private readonly prisma: PrismaService) {}

  async forResource(resource: string): Promise<DataFreshnessDto> {
    const [lastSuccess, lastRun] = await Promise.all([
      this.prisma.syncRun.findFirst({
        where: { resource, status: 'success' },
        orderBy: { startedAt: 'desc' },
      }),
      this.prisma.syncRun.findFirst({
        where: { resource, status: { in: ['success', 'failed'] } },
        orderBy: { startedAt: 'desc' },
      }),
    ]);

    const lastSyncedAt = lastSuccess?.finishedAt ?? null;
    const ageSeconds =
      lastSyncedAt === null ? null : Math.max(0, Math.round((Date.now() - lastSyncedAt.getTime()) / 1000));

    return {
      lastSyncedAt: lastSyncedAt?.toISOString() ?? null,
      ageSeconds,
      isStale: ageSeconds === null || ageSeconds > STALE_AFTER_SECONDS,
      lastSyncFailed: lastRun?.status === 'failed',
    };
  }
}
