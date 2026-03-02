/**
 * @file 스터디 노트 엔티티 (문제별 1개, 스터디 공유)
 * @domain review
 * @layer entity
 * @related ReviewComment
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  BeforeInsert,
} from 'typeorm';
import { v4 as uuid } from 'uuid';

@Entity('study_notes')
@Unique('UQ_study_notes_problem_study', ['problemId', 'studyId'])
export class StudyNote {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'uuid', unique: true })
  publicId!: string;

  @Column({ type: 'uuid' })
  problemId!: string;

  @Column({ type: 'uuid' })
  studyId!: string;

  @Column({ type: 'text' })
  content!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @BeforeInsert()
  generatePublicId() {
    this.publicId = this.publicId || uuid();
  }
}
