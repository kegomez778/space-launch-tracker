import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { CatalogSyncService } from '../application/catalog-sync.service';

/**
 * Dispara la sincronización programada.
 *
 * Los fallos se registran y se tragan a propósito: una sincronización fallida no
 * debe tumbar el proceso ni impedir el siguiente intento. Su rastro queda en la
 * bitácora y sale por `/api/data-quality`, que es donde se mira.
 */
@Injectable()
export class SyncScheduler {
  private readonly logger = new Logger(SyncScheduler.name);
  private isRunning = false;

  constructor(
    private readonly sync: CatalogSyncService,
    private readonly config: ConfigService,
  ) {}

  @Cron('*/15 * * * *', { name: 'catalog-sync' })
  async syncCatalog(): Promise<void> {
    if (this.config.get<string>('SYNC_ENABLED') !== 'true') {
      return;
    }

    // Una sincronización lenta no debe solaparse con la siguiente ventana: sería
    // duplicar carga contra el proveedor justo cuando ya va justo.
    if (this.isRunning) {
      this.logger.warn('Se omite este ciclo: la sincronización anterior sigue en curso');
      return;
    }

    this.isRunning = true;
    try {
      await this.sync.syncAll();
    } catch (error) {
      this.logger.error(`Ciclo de sincronización fallido: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.isRunning = false;
    }
  }
}
