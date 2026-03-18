/**
 * @file 공개 공유 링크 컨트롤러 — 게스트 읽기 전용 엔드포인트
 * @domain share
 * @layer controller
 * @related share-link.guard.ts, share-link.service.ts
 *
 * 보안: JWT 미들웨어 제외 (AppModule exclude), ShareLinkGuard만 적용
 * 모든 엔드포인트 GET only — 쓰기 API 없음
 */
import {
  Controller,
  Get,
  Param,
  Req,
  UseGuards,
  NotFoundException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { ShareLinkGuard } from '../common/guards/share-link.guard';
import { IdentityClientService } from '../identity-client/identity-client.service';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

@ApiTags('Public Share')
@Controller('api/public/shared')
export class PublicShareController {
  private readonly problemServiceUrl: string;
  private readonly problemServiceKey: string;
  private readonly submissionServiceUrl: string;
  private readonly submissionServiceKey: string;
  constructor(
    private readonly configService: ConfigService,
    private readonly identityClient: IdentityClientService,
    private readonly logger: StructuredLoggerService,
  ) {
    this.logger.setContext(PublicShareController.name);
    this.problemServiceUrl = this.configService.get<string>('PROBLEM_SERVICE_URL', 'http://localhost:3001');
    this.problemServiceKey = this.configService.getOrThrow<string>('INTERNAL_KEY_PROBLEM');
    this.submissionServiceUrl = this.configService.get<string>('SUBMISSION_SERVICE_URL', 'http://localhost:3003');
    this.submissionServiceKey = this.configService.getOrThrow<string>('INTERNAL_KEY_SUBMISSION');
  }

  /** 공유 링크 메타 — 스터디 정보 반환 */
  @ApiOperation({ summary: '공유 링크 스터디 정보 조회' })
  @ApiResponse({ status: 200, description: '스터디 메타 정보' })
  @Get(':token')
  @UseGuards(ShareLinkGuard)
  async getSharedStudyMeta(@Req() req: Request) {
    const studyId = req.headers['x-share-study-id'] as string;
    const createdBy = req.headers['x-share-created-by'] as string;

    let study: Record<string, unknown>;
    try {
      study = await this.identityClient.findStudyById(studyId);
    } catch {
      throw new NotFoundException('스터디를 찾을 수 없습니다.');
    }
    if (!study) throw new NotFoundException('스터디를 찾을 수 없습니다.');

    const [members, creator] = await Promise.all([
      this.identityClient.getMembers(studyId).catch(() => []),
      this.identityClient.findUserById(createdBy).catch(() => null),
    ]);

    const memberList = members as Record<string, unknown>[];
    const creatorData = creator as Record<string, unknown> | null;

    return {
      data: {
        studyName: study.name,
        memberCount: memberList.length,
        createdBy: {
          id: createdBy,
          name: creatorData?.name ?? null,
          avatarUrl: creatorData?.avatar_url ?? null,
        },
        members: memberList.map((m) => ({
          userId: m.user_id,
          nickname: m.nickname,
          role: m.role,
        })),
      },
    };
  }

  /** 공유 스터디 문제 목록 — Problem Service 프록시 */
  @ApiOperation({ summary: '공유 스터디 문제 목록 조회' })
  @Get(':token/problems')
  @UseGuards(ShareLinkGuard)
  async getSharedProblems(@Req() req: Request) {
    const studyId = req.headers['x-share-study-id'] as string;
    const createdBy = req.headers['x-share-created-by'] as string;

    const response = await fetch(`${this.problemServiceUrl}/all`, {
      method: 'GET',
      headers: {
        'X-Internal-Key': this.problemServiceKey,
        'X-Study-ID': studyId,
        'X-User-ID': createdBy,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      this.logger.warn(`Problem Service 프록시 실패: status=${response.status}`);
      throw new NotFoundException('문제 목록을 조회할 수 없습니다.');
    }

    return response.json();
  }

  /** 공유 스터디 제출 목록 — Submission Service 프록시 */
  @ApiOperation({ summary: '공유 스터디 제출 목록 조회' })
  @Get(':token/submissions')
  @UseGuards(ShareLinkGuard)
  async getSharedSubmissions(@Req() req: Request) {
    const studyId = req.headers['x-share-study-id'] as string;

    const response = await fetch(`${this.submissionServiceUrl}/internal/study-all/${studyId}`, {
      method: 'GET',
      headers: {
        'X-Internal-Key': this.submissionServiceKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      this.logger.warn(`Submission Service 프록시 실패: status=${response.status}`);
      throw new NotFoundException('제출 목록을 조회할 수 없습니다.');
    }

    return response.json();
  }

  /** 공유 AI 분석 결과 — AI Analysis Service 프록시 */
  @ApiOperation({ summary: '공유 AI 분석 결과 조회' })
  @Get(':token/analysis/:submissionId')
  @UseGuards(ShareLinkGuard)
  async getSharedAnalysis(
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
  ) {
    const response = await fetch(
      `${this.submissionServiceUrl}/internal/${submissionId}`,
      {
        method: 'GET',
        headers: {
          'X-Internal-Key': this.submissionServiceKey,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      this.logger.warn(`Submission Service 분석 프록시 실패: status=${response.status}`);
      throw new NotFoundException('분석 결과를 조회할 수 없습니다.');
    }

    const result = (await response.json()) as {
      data: {
        aiFeedback?: string;
        aiScore?: number;
        aiOptimizedCode?: string;
        aiAnalysisStatus?: string;
        code?: string;
      };
    };
    const sub = result.data;

    return {
      data: {
        feedback: sub.aiFeedback ?? null,
        score: sub.aiScore ?? null,
        optimizedCode: sub.aiOptimizedCode ?? null,
        analysisStatus: sub.aiAnalysisStatus ?? null,
        code: sub.code ?? null,
      },
    };
  }
}
