import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

/**
 * Valida y normaliza la entrada en el borde con Zod, en lugar de arrastrar
 * class-validator sólo para esto. El error resultante nombra el campo concreto:
 * "page: debe ser mayor o igual a 1", no "Bad Request".
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw new BadRequestException({
        code: 'INVALID_INPUT',
        message: result.error.issues
          .map((issue) => `${issue.path.join('.') || '(raíz)'}: ${issue.message}`)
          .join('; '),
      });
    }

    return result.data;
  }
}
