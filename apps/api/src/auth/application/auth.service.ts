import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from '@node-rs/argon2';
import type { AuthUserDto } from '@slt/shared';
import { EmailAlreadyRegisteredError, InvalidCredentialsError } from '../../shared/domain/domain-errors';
import { normalizeText } from '../../shared/domain/text-normalization';
import { PrismaService } from '../../shared/infrastructure/prisma.service';

export interface Credentials {
  readonly email: string;
  readonly password: string;
  readonly countryCode?: string | undefined;
}

const USER_SELECT = {
  id: true,
  email: true,
  country: { select: { code: true, name: true, flagSvg: true, flagAlt: true } },
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(credentials: Credentials): Promise<{ user: AuthUserDto; token: string }> {
    const emailNormalized = normalizeText(credentials.email);

    if ((await this.prisma.user.count({ where: { emailNormalized } })) > 0) {
      throw new EmailAlreadyRegisteredError();
    }

    const user = await this.prisma.user.create({
      data: {
        email: credentials.email.trim(),
        emailNormalized,
        passwordHash: await hash(credentials.password),
        countryCode: credentials.countryCode ?? null,
      },
      select: USER_SELECT,
    });

    return { user: toAuthUser(user), token: await this.signToken(user.id) };
  }

  async login(credentials: Credentials): Promise<{ user: AuthUserDto; token: string }> {
    const user = await this.prisma.user.findUnique({
      where: { emailNormalized: normalizeText(credentials.email) },
      select: { ...USER_SELECT, passwordHash: true },
    });

    // Se comprueba la contraseña incluso sin usuario, contra un hash de descarte,
    // para que el tiempo de respuesta no delate qué emails existen.
    const passwordHash = user?.passwordHash ?? (await decoyHash());
    const isValid = await verify(passwordHash, credentials.password).catch(() => false);

    if (user === null || !isValid) {
      throw new InvalidCredentialsError();
    }

    return { user: toAuthUser(user), token: await this.signToken(user.id) };
  }

  async findById(userId: string): Promise<AuthUserDto | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: USER_SELECT });
    return user === null ? null : toAuthUser(user);
  }

  private signToken(userId: string): Promise<string> {
    return this.jwt.signAsync({ sub: userId });
  }
}

/**
 * Hash de una contraseña arbitraria, calculado una sola vez y reutilizado.
 *
 * Tiene que ser un hash **real**: si fuese una cadena inventada, `verify` fallaría
 * de inmediato y el login de un email inexistente respondería mucho más rápido que
 * el de uno existente, que es precisamente la fuga que esto viene a tapar.
 */
let decoyHashPromise: Promise<string> | null = null;

function decoyHash(): Promise<string> {
  decoyHashPromise ??= hash('contrasena-de-descarte-para-igualar-tiempos');
  return decoyHashPromise;
}

function toAuthUser(user: { id: string; email: string; country: AuthUserDto['country'] }): AuthUserDto {
  return { id: user.id, email: user.email, country: user.country };
}
