/**
 * @file 코드 리뷰 답글 엔티티 (soft-delete)
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
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
} from 'typeorm';
import { v4 as uuid } from 'uuid';
import { ReviewComment } from './review-comment.entity';

@Entity('review_replies')
export class ReviewReply {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'uuid', unique: true })
  publicId!: string;

  @Column({ type: 'int' })
  commentId!: number;

  @Column({ type: 'uuid' })
  authorId!: string;

  @Column({ type: 'text' })
  content!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt!: Date | null;

  @ManyToOne(() => ReviewComment, (comment) => comment.replies, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'commentId' })
  comment!: ReviewComment;

  @BeforeInsert()
  generatePublicId() {
    this.publicId = this.publicId || uuid();
  }

  toJSON() {
    const { id, commentId, comment, ...rest } = this as Record<string, unknown>;
    return rest;
  }
}
