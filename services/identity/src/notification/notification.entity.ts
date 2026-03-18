/**
 * @file 알림 엔티티 — NotificationType 9종 ENUM + Notification 테이블 정의
 * @domain identity
 * @layer entity
 * @related notification.service.ts, notification.controller.ts
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
 * 알림 타입 9종 ENUM
 * @domain notification
 */
export enum NotificationType {
  SUBMISSION_STATUS = 'SUBMISSION_STATUS',
  AI_COMPLETED = 'AI_COMPLETED',
  GITHUB_FAILED = 'GITHUB_FAILED',
  ROLE_CHANGED = 'ROLE_CHANGED',
  PROBLEM_CREATED = 'PROBLEM_CREATED',
  DEADLINE_REMINDER = 'DEADLINE_REMINDER',
  MEMBER_JOINED = 'MEMBER_JOINED',
  MEMBER_LEFT = 'MEMBER_LEFT',
  STUDY_CLOSED = 'STUDY_CLOSED',
}

@Entity('notifications')
@Index('idx_notifications_user_read', ['userId', 'read'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'uuid', name: 'study_id', nullable: true })
  studyId!: string | null;

  @Column({ type: 'enum', enum: NotificationType })
  type!: NotificationType;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  link!: string | null;

  @Column({ type: 'boolean', default: false })
  read!: boolean;

  @Column({ type: 'uuid', unique: true })
  publicId!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @BeforeInsert()
  generatePublicId() {
    this.publicId = this.publicId || uuid();
  }
}
