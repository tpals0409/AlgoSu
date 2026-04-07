/**
 * @file Problem Service 부트스트랩
 * @domain problem
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

  const filterLogger = new StructuredLoggerService();
  filterLogger.setContext('GlobalExceptionFilter');
  app.useGlobalFilters(new GlobalExceptionFilter(filterLogger));

  app.enableShutdownHooks();

  // Swagger — 프로덕션 비활성화
  const nodeEnv = process.env['NODE_ENV'] ?? 'development';
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('AlgoSu Problem API')
      .setDescription('Problem Service — 문제 CRUD, 마감 관리 API')
      .setVersion('1.0')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api-docs', app, document);
  }

  const port = process.env['PORT'] ?? 3002;
  await app.listen(port);
  structuredLogger.log(`Problem Service is running on port ${port}`);
  if (nodeEnv !== 'production') {
    structuredLogger.log(`Swagger UI: http://localhost:${port}/api-docs`);
  }
}

void bootstrap();
