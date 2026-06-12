export type PaginationLinks = {
  next: string | null;
  prev: string | null;
};

export type PaginationMeta = {
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type PaginatedResponse<T> = PaginationMeta & {
  data: T[];
  links: PaginationLinks;
};

export function normalizePagination(query: { page?: number; pageSize?: number }) {
  return {
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 20,
  };
}
export function createPaginatedResponse<T>(
  data: T[],
  totalCount: number,
  pagination: { page: number; pageSize: number },
  basePath: string,
): PaginatedResponse<T> {
  const totalPages = Math.ceil(totalCount / pagination.pageSize);
  const buildLink = (page: number) => `${basePath}?page=${page}&pageSize=${pagination.pageSize}`;

  return {
    data,
    totalCount,
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalPages,
    links: {
      next: pagination.page < totalPages ? buildLink(pagination.page + 1) : null,
      prev: pagination.page > 1 ? buildLink(pagination.page - 1) : null,
    },
  };
}
