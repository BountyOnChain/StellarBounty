import { createPaginatedResponse } from './paginated-response';

describe('createPaginatedResponse', () => {
  it('includes metadata and next/previous links', () => {
    expect(createPaginatedResponse(['item'], 25, { page: 2, pageSize: 10 }, '/items')).toEqual({
      data: ['item'],
      totalCount: 25,
      page: 2,
      pageSize: 10,
      totalPages: 3,
      links: {
        next: '/items?page=3&pageSize=10',
        prev: '/items?page=1&pageSize=10',
      },
    });
  });

  it('omits boundary links when there is no adjacent page', () => {
    expect(createPaginatedResponse([], 0, { page: 1, pageSize: 10 }, '/items')).toMatchObject({
      totalPages: 0,
      links: {
        next: null,
        prev: null,
      },
    });
  });
});
