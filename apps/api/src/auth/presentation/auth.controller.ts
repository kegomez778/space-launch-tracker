import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { z } from 'zod';
import type { AuthUserDto } from '@slt/shared';
import { ZodValidationPipe } from '../../shared/presentation/zod-validation.pipe';
import { AuthService } from '../application/auth.service';
import { AuthGuard, SESSION_COOKIE, type AuthenticatedRequest } from './auth.guard';

const credentialsSchema = z.object({
  email: z.email('debe ser un email válido'),
  password: z.string().min(8, 'debe tener al menos 8 caracteres'),
  countryCode: z.string().trim().length(2).toUpperCase().optional(),
});

type CredentialsInput = z.infer<typeof credentialsSchema>;

const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  // Registro y login son los dos endpoints que un atacante puede repetir a
  // voluntad, así que llevan su propio límite más estricto que el global.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  async register(
    @Body(new ZodValidationPipe(credentialsSchema)) body: CredentialsInput,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthUserDto> {
    const { user, token } = await this.auth.register(body);
    this.setSessionCookie(response, token);
    return user;
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(credentialsSchema)) body: CredentialsInput,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthUserDto> {
    const { user, token } = await this.auth.login(body);
    this.setSessionCookie(response, token);
    return user;
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) response: Response): void {
    response.clearCookie(SESSION_COOKIE, this.cookieOptions());
  }

  @UseGuards(AuthGuard)
  @Get('me')
  async me(@Req() request: AuthenticatedRequest): Promise<AuthUserDto | null> {
    return this.auth.findById(request.userId);
  }

  private setSessionCookie(response: Response, token: string): void {
    response.cookie(SESSION_COOKIE, token, { ...this.cookieOptions(), maxAge: SESSION_MAX_AGE_MS });
  }

  /**
   * `httpOnly` deja el token fuera del alcance de cualquier script, y `sameSite`
   * lax basta como defensa CSRF porque frontend y API comparten origen a través
   * del proxy (ADR-004): no hay peticiones entre sitios que proteger.
   */
  private cookieOptions() {
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: this.config.get<string>('NODE_ENV') === 'production',
      path: '/',
    };
  }
}
