/**
 * Manual mock for jwks-rsa.
 *
 * jose (dependency of jwks-rsa) is ESM-only and cannot be parsed by Jest
 * in CommonJS mode. This mock prevents the ESM import chain from being loaded
 * during e2e tests, since we don't need real JWKS resolution.
 *
 * See: https://jestjs.io/docs/manual-mocks
 */

export const passportJwtSecret =
  () =>
  (_requestHeaders: unknown, _token: unknown, cb: (err: Error | null, key?: string) => void) => {
    cb(null, '');
  };
