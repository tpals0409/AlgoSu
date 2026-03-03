/**
 * @file 글로벌 예외 필터 — 일관된 에러 응답 구조 + 민감 정보 차단
 * @domain common
 * @layer middleware
 *
 * 응답 구조: { statusCode, message, error, timestamp, path }
 * - HttpException → statusCode + message 그대로
 * - ValidationPipe → 400 + errors[] (class-validator)
 * - 그 외 → 500 + "Internal Server Error" (스택트레이스 노출 방지)
 */

import {
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    let statusCode: number;
    let message: string | string[];
    let error: string;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const body = exceptionResponse as Record<string, unknown>;
        // ValidationPipe 에러: { message: string[], error: string }
        message = (body['message'] as string | string[]) ?? exception.message;
        error = (body['error'] as string) ?? HttpStatus[statusCode] ?? 'Error';
      } else {
        message = exception.message;
        error = HttpStatus[statusCode] ?? 'Error';
      }
    } else {
      // 알 수 없는 에러 → 500, 민감 정보 노출 방지
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal Server Error';
      error = 'Internal Server Error';

      // 서버 로그에만 상세 정보 기록 (클라이언트 비노출)
      this.logger.error(
        `Unhandled exception: ${(exception as Error)?.message ?? 'Unknown'}`,
        (exception as Error)?.stack,
      );
    }

    const responseBody = {
      statusCode,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: req.url,
    };

    res.status(statusCode).json(responseBody);
  }
}
