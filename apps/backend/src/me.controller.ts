import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BountiesService } from '../bounties/bounties.service';
import { SubmissionsService } from '../submissions/submissions.service';

@Controller('api/v1/me')
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(
    private readonly bountiesService: BountiesService,
    private readonly submissionsService: SubmissionsService,
  ) {}

  @Get('submissions')
  async getMySubmissions(@Req() req) {
    const userId = req.user.id || req.user.publicKey; // adjust based on your JWT payload
    return this.submissionsService.findByContributor(userId);
  }

  @Get('bounties')
  async getMyBounties(@Req() req) {
    const userId = req.user.id || req.user.publicKey;
    return this.bountiesService.findByOwner(userId);
  }
}
