import { describe, expect, it } from 'vitest';
import type { LaunchDateDto } from '@slt/shared';
import { computeCountdown, formatAge, formatLaunchDate } from './launch-date.format';

const dateWith = (precision: LaunchDateDto['precision'], overrides: Partial<LaunchDateDto> = {}): LaunchDateDto => ({
  dateUtc: '2026-02-03T14:22:00.000Z',
  precision,
  isProvisional: false,
  supportsCountdown: precision === 'hour',
  ...overrides,
});

describe('formatLaunchDate', () => {
  it('muestra la hora sólo cuando la fuente la conoce', () => {
    // La hora se presenta en la zona del usuario (supuesto S7), así que el valor
    // concreto depende de dónde se ejecute el test. Fijar "14:22" lo ataría a UTC
    // y fallaría en cualquier otra máquina. Lo que se comprueba es el contrato:
    // que aparezca la hora que corresponde a esa zona.
    const localTime = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(
      new Date('2026-02-03T14:22:00.000Z'),
    );

    expect(formatLaunchDate(dateWith('hour'))).toContain(localTime);
  });

  // El núcleo del requisito: con precisión de mes, la hora del dato es relleno.
  it('no muestra hora ni día cuando la precisión es de mes', () => {
    const formatted = formatLaunchDate(dateWith('month'));

    expect(formatted).not.toMatch(/14:22/);
    expect(formatted).not.toMatch(/\b3\b/);
    expect(formatted).toContain('día por confirmar');
  });

  it('no muestra hora cuando la precisión es de día', () => {
    const formatted = formatLaunchDate(dateWith('day'));

    expect(formatted).not.toMatch(/14:22/);
    expect(formatted).toContain('hora por confirmar');
  });

  it('expresa el trimestre en vez de una fecha concreta', () => {
    expect(formatLaunchDate(dateWith('quarter'))).toBe('1T 2026 · estimado');
  });

  it('expresa el semestre', () => {
    expect(formatLaunchDate(dateWith('half'))).toBe('1S 2026 · estimado');
  });

  it('con precisión de año dice explícitamente que no hay fecha', () => {
    expect(formatLaunchDate(dateWith('year'))).toBe('2026 · sin fecha asignada');
  });

  it('antepone el carácter provisional a cualquier precisión', () => {
    expect(formatLaunchDate(dateWith('hour', { isProvisional: true }))).toMatch(/^Provisional: /);
    expect(formatLaunchDate(dateWith('year', { isProvisional: true }))).toMatch(/^Provisional: /);
  });
});

describe('computeCountdown', () => {
  const now = Date.parse('2026-02-03T12:00:00.000Z');

  it('descompone el tiempo restante', () => {
    expect(computeCountdown('2026-02-05T14:30:45.000Z', now)).toEqual({
      days: 2,
      hours: 2,
      minutes: 30,
      seconds: 45,
      hasArrived: false,
    });
  });

  it('marca como llegada una fecha ya pasada en vez de contar en negativo', () => {
    expect(computeCountdown('2026-02-01T00:00:00.000Z', now).hasArrived).toBe(true);
  });
});

describe('formatAge', () => {
  it.each([
    [null, 'sin sincronizar'],
    [30, 'hace unos segundos'],
    [900, 'hace 15 min'],
    [10_800, 'hace 3 h'],
    [86_400, 'hace 1 día'],
    [259_200, 'hace 3 días'],
  ])('describe %s segundos como "%s"', (seconds, expected) => {
    expect(formatAge(seconds)).toBe(expected);
  });
});
