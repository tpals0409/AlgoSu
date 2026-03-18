/**
 * @file User 엔티티 — OAuth 사용자 + GitHub 연동 정보
 * @domain identity
 * @layer entity
 * @related oauth.service.ts, internal.controller.ts
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  BeforeInsert,
} from 'typeorm';
import { v4 as uuid } from 'uuid';

export enum OAuthProvider {
  GOOGLE = 'google',
  NAVER = 'naver',
  KAKAO = 'kakao',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  name!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatar_url!: string | null;

  @Column({ type: 'enum', enum: OAuthProvider })
  oauth_provider!: OAuthProvider;

  @Column({ type: 'boolean', default: false })
  github_connected!: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  github_user_id!: string | null;

  @Index('idx_users_github_username')
  @Column({ type: 'varchar', length: 100, nullable: true })
  github_username!: string | null;

  @Column({ type: 'text', nullable: true })
  github_token!: string | null;

  @Column({ type: 'uuid', unique: true })
  publicId!: string;

  @Index('IDX_users_profile_slug', { unique: true })
  @Column({ type: 'varchar', length: 20, nullable: true })
  profile_slug!: string | null;

  @Column({ type: 'boolean', default: false })
  is_profile_public!: boolean;

  @Column({ type: 'timestamp', nullable: true, default: null })
  deleted_at!: Date | null;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @BeforeInsert()
  generatePublicId() {
    this.publicId = this.publicId || uuid();
  }
}
