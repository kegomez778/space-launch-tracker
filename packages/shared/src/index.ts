/**
 * Contrato HTTP entre `apps/api` y `apps/web`.
 *
 * Es la única fuente de verdad de la forma de las respuestas: el backend construye
 * estos tipos y el frontend los consume, de modo que una divergencia rompe en
 * compilación en lugar de en tiempo de ejecución.
 */

export const DATE_PRECISIONS = ['hour', 'day', 'month', 'quarter', 'half', 'year'] as const;
export type DatePrecision = (typeof DATE_PRECISIONS)[number];

export type LaunchOutcome = 'success' | 'failure' | 'pending';
export type LaunchTiming = 'upcoming' | 'launched';

/**
 * Fecha y precisión son inseparables: `dateUtc` con precisión `month` es un marcador
 * de posición, no un instante. Mantenerlas en un mismo tipo impide que la interfaz
 * muestre más exactitud de la que el dato realmente tiene.
 */
export interface LaunchDateDto {
  readonly dateUtc: string;
  readonly precision: DatePrecision;
  readonly isProvisional: boolean;
  readonly supportsCountdown: boolean;
}

export interface RocketSummaryDto {
  readonly id: string;
  readonly name: string;
  readonly type: string;
}

export interface LaunchpadSummaryDto {
  readonly id: string;
  readonly name: string;
  readonly fullName: string;
  readonly locality: string | null;
  readonly region: string | null;
  readonly country: CountrySummaryDto | null;
}

export type NationalityResolution = 'resolved' | 'not_a_country' | 'unresolved';

export interface PayloadNationalityDto {
  readonly rawValue: string;
  readonly resolution: NationalityResolution;
  readonly country: CountrySummaryDto | null;
}

export interface PayloadDto {
  readonly id: string;
  readonly name: string;
  readonly type: string | null;
  readonly massKg: number | null;
  readonly orbit: string | null;
  readonly customers: readonly string[];
  readonly nationalities: readonly PayloadNationalityDto[];
}

export interface LaunchSummaryDto {
  readonly id: string;
  readonly flightNumber: number;
  readonly name: string;
  readonly date: LaunchDateDto;
  readonly timing: LaunchTiming;
  readonly outcome: LaunchOutcome;
  readonly rocketName: string;
  readonly patchUrl: string | null;
  readonly siteCountry: CountrySummaryDto | null;
}

export interface LaunchDetailDto extends LaunchSummaryDto {
  readonly details: string | null;
  readonly failureReason: string | null;
  readonly rocket: RocketSummaryDto | null;
  readonly launchpad: LaunchpadSummaryDto | null;
  readonly payloads: readonly PayloadDto[];
  readonly links: {
    readonly webcast: string | null;
    readonly wikipedia: string | null;
    readonly article: string | null;
  };
}

export interface CountrySummaryDto {
  readonly code: string;
  readonly name: string;
  readonly flagSvg: string | null;
  readonly flagAlt: string | null;
}

export interface CountryDetailDto extends CountrySummaryDto {
  readonly officialName: string;
  readonly region: string | null;
  readonly subregion: string | null;
  readonly capital: string | null;
  readonly launchesFromSoil: number;
  readonly launchesWithPayload: number;
}

export interface CountryListItemDto extends CountrySummaryDto {
  readonly region: string | null;
  readonly launchCount: number;
}

/**
 * Antigüedad del dato replicado. Viaja en toda respuesta de catálogo porque la
 * interfaz debe poder decir "datos de hace 3 h" en lugar de fingir que están al día.
 */
export interface DataFreshnessDto {
  readonly lastSyncedAt: string | null;
  readonly ageSeconds: number | null;
  readonly isStale: boolean;
  readonly lastSyncFailed: boolean;
}

export interface PaginationDto {
  readonly page: number;
  readonly pageSize: number;
  readonly totalItems: number;
  readonly totalPages: number;
}

export interface PaginatedDto<T> {
  readonly data: readonly T[];
  readonly pagination: PaginationDto;
  readonly freshness: DataFreshnessDto;
}

export interface DataQualityDto {
  readonly nationalities: {
    readonly total: number;
    readonly resolved: number;
    readonly notACountry: number;
    readonly unresolved: number;
    readonly coveragePercent: number;
    readonly unresolvedValues: readonly { readonly rawValue: string; readonly occurrences: number }[];
  };
  readonly launches: {
    readonly total: number;
    /** Lanzamientos cuyo flag `upcoming` de la fuente contradice su propia fecha. */
    readonly contradictoryTimingFlags: number;
  };
  readonly syncs: readonly {
    readonly resource: string;
    readonly status: 'success' | 'failed' | 'running';
    readonly finishedAt: string | null;
    readonly recordsProcessed: number;
    readonly recordsRejected: number;
    readonly error: string | null;
  }[];
}

export interface AuthUserDto {
  readonly id: string;
  readonly email: string;
  readonly country: CountrySummaryDto | null;
}

export interface FollowedLaunchDto extends LaunchSummaryDto {
  readonly followedAt: string;
}

export interface ApiErrorDto {
  readonly statusCode: number;
  readonly code: string;
  readonly message: string;
}

export const LAUNCH_TIMING_FILTERS = ['all', 'upcoming', 'launched'] as const;
export type LaunchTimingFilter = (typeof LAUNCH_TIMING_FILTERS)[number];

export const LAUNCH_OUTCOME_FILTERS = ['all', 'success', 'failure', 'pending'] as const;
export type LaunchOutcomeFilter = (typeof LAUNCH_OUTCOME_FILTERS)[number];

export const LAUNCH_SORT_OPTIONS = ['date_desc', 'date_asc'] as const;
export type LaunchSort = (typeof LAUNCH_SORT_OPTIONS)[number];

export interface LaunchQueryParams {
  readonly search?: string;
  readonly timing?: LaunchTimingFilter;
  readonly outcome?: LaunchOutcomeFilter;
  readonly country?: string;
  readonly rocket?: string;
  readonly year?: number;
  readonly sort?: LaunchSort;
  readonly page?: number;
  readonly pageSize?: number;
}

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
