import { describe, expect, it } from 'vitest';
import { LaunchDate } from './launch-date';
import { deriveLaunchStatus } from './launch-status';

const NOW = new Date('2026-06-15T12:00:00Z');

const dateAt = (iso: string) => LaunchDate.create(new Date(iso), 'hour', false);

describe('deriveLaunchStatus', () => {
  it('clasifica como próximo un lanzamiento con fecha futura y sin resultado', () => {
    const status = deriveLaunchStatus(
      { date: dateAt('2026-09-01T10:00:00Z'), success: null, sourceUpcoming: true },
      NOW,
    );

    expect(status).toEqual({
      timing: 'upcoming',
      outcome: 'pending',
      hasContradictorySourceFlag: false,
    });
  });

  it('clasifica como lanzado un vuelo pasado con resultado', () => {
    const status = deriveLaunchStatus(
      { date: dateAt('2026-01-10T10:00:00Z'), success: true, sourceUpcoming: false },
      NOW,
    );

    expect(status.timing).toBe('launched');
    expect(status.outcome).toBe('success');
    expect(status.hasContradictorySourceFlag).toBe(false);
  });

  // Riesgo R3: la fuente arrastra lanzamientos marcados como próximos cuya fecha
  // ya pasó. Si el flag mandara, la vista de "próximos" se llenaría de pasado.
  it('ignora el flag de la fuente cuando contradice a la fecha, y lo marca', () => {
    const status = deriveLaunchStatus(
      { date: dateAt('2025-03-01T10:00:00Z'), success: null, sourceUpcoming: true },
      NOW,
    );

    expect(status.timing).toBe('launched');
    expect(status.hasContradictorySourceFlag).toBe(true);
  });

  it('marca también la contradicción inversa: fecha futura con flag de pasado', () => {
    const status = deriveLaunchStatus(
      { date: dateAt('2027-03-01T10:00:00Z'), success: null, sourceUpcoming: false },
      NOW,
    );

    expect(status.timing).toBe('upcoming');
    expect(status.hasContradictorySourceFlag).toBe(true);
  });

  it('distingue un resultado pendiente de un fallo', () => {
    const pending = deriveLaunchStatus(
      { date: dateAt('2026-09-01T10:00:00Z'), success: null, sourceUpcoming: true },
      NOW,
    );
    const failed = deriveLaunchStatus(
      { date: dateAt('2026-01-01T10:00:00Z'), success: false, sourceUpcoming: false },
      NOW,
    );

    expect(pending.outcome).toBe('pending');
    expect(failed.outcome).toBe('failure');
  });
});
