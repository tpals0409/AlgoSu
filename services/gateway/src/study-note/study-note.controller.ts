/**
 * @file 스터디 노트 프록시 컨트롤러 — Gateway → Submission Service
 * @domain review
 * @layer controller
 * @related StudyNoteService(Submission), GlobalExceptionFilter, StructuredLoggerService
 */
import {
  Controller,
  Get,
  Put,
  Body,
  Query,
  Req,
  ParseUUIDPipe,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

/** upstream 에러 응답 구조 */
interface UpstreamErrorBody {
  message?: string;
  statusCode?: number;
  error?: string;
}

@Controller('api/study-notes')
export class StudyNoteProxyController {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: StructuredLoggerService,
  ) {
    this.logger.setContext(StudyNoteProxyController.name);
  }

  /**
   * PUT /api/study-notes — 메모 생성/수정
   * @api PUT /api/study-notes
   * @guard jwt-auth
   */
  @Put()
  async upsert(@Req() req: Request, @Body() body: unknown) {
    return this.proxyToSubmission(req, '/study-notes', 'PUT', body);
  }

  /**
   * GET /api/study-notes — 메모 조회
   * @api GET /api/study-notes
   * @guard jwt-auth
   */
  @Get()
  async find(
    @Query('problemId', ParseUUIDPipe) problemId: string,
    @Req() req: Request,
  ) {
    return this.proxyToSubmission(req, `/study-notes?problemId=${problemId}`, 'GET');
  }

  // ─── PROXY HELPER ─────────────────────────

  /**
   * Submission Service로 프록시 요청을 전달한다.
   * upstream 에러 → HttpException throw → GlobalExceptionFilter 처리.
   * 네트워크/타임아웃 에러 → 502 Bad Gateway.
   */
  private async proxyToSubmission(
    req: Request,
    path: string,
    method: string,
    body?: unknown,
  ): Promise<unknown> {
    const submissionUrl = this.configService.getOrThrow<string>('SUBMISSION_SERVICE_URL');
    const internalKey = this.configService.getOrThrow<string>('INTERNAL_KEY_SUBMISSION');

    const userId = req.headers['x-user-id'] as string;
    const studyId = req.headers['x-study-id'] as string;
    const requestId = req.headers['x-request-id'] as string;

    const headers: Record<string, string> = {
      'x-internal-key': internalKey,
      'Content-Type': 'application/json',
    };
    if (userId) headers['x-user-id'] = userId;
    if (studyId) headers['x-study-id'] = studyId;

    const url = `${submissionUrl}${path}`;

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (response.status === 204) {
        return undefined;
      }

      const data: unknown = await response.json();

      if (!response.ok) {
        const errorData = data as UpstreamErrorBody;
        const status = errorData.statusCode ?? response.status;
        const message = errorData.message ?? 'Internal service error';

        this.logger.warn(
          `Upstream 응답 오류: status=${status}, path=${path}`,
          { requestId, upstream: 'submission', upstreamStatus: status },
        );

        throw new HttpException(
          { statusCode: status, message, error: errorData.error ?? HttpStatus[status] ?? 'Error' },
          status,
        );
      }

      return data;
    } catch (error: unknown) {
      // HttpException은 GlobalExceptionFilter가 처리하도록 재throw
      if (error instanceof HttpException) {
        throw error;
      }

      // 네트워크 에러, 타임아웃 등 → 502 Bad Gateway
      this.logger.error(
        `Submission Service 프록시 실패: path=${path}`,
        error instanceof Error ? error : undefined,
        { requestId, upstream: 'submission', errorCode: 'ALGOSU_GATEWAY_INFRA_001' },
      );

      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_GATEWAY,
          message: '스터디 노트 서비스에 연결할 수 없습니다.',
          error: 'Bad Gateway',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
