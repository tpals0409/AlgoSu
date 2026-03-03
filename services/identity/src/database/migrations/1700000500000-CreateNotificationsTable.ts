import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotificationsTable1700000500000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE notification_type_enum AS ENUM (
        'SUBMISSION_STATUS',
        'GITHUB_FAILED',
        'AI_COMPLETED',
        'ROLE_CHANGED'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE notifications (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     UUID NOT NULL,
        type        notification_type_enum NOT NULL,
        title       VARCHAR(200) NOT NULL,
        message     TEXT NOT NULL,
        read        BOOLEAN NOT NULL DEFAULT false,
        created_at  TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_notifications_user_read
      ON notifications (user_id, read)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_notifications_user_created
      ON notifications (user_id, created_at DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS notifications`);
    await queryRunner.query(`DROP TYPE IF EXISTS notification_type_enum`);
  }
}
