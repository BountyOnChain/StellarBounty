import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key for marking routes as publicly accessible.
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Mark a route as publicly accessible (no JWT authentication required).
 *
 * @example
 * ```typescript
 * @Public()
 * @Get('health')
 * healthCheck() {
 *   return { status: 'ok' };
 * }
 * ```
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
