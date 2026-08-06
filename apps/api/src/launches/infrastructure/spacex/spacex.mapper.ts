import type { CatalogLaunch, CatalogLaunchpad, CatalogPayload, CatalogRocket } from '../../domain/catalog-snapshot';
import type {
  SpaceXLaunchDto,
  SpaceXLaunchpadDto,
  SpaceXPayloadDto,
  SpaceXRocketDto,
} from './spacex.schemas';

/**
 * Traduce los DTO de SpaceX a entidades propias.
 *
 * Aquí se concentran todas las rarezas de la fuente, para que no se filtren al
 * resto del sistema: campos que a veces vienen como cadena vacía en vez de null,
 * fallos descritos en un array del que sólo interesa el motivo, y una precisión de
 * fecha que el dominio necesita conservar tal cual.
 */

/** La fuente usa cadenas vacías y null indistintamente para "no hay dato". */
const orNull = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed !== undefined && trimmed.length > 0 ? trimmed : null;
};

const numberOrNull = (value: number | null | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

export function toCatalogLaunch(dto: SpaceXLaunchDto): CatalogLaunch {
  return {
    id: dto.id,
    flightNumber: dto.flight_number,
    name: dto.name,
    dateUtc: new Date(dto.date_utc),
    datePrecision: dto.date_precision,
    // `tbd` y `net` expresan lo mismo desde ángulos distintos: que la fecha aún
    // puede moverse. El dominio sólo necesita saber que no es firme.
    isProvisional: dto.tbd === true || dto.net === true,
    success: dto.success ?? null,
    failureReason: firstFailureReason(dto),
    details: orNull(dto.details),
    patchSmall: orNull(dto.links?.patch?.small),
    patchLarge: orNull(dto.links?.patch?.large),
    webcast: orNull(dto.links?.webcast),
    wikipedia: orNull(dto.links?.wikipedia),
    article: orNull(dto.links?.article),
    sourceUpcoming: dto.upcoming,
    rocketId: orNull(dto.rocket),
    launchpadId: orNull(dto.launchpad),
  };
}

function firstFailureReason(dto: SpaceXLaunchDto): string | null {
  for (const failure of dto.failures ?? []) {
    const reason = orNull(failure.reason);
    if (reason !== null) {
      return reason;
    }
  }
  return null;
}

export function toCatalogRocket(dto: SpaceXRocketDto): CatalogRocket {
  return {
    id: dto.id,
    name: dto.name,
    type: dto.type,
    active: dto.active,
    stages: dto.stages,
    firstFlight: orNull(dto.first_flight),
    heightM: numberOrNull(dto.height?.meters),
    massKg: numberOrNull(dto.mass?.kg),
    description: orNull(dto.description),
  };
}

export function toCatalogLaunchpad(dto: SpaceXLaunchpadDto): CatalogLaunchpad {
  return {
    id: dto.id,
    name: dto.name,
    fullName: dto.full_name,
    locality: orNull(dto.locality),
    region: orNull(dto.region),
    timezone: orNull(dto.timezone),
    latitude: numberOrNull(dto.latitude),
    longitude: numberOrNull(dto.longitude),
    status: orNull(dto.status),
  };
}

/**
 * Devuelve null para cargas sin lanzamiento asociado: existen en la fuente y no
 * tienen sitio en el catálogo, así que se descartan de forma explícita en lugar
 * de colarse con una referencia rota.
 */
export function toCatalogPayload(dto: SpaceXPayloadDto): CatalogPayload | null {
  const launchId = orNull(dto.launch);
  if (launchId === null) {
    return null;
  }

  return {
    id: dto.id,
    launchId,
    name: orNull(dto.name) ?? dto.id,
    type: orNull(dto.type),
    massKg: numberOrNull(dto.mass_kg),
    orbit: orNull(dto.orbit),
    customers: (dto.customers ?? []).map((value) => value.trim()).filter((value) => value.length > 0),
    manufacturers: (dto.manufacturers ?? []).map((value) => value.trim()).filter((value) => value.length > 0),
    nationalities: (dto.nationalities ?? []).map((value) => value.trim()).filter((value) => value.length > 0),
  };
}
