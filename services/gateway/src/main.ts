/**
 * @file Gateway 부트스트랩 — cookie-parser, CORS, ValidationPipe 설정
 * @domain common
 * @layer config
 * @related AppModule, GlobalExceptionFilter
 */

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import cookieParser = require('cookie-parser');
import { AppModule } from './app.module';
import { StructuredLoggerService } from './common/logger/structured-logger.service';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap(): Promise<void> {
  const structuredLogger = new StructuredLoggerService();
  structuredLogger.setContext('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: structuredLogger,
  });

  // M9: ConfigService를 통한 환경변수 접근
  const configService = app.get(ConfigService);

  // httpOnly Cookie 파싱 — JWT 쿠키 인증용
  app.use(cookieParser());

  // T3: CORS 설정 — credentials: true 필수 (httpOnly Cookie 전송)
  const corsOrigin = configService.get<string>('ALLOWED_ORIGINS', 'http://localhost:3001');
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Study-ID', 'X-Request-ID'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter(app.get(StructuredLoggerService)));

  app.enableShutdownHooks();

  // Swagger — 프로덕션 비활성화
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('AlgoSu Gateway API')
      .setDescription('알고리즘 스터디 관리 플랫폼 API')
      .setVersion('1.0')
      .addCookieAuth('token')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api-docs', app, document);
  }

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
  structuredLogger.log(`Gateway is running on port ${port}`);
  if (nodeEnv !== 'production') {
    structuredLogger.log(`Swagger UI: http://localhost:${port}/api-docs`);
  }
}

void bootstrap();
