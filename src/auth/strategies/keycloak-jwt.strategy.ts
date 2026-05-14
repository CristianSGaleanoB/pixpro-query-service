import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class KeycloakJwtStrategy extends PassportStrategy(Strategy, 'keycloak') {
  constructor(configService: ConfigService) {
    const keycloakUrl = configService.get<string>('keycloak.url');
    const keycloakIssuer = configService.get<string>('keycloak.issuer');
    const realm = configService.get<string>('keycloak.realm');
    const issuer = keycloakIssuer || `${keycloakUrl}/realms/${realm}`;
    const jwksUri = `${keycloakUrl}/realms/${realm}/protocol/openid-connect/certs`;

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      issuer,
      algorithms: ['RS256'],
      // jwks-rsa retrieves public keys from Keycloak's public endpoint
      // and caches them — no client secret needed
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri,
      }),
    });
  }

  /**
   * Called by Passport after the JWT signature is verified.
   * The returned object is attached to `request.user`.
   */
  validate(payload: JwtPayload): JwtPayload {
    return payload;
  }
}
