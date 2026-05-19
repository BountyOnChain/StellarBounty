import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsArray,
  Min,
  MaxLength,
  MinLength,
  IsDateString,
} from 'class-validator';

export class CreateBountyDto {
  @ApiProperty({
    description: 'Bounty title',
    example: 'Build a Stellar Payment Gateway',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @ApiProperty({
    description: 'Detailed description of the bounty',
    example: 'Implement a payment gateway using Stellar SDK with support for...',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(5000)
  description: string;

  @ApiProperty({
    description: 'Reward amount in XLM',
    example: 100,
  })
  @IsNumber()
  @Min(1)
  rewardAmount: number;

  @ApiProperty({
    description: 'Submission deadline (ISO 8601)',
    example: '2025-12-31T23:59:59Z',
  })
  @IsDateString()
  deadline: string;

  @ApiPropertyOptional({
    description: 'Tags for categorizing the bounty',
    example: ['Stellar', 'Payment', 'Rust'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class BountyResponseDto {
  @ApiProperty({ description: 'Unique ID' })
  id: string;

  @ApiProperty({ description: 'Bounty title' })
  title: string;

  @ApiProperty({ description: 'Bounty description' })
  description: string;

  @ApiProperty({ description: 'Reward in XLM' })
  rewardAmount: number;

  @ApiProperty({ description: 'Submission deadline' })
  deadline: string;

  @ApiProperty({ enum: ['open', 'closed', 'paid'], description: 'Current status' })
  status: string;

  @ApiProperty({ description: "Owner's Stellar wallet address" })
  ownerAddress: string;

  @ApiPropertyOptional({ description: 'Tags' })
  tags?: string[];

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: string;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: string;
}
