/**
 * @file Problem Service 부트스트랩
 * @domain problem
 * @layer config
 */

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
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

  app.useGlobalFilters(new GlobalExceptionFilter());

  app.enableShutdownHooks();

  const port = process.env['PORT'] ?? 3002;
  await app.listen(port);
  structuredLogger.log(`Problem Service is running on port ${port}`);
}

void bootstrap();
