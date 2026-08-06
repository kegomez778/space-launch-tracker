import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { AuthService } from './auth/application/auth.service';
import { AuthController } from './auth/presentation/auth.controller';
import { AuthGuard } from './auth/presentation/auth.guard';
import { CountriesService } from './countries/application/countries.service';
import { COUNTRY_CATALOG_PROVIDER } from './countries/domain/country-catalog';
import { RestCountriesProvider } from './countries/infrastructure/rest-countries/rest-countries.provider';
import { CountriesController } from './countries/presentation/countries.controller';
import { FollowsService } from './follows/application/follows.service';
import { FollowsController } from './follows/presentation/follows.controller';
import { LaunchesService } from './launches/application/launches.service';
import { LAUNCH_CATALOG_PROVIDER } from './launches/domain/catalog-snapshot';
import { SpaceXCatalogProvider } from './launches/infrastructure/spacex/spacex-catalog.provider';
import { LaunchesController } from './launches/presentation/launches.controller';
import { DataFreshnessService } from './shared/application/data-freshness.service';
import {
  FixtureCountryCatalogProvider,
  FixtureLaunchCatalogProvider,
} from './shared/infrastructure/fixture-catalog.providers';
import { PrismaService } from './shared/infrastructure/prisma.service';
import { ResilientHttpClient } from './shared/infrastructure/resilient-http.client';
import { CatalogSyncService } from './sync/application/catalog-sync.service';
import { SyncScheduler } from './sync/presentation/sync.scheduler';

const httpClientFor = (service: string, urlKey: string) => (config: ConfigService) =>
  new ResilientHttpClient({
    serviceName: service,
    baseUrl: config.getOrThrow<string>(urlKey),
    timeoutMs: Number(config.get('EXTERNAL_TIMEOUT_MS') ?? 10_000),
    maxRetries: Number(config.get('EXTERNAL_MAX_RETRIES') ?? 3),
    circuit: {
      failureThreshold: Number(config.get('CIRCUIT_BREAKER_THRESHOLD') ?? 5),
      resetTimeoutMs: Number(config.get('CIRCUIT_BREAKER_RESET_MS') ?? 60_000),
    },
  });

const SPACEX_HTTP = Symbol('SpaceXHttpClient');
const REST_COUNTRIES_HTTP = Symbol('RestCountriesHttpClient');

/**
 * Selección del proveedor de datos.
 *
 * Con `SYNC_ENABLED=false` (por defecto) la aplicación usa los fixtures locales,
 * de modo que arranca con contenido sin depender de la red. Ambas rutas
 * implementan el mismo puerto, así que el resto del sistema no distingue cuál
 * está activa: no hay una "ruta de demo" que pueda divergir de la real.
 */
const useLiveProviders = (config: ConfigService) => config.get<string>('SYNC_ENABLED') === 'true';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env'] }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        // El tipo de expiresIn de jsonwebtoken es un literal de plantilla, así que
        // el valor de entorno se estrecha aquí en vez de ensanchar el tipo.
        signOptions: { expiresIn: (config.get<string>('JWT_EXPIRES_IN') ?? '7d') as `${number}d` },
      }),
    }),
  ],
  controllers: [LaunchesController, CountriesController, AuthController, FollowsController],
  providers: [
    PrismaService,
    DataFreshnessService,
    LaunchesService,
    CountriesService,
    AuthService,
    AuthGuard,
    FollowsService,
    CatalogSyncService,
    SyncScheduler,
    FixtureLaunchCatalogProvider,
    FixtureCountryCatalogProvider,
    { provide: SPACEX_HTTP, inject: [ConfigService], useFactory: httpClientFor('SpaceX', 'SPACEX_API_URL') },
    {
      provide: REST_COUNTRIES_HTTP,
      inject: [ConfigService],
      useFactory: httpClientFor('REST Countries', 'REST_COUNTRIES_API_URL'),
    },
    {
      provide: LAUNCH_CATALOG_PROVIDER,
      inject: [ConfigService, SPACEX_HTTP, FixtureLaunchCatalogProvider],
      useFactory: (config: ConfigService, http: ResilientHttpClient, fixtures: FixtureLaunchCatalogProvider) =>
        useLiveProviders(config) ? new SpaceXCatalogProvider(http) : fixtures,
    },
    {
      provide: COUNTRY_CATALOG_PROVIDER,
      inject: [ConfigService, REST_COUNTRIES_HTTP, FixtureCountryCatalogProvider],
      useFactory: (config: ConfigService, http: ResilientHttpClient, fixtures: FixtureCountryCatalogProvider) =>
        useLiveProviders(config) ? new RestCountriesProvider(http) : fixtures,
    },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
