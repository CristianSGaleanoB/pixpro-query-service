import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { appConfig } from './config/app.config';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { BrokerModule } from './broker/broker.module';
import { RedisModule } from './redis/redis.module';
import { EventsModule } from './events/events.module';
import { ProjectsModule } from './projects/projects.module';
import { ImagesModule } from './images/images.module';
import { WebsocketModule } from './websocket/websocket.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }),
    AuthModule,
    BrokerModule,
    RedisModule,
    EventsModule,
    ProjectsModule,
    ImagesModule,
    WebsocketModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
