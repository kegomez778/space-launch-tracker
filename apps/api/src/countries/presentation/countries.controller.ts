import { Controller, Get, Param } from '@nestjs/common';
import type { CountryDetailDto, CountryListItemDto, DataQualityDto, LaunchSummaryDto } from '@slt/shared';
import { CountriesService } from '../application/countries.service';

@Controller()
export class CountriesController {
  constructor(private readonly countries: CountriesService) {}

  @Get('countries')
  list(): Promise<readonly CountryListItemDto[]> {
    return this.countries.list();
  }

  @Get('countries/:code')
  detail(@Param('code') code: string): Promise<CountryDetailDto> {
    return this.countries.findByCode(code);
  }

  @Get('countries/:code/launches')
  async launches(@Param('code') code: string): Promise<{
    fromSoil: readonly LaunchSummaryDto[];
    withPayload: readonly LaunchSummaryDto[];
  }> {
    const [fromSoil, withPayload] = await Promise.all([
      this.countries.launchesForCountry(code, 'site'),
      this.countries.launchesForCountry(code, 'payload'),
    ]);

    return { fromSoil, withPayload };
  }

  @Get('data-quality')
  dataQuality(): Promise<DataQualityDto> {
    return this.countries.dataQuality();
  }
}
