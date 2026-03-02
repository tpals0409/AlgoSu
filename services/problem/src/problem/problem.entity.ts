import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
} from 'typeorm';
import { v4 as uuid } from 'uuid';

export enum Difficulty {
  BRONZE = 'BRONZE',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  PLATINUM = 'PLATINUM',
  DIAMOND = 'DIAMOND',
}

export enum ProblemStatus {
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
  DRAFT = 'DRAFT',
}

@Entity('problems')
export class Problem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 20, name: 'week_number' })
  weekNumber!: string;

  @Column({ type: 'enum', enum: Difficulty, nullable: true })
  difficulty!: Difficulty | null;

  @Column({ type: 'smallint', nullable: true, default: null })
  level!: number | null;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'source_url' })
  sourceUrl!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'source_platform' })
  sourcePlatform!: string | null;

  @Column({ type: 'enum', enum: ProblemStatus, default: ProblemStatus.ACTIVE })
  status!: ProblemStatus;

  @Column({ type: 'timestamptz', nullable: true })
  deadline!: Date | null;

  @Column({ type: 'simple-json', nullable: true, name: 'allowed_languages' })
  allowedLanguages!: string[] | null;

  @Column({ type: 'simple-json', nullable: true })
  tags!: string[] | null;

  @Column({ type: 'uuid', name: 'study_id' })
  studyId!: string;

  @Column({ type: 'varchar', length: 255, name: 'created_by' })
  createdBy!: string;

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
