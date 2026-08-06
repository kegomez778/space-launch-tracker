import { Controller, Get, Param, Query } from '@nestjs/common';
import type { LaunchDetailDto, LaunchSummaryDto, PaginatedDto } from '@slt/shared';
import { ZodValidationPipe } from '../../shared/presentation/zod-validation.pipe';
import { LaunchesService } from '../application/launches.service';
import { launchQuerySchema, type LaunchQuery } from './launch-query.schema';

@Controller('launches')
export class LaunchesController {
  constructor(private readonly launches: LaunchesService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(launchQuerySchema)) query: LaunchQuery,
  ): Promise<PaginatedDto<LaunchSummaryDto>> {
    return this.launches.findPaginated(query);
  }

  @Get(':id')
  detail(@Param('id') id: string): Promise<LaunchDetailDto> {
    return this.launches.findById(id);
  }
}
