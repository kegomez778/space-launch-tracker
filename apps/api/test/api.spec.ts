import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { DomainExceptionFilter } from '../src/shared/presentation/domain-exception.filter';
import { CatalogSyncService } from '../src/sync/application/catalog-sync.service';

/**
 * Integración contra una base SQLite temporal real, no contra mocks.
 *
 * El objetivo es validar el SQL que se ejecuta —filtros, paginación, joins de la
 * proyección de países— y no mi idea de lo que hace. Un doble de repositorio
 * habría pasado estos tests con consultas rotas.
 */
describe('API', () => {
  let app: INestApplication;
  let databaseDir: string;

  beforeAll(async () => {
    databaseDir = mkdtempSync(join(tmpdir(), 'slt-test-'));
    process.env.DATABASE_URL = `file:${join(databaseDir, 'test.db')}`;
    process.env.JWT_SECRET = 'test-secret';
    process.env.SYNC_ENABLED = 'false';

    // Se invoca el CLI de Prisma con el propio Node en lugar de a través de npx.
    // En Windows npx es un .cmd, y Node ya no lo lanza sin shell: true desde el
    // endurecimiento por CVE-2024-27980 (ENOENT primero, EINVAL después). Resolver
    // el entry point del paquete evita tanto el shell como sus problemas de
    // entrecomillado en rutas con espacios, y funciona igual en los tres sistemas.
    const prismaCli = require.resolve('prisma/build/index.js');

    execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'pipe',
    });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();

    await app.get(CatalogSyncService).syncAll();
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    rmSync(databaseDir, { recursive: true, force: true });
  });

  const server = () => app.getHttpServer();

  describe('catálogo', () => {
    it('devuelve una página con paginación y antigüedad de los datos', async () => {
      const response = await request(server()).get('/api/launches').expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.pagination).toMatchObject({ page: 1, pageSize: 20 });
      expect(response.body.freshness.lastSyncedAt).not.toBeNull();
    });

    it('filtra los próximos por fecha y no por el flag de la fuente', async () => {
      const response = await request(server()).get('/api/launches?timing=upcoming').expect(200);

      const now = Date.now();
      for (const launch of response.body.data) {
        expect(Date.parse(launch.date.dateUtc)).toBeGreaterThan(now);
        expect(launch.timing).toBe('upcoming');
      }
    });

    it('busca sin distinguir mayúsculas ni acentos', async () => {
      const upper = await request(server()).get('/api/launches?search=STARLINK').expect(200);
      const lower = await request(server()).get('/api/launches?search=starlink').expect(200);

      expect(upper.body.pagination.totalItems).toBeGreaterThan(0);
      expect(upper.body.pagination.totalItems).toBe(lower.body.pagination.totalItems);
    });

    it('respeta el tamaño de página y rechaza uno excesivo', async () => {
      const response = await request(server()).get('/api/launches?pageSize=3').expect(200);
      expect(response.body.data).toHaveLength(3);

      await request(server()).get('/api/launches?pageSize=5000').expect(400);
    });

    it('devuelve 404 con código de dominio para una misión inexistente', async () => {
      const response = await request(server()).get('/api/launches/no-existe').expect(404);
      expect(response.body.code).toBe('LAUNCH_NOT_FOUND');
    });

    it('compone el detalle con cargas útiles y su estado de resolución', async () => {
      const list = await request(server()).get('/api/launches?search=Axiom').expect(200);
      const detail = await request(server()).get(`/api/launches/${list.body.data[0].id}`).expect(200);

      const nationalities = detail.body.payloads.flatMap((payload: { nationalities: unknown[] }) => payload.nationalities);
      expect(nationalities.some((n: { resolution: string }) => n.resolution === 'unresolved')).toBe(true);
    });
  });

  describe('países', () => {
    it('lista sólo países con vínculo real con algún lanzamiento', async () => {
      const response = await request(server()).get('/api/countries').expect(200);

      expect(response.body.length).toBeGreaterThan(0);
      for (const country of response.body) {
        expect(country.launchCount).toBeGreaterThan(0);
      }
    });

    it('separa los lanzamientos por suelo de los que llevan carga del país', async () => {
      const response = await request(server()).get('/api/countries/DE/launches').expect(200);

      // Alemania no tiene sitios de SpaceX, pero sí cargas útiles: es justo el
      // caso que justifica el segundo puente entre ambas APIs.
      expect(response.body.fromSoil).toHaveLength(0);
      expect(response.body.withPayload.length).toBeGreaterThan(0);
    });

    it('acepta el código de país en minúsculas', async () => {
      await request(server()).get('/api/countries/us').expect(200);
    });
  });

  describe('calidad de datos', () => {
    it('expone lo no resuelto en lugar de ocultarlo', async () => {
      const response = await request(server()).get('/api/data-quality').expect(200);

      expect(response.body.nationalities.unresolved).toBeGreaterThan(0);
      expect(response.body.nationalities.unresolvedValues[0].rawValue).toBe('Freedonia');
      expect(response.body.nationalities.coveragePercent).toBeLessThan(100);
    });

    it('cuenta los registros descartados durante la sincronización', async () => {
      const response = await request(server()).get('/api/data-quality').expect(200);
      const launchSync = response.body.syncs.find((run: { resource: string }) => run.resource === 'launches');

      expect(launchSync.recordsRejected).toBeGreaterThan(0);
    });

    it('detecta el flag temporal que contradice a su propia fecha', async () => {
      const response = await request(server()).get('/api/data-quality').expect(200);
      expect(response.body.launches.contradictoryTimingFlags).toBeGreaterThan(0);
    });
  });

  describe('autenticación y seguimientos', () => {
    const credentials = { email: 'nuevo@ejemplo.com', password: 'contrasena-larga' };
    let sessionCookie: string;

    it('registra y devuelve la sesión en una cookie httpOnly', async () => {
      const response = await request(server()).post('/api/auth/register').send(credentials).expect(201);

      const cookies = response.headers['set-cookie'] as unknown as string[];
      sessionCookie = cookies[0];

      expect(sessionCookie).toContain('HttpOnly');
      expect(sessionCookie).toContain('SameSite=Lax');
      expect(response.body.email).toBe(credentials.email);
    });

    it('impide registrar dos veces el mismo email', async () => {
      const response = await request(server()).post('/api/auth/register').send(credentials).expect(409);
      expect(response.body.code).toBe('EMAIL_ALREADY_REGISTERED');
    });

    it('no revela si el email existe cuando la contraseña es incorrecta', async () => {
      const wrongPassword = await request(server())
        .post('/api/auth/login')
        .send({ ...credentials, password: 'otra-contrasena' })
        .expect(401);

      const unknownEmail = await request(server())
        .post('/api/auth/login')
        .send({ email: 'nadie@ejemplo.com', password: 'otra-contrasena' })
        .expect(401);

      expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
    });

    it('rechaza el acceso a seguimientos sin sesión', async () => {
      await request(server()).get('/api/follows').expect(401);
    });

    it('sigue una misión de forma idempotente', async () => {
      const list = await request(server()).get('/api/launches?pageSize=1').expect(200);
      const launchId = list.body.data[0].id;

      await request(server()).put(`/api/follows/${launchId}`).set('Cookie', sessionCookie).expect(204);
      await request(server()).put(`/api/follows/${launchId}`).set('Cookie', sessionCookie).expect(204);

      const follows = await request(server()).get('/api/follows').set('Cookie', sessionCookie).expect(200);
      expect(follows.body.filter((f: { id: string }) => f.id === launchId)).toHaveLength(1);
    });

    it('dejar de seguir algo no seguido no es un error', async () => {
      await request(server()).delete('/api/follows/inexistente').set('Cookie', sessionCookie).expect(204);
    });

    // La regla que impide actuar en nombre de otro: el usuario sale del token y
    // no hay ninguna ruta que lo acepte como parámetro.
    it('aísla los seguimientos entre usuarios', async () => {
      const otherSession = await request(server())
        .post('/api/auth/register')
        .send({ email: 'otra@ejemplo.com', password: 'contrasena-larga' })
        .expect(201);
      const otherCookie = (otherSession.headers['set-cookie'] as unknown as string[])[0];

      const mine = await request(server()).get('/api/follows').set('Cookie', sessionCookie).expect(200);
      const theirs = await request(server()).get('/api/follows').set('Cookie', otherCookie).expect(200);

      expect(mine.body.length).toBeGreaterThan(0);
      expect(theirs.body).toHaveLength(0);
    });

    it('rechaza seguir una misión que no existe', async () => {
      const response = await request(server())
        .put('/api/follows/no-existe')
        .set('Cookie', sessionCookie)
        .expect(404);

      expect(response.body.code).toBe('LAUNCH_NOT_FOUND');
    });
  });
});
