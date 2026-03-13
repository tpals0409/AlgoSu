/**
 * @file ShareLinkGuard — 공유 링크 토큰 검증 (게스트 접근용)
 * @domain share
 * @layer guard
 * @related public-share.controller.ts, share-link.service.ts
 *
 * 보안 요구사항:
 * - 토큰 형식 검증 (hex 64자)
 * - 만료/비활성/미존재 토큰 모두 404 반환 (열거 공격 방어)
 * - 유효 토큰 시 x-share-study-id, x-share-created-by 헤더 주입
 */
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { ShareLink } from '../../share/share-link.entity';
import { SHARE_LINK_TOKEN_REGEX } from '../../share/share-link.constants';
import { StructuredLoggerService } from '../logger/structured-logger.service';

@Injectable()
export class ShareLinkGuard implements CanActivate {
  constructor(
    @InjectRepository(ShareLink)
    private readonly shareLinkRepository: Repository<ShareLink>,
    private readonly logger: StructuredLoggerService,
  ) {
    this.logger.setContext(ShareLinkGuard.name);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const token = req.params['token'];

    /* 1단계: 토큰 형식 검증 */
    if (!token || !SHARE_LINK_TOKEN_REGEX.test(token)) {
      throw new NotFoundException('공유 링크를 찾을 수 없습니다.');
    }

    /* 2단계: DB 조회 */
    const link = await this.shareLinkRepository.findOne({
      where: { token, is_active: true },
    });

    /* 3단계: 존재/활성/만료 검증 — 모두 404 (열거 방어) */
    if (!link) {
      throw new NotFoundException('공유 링크를 찾을 수 없습니다.');
    }

    if (link.expires_at && link.expires_at < new Date()) {
      this.logger.warn(`만료된 공유 링크 접근 시도: token=${token.slice(0, 8)}...`);
      throw new NotFoundException('공유 링크를 찾을 수 없습니다.');
    }

    /* 4단계: 컨텍스트에 스터디 정보 주입 */
    req.headers['x-share-study-id'] = link.study_id;
    req.headers['x-share-created-by'] = link.created_by;

    return true;
  }
}
