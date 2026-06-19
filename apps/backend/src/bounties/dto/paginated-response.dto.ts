import { ApiProperty } from '@nestjs/swagger';

export class PaginatedResponseDto<T> {
  @ApiProperty({ description: 'Array of items for the current page' })
  data!: T[];

  @ApiProperty({ description: 'Total number of items across all pages' })
  total!: number;

  @ApiProperty({ description: 'Current page number (1-indexed)' })
  page!: number;

  @ApiProperty({ description: 'Number of items per page' })
  pageSize!: number;

  @ApiProperty({ description: 'Total number of pages' })
  totalPages!: number;
}
