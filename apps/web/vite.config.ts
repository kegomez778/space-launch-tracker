import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
// defineConfig de vitest en lugar de vite: extiende el tipo con la clave `test`,
// de modo que build y tests comparten un único fichero de configuración.
import { defineConfig } from 'vitest/config';

const here = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@slt/shared': resolve(here, '../../packages/shared/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    // El proxy hace que frontend y API compartan origen: sin CORS que configurar
    // y con SameSite=Lax como defensa CSRF suficiente (ADR-004).
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.spec.tsx', 'src/**/*.spec.ts'],
  },
});
