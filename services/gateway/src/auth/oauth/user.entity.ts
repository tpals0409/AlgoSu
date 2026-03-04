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
