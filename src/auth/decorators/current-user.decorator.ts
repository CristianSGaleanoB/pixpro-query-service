import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

/**
 * Injects the Keycloak JWT payload (decoded and validated) into the parameter.
 *
 * @example
 * // Get the full user
 * getProfile(@CurrentUser() user: JwtPayload) { ... }
 *
 * // Get a specific field
 * getProfile(@CurrentUser('preferred_username') username: string) { ... }
 */
export const CurrentUser = createParamDecorator(
  (field: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user: JwtPayload }>();
    const user = request.user;
    return field ? user?.[field] : user;
  },
);
