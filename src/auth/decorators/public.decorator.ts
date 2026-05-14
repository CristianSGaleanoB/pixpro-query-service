import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks an endpoint as public (no authentication required).
 * Should be placed BEFORE the global guard for the guard to respect it.
 *
 * @example
 * @Get('health')
 * @Public()
 * healthCheck() { ... }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
