import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { pinoHttp } from 'pino-http';
import helmet from 'helmet';
import { createLogger } from '@byrdos/observability';
import { AppModule } from './app.module.js';
import { GlobalExceptionFilter } from './common/exception.filter.js';

const logger = createLogger('api');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
        },
      },
      hsts: {
        maxAge: 63072000,
        includeSubDomains: true,
        preload: true,
      },
    }),
  );

  app.use(
    pinoHttp({
      logger,
      redact: {
        paths: [
          'password',
          '*.password',
          'token',
          '*.token',
          'accessToken',
          '*.accessToken',
          'authorization',
          '*.authorization',
          'access_token',
          '*.access_token',
          'refresh_token',
          '*.refresh_token',
          'apiKey',
          '*.apiKey',
          'cookie',
          '*.cookie',
          'headers.authorization',
          'cipher',
          '*.cipher',
          'secret',
          '*.secret',
        ],
        censor: '[REDACTED]',
      },
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('byrdOS API')
    .setDescription('Personal financial operating system API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  app.setGlobalPrefix('api', {
    exclude: ['/health', '/health/(.*)'],
  });
  app.enableCors({
    origin: process.env.WEB_URL || 'http://localhost:3000',
    credentials: true,
  });
  await app.listen(process.env.PORT || 4000);
}
bootstrap();
