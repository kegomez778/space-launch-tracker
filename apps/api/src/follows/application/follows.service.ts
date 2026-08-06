import { Injectable } from '@nestjs/common';
import type { FollowedLaunchDto } from '@slt/shared';
import { LaunchNotFoundError } from '../../shared/domain/domain-errors';
import { PrismaService } from '../../shared/infrastructure/prisma.service';
import { toLaunchSummary, type LaunchRow } from '../../launches/application/launch-dto.mapper';

const LAUNCH_SELECT = {
  id: true,
  flightNumber: true,
  name: true,
  dateUtc: true,
  datePrecision: true,
  isProvisional: true,
  success: true,
  sourceUpcoming: true,
  patchSmall: true,
  rocket: { select: { id: true, name: true, type: true } },
  launchpad: {
    select: { countryCode: true, country: { select: { code: true, name: true, flagSvg: true, flagAlt: true } } },
  },
} as const;

@Injectable()
export class FollowsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ordena por proximidad real: primero lo que aún va a ocurrir, de lo más cercano
   * a lo más lejano, y después lo ya lanzado de lo más reciente hacia atrás. Es el
   * orden que responde a la pregunta con la que el usuario entra: "¿qué es lo
   * siguiente?".
   */
  async listForUser(userId: string): Promise<readonly FollowedLaunchDto[]> {
    const now = new Date();
    const follows = await this.prisma.follow.findMany({
      where: { userId },
      select: { followedAt: true, launch: { select: LAUNCH_SELECT } },
    });

    const followed = follows.map((follow) => ({
      ...toLaunchSummary(follow.launch as LaunchRow, now),
      followedAt: follow.followedAt.toISOString(),
    }));

    return followed.sort((a, b) => {
      if (a.timing !== b.timing) {
        return a.timing === 'upcoming' ? -1 : 1;
      }
      const direction = a.timing === 'upcoming' ? 1 : -1;
      return direction * (Date.parse(a.date.dateUtc) - Date.parse(b.date.dateUtc));
    });
  }

  /** Idempotente: seguir dos veces deja el mismo estado que seguir una. */
  async follow(userId: string, launchId: string): Promise<void> {
    if ((await this.prisma.launch.count({ where: { id: launchId } })) === 0) {
      throw new LaunchNotFoundError(launchId);
    }

    await this.prisma.follow.upsert({
      where: { userId_launchId: { userId, launchId } },
      create: { userId, launchId },
      update: {},
    });
  }

  /** Idempotente: dejar de seguir algo que no se seguía no es un error. */
  async unfollow(userId: string, launchId: string): Promise<void> {
    await this.prisma.follow.deleteMany({ where: { userId, launchId } });
  }

  async followedIds(userId: string): Promise<readonly string[]> {
    const follows = await this.prisma.follow.findMany({ where: { userId }, select: { launchId: true } });
    return follows.map((follow) => follow.launchId);
  }
}
