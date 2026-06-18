import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';
import { HealthResponseDto } from './dto/health.dto';

@ApiTags('v1: health')
@Controller('api/v1/health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @ApiOperation({ summary: 'Service health check' })
  @Get()
  getHealth(): Promise<HealthResponseDto> {
    return this.healthService.getHealth();
  }
}
