/**
 * @file QuizRecord 엔티티 — 로그인 사용자별 CS 퀴즈 최고 기록
 * @domain identity
 * @layer entity
 * @related quiz-record.service.ts, quiz-record.controller.ts
 *
 * best 단위 = (user_id, category, difficulty) 복합.
 * Sprint 216에서 난이도 필터 UX를 출시했으므로 기록도 난이도별로 분리한다.
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

/** 퀴즈 분야 카테고리 — frontend src/data/quiz/types.ts QuizCategory와 동일 값 */
export enum QuizRecordCategory {
  DATA_STRUCTURE = 'DATA_STRUCTURE',
  ALGORITHM = 'ALGORITHM',
  NETWORK = 'NETWORK',
  OS = 'OS',
  DATABASE = 'DATABASE',
}

/**
 * 기록 난이도 차원 — EASY/MEDIUM/HARD 3단계 + 'ALL'(전체 난이도 플레이).
 * frontend QuizDifficulty(EASY/MEDIUM/HARD)에 난이도 미선택('ALL')을 더한 집합.
 */
export type QuizRecordDifficulty = 'ALL' | 'EASY' | 'MEDIUM' | 'HARD';

@Entity('quiz_records')
@Unique('uq_quiz_records_user_category_difficulty', [
  'user_id',
  'category',
  'difficulty',
])
export class QuizRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_quiz_records_user_id')
  @Column({ type: 'uuid' })
  user_id!: string;

  @Column({ type: 'varchar', length: 30 })
  category!: QuizRecordCategory;

  @Column({ type: 'varchar', length: 10 })
  difficulty!: QuizRecordDifficulty;

  @Column({ type: 'int' })
  best_score_percent!: number;

  /** best 점수를 달성한 시각 */
  @Column({ type: 'timestamptz' })
  played_at!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
