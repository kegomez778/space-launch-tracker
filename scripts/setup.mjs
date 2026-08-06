#!/usr/bin/env node
/**
 * Prepara el entorno local en un solo comando: copia los .env de ejemplo si no
 * existen, aplica las migraciones y siembra la base con los fixtures.
 *
 * Es idempotente: volver a ejecutarlo no pisa un .env ya editado.
 */
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const apiDir = join(root, 'apps', 'api');
const webDir = join(root, 'apps', 'web');

const step = (message) => console.log(`\n\x1b[36m▸ ${message}\x1b[0m`);
const done = (message) => console.log(`  \x1b[32m✓\x1b[0m ${message}`);

const ensureEnv = (dir, label) => {
  const target = join(dir, '.env');
  const example = join(dir, '.env.example');
  if (existsSync(target)) {
    done(`${label}: .env ya existe, no se toca`);
    return;
  }
  copyFileSync(example, target);
  done(`${label}: .env creado desde .env.example`);
};

const run = (command, cwd) => execSync(command, { cwd, stdio: 'inherit' });

step('Variables de entorno');
ensureEnv(apiDir, 'api');
ensureEnv(webDir, 'web');

step('Cliente de Prisma');
run('npx prisma generate', apiDir);

step('Base de datos (SQLite)');
run('npx prisma migrate deploy', apiDir);

step('Datos iniciales desde fixtures');
run('npx tsx prisma/seed.ts', apiDir);

console.log('\n\x1b[32mListo.\x1b[0m Arranca la aplicación con: \x1b[1mnpm run dev\x1b[0m');
console.log('Frontend en http://localhost:5173 · API en http://localhost:3000/api\n');
