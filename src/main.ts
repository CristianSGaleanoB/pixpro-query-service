import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { ValidationPipe } from '@nestjs/common';
import { AppLogger } from './common/services/app-logger.service';
import { HttpLoggerInterceptor } from './common/interceptors/http-logger.interceptor';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.setGlobalPrefix('api');

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalInterceptors(new HttpLoggerInterceptor());

  // Swagger Configuration
  const swaggerConfig = new DocumentBuilder()
    .setTitle('PixPro Query Service')
    .setDescription('The Read-Only API for PixPro platform (CQRS Read Model)')
    .setVersion('1.0')
    .addTag('queries')
    .addBearerAuth()
    .build();
  
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') ?? 3001;
  const prefix = 'api';

  await app.listen(port);

  const logger = new AppLogger('Bootstrap');
  logger.appStarted(port, prefix);
}

void bootstrap();
