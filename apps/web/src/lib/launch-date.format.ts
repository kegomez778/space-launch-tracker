import type { LaunchDateDto } from '@slt/shared';

/**
 * Formatea una fecha respetando su precisión.
 *
 * Es la contrapartida en interfaz de la regla del dominio: la API entrega
 * siempre un instante completo, pero con precisión `month` esa hora es relleno.
 * Mostrar "3 feb 2026, 14:22" cuando la fuente sólo sabe el mes sería inventar
 * información, y en un producto cuyo valor es "seguir" una misión, eso es
 * exactamente lo que no se puede hacer.
 */
export function formatLaunchDate(date: LaunchDateDto, locale = 'es-ES'): string {
  const instant = new Date(date.dateUtc);
  const prefix = date.isProvisional ? 'Provisional: ' : '';

  switch (date.precision) {
    case 'hour':
      return (
        prefix +
        new Intl.DateTimeFormat(locale, {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }).format(instant)
      );

    case 'day':
      return `${prefix}${new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(instant)} · hora por confirmar`;

    case 'month':
      return `${prefix}${capitalize(
        new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(instant),
      )} · día por confirmar`;

    case 'quarter':
      return `${prefix}${Math.floor(instant.getUTCMonth() / 3) + 1}T ${instant.getUTCFullYear()} · estimado`;

    case 'half':
      return `${prefix}${instant.getUTCMonth() < 6 ? 1 : 2}S ${instant.getUTCFullYear()} · estimado`;

    case 'year':
      return `${prefix}${instant.getUTCFullYear()} · sin fecha asignada`;
  }
}

/** Zona horaria del navegador, que es la que el usuario espera ver. */
export function localTimeZoneLabel(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export interface Countdown {
  readonly days: number;
  readonly hours: number;
  readonly minutes: number;
  readonly seconds: number;
  readonly hasArrived: boolean;
}

export function computeCountdown(isoDate: string, now: number = Date.now()): Countdown {
  const remaining = Date.parse(isoDate) - now;

  if (remaining <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, hasArrived: true };
  }

  const totalSeconds = Math.floor(remaining / 1000);

  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    hasArrived: false,
  };
}

/** "hace 3 h", "hace 12 min": la antigüedad de los datos en lenguaje llano. */
export function formatAge(ageSeconds: number | null): string {
  if (ageSeconds === null) {
    return 'sin sincronizar';
  }
  if (ageSeconds < 60) {
    return 'hace unos segundos';
  }
  if (ageSeconds < 3600) {
    return `hace ${Math.floor(ageSeconds / 60)} min`;
  }
  if (ageSeconds < 86_400) {
    return `hace ${Math.floor(ageSeconds / 3600)} h`;
  }
  const days = Math.floor(ageSeconds / 86_400);
  return `hace ${days} ${days === 1 ? 'día' : 'días'}`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
