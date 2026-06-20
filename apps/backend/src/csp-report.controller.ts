import { Body, Controller, HttpCode, Logger, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('security')
@Controller('csp-report')
export class CspReportController {
  private readonly logger = new Logger(CspReportController.name);

  @Post()
  @HttpCode(204)
  @ApiOperation({ summary: 'Accept Content-Security-Policy violation reports' })
  report(@Body() body: unknown): void {
    this.logger.warn(`CSP violation report received: ${JSON.stringify(body)}`);
  }
}
