/**
 * @file ShareLink 엔티티 — 공유 링크 토큰 기반 게스트 접근
 * @domain identity
 * @layer entity
 * @related share-link.service.ts, public-share.controller.ts
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Study } from '../study/study.entity';
import { User } from '../user/user.entity';

@Entity('share_links')
export class ShareLink {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('IDX_share_links_token', { unique: true })
  @Column({ type: 'varchar', length: 64 })
  token!: string;

  @Column({ type: 'uuid' })
  study_id!: string;

  @Column({ type: 'uuid' })
  created_by!: string;

  @Column({ type: 'timestamp', nullable: true })
  expires_at!: Date | null;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @ManyToOne(() => Study, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'study_id' })
  study!: Study;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by' })
  creator!: User;
}
