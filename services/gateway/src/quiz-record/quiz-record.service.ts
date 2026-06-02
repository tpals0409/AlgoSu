/**
 * @file 퀴즈 기록 서비스 — BFF 오케스트레이션 (Identity 위임)
 * @domain quiz-record
 * @layer service
 * @related QuizRecordController, IdentityClientService
 *
 * Gateway 오케스트레이션 레이어:
 * - DB 접근은 IdentityClientService를 통해 Identity 서비스에 위임
 * - X-Internal-Key 첨부는 IdentityClientService가 자동 처리
 */
import { Injectable } from '@nestjs/common';
import { IdentityClientService } from '../identity-client/identity-client.service';
import { SaveQuizRecordDto } from './dto/save-quiz-record.dto';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

@Injectable()
export class QuizRecordService {
  constructor(
    private readonly identityClient: IdentityClientService,
    private readonly logger: StructuredLoggerService,
  ) {
    this.logger.setContext(QuizRecordService.name);
  }

  /**
   * 퀴즈 최고 기록 저장 — Identity upsertBest 위임 (높을 때만 갱신).
   * @param userId X-User-ID 헤더에서 검증된 사용자 ID
   * @param dto category/difficulty/scorePercent/playedAt
   */
  async save(
    userId: string,
    dto: SaveQuizRecordDto,
  ): Promise<Record<string, unknown>> {
    const record = await this.identityClient.saveQuizRecord(userId, {
      category: dto.category,
      difficulty: dto.difficulty,
      scorePercent: dto.scorePercent,
      playedAt: dto.playedAt,
    });
    this.logger.log(`퀴즈 기록 저장: userId=${userId}, category=${dto.category}`);
    return record;
  }

  /**
   * 내 전체 best 목록 조회.
   * @param userId X-User-ID 헤더에서 검증된 사용자 ID
   */
  async findMine(userId: string): Promise<Record<string, unknown>[]> {
    return this.identityClient.findQuizRecordsByUserId(userId);
  }
}
