import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Restricts access to one or more Keycloak realm roles.
 * Evaluated against `realm_access.roles` AND `resource_access.<client>.roles`.
 *
 * @example
 * @Get('admin-dashboard')
 * @Roles('admin')
 * getAdminDashboard() { ... }
 *
 * @Get('profile')
 * @Roles('user', 'admin')
 * getProfile() { ... }
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
