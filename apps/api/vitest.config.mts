import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const here = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    // Los tests de integración comparten un fichero SQLite temporal, así que los
    // ficheros de test se ejecutan en serie para no pisarse entre sí.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      // Se apunta al fuente y no a dist para que los tests no dependan de un
      // build previo del paquete compartido.
      '@slt/shared': resolve(here, '../../packages/shared/src/index.ts'),
    },
  },
});
