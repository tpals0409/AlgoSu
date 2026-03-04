/**
 * @file 스터디 멤버십 검증 가드 (fail-close)
 * @domain study
 * @layer guard
 * @guard study-member
 * @related StudyMember, StudyController
 */
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StudyMember } from '../../study/study.entity';
import { Request } from 'express';

@Injectable()
export class StudyMemberGuard implements CanActivate {
  private readonly logger = new Logger(StudyMemberGuard.name);
  private readonly redis: Redis;
  private static readonly CACHE_TTL = 300; // 5분

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(StudyMember)
    private readonly memberRepo: Repository<StudyMember>,
  ) {
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const userId = req.headers['x-user-id'] as string;
    const studyId = req.params['id'] || req.params['studyId'];

    if (!userId || !studyId) {
      throw new ForbiddenException('사용자 또는 스터디 정보가 없습니다.');
    }

    const cacheKey = `study:membership:${studyId}:${userId}`;

    // 1. Redis 캐시 확인
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached === '1') return true;
      if (cached === '0') throw new ForbiddenException('해당 스터디의 멤버가 아닙니다.');
    } catch (err) {
      if (err instanceof ForbiddenException) throw err;
      this.logger.warn(`Redis 캐시 조회 실패 — DB 폴백: ${(err as Error).message}`);
    }

    // 2. DB 폴백 (fail-close: 확인 불가하면 거부)
    const member = await this.memberRepo.findOne({
      where: { study_id: studyId, user_id: userId },
    });

    if (!member) {
      // 비멤버 캐시 (짧은 TTL)
      try { await this.redis.set(cacheKey, '0', 'EX', 60); } catch {}
      throw new ForbiddenException('해당 스터디의 멤버가 아닙니다.');
    }

    // 멤버 캐시
    try { await this.redis.set(cacheKey, '1', 'EX', StudyMemberGuard.CACHE_TTL); } catch {}

    return true;
  }
}
