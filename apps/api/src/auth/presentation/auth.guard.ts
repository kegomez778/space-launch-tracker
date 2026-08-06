import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

export const SESSION_COOKIE = 'slt_session';

export interface AuthenticatedRequest extends Request {
  userId: string;
}

/**
 * Extrae el usuario del token de sesión y lo adjunta a la petición.
 *
 * El identificador **sólo** puede venir de aquí. Ningún endpoint acepta un userId
 * en el cuerpo o la ruta, de modo que actuar en nombre de otro usuario no es un
 * caso que haya que recordar comprobar: no existe la vía.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token: unknown = request.cookies?.[SESSION_COOKIE];

    if (typeof token !== 'string' || token.length === 0) {
      throw new UnauthorizedException({ code: 'NOT_AUTHENTICATED', message: 'Necesitas iniciar sesión' });
    }

    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token);
      request.userId = payload.sub;
      return true;
    } catch {
      throw new UnauthorizedException({
        code: 'SESSION_EXPIRED',
        message: 'Tu sesión ha caducado, vuelve a iniciar sesión',
      });
    }
  }
}
