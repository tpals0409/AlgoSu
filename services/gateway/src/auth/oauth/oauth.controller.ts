import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  Req,
  Res,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { OAuthService } from './oauth.service';

@Controller('auth')
export class OAuthController {
  private readonly logger = new Logger(OAuthController.name);

  constructor(private readonly oauthService: OAuthService) {}

  /**
   * GET /auth/oauth/:provider — OAuth 인증 시작
   * 클라이언트를 OAuth Provider 인증 페이지로 리다이렉트
   */
  @Get('oauth/:provider')
  async startOAuth(
    @Param('provider') provider: string,
    @Res() res: Response,
  ): Promise<void> {
    const { url } = await this.oauthService.getAuthorizationUrl(provider);
    res.redirect(url);
  }

  /**
   * GET /auth/oauth/:provider/callback — OAuth 콜백 처리
   * code → token 교환 → users 테이블 upsert → 자체 JWT 발급
   */
  @Get('oauth/:provider/callback')
  async handleOAuthCallback(
    @Param('provider') provider: string,
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ): Promise<void> {
    if (!code || !state) {
      throw new BadRequestException('OAuth 콜백에 code 또는 state가 없습니다.');
    }

    const result = await this.oauthService.handleCallback(provider, code, state);

    this.logger.log(`OAuth 로그인 성공: provider=${provider}, userId=${result.user.id}`);

    // 프론트엔드로 토큰 전달 (fragment 방식)
    const frontendUrl = process.env['FRONTEND_URL'] ?? 'http://localhost:3001';
    const params = new URLSearchParams({
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
      github_connected: String(result.user.github_connected),
    });
    res.redirect(`${frontendUrl}/auth/callback?${params.toString()}`);
  }

  /**
   * POST /auth/github/link — GitHub OAuth 연동
   * 인증된 사용자만 접근 가능 (JWT 미들웨어 통과 후)
   */
  @Post('github/link')
  async linkGitHub(
    @Req() req: Request,
    @Body('code') code: string,
  ): Promise<{ message: string; github_username: string | null }> {
    const userId = req.headers['x-user-id'] as string;
    if (!code) {
      throw new BadRequestException('GitHub OAuth code가 필요합니다.');
    }

    const user = await this.oauthService.linkGitHub(userId, code);
    this.logger.log(`GitHub 연동 완료: userId=${userId}, github=${user.github_username}`);

    return {
      message: 'GitHub 연동이 완료되었습니다.',
      github_username: user.github_username,
    };
  }

  /**
   * DELETE /auth/github/link — GitHub 연동 해제
   */
  @Delete('github/link')
  async unlinkGitHub(
    @Req() req: Request,
  ): Promise<{ message: string }> {
    const userId = req.headers['x-user-id'] as string;
    await this.oauthService.unlinkGitHub(userId);
    this.logger.log(`GitHub 연동 해제: userId=${userId}`);

    return { message: 'GitHub 연동이 해제되었습니다.' };
  }

  /**
   * POST /auth/github/relink — GitHub 재연동
   */
  @Post('github/relink')
  async relinkGitHub(
    @Req() req: Request,
    @Body('code') code: string,
  ): Promise<{ message: string; github_username: string | null }> {
    const userId = req.headers['x-user-id'] as string;
    if (!code) {
      throw new BadRequestException('GitHub OAuth code가 필요합니다.');
    }

    const user = await this.oauthService.relinkGitHub(userId, code);
    this.logger.log(`GitHub 재연동 완료: userId=${userId}, github=${user.github_username}`);

    return {
      message: 'GitHub 재연동이 완료되었습니다.',
      github_username: user.github_username,
    };
  }

  /**
   * POST /auth/refresh — JWT 갱신
   */
  @Post('refresh')
  async refreshToken(
    @Body('refresh_token') refreshToken: string,
  ): Promise<{ access_token: string }> {
    if (!refreshToken) {
      throw new BadRequestException('Refresh token이 필요합니다.');
    }

    const result = await this.oauthService.refreshAccessToken(refreshToken);
    return { access_token: result.accessToken };
  }
}
