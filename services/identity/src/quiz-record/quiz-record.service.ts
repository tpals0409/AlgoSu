/**
 * @file QuizRecord 서비스 — 퀴즈 최고 기록 upsert + 조회
 * @domain identity
 * @layer service
 * @related quiz-record.entity.ts, quiz-record.controller.ts
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuizRecord } from './quiz-record.entity';
import { UpsertQuizRecordDto } from './dto/upsert-quiz-record.dto';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

@Injectable()
export class QuizRecordService {
  constructor(
    @InjectRepository(QuizRecord)
    private readonly quizRecordRepository: Repository<QuizRecord>,
    private readonly logger: StructuredLoggerService,
  ) {
    this.logger.setContext(QuizRecordService.name);
  }

  /**
   * 최고 기록 upsert — 기존 best보다 **높을 때만** 갱신(동률·낮으면 무시), 없으면 insert.
   *
   * 동시성 안전: PostgreSQL `INSERT ... ON CONFLICT ... DO UPDATE WHERE` 단일 원자 쿼리로
   * find→save TOCTOU race를 회피한다. WHERE 절(`best_score_percent < EXCLUDED.best_score_percent`)이
   * 더 높은 점수만 반영하므로 동률/하락은 자연히 무시된다.
   *
   * @param dto userId + (category, difficulty) 복합 키 + scorePercent + playedAt
   * @returns 갱신/유지된 현재 best 기록
   */
  async upsertBest(dto: UpsertQuizRecordDto): Promise<QuizRecord> {
    await this.quizRecordRepository.query(
      `INSERT INTO quiz_records
         (user_id, category, difficulty, best_score_percent, played_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, category, difficulty)
       DO UPDATE SET
         best_score_percent = EXCLUDED.best_score_percent,
         played_at = EXCLUDED.played_at,
         updated_at = NOW()
       WHERE quiz_records.best_score_percent < EXCLUDED.best_score_percent`,
      [dto.userId, dto.category, dto.difficulty, dto.scorePercent, dto.playedAt],
    );

    this.logger.log(
      `퀴즈 기록 upsert: userId=${dto.userId}, category=${dto.category}, difficulty=${dto.difficulty}, score=${dto.scorePercent}`,
    );

    return this.findOneBest(dto.userId, dto.category, dto.difficulty);
  }

  /**
   * 사용자의 전체 best 목록 조회 — 모든 (category, difficulty) 기록.
   * @param userId 사용자 ID
   */
  async findByUser(userId: string): Promise<QuizRecord[]> {
    return this.quizRecordRepository.find({
      where: { user_id: userId },
      order: { category: 'ASC', difficulty: 'ASC' },
    });
  }

  /** 단일 (user, category, difficulty) best 조회 — upsert 후 현재 상태 반환용 */
  private async findOneBest(
    userId: string,
    category: string,
    difficulty: string,
  ): Promise<QuizRecord> {
    return this.quizRecordRepository.findOneOrFail({
      where: {
        user_id: userId,
        category: category as QuizRecord['category'],
        difficulty: difficulty as QuizRecord['difficulty'],
      },
    });
  }
}
