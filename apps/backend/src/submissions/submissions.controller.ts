import { Body, Controller, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateSubmissionDto, SubmissionResponseDto } from './submissions.dto';
import { SubmissionsService } from './submissions.service';

@ApiTags('v1: submissions')
@Controller('api/v1/bounties/:bountyId/submissions')
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Submit work for a bounty' })
  @ApiParam({ name: 'bountyId', description: 'Bounty UUID that receives the submission' })
  @ApiCreatedResponse({ description: 'Submission created.', type: SubmissionResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid submission payload.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiNotFoundResponse({ description: 'Bounty not found.' })
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post()
  create(
    @Param('bountyId') bountyId: string,
    @Body() dto: CreateSubmissionDto,
    @Request() req: { user: { address: string } },
  ) {
    return this.submissionsService.create(bountyId, dto, req.user.address);
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List all submissions for a bounty (owner only)' })
  @ApiParam({ name: 'bountyId', description: 'Bounty UUID whose submissions should be listed' })
  @ApiOkResponse({ description: 'Submissions for this bounty.', type: [SubmissionResponseDto] })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'Only the bounty owner can list submissions.' })
  @ApiNotFoundResponse({ description: 'Bounty not found.' })
  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(
    @Param('bountyId') bountyId: string,
    @Request() req: { user: { address: string } },
  ) {
    return this.submissionsService.findAll(bountyId, req.user.address);
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Approve a submission and release payment' })
  @ApiParam({ name: 'bountyId', description: 'Bounty UUID that owns the submission' })
  @ApiParam({ name: 'subId', description: 'Submission UUID to approve' })
  @ApiOkResponse({ description: 'Approved submission.', type: SubmissionResponseDto })
  @ApiBadRequestResponse({ description: 'A submission is already approved for this bounty.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'Only the bounty owner can approve submissions.' })
  @ApiNotFoundResponse({ description: 'Bounty or submission not found.' })
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Patch(':subId/approve')
  approve(
    @Param('bountyId') bountyId: string,
    @Param('subId') subId: string,
    @Request() req: { user: { address: string } },
  ) {
    return this.submissionsService.approve(bountyId, subId, req.user.address);
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Reject a submission' })
  @ApiParam({ name: 'bountyId', description: 'Bounty UUID that owns the submission' })
  @ApiParam({ name: 'subId', description: 'Submission UUID to reject' })
  @ApiOkResponse({ description: 'Rejected submission.', type: SubmissionResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'Only the bounty owner can reject submissions.' })
  @ApiNotFoundResponse({ description: 'Bounty or submission not found.' })
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Patch(':subId/reject')
  reject(
    @Param('bountyId') bountyId: string,
    @Param('subId') subId: string,
    @Request() req: { user: { address: string } },
  ) {
    return this.submissionsService.reject(bountyId, subId, req.user.address);
  }
}
