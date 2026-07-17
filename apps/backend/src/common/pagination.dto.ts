import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min, IsString } from 'class-validator';

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/**
 * Generic query DTO for paginated list endpoints.
 */
export class PaginationQueryDto {
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

  // ────── New filter fields ──────
  @ApiPropertyOptional({ description: 'Filter by bounty owner public key' })
  @IsOptional()
  @IsString()
  owner?: string;

  @ApiPropertyOptional({ description: 'Filter by contributor public key' })
  @IsOptional()
  @IsString()
  contributor?: string;

  @ApiPropertyOptional({ description: 'Filter by bounty status' })
  @IsOptional()
  @IsString()
  status?: string;
}

/** Keep everything below unchanged (toSkip, toTotalPages, PaginatedResponse) */
export function toSkip(page: number | undefined, limit: number | undefined): number {
  const safePage = page ?? DEFAULT_PAGE;
  const safeLimit = limit ?? DEFAULT_PAGE_SIZE;
  return (safePage - 1) * safeLimit;
}

export function toTotalPages(total: number, limit: number | undefined): number {
  const safeLimit = limit ?? DEFAULT_PAGE_SIZE;
  if (safeLimit <= 0) return 0;
  return Math.max(1, Math.ceil(total / safeLimit));
}

export class PaginatedResponse<T> {
  @ApiProperty({ description: 'Items in the current page.', isArray: true })
  data!: T[];

  @ApiProperty({ description: 'Total number of items across all pages.' })
  total!: number;

  @ApiProperty({ description: 'Current page number (1-based).' })
  page!: number;

  @ApiProperty({ description: 'Items per page.' })
  pageSize!: number;

  @ApiProperty({ description: 'Total number of pages.' })
  totalPages!: number;

  static of<T>(
    data: T[],
    total: number,
    page: number | undefined,
    limit: number | undefined,
  ): PaginatedResponse<T> {
    const safePage = page ?? DEFAULT_PAGE;
    const safeLimit = limit ?? DEFAULT_PAGE_SIZE;
    return {
      data,
      total,
      page: safePage,
      pageSize: safeLimit,
      totalPages: toTotalPages(total, safeLimit),
    };
  }
}
