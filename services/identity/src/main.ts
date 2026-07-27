/**
 * @file Identity Service 부트스트랩 — Sprint 51: 비즈니스 API 34개 엔드포인트 제공
 * @domain identity
 * @layer config
 */

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { StructuredLoggerService } from './common/logger/structured-logger.service';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap(): Promise<void> {
  // H10: 구조화 JSON 로거 적용
  const structuredLogger = new StructuredLoggerService();
  structuredLogger.setContext('Bootstrap');

  // bodyParser: false — 기본 파서 비활성화 후 5mb 한도 파서를 직접 등록
  // (Gateway 경유 피드백 스크린샷 최대 4장 × 700KB ≈ 2.8MB 페이로드 수용)
  const app = await NestFactory.create(AppModule, {
    logger: structuredLogger,
    bodyParser: false,
  });

  // 다중 스크린샷 첨부 대응 — JSON/urlencoded body 한도 5mb 상향
  app.use(json({ limit: '5mb' }));
  app.use(urlencoded({ extended: true, limit: '5mb' }));

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
