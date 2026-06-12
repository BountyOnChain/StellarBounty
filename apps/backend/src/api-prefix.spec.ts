import { API_PREFIX } from './api-prefix';

describe('API_PREFIX', () => {
  it('uses the versioned v1 REST namespace', () => {
    expect(API_PREFIX).toBe('api/v1');
  });
});
