import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SavedBountiesService } from './saved-bounties.service';

@ApiTags('v1: saved bounties')
@Controller('me/saved-bounties')
export class SavedBountiesController {
  constructor(private readonly savedBountiesService: SavedBountiesService) {}

  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List all saved bounties for the authenticated user' })
  @ApiOkResponse({ description: 'Saved bounties list.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Request() req: { user: { address: string } }) {
    return this.savedBountiesService.findAll(req.user.address);
  }
}