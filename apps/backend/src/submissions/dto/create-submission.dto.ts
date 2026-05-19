import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUrl, IsOptional, MinLength, MaxLength } from 'class-validator';

export class CreateSubmissionDto {
  @ApiProperty({
    description: 'Link to the submitted work (GitHub PR, demo URL, etc.)',
    example: 'https://github.com/user/repo/pull/42',
  })
  @IsUrl({ protocols: ['https', 'http'] })
  @IsNotEmpty()
  workLink: string;

  @ApiPropertyOptional({
    description: 'Additional notes or description of the submission',
    example: 'Implemented the Stellar payment integration with full test coverage and documentation.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  notes?: string;
}

export class SubmissionResponseDto {
  @ApiProperty({ description: 'Unique submission ID' })
  id: string;

  @ApiProperty({ description: 'Bounty ID this submission belongs to' })
  bountyId: string;

  @ApiProperty({ description: "Submitter's Stellar wallet address" })
  submitterAddress: string;

  @ApiProperty({ description: 'Link to submitted work' })
  workLink: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  notes?: string;

  @ApiProperty({
    description: 'Submission status',
    enum: ['pending', 'approved', 'rejected'],
  })
  status: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: string;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: string;
}
