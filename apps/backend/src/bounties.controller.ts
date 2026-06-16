import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import {
  getAuthenticatedAddressTracker,
  getAuthRateLimitTtl,
  getBountyCreateRateLimit,
} from './auth/auth-rate-limit.config';
import { BountiesService } from './bounties.service';
import { BountyResponseDto, CreateBountyDto, UpdateBountyDto } from './bounties/dto/bounty.dto';

@ApiTags('bounties')
@Controller('bounties')
export class BountiesController {
  constructor(private readonly bountiesService: BountiesService) {}

  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a new bounty' })
  @ApiCreatedResponse({ description: 'Bounty created.', type: BountyResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid bounty payload.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @UseGuards(JwtAuthGuard)
  @Throttle({
    default: {
      limit: getBountyCreateRateLimit,
      ttl: getAuthRateLimitTtl,
      getTracker: getAuthenticatedAddressTracker,
    },
  })
  @Post()
  create(@Body() dto: CreateBountyDto) {
    return this.bountiesService.create(dto);
  }

  @ApiOperation({ summary: 'List all bounties' })
  @ApiOkResponse({ description: 'Bounties ordered newest first.', type: [BountyResponseDto] })
  @Get()
  findAll() {
    return this.bountiesService.findAll();
  }

  @ApiOperation({ summary: 'Get a single bounty by ID' })
  @ApiParam({ name: 'id', description: 'Bounty UUID' })
  @ApiOkResponse({ description: 'Requested bounty.', type: BountyResponseDto })
  @ApiNotFoundResponse({ description: 'Bounty not found.' })
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
  @Throttle({
    default: {
      limit: getBountyCreateRateLimit,
      ttl: getAuthRateLimitTtl,
      getTracker: getAuthenticatedAddressTracker,
    },
  })
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
  @Throttle({
    default: {
      limit: getBountyCreateRateLimit,
      ttl: getAuthRateLimitTtl,
      getTracker: getAuthenticatedAddressTracker,
    },
  })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.bountiesService.remove(id);
  }
}
