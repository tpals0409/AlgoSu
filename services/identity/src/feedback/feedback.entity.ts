/**
 * @file 피드백 엔티티 — FeedbackCategory/FeedbackStatus ENUM + Feedback 테이블 정의
 * @domain identity
 * @layer entity
 * @related feedback.service.ts, feedback.controller.ts
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  BeforeInsert,
} from 'typeorm';
import { v4 as uuid } from 'uuid';

/**
 * 피드백 카테고리 4종 ENUM
 * @domain feedback
 */
export enum FeedbackCategory {
  GENERAL = 'GENERAL',
  BUG = 'BUG',
  FEATURE = 'FEATURE',
  UX = 'UX',
}

/**
 * 피드백 상태 4종 ENUM
 * @domain feedback
 */
export enum FeedbackStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
}

@Entity('feedbacks')
@Index('idx_feedbacks_user_id', ['userId'])
@Index('idx_feedbacks_status', ['status'])
@Index('idx_feedbacks_category', ['category'])
export class Feedback {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'uuid', unique: true })
  publicId!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'uuid', name: 'study_id', nullable: true })
  studyId!: string | null;

  @Column({ type: 'varchar', length: 30 })
  category!: FeedbackCategory;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'page_url' })
  pageUrl!: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true, name: 'browser_info' })
  browserInfo!: string | null;

  @Column({ type: 'text', nullable: true })
  screenshot!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'OPEN' })
  status!: FeedbackStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'resolved_at' })
  resolvedAt!: Date | null;

  @BeforeInsert()
  generatePublicId() {
    this.publicId = this.publicId || uuid();
  }

  /**
   * JSON 직렬화 — id 숨기고, screenshot은 목록에서 제외 (상세에서만 포함)
   */
  toJSON() {
    const { id, screenshot, ...rest } = this as unknown as Record<string, unknown>;
    return rest;
  }
}
