import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum NotificationType {
  SUBMISSION_STATUS = 'SUBMISSION_STATUS',
  GITHUB_FAILED = 'GITHUB_FAILED',
  AI_COMPLETED = 'AI_COMPLETED',
  ROLE_CHANGED = 'ROLE_CHANGED',
}

@Entity('notifications')
@Index('idx_notifications_user_read', ['userId', 'read'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'enum', enum: NotificationType })
  type!: NotificationType;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'boolean', default: false })
  read!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
