import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
} from 'typeorm';
import { v4 as uuid } from 'uuid';

export enum SagaStep {
  DB_SAVED = 'DB_SAVED',
  GITHUB_QUEUED = 'GITHUB_QUEUED',
  AI_QUEUED = 'AI_QUEUED',
  AI_SKIPPED = 'AI_SKIPPED',
  DONE = 'DONE',
  FAILED = 'FAILED',
}

export enum GitHubSyncStatus {
  PENDING = 'PENDING',
  SYNCED = 'SYNCED',
  FAILED = 'FAILED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  SKIPPED = 'SKIPPED',
}

@Entity('submissions')
export class Submission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'study_id' })
  studyId!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'uuid', name: 'problem_id' })
  problemId!: string;

  @Column({ type: 'varchar', length: 50 })
  language!: string;

  @Column({ type: 'text' })
  code!: string;

  @Column({ type: 'enum', enum: SagaStep, default: SagaStep.DB_SAVED, name: 'saga_step' })
  sagaStep!: SagaStep;

  @Column({
    type: 'enum',
    enum: GitHubSyncStatus,
    default: GitHubSyncStatus.PENDING,
    name: 'github_sync_status',
  })
  githubSyncStatus!: GitHubSyncStatus;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'github_file_path' })
  githubFilePath!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'week_number' })
  weekNumber!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'idempotency_key' })
  idempotencyKey!: string | null;

  @Column({ type: 'text', nullable: true, name: 'ai_feedback' })
  aiFeedback!: string | null;

  @Column({ type: 'int', nullable: true, name: 'ai_score' })
  aiScore!: number | null;

  @Column({ type: 'text', nullable: true, name: 'ai_optimized_code' })
  aiOptimizedCode!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'pending', name: 'ai_analysis_status' })
  aiAnalysisStatus!: string;

  @Column({ type: 'boolean', default: false, name: 'ai_skipped' })
  aiSkipped!: boolean;

  @Column({ type: 'boolean', default: false, name: 'is_late' })
  isLate!: boolean;

  @Column({ type: 'uuid', unique: true })
  publicId!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @BeforeInsert()
  generatePublicId() {
    this.publicId = this.publicId || uuid();
  }
}
