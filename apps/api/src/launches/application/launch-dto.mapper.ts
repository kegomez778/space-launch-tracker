import type {
  CountrySummaryDto,
  DatePrecision,
  LaunchDateDto,
  LaunchDetailDto,
  LaunchSummaryDto,
  PayloadDto,
} from '@slt/shared';
import { LaunchDate } from '../domain/launch-date';
import { deriveLaunchStatus } from '../domain/launch-status';

/** Forma mínima que necesita el mapper, satisfecha por las consultas de Prisma. */
export interface LaunchRow {
  id: string;
  flightNumber: number;
  name: string;
  dateUtc: Date;
  datePrecision: string;
  isProvisional: boolean;
  success: boolean | null;
  sourceUpcoming: boolean;
  patchSmall: string | null;
  rocket: { id: string; name: string; type: string } | null;
  launchpad: { countryCode: string | null; country: CountryRow | null } | null;
}

export interface CountryRow {
  code: string;
  name: string;
  flagSvg: string | null;
  flagAlt: string | null;
}

export function toCountrySummary(country: CountryRow | null | undefined): CountrySummaryDto | null {
  if (!country) {
    return null;
  }
  return { code: country.code, name: country.name, flagSvg: country.flagSvg, flagAlt: country.flagAlt };
}

function toLaunchDateDto(row: Pick<LaunchRow, 'dateUtc' | 'datePrecision' | 'isProvisional'>): LaunchDateDto {
  const precision = toDatePrecision(row.datePrecision);
  const launchDate = LaunchDate.create(row.dateUtc, precision, row.isProvisional);

  return {
    dateUtc: row.dateUtc.toISOString(),
    precision,
    isProvisional: row.isProvisional,
    supportsCountdown: launchDate.supportsCountdown,
  };
}

/**
 * SQLite no admite enum, así que la precisión viaja como texto. Este es el único
 * punto donde se convierte a tipo del dominio, y un valor desconocido degrada al
 * caso más conservador en lugar de romper la respuesta entera.
 */
function toDatePrecision(value: string): DatePrecision {
  return LaunchDate.isDatePrecision(value) ? value : 'year';
}

export function toLaunchSummary(row: LaunchRow, now: Date): LaunchSummaryDto {
  const precision = toDatePrecision(row.datePrecision);
  const status = deriveLaunchStatus(
    {
      date: LaunchDate.create(row.dateUtc, precision, row.isProvisional),
      success: row.success,
      sourceUpcoming: row.sourceUpcoming,
    },
    now,
  );

  return {
    id: row.id,
    flightNumber: row.flightNumber,
    name: row.name,
    date: toLaunchDateDto(row),
    timing: status.timing,
    outcome: status.outcome,
    rocketName: row.rocket?.name ?? 'Cohete no informado',
    patchUrl: row.patchSmall,
    siteCountry: toCountrySummary(row.launchpad?.country),
  };
}

export interface LaunchDetailRow extends LaunchRow {
  details: string | null;
  failureReason: string | null;
  patchLarge: string | null;
  webcast: string | null;
  wikipedia: string | null;
  article: string | null;
  launchpad:
    | {
        id: string;
        name: string;
        fullName: string;
        locality: string | null;
        region: string | null;
        countryCode: string | null;
        country: CountryRow | null;
      }
    | null;
  payloads: {
    id: string;
    name: string;
    type: string | null;
    massKg: number | null;
    orbit: string | null;
    customers: string;
    nationalities: {
      rawValue: string;
      resolution: string;
      country: CountryRow | null;
    }[];
  }[];
}

export function toLaunchDetail(row: LaunchDetailRow, now: Date): LaunchDetailDto {
  return {
    ...toLaunchSummary(row, now),
    details: row.details,
    failureReason: row.failureReason,
    rocket: row.rocket,
    launchpad: row.launchpad
      ? {
          id: row.launchpad.id,
          name: row.launchpad.name,
          fullName: row.launchpad.fullName,
          locality: row.launchpad.locality,
          region: row.launchpad.region,
          country: toCountrySummary(row.launchpad.country),
        }
      : null,
    payloads: row.payloads.map(toPayloadDto),
    links: { webcast: row.webcast, wikipedia: row.wikipedia, article: row.article },
  };
}

function toPayloadDto(payload: LaunchDetailRow['payloads'][number]): PayloadDto {
  return {
    id: payload.id,
    name: payload.name,
    type: payload.type,
    massKg: payload.massKg,
    orbit: payload.orbit,
    customers: parseStringList(payload.customers),
    nationalities: payload.nationalities.map((nationality) => ({
      rawValue: nationality.rawValue,
      resolution: toResolution(nationality.resolution),
      country: toCountrySummary(nationality.country),
    })),
  };
}

function toResolution(value: string): PayloadDto['nationalities'][number]['resolution'] {
  return value === 'resolved' || value === 'not_a_country' ? value : 'unresolved';
}

function parseStringList(value: string): readonly string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export type { CountrySummaryDto, LaunchSummaryDto };
