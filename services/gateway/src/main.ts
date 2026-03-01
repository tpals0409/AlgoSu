import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { StructuredLoggerService } from './common/logger/structured-logger.service';

async function bootstrap(): Promise<void> {
  const structuredLogger = new StructuredLoggerService();
  structuredLogger.setContext('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: structuredLogger,
  });

  // M9: ConfigService를 통한 환경변수 접근
  const configService = app.get(ConfigService);

  const allowedOrigins = configService.get<string>('ALLOWED_ORIGINS', 'http://localhost:3001').split(',');
  app.enableCors({
    origin: allowedOrigins,
    credentials: false,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableShutdownHooks();

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
  structuredLogger.log(`Gateway is running on port ${port}`);
}

void bootstrap();
