import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { CatalogSyncService } from '../src/sync/application/catalog-sync.service';
import { PrismaService } from '../src/shared/infrastructure/prisma.service';

/**
 * Ejecuta una sincronización completa y termina, sin levantar el servidor ni
 * esperar a la ventana del planificador.
 *
 * Con `SYNC_ENABLED=true` va contra las APIs reales; con `false`, contra los
 * fixtures. Es el mismo servicio que usa la aplicación en marcha, así que lo que
 * se observa aquí es exactamente lo que ocurriría desatendido.
 */
async function syncOnce(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['warn', 'error'] });
  const isLive = process.env.SYNC_ENABLED === 'true';

  console.log(`\nFuente: ${isLive ? 'APIs reales (SYNC_ENABLED=true)' : 'fixtures locales'}\n`);

  try {
    await app.get(CatalogSyncService).syncAll();
  } catch (error) {
    // No se relanza: una sincronización fallida es un resultado posible, no un
    // fallo del comando. El detalle queda en la bitácora que se imprime abajo.
    console.error(`\nLa sincronización terminó con error: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }

  await report(app.get(PrismaService));
  await app.close();
}

async function report(prisma: PrismaService): Promise<void> {
  const runs = await prisma.syncRun.findMany({ orderBy: { startedAt: 'desc' }, take: 4 });

  console.log('\nÚltimas sincronizaciones:');
  for (const run of runs) {
    const detail =
      run.status === 'success'
        ? `${run.recordsProcessed} registros, ${run.recordsRejected} descartados`
        : (run.error ?? 'sin detalle');
    console.log(`  ${run.resource.padEnd(10)} ${run.status.padEnd(8)} ${detail}`);
  }

  const [countries, launches, nationalities, unresolved] = await Promise.all([
    prisma.country.count(),
    prisma.launch.count(),
    prisma.payloadNationality.count(),
    prisma.payloadNationality.count({ where: { resolution: 'unresolved' } }),
  ]);

  console.log('\nEstado de la base:');
  console.log(`  países         ${countries}`);
  console.log(`  lanzamientos   ${launches}`);
  console.log(
    `  nacionalidades ${nationalities}` +
      (nationalities > 0
        ? ` · ${Math.round(((nationalities - unresolved) / nationalities) * 1000) / 10}% clasificadas`
        : ''),
  );
}

syncOnce().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
