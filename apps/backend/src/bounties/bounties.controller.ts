import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { BountiesService } from './bounties.service';
import { CreateBountyDto, BountyResponseDto } from './dto/create-bounty.dto';
import { UpdateBountyDto } from './dto/update-bounty.dto';
import { PaginationDto } from './dto/pagination.dto';

@ApiTags('bounties')
@Controller('bounties')
export class BountiesController {
  constructor(private readonly bountiesService: BountiesService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a new bounty' })
  @ApiResponse({ status: 201, description: 'Bounty created', type: BountyResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  create(
    @Body() dto: CreateBountyDto,
    @Req() req: { user: { wallet: string } },
  ): BountyResponseDto {
    return this.bountiesService.create(dto, req.user.wallet);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all bounties (paginated)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({
    status: 200,
    description: 'Paginated bounty list',
    schema: {
      example: {
        data: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      },
    },
  })
  findAll(@Query() query: PaginationDto) {
    return this.bountiesService.findAll(query.page, query.limit);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a bounty by ID' })
  @ApiParam({ name: 'id', description: 'Bounty ID' })
  @ApiResponse({ status: 200, description: 'Bounty found', type: BountyResponseDto })
  @ApiResponse({ status: 404, description: 'Bounty not found' })
  findOne(@Param('id') id: string): BountyResponseDto {
    return this.bountiesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a bounty (owner only)' })
  @ApiParam({ name: 'id', description: 'Bounty ID' })
  @ApiResponse({ status: 200, description: 'Bounty updated', type: BountyResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Only owner can update' })
  @ApiResponse({ status: 404, description: 'Bounty not found' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBountyDto,
    @Req() req: { user: { wallet: string } },
  ): BountyResponseDto {
    return this.bountiesService.update(id, dto, req.user.wallet);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Cancel / soft-delete a bounty (owner only)' })
  @ApiParam({ name: 'id', description: 'Bounty ID' })
  @ApiResponse({ status: 200, description: 'Bounty cancelled', schema: { example: { success: true } } })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Only owner can cancel' })
  @ApiResponse({ status: 404, description: 'Bounty not found' })
  remove(
    @Param('id') id: string,
    @Req() req: { user: { wallet: string } },
  ): { success: boolean } {
    return this.bountiesService.remove(id, req.user.wallet);
  }
}
