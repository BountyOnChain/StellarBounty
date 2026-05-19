import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export class UpdateSubmissionStatusDto {
  @ApiProperty({
    description: 'New status for the submission',
    enum: ['approved', 'rejected'],
    example: 'approved',
  })
  @IsEnum(['approved', 'rejected'])
  status: 'approved' | 'rejected';
}

export class ApproveSubmissionResponseDto {
  @ApiProperty({ description: 'Submission ID' })
  submissionId: string;

  @ApiProperty({ description: 'Updated status' })
  status: string;

  @ApiProperty({
    description: 'Soroban contract release transaction hash (if approved)',
    required: false,
  })
  txHash?: string;

  @ApiProperty({ description: 'Processing timestamp' })
  processedAt: string;
}
