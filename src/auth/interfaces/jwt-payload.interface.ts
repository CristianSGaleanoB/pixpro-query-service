/**
 * Keycloak JWT payload structure.
 * Must be a class (not interface) to support emitDecoratorMetadata.
 * See: https://www.typescriptlang.org/tsconfig#emitDecoratorMetadata
 */
export class JwtPayload {
  /** Subject — Keycloak user ID (UUID) */
  sub!: string;

  email!: string;

  preferred_username!: string;

  given_name?: string;

  family_name?: string;

  /** Realm-level roles: realm_access.roles */
  realm_access!: {
    roles: string[];
  };

  /** Client-level roles: resource_access.<clientId>.roles */
  resource_access!: Record<string, { roles: string[] }>;

  scope!: string;

  /** Token issuer — must match Keycloak realm URL */
  iss!: string;

  /** Audience */
  aud!: string | string[];

  /** Issued at (Unix timestamp) */
  iat!: number;

  /** Expiration (Unix timestamp) */
  exp!: number;
}
