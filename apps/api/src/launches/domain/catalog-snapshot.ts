import type { DatePrecision } from '@slt/shared';

/**
 * Modelo de dominio propio del catálogo. Es la frontera de la capa anticorrupción:
 * ningún DTO de proveedor cruza más allá de los mappers de `infrastructure`, de modo
 * que añadir una segunda fuente de lanzamientos no obliga a tocar nada de esto.
 */

export interface CatalogRocket {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly active: boolean;
  readonly stages: number;
  readonly firstFlight: string | null;
  readonly heightM: number | null;
  readonly massKg: number | null;
  readonly description: string | null;
}

export interface CatalogLaunchpad {
  readonly id: string;
  readonly name: string;
  readonly fullName: string;
  readonly locality: string | null;
  readonly region: string | null;
  readonly timezone: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly status: string | null;
}

export interface CatalogPayload {
  readonly id: string;
  readonly launchId: string;
  readonly name: string;
  readonly type: string | null;
  readonly massKg: number | null;
  readonly orbit: string | null;
  readonly customers: readonly string[];
  readonly manufacturers: readonly string[];
  /** Valores en crudo. La resolución a país ocurre después, en su propio paso. */
  readonly nationalities: readonly string[];
}

export interface CatalogLaunch {
  readonly id: string;
  readonly flightNumber: number;
  readonly name: string;
  readonly dateUtc: Date;
  readonly datePrecision: DatePrecision;
  readonly isProvisional: boolean;
  readonly success: boolean | null;
  readonly failureReason: string | null;
  readonly details: string | null;
  readonly patchSmall: string | null;
  readonly patchLarge: string | null;
  readonly webcast: string | null;
  readonly wikipedia: string | null;
  readonly article: string | null;
  readonly sourceUpcoming: boolean;
  readonly rocketId: string | null;
  readonly launchpadId: string | null;
}

export interface CatalogSnapshot {
  readonly launches: readonly CatalogLaunch[];
  readonly rockets: readonly CatalogRocket[];
  readonly launchpads: readonly CatalogLaunchpad[];
  readonly payloads: readonly CatalogPayload[];
  readonly rejectedRecords: number;
}

/** Puerto de salida: cualquier proveedor de lanzamientos debe entregar esta forma. */
export interface LaunchCatalogProvider {
  readonly providerName: string;
  fetchCatalog(): Promise<CatalogSnapshot>;
}

export const LAUNCH_CATALOG_PROVIDER = Symbol('LaunchCatalogProvider');
