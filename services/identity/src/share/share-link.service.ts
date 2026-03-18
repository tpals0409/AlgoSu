/**
 * @file ShareLink 서비스 — 공유 링크 CRUD + 토큰 검증
 * @domain share
 * @layer service
 * @related share-link.controller.ts, share-link.entity.ts
 */
import { randomBytes } from 'crypto';
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, MoreThanOrEqual, Or } from 'typeorm';
import { ShareLink } from './share-link.entity';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

/** 256-bit hex 토큰 정규식 (64자 hex) */
const SHARE_LINK_TOKEN_REGEX = /^[a-f0-9]{64}$/;

@Injectable()
export class ShareLinkService {
  constructor(
    @InjectRepository(ShareLink)
    private readonly shareLinkRepository: Repository<ShareLink>,
    private readonly logger: StructuredLoggerService,
  ) {
    this.logger.setContext(ShareLinkService.name);
  }

  /**
   * 공유 링크 생성 — 256-bit hex 토큰
   * @param data studyId, createdBy, expiresAt(선택)
   * @returns 생성된 ShareLink 엔티티
   */
  async create(data: {
    study_id: string;
    created_by: string;
    expires_at?: string | null;
  }): Promise<ShareLink> {
    const token = randomBytes(32).toString('hex');
    const expiresAt = data.expires_at ? new Date(data.expires_at) : null;

    if (expiresAt && expiresAt <= new Date()) {
      throw new BadRequestException('만료 일시는 현재 시간 이후여야 합니다.');
    }

    const shareLink = this.shareLinkRepository.create({
      token,
      study_id: data.study_id,
      created_by: data.created_by,
      expires_at: expiresAt,
      is_active: true,
    });

    const saved = await this.shareLinkRepository.save(shareLink);
    this.logger.log(`공유 링크 생성: studyId=${data.study_id}, userId=${data.created_by}`);
    return saved;
  }

  /**
   * 사용자가 생성한 활성 공유 링크 목록 조회
   * @param userId 사용자 UUID
   * @param studyId 스터디 UUID
   * @returns 활성 + 미만료 ShareLink 배열
   */
  async findByUserAndStudy(userId: string, studyId: string): Promise<ShareLink[]> {
    return this.shareLinkRepository.find({
      where: {
        study_id: studyId,
        created_by: userId,
        is_active: true,
        expires_at: Or(IsNull(), MoreThanOrEqual(new Date())),
      },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * 공유 링크 비활성화 (soft delete) — 소유자 검증
   * @param id 링크 UUID
   * @param userId 요청자 UUID (소유자 검증)
   * @returns 성공 메시지
   */
  async deactivate(id: string, userId: string): Promise<{ message: string }> {
    const link = await this.shareLinkRepository.findOne({
      where: { id, is_active: true },
    });

    if (!link) {
      throw new NotFoundException('공유 링크를 찾을 수 없습니다.');
    }

    if (link.created_by !== userId) {
      throw new ForbiddenException('링크 생성자만 비활성화할 수 있습니다.');
    }

    link.is_active = false;
    await this.shareLinkRepository.save(link);
    this.logger.log(`공유 링크 비활성화: linkId=${id}, userId=${userId}`);
    return { message: '공유 링크가 비활성화되었습니다.' };
  }

  /**
   * 토큰으로 공유 링크 검증
   * @param token 64자 hex 토큰
   * @returns 유효한 ShareLink 또는 null
   */
  async verifyToken(token: string): Promise<ShareLink | null> {
    if (!SHARE_LINK_TOKEN_REGEX.test(token)) {
      return null;
    }

    const link = await this.shareLinkRepository.findOne({
      where: { token, is_active: true },
    });

    if (!link) return null;
    if (link.expires_at && link.expires_at < new Date()) return null;

    return link;
  }
}
