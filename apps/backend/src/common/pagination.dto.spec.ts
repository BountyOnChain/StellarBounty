import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { PaginatedResponse, PaginationQueryDto, toSkip, toTotalPages, DEFAULT_PAGE_SIZE } from './pagination.dto';

describe('PaginationQueryDto', () => {
  it('applies defaults when the query is empty', () => {
    const dto = plainToInstance(PaginationQueryDto, {});
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
  });

  it('coerces string query params to numbers (class-transformer @Type)', () => {
    const dto = plainToInstance(PaginationQueryDto, { page: '3', limit: '50' });
    expect(dto.page).toBe(3);
    expect(dto.limit).toBe(50);
  });

  it('rejects page < 1', async () => {
    const dto = plainToInstance(PaginationQueryDto, { page: 0 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'page')).toBe(true);
  });

  it('rejects limit > 100', async () => {
    const dto = plainToInstance(PaginationQueryDto, { limit: 200 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('accepts limit at the boundary (100)', async () => {
    const dto = plainToInstance(PaginationQueryDto, { limit: 100 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});

describe('toSkip / toTotalPages / PaginatedResponse.of', () => {
  it('toSkip computes 0-based offset', () => {
    expect(toSkip(1, 20)).toBe(0);
    expect(toSkip(2, 20)).toBe(20);
    expect(toSkip(undefined, 20)).toBe(0);
  });

  it('toTotalPages rounds up and never returns < 1', () => {
    expect(toTotalPages(0, 20)).toBe(1);
    expect(toTotalPages(1, 20)).toBe(1);
    expect(toTotalPages(20, 20)).toBe(1);
    expect(toTotalPages(21, 20)).toBe(2);
    expect(toTotalPages(100, 20)).toBe(5);
  });

  it('toTotalPages returns 0 for limit <= 0 (defensive)', () => {
    expect(toTotalPages(10, 0)).toBe(0);
    expect(toTotalPages(10, -1)).toBe(0);
  });

  it('PaginatedResponse.of builds metadata consistently', () => {
    const r = PaginatedResponse.of(['a', 'b', 'c'], 50, 2, 15);
    expect(r).toEqual({
      data: ['a', 'b', 'c'],
      total: 50,
      page: 2,
      pageSize: 15,
      totalPages: 4,
    });
  });

  it('PaginatedResponse.of uses defaults when params are missing', () => {
    const r = PaginatedResponse.of<number>([], 0, undefined, undefined);
    expect(r.page).toBe(1);
    expect(r.pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(r.totalPages).toBe(1);
  });
});
