import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import type { ApiErrorDto } from '@slt/shared';
import {
  CountryNotFoundError,
  DomainError,
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  LaunchNotFoundError,
} from '../domain/domain-errors';

const STATUS_BY_ERROR = new Map<Function, HttpStatus>([
  [LaunchNotFoundError, HttpStatus.NOT_FOUND],
  [CountryNotFoundError, HttpStatus.NOT_FOUND],
  [InvalidCredentialsError, HttpStatus.UNAUTHORIZED],
  [EmailAlreadyRegisteredError, HttpStatus.CONFLICT],
]);

/**
 * Único punto donde el dominio se traduce a HTTP.
 *
 * Un fallo de un proveedor externo nunca llega aquí: la petición del usuario se
 * resuelve contra la base de datos, así que una caída de SpaceX no se convierte
 * en un 500 para alguien que sólo estaba consultando el catálogo.
 */
@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const payload = this.toPayload(exception);

    if (payload.statusCode >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    response.status(payload.statusCode).json(payload);
  }

  private toPayload(exception: unknown): ApiErrorDto {
    if (exception instanceof DomainError) {
      return {
        statusCode: STATUS_BY_ERROR.get(exception.constructor) ?? HttpStatus.BAD_REQUEST,
        code: exception.code,
        message: exception.message,
      };
    }

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      const detail = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};

      return {
        statusCode: exception.getStatus(),
        code: typeof detail.code === 'string' ? detail.code : 'HTTP_ERROR',
        message: typeof detail.message === 'string' ? detail.message : exception.message,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Se produjo un error inesperado al procesar la petición',
    };
  }
}
