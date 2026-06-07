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

/**
 * 퀴즈 분야 카테고리 — frontend src/data/quiz/types.ts QuizCategory와 동일 값.
 * Sprint 227에서 신규 5분야(컴퓨터구조·디자인패턴·웹/HTTP·보안·AI)를 추가했다.
 */
export enum QuizRecordCategory {
  DATA_STRUCTURE = 'DATA_STRUCTURE',
  ALGORITHM = 'ALGORITHM',
  NETWORK = 'NETWORK',
  OS = 'OS',
  DATABASE = 'DATABASE',
  COMPUTER_ARCHITECTURE = 'COMPUTER_ARCHITECTURE',
  DESIGN_PATTERN = 'DESIGN_PATTERN',
  WEB = 'WEB',
  SECURITY = 'SECURITY',
  AI = 'AI',
}

/**
 * 기록 분야 차원 — 실제 분야 enum + 'ALL'(전 분야 랜덤 플레이).
 * Sprint 227에서 분야 'ALL' 필터를 출시했으므로 기록도 'ALL' 메타 분야를 저장한다
 * (난이도 'ALL' 패턴과 대칭). DB 컬럼은 varchar(30)이라 분야 확장에 마이그레이션 불필요.
 */
export type QuizRecordCategoryValue = QuizRecordCategory | 'ALL';

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
  category!: QuizRecordCategoryValue;

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
