import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { SubmissionsService } from './submissions.service';
import {
  CreateSubmissionDto,
  SubmissionResponseDto,
} from './dto/create-submission.dto';
import {
  UpdateSubmissionStatusDto,
  ApproveSubmissionResponseDto,
} from './dto/update-submission-status.dto';

@ApiTags('submissions')
@ApiBearerAuth('access-token')
@Controller('bounties/:id/submissions')
@UseGuards(AuthGuard('jwt'))
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({
    summary: 'Submit work for a bounty',
    description:
      'Create a new submission for a bounty. Requires JWT authentication. One submission per user per bounty.',
  })
  @ApiParam({
    name: 'id',
    description: 'Bounty ID',
    example: 'clx4f8a2s0000aabb12345678',
  })
  @ApiResponse({
    status: 201,
    description: 'Submission created successfully',
    type: SubmissionResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Already submitted to this bounty' })
  create(
    @Param('id') bountyId: string,
    @Req() req: { user: { wallet: string } },
    @Body() dto: CreateSubmissionDto,
  ): SubmissionResponseDto {
    const submission = this.submissionsService.create(
      bountyId,
      req.user.wallet,
      dto,
    );
    return this.mapToResponse(submission);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List submissions for a bounty',
    description:
      'Get all submissions for a bounty. Only the bounty owner can view submissions.',
  })
  @ApiParam({
    name: 'id',
    description: 'Bounty ID',
  })
  @ApiResponse({
    status: 200,
    description: 'List of submissions',
    type: [SubmissionResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Only the bounty owner can view submissions' })
  findAll(
    @Param('id') bountyId: string,
    @Req() req: { user: { wallet: string } },
  ): SubmissionResponseDto[] {
    const submissions = this.submissionsService.findByBountyId(
      bountyId,
      req.user.wallet,
    );
    return submissions.map(this.mapToResponse);
  }

  @Patch(':subId/approve')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({
    summary: 'Approve a submission and release payout',
    description:
      'Approve a pending submission. Only the bounty owner can approve. Triggers the Soroban contract `release` function to transfer funds. Only one approval allowed per bounty.',
  })
  @ApiParam({ name: 'id', description: 'Bounty ID' })
  @ApiParam({ name: 'subId', description: 'Submission ID' })
  @ApiResponse({
    status: 200,
    description: 'Submission approved, payout released',
    type: ApproveSubmissionResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Submission not found' })
  @ApiResponse({ status: 409, description: 'Already approved or rejected' })
  async approve(
    @Param('id') bountyId: string,
    @Param('subId') submissionId: string,
    @Req() req: { user: { wallet: string } },
  ): Promise<ApproveSubmissionResponseDto> {
    const result = await this.submissionsService.approve(
      submissionId,
      bountyId,
      req.user.wallet,
    );
    return {
      submissionId,
      status: 'approved',
      txHash: result.txHash,
      processedAt: new Date().toISOString(),
    };
  }

  @Patch(':subId/reject')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({
    summary: 'Reject a submission',
    description:
      'Reject a pending submission. Only the bounty owner can reject.',
  })
  @ApiParam({ name: 'id', description: 'Bounty ID' })
  @ApiParam({ name: 'subId', description: 'Submission ID' })
  @ApiResponse({
    status: 200,
    description: 'Submission rejected',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Submission not found' })
  reject(
    @Param('id') bountyId: string,
    @Param('subId') submissionId: string,
    @Req() req: { user: { wallet: string } },
  ): { submissionId: string; status: string } {
    const result = this.submissionsService.reject(
      submissionId,
      bountyId,
      req.user.wallet,
    );
    return {
      submissionId,
      status: result.status,
    };
  }

  private mapToResponse(submission: {
    id: string;
    bountyId: string;
    submitterAddress: string;
    workLink: string;
    notes?: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  }): SubmissionResponseDto {
    return {
      id: submission.id,
      bountyId: submission.bountyId,
      submitterAddress: submission.submitterAddress,
      workLink: submission.workLink,
      notes: submission.notes,
      status: submission.status,
      createdAt: submission.createdAt,
      updatedAt: submission.updatedAt,
    };
  }
}
