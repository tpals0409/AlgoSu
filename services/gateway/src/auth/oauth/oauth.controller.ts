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
  ): Promise<{ url: string }> {
    const { url } = await this.oauthService.getAuthorizationUrl(provider);
    return { url };
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

    // H4: 토큰을 fragment(#)로 전달 — URL 히스토리/서버 로그/Referrer 노출 방지
    const frontendUrl = process.env['FRONTEND_URL'] ?? 'http://localhost:3001';
    const params = new URLSearchParams({
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
      github_connected: String(result.user.github_connected),
    });
    res.redirect(`${frontendUrl}/callback#${params.toString()}`);
  }

  /**
   * POST /auth/github/link — GitHub OAuth 연동 시작
   * GitHub OAuth Authorization URL을 반환한다.
   * 인증된 사용자만 접근 가능 (JWT 미들웨어 통과 후)
   */
  @Post('github/link')
  async linkGitHub(
    @Req() req: Request,
  ): Promise<{ url: string }> {
    const userId = req.headers['x-user-id'] as string;
    return this.oauthService.getGitHubAuthUrl(userId);
  }

  /**
   * GET /auth/github/link/callback — GitHub OAuth 연동 콜백
   * GitHub에서 code+state를 받아 토큰 교환 후 프론트엔드로 리다이렉트
   */
  @Get('github/link/callback')
  async handleGitHubLinkCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ): Promise<void> {
    if (!code || !state) {
      throw new BadRequestException('GitHub 콜백에 code 또는 state가 없습니다.');
    }

    const userId = await this.oauthService.validateAndConsumeGitHubLinkState(state);
    const user = await this.oauthService.linkGitHub(userId, code);

    this.logger.log(`GitHub 연동 완료: userId=${userId}, github=${user.github_username}`);

    const frontendUrl = process.env['FRONTEND_URL'] ?? 'http://localhost:3001';
    const params = new URLSearchParams({
      github_connected: 'true',
      github_username: user.github_username ?? '',
    });
    res.redirect(`${frontendUrl}/github-link/complete#${params.toString()}`);
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
   * 기존 연동을 해제하고 새 GitHub 계정으로 연동 시작
   */
  @Post('github/relink')
  async relinkGitHub(
    @Req() req: Request,
  ): Promise<{ url: string }> {
    const userId = req.headers['x-user-id'] as string;
    return this.oauthService.getGitHubAuthUrl(userId);
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
