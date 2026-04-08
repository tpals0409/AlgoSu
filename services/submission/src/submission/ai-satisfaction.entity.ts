/**
 * @file AI 만족도 엔티티 — 사용자별 제출 분석 평가
 * @domain submission
 * @layer entity
 * @related Submission
 */
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { Submission } from './submission.entity';

@Entity('ai_satisfaction')
@Unique(['submissionId', 'userId'])
export class AiSatisfaction {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'uuid', name: 'submission_id' })
  submissionId!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'smallint' })
  rating!: number;  // 1 (up) | -1 (down)

  @Column({ type: 'varchar', length: 500, nullable: true })
  comment!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => Submission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'submission_id' })
  submission!: Submission;

  toJSON() {
    const { id, submission, ...rest } = this as Record<string, unknown>;
    return rest;
  }
}
