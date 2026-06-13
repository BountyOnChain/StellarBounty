import { createReadStream } from 'fs';
import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Request,
  Res,
  StreamableFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateSubmissionDto, SubmissionResponseDto } from './submissions.dto';
import { SubmissionsService, UploadedSubmissionFile } from './submissions.service';

@ApiTags('submissions')
@Controller('bounties/:bountyId/submissions')
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Submit work for a bounty' })
  @ApiParam({ name: 'bountyId', description: 'Bounty UUID that receives the submission' })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiCreatedResponse({ description: 'Submission created.', type: SubmissionResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid submission payload.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiNotFoundResponse({ description: 'Bounty not found.' })
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('files'))
  @Post()
  create(
    @Param('bountyId') bountyId: string,
    @Body() dto: CreateSubmissionDto,
    @UploadedFiles() files: UploadedSubmissionFile[] | undefined,
    @Request() req: { user: { address: string } },
  ) {
    return this.submissionsService.create(bountyId, dto, req.user.address, files ?? []);
  }

  @ApiOperation({ summary: 'Download a submitted attachment using a signed URL' })
  @Header('Cache-Control', 'private, max-age=60')
  @Get(':subId/attachments/:attachmentId/download')
  async downloadAttachment(
    @Param('bountyId') bountyId: string,
    @Param('subId') subId: string,
    @Param('attachmentId') attachmentId: string,
    @Query('token') token: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const download = await this.submissionsService.resolveAttachmentDownload(
      bountyId,
      subId,
      attachmentId,
      token,
    );

    response.setHeader('Content-Type', download.mimeType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${download.originalName.replace(/["\\]/g, '_')}"`,
    );
    response.setHeader('Content-Length', download.size.toString());
    return new StreamableFile(createReadStream(download.filePath));
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
  @Patch(':subId/reject')
  reject(
    @Param('bountyId') bountyId: string,
    @Param('subId') subId: string,
    @Request() req: { user: { address: string } },
  ) {
    return this.submissionsService.reject(bountyId, subId, req.user.address);
  }
}
