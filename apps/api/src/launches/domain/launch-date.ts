import { DATE_PRECISIONS, type DatePrecision } from '@slt/shared';

/**
 * Fecha de lanzamiento con su grado de certeza.
 *
 * La SpaceX API entrega siempre un `date_utc` completo, pero acompañado de una
 * precisión que puede ser tan gruesa como el año. Con precisión `month`, esa hora
 * concreta es relleno: mostrarla sería inventar información que la fuente no tiene.
 *
 * Por eso instante y precisión no se separan nunca. Cualquier consumidor que
 * quiera la fecha recibe también su certeza, y no puede formatearla sin ella.
 */
export class LaunchDate {
  private constructor(
    readonly utc: Date,
    readonly precision: DatePrecision,
    readonly isProvisional: boolean,
  ) {}

  static create(utc: Date, precision: DatePrecision, isProvisional: boolean): LaunchDate {
    if (Number.isNaN(utc.getTime())) {
      throw new RangeError('LaunchDate requiere una fecha válida');
    }
    return new LaunchDate(utc, precision, isProvisional);
  }

  static isDatePrecision(value: string): value is DatePrecision {
    return (DATE_PRECISIONS as readonly string[]).includes(value);
  }

  /**
   * Solo una fecha con hora conocida y no provisional admite cuenta atrás. Contar
   * los segundos hacia un instante que la fuente sitúa en "algún momento de 2026"
   * daría al usuario una precisión que no existe.
   */
  get supportsCountdown(): boolean {
    return this.precision === 'hour' && !this.isProvisional;
  }

  isBefore(reference: Date): boolean {
    return this.utc.getTime() < reference.getTime();
  }
}
