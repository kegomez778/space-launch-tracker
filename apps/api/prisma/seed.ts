import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { hash } from '@node-rs/argon2';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/infrastructure/prisma.service';
import { CatalogSyncService } from '../src/sync/application/catalog-sync.service';
import { normalizeText } from '../src/shared/domain/text-normalization';

const DEMO_EMAIL = 'demo@demo.com';
const DEMO_PASSWORD = 'demo1234';

/**
 * Siembra la base a través del **mismo servicio de sincronización** que usa la
 * aplicación en producción. No hay un camino de carga alternativo que pudiera
 * comportarse distinto del real: sólo cambia de dónde salen los datos.
 */
async function seed(): Promise<void> {
  // Se silencia el log de Nest y se informa por stdout: esto es un script de
  // línea de comandos y su salida debe leerse como tal, no como el arranque
  // de un servidor.
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['warn', 'error'] });

  try {
    const sync = app.get(CatalogSyncService);
    const prisma = app.get(PrismaService);

    const outcomes = await sync.syncAll();
    for (const outcome of outcomes) {
      console.log(`  ${outcome.resource}: ${outcome.processed} registros, ${outcome.rejected} descartados`);
    }

    const user = await seedDemoUser(prisma);
    await seedDemoFollows(prisma, user.id);

    const coverage = await reportNationalityCoverage(prisma);
    console.log(`  nacionalidades: ${coverage}`);
    console.log(`\nUsuario de demostración: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  } finally {
    await app.close();
  }
}

async function seedDemoUser(prisma: PrismaService) {
  const emailNormalized = normalizeText(DEMO_EMAIL);
  const passwordHash = await hash(DEMO_PASSWORD);
  const countryExists = (await prisma.country.count({ where: { code: 'ES' } })) > 0;

  return prisma.user.upsert({
    where: { emailNormalized },
    create: {
      email: DEMO_EMAIL,
      emailNormalized,
      passwordHash,
      countryCode: countryExists ? 'ES' : null,
    },
    update: { passwordHash },
    select: { id: true },
  });
}

/**
 * Deja un par de misiones ya seguidas para que el panel no aparezca vacío en la
 * primera visita: un estado vacío es correcto, pero no enseña para qué sirve.
 */
async function seedDemoFollows(prisma: PrismaService, userId: string): Promise<void> {
  const upcoming = await prisma.launch.findMany({
    where: { dateUtc: { gt: new Date() } },
    orderBy: { dateUtc: 'asc' },
    take: 2,
    select: { id: true },
  });

  for (const launch of upcoming) {
    await prisma.follow.upsert({
      where: { userId_launchId: { userId, launchId: launch.id } },
      create: { userId, launchId: launch.id },
      update: {},
    });
  }
}

/**
 * La cobertura se imprime al sembrar porque es el momento en que un valor nuevo y
 * sin resolver aparece por primera vez. Verla aquí evita descubrirla en la interfaz.
 */
async function reportNationalityCoverage(prisma: PrismaService): Promise<string> {
  const [total, unresolved] = await Promise.all([
    prisma.payloadNationality.count(),
    prisma.payloadNationality.count({ where: { resolution: 'unresolved' } }),
  ]);

  if (total === 0) {
    return 'sin datos';
  }

  const percent = Math.round(((total - unresolved) / total) * 1000) / 10;
  return `${percent}% clasificadas, ${unresolved} sin resolver`;
}

seed().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
