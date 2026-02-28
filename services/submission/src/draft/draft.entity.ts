import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('drafts')
export class Draft {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'study_id' })
  studyId!: string;

  @Column({ type: 'varchar', length: 255, name: 'user_id' })
  userId!: string;

  @Column({ type: 'uuid', name: 'problem_id' })
  problemId!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  language!: string | null;

  @Column({ type: 'text', nullable: true })
  code!: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()', name: 'saved_at' })
  savedAt!: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
