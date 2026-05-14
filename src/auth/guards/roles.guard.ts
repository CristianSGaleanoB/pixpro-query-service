import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

/**
 * Keycloak roles-based RBAC guard.
 *
 * Evaluates the required roles (@Roles) against:
 *   1. realm_access.roles       — realm roles (global)
 *   2. resource_access.*.roles  — client-specific roles
 *
 * If the endpoint does not have @Roles, allows access (only requires authentication).
 * Registered as APP_GUARD AFTER JwtAuthGuard.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles → only authentication required
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user: JwtPayload }>();
    const user = request.user;

    if (!user) {
      return false;
    }

    // Combines realm roles and all client roles
    const realmRoles: string[] = user.realm_access?.roles ?? [];
    const clientRoles: string[] = Object.values(user.resource_access ?? {}).flatMap(
      (resource) => resource.roles ?? [],
    );

    const allRoles = new Set([...realmRoles, ...clientRoles]);

    return requiredRoles.some((role) => allRoles.has(role));
  }
}
