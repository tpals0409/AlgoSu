import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  BeforeInsert,
} from 'typeorm';
import { v4 as uuid } from 'uuid';

export enum StudyMemberRole {
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
}

export enum StudyStatus {
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
}

@Entity('studies')
export class Study {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'uuid' })
  created_by!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  github_repo!: string | null;

  @Column({ type: 'varchar', length: 10, default: StudyStatus.ACTIVE })
  status!: StudyStatus;

  @Column({ type: 'text', nullable: true })
  groundRules!: string | null;

  @Column({ type: 'uuid', unique: true })
  publicId!: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @BeforeInsert()
  generatePublicId() {
    this.publicId = this.publicId || uuid();
  }
}

@Entity('study_members')
@Index('idx_study_members_unique', ['study_id', 'user_id'], { unique: true })
export class StudyMember {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  study_id!: string;

  @Column({ type: 'uuid' })
  user_id!: string;

  // M2: DB는 VARCHAR(10) + CHECK 제약 (마이그레이션 기준), enum으로 매핑 (synchronize:false)
  @Column({ type: 'varchar', length: 10, default: StudyMemberRole.MEMBER })
  role!: StudyMemberRole;

  @Column({ type: 'varchar', length: 50 })
  nickname!: string;

  @ManyToOne(() => Study, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'study_id' })
  study!: Study;

  @CreateDateColumn()
  joined_at!: Date;
}

@Entity('study_invites')
export class StudyInvite {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  study_id!: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  code!: string;

  @Column({ type: 'uuid' })
  created_by!: string;

  @Column({ type: 'timestamp' })
  expires_at!: Date;

  @Column({ type: 'integer', default: 0 })
  used_count!: number;

  @Column({ type: 'integer', nullable: true })
  max_uses!: number | null;

  @ManyToOne(() => Study, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'study_id' })
  study!: Study;

  @CreateDateColumn()
  created_at!: Date;
}
