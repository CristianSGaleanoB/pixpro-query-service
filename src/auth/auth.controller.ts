import { Controller, Get } from '@nestjs/common';
import { Public } from './decorators/public.decorator';
import { Roles } from './decorators/roles.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtPayload } from './interfaces/jwt-payload.interface';

/**
 * Test endpoints to verify the Keycloak integration
 */
@Controller('test')
export class AuthController {
  @Get('public')
  @Public()
  publicEndpoint() {
    return { message: 'This endpoint is public' };
  }

  @Get('protected')
  protectedEndpoint(@CurrentUser() user: JwtPayload) {
    return {
      message: 'Your token is valid',
      user: user.preferred_username,
    };
  }

  @Get('admin')
  @Roles('admin')
  adminEndpoint(@CurrentUser() user: JwtPayload) {
    return {
      message: 'You are an administrator',
      user: user.preferred_username,
    };
  }
}
