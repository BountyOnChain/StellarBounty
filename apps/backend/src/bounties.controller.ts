import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { BountiesService } from './bounties.service';
import { BountyResponseDto, CreateBountyDto, UpdateBountyDto } from './bounties/dto/bounty.dto';
import { PaginationQueryDto, PaginatedResponse } from './common/pagination.dto';
import { Bounty } from './entities/bounty.entity';

@ApiTags('v1: bounties')
@Controller('api/v1/bounties')
export class BountiesController {
  constructor(private readonly bountiesService: BountiesService) {}

  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a new bounty' })
  @ApiCreatedResponse({ description: 'Bounty created.', type: BountyResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid bounty payload.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post()
  create(@Body() dto: CreateBountyDto) {
    return this.bountiesService.create(dto);
  }

  @ApiOperation({ summary: 'List all bounties (paginated, newest first)' })
  @ApiOkResponse({
    description: 'Paginated list of bounties with metadata.',
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { $ref: '#/components/schemas/BountyResponseDto' } },
        total: { type: 'integer', example: 123 },
        page: { type: 'integer', example: 1 },
        pageSize: { type: 'integer', example: 20 },
        totalPages: { type: 'integer', example: 7 },
      },
    },
  })
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Get()
  findAll(@Query() pagination: PaginationQueryDto): Promise<PaginatedResponse<Bounty>> {
    return this.bountiesService.findAll(pagination);
  }

  @ApiOperation({ summary: 'Get a single bounty by ID' })
  @ApiParam({ name: 'id', description: 'Bounty UUID' })
  @ApiOkResponse({ description: 'Requested bounty.', type: BountyResponseDto })
  @ApiNotFoundResponse({ description: 'Bounty not found.' })
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bountiesService.findOne(id);
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a bounty' })
  @ApiParam({ name: 'id', description: 'Bounty UUID' })
  @ApiOkResponse({ description: 'Updated bounty.', type: BountyResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid bounty update payload.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiNotFoundResponse({ description: 'Bounty not found.' })
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBountyDto) {
    return this.bountiesService.update(id, dto);
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a bounty' })
  @ApiParam({ name: 'id', description: 'Bounty UUID' })
  @ApiOkResponse({ description: 'Deletion confirmation.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiNotFoundResponse({ description: 'Bounty not found.' })
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.bountiesService.remove(id);
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Restore a soft-deleted bounty' })
  @ApiParam({ name: 'id', description: 'Bounty UUID' })
  @ApiOkResponse({ description: 'Restored bounty.', type: BountyResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiNotFoundResponse({ description: 'Bounty not found.' })
  @UseGuards(JwtAuthGuard)
  @Patch(':id/restore')
  restore(@Param('id') id: string) {
    return this.bountiesService.restore(id);
  }
}
