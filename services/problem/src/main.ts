import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

const logger = new Logger('Bootstrap');

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,           // 화이트리스트 검증 — 미등록 필드 제거
      forbidNonWhitelisted: true, // 미등록 필드 포함 시 400 반환
      transform: true,
    }),
  );

  const port = process.env['PORT'] ?? 3002;
  await app.listen(port);
  logger.log(`Problem Service is running on port ${port}`);
}

void bootstrap();
