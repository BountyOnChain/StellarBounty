import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { BountyStatus } from '../../entities/bounty.entity';

export enum BountySort {
  NEWEST = 'newest',
  RELEVANCE = 'relevance',
  HIGHEST_REWARD = 'highest_reward',
  CLOSEST_DEADLINE = 'closest_deadline',
}

export class ListBountiesQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  search?: string;

  @IsOptional()
  @IsEnum(BountyStatus)
  status?: BountyStatus;

  @IsOptional()
  @IsEnum(BountySort)
  sort?: BountySort;
}
