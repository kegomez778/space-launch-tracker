import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

/**
 * Prisma 7 saca la URL del datasource fuera de `schema.prisma`. La documentación
 * pública escrita para v5/v6 no coincide con este fichero: ver ADR-002.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
