import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { DomainExceptionFilter } from './shared/presentation/domain-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useGlobalFilters(new DomainExceptionFilter());

  // Sin configuración de CORS: el dev server de Vite hace de proxy hacia /api, de
  // modo que frontend y backend comparten origen (ADR-004).
  const port = Number(config.get('PORT') ?? 3000);
  await app.listen(port);

  new Logger('Bootstrap').log(`API escuchando en http://localhost:${port}/api`);
}

void bootstrap();
