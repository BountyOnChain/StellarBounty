import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsDateString,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateBountyDto {
  @ApiPropertyOptional({ description: 'Bounty title' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ description: 'Detailed description' })
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ description: 'Reward amount in XLM' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  rewardAmount?: number;

  @ApiPropertyOptional({ description: 'Submission deadline (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  deadline?: string;

  @ApiPropertyOptional({ description: 'Tags' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
