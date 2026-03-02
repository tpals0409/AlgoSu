/**
 * @file 스터디 노트 프록시 컨트롤러 — Gateway → Submission Service
 * @domain review
 * @layer controller
 * @related StudyNoteService(Submission)
 */
import {
  Controller,
  Get,
  Put,
  Body,
  Query,
  Req,
  Logger,
  ParseUUIDPipe,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Controller('api/study-notes')
export class StudyNoteProxyController {
  private readonly logger = new Logger(StudyNoteProxyController.name);

  constructor(private readonly configService: ConfigService) {}

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
   * Submission Service로 프록시 요청
   * Internal Key + x-user-id + x-study-id 헤더 첨부
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

      const data: unknown = await response.json();

      if (!response.ok) {
        this.logger.warn(`Submission Service 응답 오류: ${response.status}, path=${path}`);
        const errorData = data as { message?: string; statusCode?: number };
        return {
          statusCode: errorData.statusCode ?? response.status,
          message: errorData.message ?? 'Internal service error',
        };
      }

      return data;
    } catch (error: unknown) {
      this.logger.error(`Submission Service 프록시 실패: path=${path}, ${(error as Error).message}`);
      throw new InternalServerErrorException('스터디 노트 서비스 요청에 실패했습니다.');
    }
  }
}
