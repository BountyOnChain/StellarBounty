import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  Matches,
  IsIn,
} from 'class-validator';
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from '../../common/pagination.dto';
import { BountyStatus } from '../../entities/bounty.entity';

export const BOUNTY_SORT_OPTIONS = [
  'newest',
  'oldest',
  'highest_reward',
  'lowest_reward',
  'closest_deadline',
  'farthest_deadline',
  'relevance',
] as const;

export type BountySort = (typeof BOUNTY_SORT_OPTIONS)[number];

/**
 * To support tags query param as ?tags=js,stellar or ?tags=js&tags=stellar
 */
function transformTags(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) {
    // flatten comma-separated entries
    const flat = (value as unknown[]).flatMap((v) => {
      if (typeof v === 'string') return v.split(',');
      return [];
    });
    const cleaned = flat.map((s) => s.trim()).filter((s) => s.length > 0);
    return cleaned.length ? cleaned : undefined;
  }
  if (typeof value === 'string') {
    const arr = value
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    return arr.length ? arr : undefined;
  }
  return undefined;
}

export class BountyFilterDto {
  @ApiPropertyOptional({
    description: '1-based page number.',
    minimum: 1,
    default: DEFAULT_PAGE,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = DEFAULT_PAGE;

  @ApiPropertyOptional({
    description: 'Items per page. Capped at 100.',
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
    default: DEFAULT_PAGE_SIZE,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit?: number = DEFAULT_PAGE_SIZE;

  @ApiPropertyOptional({
    description:
      'Full-text search query on title + description (Postgres plainto_tsquery). e.g. ?q=stellar+payment',
    example: 'stellar payment',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  })
  q?: string;

  // Keep backward compatibility with frontend's ?search=...
  @ApiPropertyOptional({
    description: 'Alias for q (backward compat).',
    example: 'stellar',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  })
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by bounty status.',
    enum: BountyStatus,
  })
  @IsOptional()
  @IsEnum(BountyStatus)
  status?: BountyStatus;

  @ApiPropertyOptional({
    description: 'Filter by tags (comma-separated or repeated). Matches any tag (overlap).',
    example: 'Stellar,Payment',
    type: [String],
  })
  @IsOptional()
  @Transform(({ value }) => transformTags(value))
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Minimum reward amount (inclusive) in stroops as string/integer.',
    example: '1000000',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    return String(value).trim();
  })
  @Matches(/^\d+$/, { message: 'minReward must be a positive integer string' })
  minReward?: string;

  @ApiPropertyOptional({
    description: 'Maximum reward amount (inclusive) in stroops.',
    example: '1000000000',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    return String(value).trim();
  })
  @Matches(/^\d+$/, { message: 'maxReward must be a positive integer string' })
  maxReward?: string;

  @ApiPropertyOptional({
    description: 'Sort order. relevance requires q to rank results.',
    enum: BOUNTY_SORT_OPTIONS,
    default: 'newest',
  })
  @IsOptional()
  @IsIn(BOUNTY_SORT_OPTIONS as unknown as string[])
  sort?: BountySort = 'newest';
}
