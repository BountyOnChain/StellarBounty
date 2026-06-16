import { ConfigService } from '@nestjs/config';
import { DEFAULT_MAX_BODY_SIZE, getMaxBodySize } from './body-size.config';

function createConfig(values: Record<string, string | undefined> = {}): ConfigService {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('body size configuration', () => {
  it('defaults the max request body size to 1mb', () => {
    expect(getMaxBodySize(createConfig())).toBe(DEFAULT_MAX_BODY_SIZE);
  });

  it('uses MAX_BODY_SIZE when it is configured', () => {
    expect(getMaxBodySize(createConfig({ MAX_BODY_SIZE: '500kb' }))).toBe('500kb');
  });
});
