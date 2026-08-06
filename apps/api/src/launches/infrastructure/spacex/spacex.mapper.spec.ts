import { describe, expect, it } from 'vitest';
import { validateEach } from '../../../shared/infrastructure/record-validation';
import { toCatalogLaunch, toCatalogPayload, toCatalogRocket } from './spacex.mapper';
import { spaceXLaunchSchema, spaceXPayloadSchema } from './spacex.schemas';

const baseLaunch = {
  id: 'l1',
  flight_number: 42,
  name: 'Starlink 6-1',
  date_utc: '2026-09-01T10:00:00.000Z',
  date_precision: 'hour',
  upcoming: true,
  success: null,
  rocket: 'r1',
  launchpad: 'p1',
};

describe('toCatalogLaunch', () => {
  it('conserva la precisión de fecha tal cual la entrega la fuente', () => {
    const launch = toCatalogLaunch({ ...baseLaunch, date_precision: 'month' } as never);

    expect(launch.datePrecision).toBe('month');
    expect(launch.dateUtc.toISOString()).toBe('2026-09-01T10:00:00.000Z');
  });

  it('mantiene success en null mientras no ha volado, sin convertirlo en fallo', () => {
    expect(toCatalogLaunch(baseLaunch as never).success).toBe(null);
  });

  it.each([
    ['tbd', { tbd: true, net: false }],
    ['net', { tbd: false, net: true }],
  ])('marca la fecha como provisional cuando la fuente activa %s', (_label, flags) => {
    expect(toCatalogLaunch({ ...baseLaunch, ...flags } as never).isProvisional).toBe(true);
  });

  it('extrae el primer motivo de fallo útil e ignora las entradas sin motivo', () => {
    const launch = toCatalogLaunch({
      ...baseLaunch,
      success: false,
      failures: [
        { time: 33, altitude: null, reason: null },
        { time: 139, altitude: null, reason: 'merlin engine failure' },
      ],
    } as never);

    expect(launch.failureReason).toBe('merlin engine failure');
  });

  it('normaliza a null las cadenas vacías que la fuente usa como hueco', () => {
    const launch = toCatalogLaunch({
      ...baseLaunch,
      details: '   ',
      links: { patch: { small: '', large: null }, webcast: 'https://youtu.be/x' },
    } as never);

    expect(launch.details).toBe(null);
    expect(launch.patchSmall).toBe(null);
    expect(launch.webcast).toBe('https://youtu.be/x');
  });

  it('sobrevive a un lanzamiento sin enlaces ni cohete ni sitio', () => {
    const launch = toCatalogLaunch({ ...baseLaunch, rocket: null, launchpad: null, links: null } as never);

    expect(launch.rocketId).toBe(null);
    expect(launch.launchpadId).toBe(null);
    expect(launch.patchLarge).toBe(null);
  });

  it('conserva el flag original de la fuente para poder auditarlo después', () => {
    expect(toCatalogLaunch({ ...baseLaunch, upcoming: true } as never).sourceUpcoming).toBe(true);
  });
});

describe('toCatalogPayload', () => {
  it('descarta cargas sin lanzamiento en vez de dejar una referencia rota', () => {
    expect(toCatalogPayload({ id: 'pl1', launch: null } as never)).toBe(null);
  });

  it('limpia espacios y descarta entradas vacías de las listas de texto libre', () => {
    const payload = toCatalogPayload({
      id: 'pl1',
      launch: 'l1',
      name: 'Starlink',
      nationalities: ['  United States ', '', '   ', 'Germany'],
      customers: ['SpaceX'],
    } as never);

    expect(payload?.nationalities).toEqual(['United States', 'Germany']);
    expect(payload?.customers).toEqual(['SpaceX']);
  });

  it('usa el identificador como nombre cuando la fuente no lo trae', () => {
    expect(toCatalogPayload({ id: 'pl9', launch: 'l1', name: null } as never)?.name).toBe('pl9');
  });
});

describe('validación registro a registro', () => {
  // Un lanzamiento corrupto en la fuente no puede impedir sincronizar los demás.
  it('deja pasar los registros válidos y aísla los inválidos', () => {
    const outcome = validateEach(spaceXLaunchSchema, [
      baseLaunch,
      { id: 'roto', flight_number: 'cuarenta y dos' },
      { ...baseLaunch, id: 'l2' },
    ]);

    expect(outcome.valid).toHaveLength(2);
    expect(outcome.rejected).toHaveLength(1);
    expect(outcome.rejected[0]?.identifier).toBe('roto');
  });

  it('explica el motivo del rechazo señalando el campo concreto', () => {
    const outcome = validateEach(spaceXLaunchSchema, [{ ...baseLaunch, date_precision: 'decade' }]);

    expect(outcome.rejected[0]?.reason).toContain('date_precision');
  });

  it('rechaza una precisión de fecha desconocida en lugar de asumir una', () => {
    expect(spaceXLaunchSchema.safeParse({ ...baseLaunch, date_precision: 'fortnight' }).success).toBe(false);
  });

  it('acepta una carga con todos los campos opcionales ausentes', () => {
    expect(spaceXPayloadSchema.safeParse({ id: 'pl1' }).success).toBe(true);
  });
});
