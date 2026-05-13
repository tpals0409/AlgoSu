/**
 * @file problem.entity.ts — Problem 엔티티 (난이도·상태·카테고리 Enum 포함)
 * @domain problem
 * @layer entity
 * @related problem.service.ts, create-problem.dto.ts
 */
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
  RUBY = 'RUBY',
}

export enum ProblemStatus {
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
  DRAFT = 'DRAFT',
  DELETED = 'DELETED',
}

/**
 * 문제 카테고리 — 프로그래머스 SQL Kit 지원 (Sprint 151)
 * ALGORITHM: 일반 알고리즘 문제 (기본값)
 * SQL: SQL 카테고리 문제 (프로그래머스 SQL 고득점 Kit 등)
 */
export enum ProblemCategory {
  ALGORITHM = 'ALGORITHM',
  SQL = 'SQL',
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

  /** 문제 카테고리 — 기본값 ALGORITHM, SQL Kit 문제는 SQL (Sprint 151) */
  @Column({ type: 'enum', enum: ProblemCategory, default: ProblemCategory.ALGORITHM })
  category!: ProblemCategory;

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
