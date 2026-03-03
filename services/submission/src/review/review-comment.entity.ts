/**
 * @file 코드 리뷰 댓글 엔티티 (soft-delete)
 * @domain review
 * @layer entity
 * @related ReviewReply, Submission
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  BeforeInsert,
} from 'typeorm';
import { v4 as uuid } from 'uuid';
import { Submission } from '../submission/submission.entity';
import { ReviewReply } from './review-reply.entity';

@Entity('review_comments')
export class ReviewComment {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'uuid', unique: true })
  publicId!: string;

  @Column({ type: 'uuid' })
  submissionId!: string;

  @Column({ type: 'varchar', length: 255 })
  authorId!: string;

  @Column({ type: 'uuid' })
  studyId!: string;

  @Column({ type: 'int', nullable: true })
  lineNumber!: number | null;

  @Column({ type: 'text' })
  content!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt!: Date | null;

  @ManyToOne(() => Submission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'submissionId' })
  submission!: Submission;

  @OneToMany(() => ReviewReply, (reply) => reply.comment)
  replies!: ReviewReply[];

  @BeforeInsert()
  generatePublicId() {
    this.publicId = this.publicId || uuid();
  }
}
