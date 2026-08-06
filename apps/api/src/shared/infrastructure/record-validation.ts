import type { ZodType } from 'zod';

export interface RejectedRecord {
  readonly index: number;
  readonly identifier: string | null;
  readonly reason: string;
}

export interface ValidationOutcome<T> {
  readonly valid: readonly T[];
  readonly rejected: readonly RejectedRecord[];
}

/**
 * Valida una colección externa **registro a registro**.
 *
 * Validar el lote entero de una vez sería más corto, pero significaría que un
 * único lanzamiento malformado en la fuente impide sincronizar los otros
 * doscientos. Aquí un registro inválido se descarta, se cuenta y se reporta,
 * mientras el resto entra con normalidad.
 */
export function validateEach<T>(schema: ZodType<T>, records: readonly unknown[]): ValidationOutcome<T> {
  const valid: T[] = [];
  const rejected: RejectedRecord[] = [];

  records.forEach((record, index) => {
    const result = schema.safeParse(record);
    if (result.success) {
      valid.push(result.data);
      return;
    }

    rejected.push({
      index,
      identifier: extractIdentifier(record),
      reason: result.error.issues
        .slice(0, 3)
        .map((issue) => `${issue.path.join('.') || '(raíz)'}: ${issue.message}`)
        .join('; '),
    });
  });

  return { valid, rejected };
}

function extractIdentifier(record: unknown): string | null {
  if (typeof record === 'object' && record !== null && 'id' in record) {
    const { id } = record as { id: unknown };
    return typeof id === 'string' ? id : null;
  }
  return null;
}
