/**
 * @file 피드백 컨트롤러 — 피드백 생성/조회 + 관리자 상태 변경
 * @domain feedback
 * @layer controller
 * @related IdentityClientService
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  ParseUUIDPipe,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IsEnum, IsString, IsOptional, MaxLength } from 'class-validator';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { IdentityClientService } from '../identity-client/identity-client.service';

class CreateFeedbackBodyDto {
  @IsEnum(['GENERAL', 'BUG', 'FEATURE', 'UX'])
  category!: string;

  @IsString()
  @MaxLength(2000)
  content!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  pageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  browserInfo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(700000)
  screenshot?: string;
}

@ApiTags('Feedback')
@Controller('api/feedbacks')
export class FeedbackController {
  constructor(
    private readonly identityClient: IdentityClientService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 피드백 생성
   * @api POST /api/feedbacks
   * @guard jwt-auth
   */
  @ApiOperation({ summary: '피드백 생성' })
  @ApiResponse({ status: 201, description: '피드백 생성 완료' })
  @Post()
  async create(
    @Req() req: Request,
    @Body() body: CreateFeedbackBodyDto,
  ): Promise<Record<string, unknown>> {
    const userId = req.headers['x-user-id'] as string;
    return this.identityClient.createFeedback({
      userId,
      ...body,
    });
  }

  /**
   * 내 피드백 목록
   * @api GET /api/feedbacks/mine
   * @guard jwt-auth
   */
  @ApiOperation({ summary: '내 피드백 목록' })
  @ApiResponse({ status: 200, description: '피드백 목록' })
  @Get('mine')
  async getMyFeedbacks(
    @Req() req: Request,
  ): Promise<Record<string, unknown>[]> {
    const userId = req.headers['x-user-id'] as string;
    return this.identityClient.findFeedbacksByUserId(userId);
  }

  /**
   * 전체 피드백 목록 (admin only)
   * @api GET /api/feedbacks
   * @guard jwt-auth, admin
   */
  @ApiOperation({ summary: '전체 피드백 목록 (관리자)' })
  @ApiResponse({ status: 200, description: '피드백 목록 (페이지네이션)' })
  @Get()
  async findAll(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
  ): Promise<Record<string, unknown>> {
    await this.verifyAdmin(req);
    return this.identityClient.findAllFeedbacks(
      page ? parseInt(page, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
      category,
      search,
    );
  }

  /**
   * 피드백 상세 조회 (admin only, screenshot 포함)
   * @api GET /api/feedbacks/:publicId/detail
   * @guard jwt-auth, admin
   */
  @ApiOperation({ summary: '피드백 상세 조회 (관리자)' })
  @ApiResponse({ status: 200, description: '피드백 상세 정보 (screenshot 포함)' })
  @Get(':publicId/detail')
  async findDetail(
    @Req() req: Request,
    @Param('publicId', ParseUUIDPipe) publicId: string,
  ): Promise<Record<string, unknown>> {
    await this.verifyAdmin(req);
    return this.identityClient.findFeedbackDetail(publicId);
  }

  /**
   * 피드백 상태 변경 (admin only)
   * @api PATCH /api/feedbacks/:publicId/status
   * @guard jwt-auth, admin
   */
  @ApiOperation({ summary: '피드백 상태 변경 (관리자)' })
  @ApiResponse({ status: 200, description: '상태 변경 완료' })
  @Patch(':publicId/status')
  async updateStatus(
    @Req() req: Request,
    @Param('publicId', ParseUUIDPipe) publicId: string,
    @Body() body: { status: string },
  ): Promise<Record<string, unknown>> {
    await this.verifyAdmin(req);
    return this.identityClient.updateFeedbackStatus(publicId, {
      status: body.status,
    });
  }

  /**
   * admin 검증: 환경변수 ADMIN_EMAILS에 포함된 이메일만 허용
   */
  private async verifyAdmin(req: Request): Promise<void> {
    const userId = req.headers['x-user-id'] as string;
    const user = await this.identityClient.findUserById(userId);
    const adminEmails = this.configService
      .get<string>('ADMIN_EMAILS', '')
      .split(',')
      .map((e) => e.trim());
    if (!adminEmails.map((e) => e.toLowerCase()).includes((user.email as string).toLowerCase())) {
      throw new ForbiddenException('관리자만 접근할 수 있습니다.');
    }
  }
}
