import type { LaunchOutcome, LaunchTiming } from '@slt/shared';
import type { LaunchDate } from './launch-date';

export interface LaunchStatus {
  readonly timing: LaunchTiming;
  readonly outcome: LaunchOutcome;
  /**
   * El flag `upcoming` de la fuente contradice su propia fecha. No se corrige en
   * silencio: se marca para poder contarlo y mostrarlo (riesgo R3).
   */
  readonly hasContradictorySourceFlag: boolean;
}

interface LaunchStatusInput {
  readonly date: LaunchDate;
  readonly success: boolean | null;
  readonly sourceUpcoming: boolean;
}

/**
 * El estado se deriva de la fecha, no se hereda del flag `upcoming` de la fuente.
 *
 * La SpaceX API v4 está en mantenimiento y su dataset arrastra lanzamientos
 * marcados como próximos cuya fecha ya pasó. Confiar en el flag llenaría de
 * pasado la vista de "próximos lanzamientos", que es justo lo que el usuario
 * viene a consultar.
 */
export function deriveLaunchStatus(input: LaunchStatusInput, now: Date): LaunchStatus {
  const hasFlown = input.date.isBefore(now);
  const timing: LaunchTiming = hasFlown ? 'launched' : 'upcoming';

  const outcome: LaunchOutcome =
    input.success === null ? 'pending' : input.success ? 'success' : 'failure';

  return {
    timing,
    outcome,
    hasContradictorySourceFlag: input.sourceUpcoming === hasFlown,
  };
}
