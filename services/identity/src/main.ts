/**
 * @file Identity Service 부트스트랩 — Sprint 51: 비즈니스 API 34개 엔드포인트 제공
 * @domain identity
 * @layer config
 */

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { StructuredLoggerService } from './common/logger/structured-logger.service';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap(): Promise<void> {
  // H10: 구조화 JSON 로거 적용
  const structuredLogger = new StructuredLoggerService();
  structuredLogger.setContext('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: structuredLogger,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter(structuredLogger));

  app.enableShutdownHooks();

  // Swagger — 프로덕션 비활성화
  const nodeEnv = process.env['NODE_ENV'] ?? 'development';
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('AlgoSu Identity API')
      .setDescription('Identity Service — 사용자, 스터디, 알림, 공유 링크 관리 API')
      .setVersion('1.0')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api-docs', app, document);
  }

  const port = process.env['PORT'] ?? 3004;
  await app.listen(port);
  structuredLogger.log(`Identity Service running on port ${port}`);
  if (nodeEnv !== 'production') {
    structuredLogger.log(`Swagger UI: http://localhost:${port}/api-docs`);
  }
}

void bootstrap();
