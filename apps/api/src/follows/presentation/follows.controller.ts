import { Controller, Delete, Get, HttpCode, Param, Put, Req, UseGuards } from '@nestjs/common';
import type { FollowedLaunchDto } from '@slt/shared';
import { AuthGuard, type AuthenticatedRequest } from '../../auth/presentation/auth.guard';
import { FollowsService } from '../application/follows.service';

/**
 * Ninguna ruta acepta un identificador de usuario: siempre se toma del token. Por
 * eso no hay comprobación de propiedad que se pueda olvidar en un endpoint nuevo.
 *
 * PUT y DELETE en lugar de POST porque la operación es idempotente: pulsar dos
 * veces el botón de seguir no puede dejar un estado distinto.
 */
@UseGuards(AuthGuard)
@Controller('follows')
export class FollowsController {
  constructor(private readonly follows: FollowsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest): Promise<readonly FollowedLaunchDto[]> {
    return this.follows.listForUser(request.userId);
  }

  @Get('ids')
  ids(@Req() request: AuthenticatedRequest): Promise<readonly string[]> {
    return this.follows.followedIds(request.userId);
  }

  @Put(':launchId')
  @HttpCode(204)
  follow(@Req() request: AuthenticatedRequest, @Param('launchId') launchId: string): Promise<void> {
    return this.follows.follow(request.userId, launchId);
  }

  @Delete(':launchId')
  @HttpCode(204)
  unfollow(@Req() request: AuthenticatedRequest, @Param('launchId') launchId: string): Promise<void> {
    return this.follows.unfollow(request.userId, launchId);
  }
}
