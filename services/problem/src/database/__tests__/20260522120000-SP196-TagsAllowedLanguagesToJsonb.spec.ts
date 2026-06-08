/**
 * @file 20260522120000-SP196-TagsAllowedLanguagesToJsonb.spec.ts — SP196 jsonb 전환 마이그레이션 회귀 가드
 * @domain problem
 * @layer database/migration (test)
 * @related ../migrations/20260522120000-SP196-TagsAllowedLanguagesToJsonb.ts, ../migrations/1700000100002-AddTagsColumn.ts
 *
 * Sprint 230: 운영 롤아웃에서 `ALTER COLUMN tags TYPE jsonb`가 ERROR 42804(카탈로그 DEFAULT 식의
 * jsonb 자동 cast 불가)로 실패한 회귀를 차단한다. QueryRunner를 mock하여 발행 SQL 시퀀스를 검증:
 * up()은 각 컬럼 TYPE 변경 직전에 DROP DEFAULT를 발행하고, down()은 역변환 후 tags DEFAULT NULL을 복원한다.
 * (실 DB 동작이 아닌 SQL 순서/내용 단언 — DB 미가용 환경에서도 결정적으로 회귀를 잡는다.)
 *
 * 위치 주의: 이 spec은 반드시 migrations/ 디렉토리 밖에 둔다. data-source.ts의 마이그레이션 glob
 * (`migrations/*{.ts,.js}`)이 컴파일된 `*.spec.js`를 require하면 migration:run이 Jest 글로벌 없이
 * top-level describe()를 실행해 db-migrate init container를 크래시시킨다 (Sprint 230 Critic P1).
 */
import { QueryRunner } from 'typeorm';
import { TagsAllowedLanguagesToJsonb20260522120000 } from '../migrations/20260522120000-SP196-TagsAllowedLanguagesToJsonb';

/** 발행된 SQL을 공백 정규화해 한 줄로 — 멀티라인 템플릿 단언을 단순화 */
const normalize = (sql: string): string => sql.replace(/\s+/g, ' ').trim();

/** query 호출 인자(SQL)만 순서대로 추출 */
const sqlSequence = (queryMock: jest.Mock): string[] =>
  queryMock.mock.calls.map((call) => normalize(String(call[0])));

/** sequence에서 substring을 포함하는 첫 인덱스 (없으면 -1) */
const indexOfContaining = (sequence: string[], needle: string): number =>
  sequence.findIndex((s) => s.includes(needle));

describe('TagsAllowedLanguagesToJsonb20260522120000', () => {
  let migration: TagsAllowedLanguagesToJsonb20260522120000;
  let queryRunner: { query: jest.Mock };

  beforeEach(() => {
    migration = new TagsAllowedLanguagesToJsonb20260522120000();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  describe('up()', () => {
    it('각 컬럼 TYPE 변경 직전에 DROP DEFAULT를 발행한다 (ERROR 42804 회귀 가드)', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const seq = sqlSequence(queryRunner.query);

      const tagsDropDefault = indexOfContaining(
        seq,
        'ALTER COLUMN tags DROP DEFAULT',
      );
      const tagsTypeChange = indexOfContaining(
        seq,
        'ALTER COLUMN tags TYPE jsonb',
      );
      const langDropDefault = indexOfContaining(
        seq,
        'ALTER COLUMN allowed_languages DROP DEFAULT',
      );
      const langTypeChange = indexOfContaining(
        seq,
        'ALTER COLUMN allowed_languages TYPE jsonb',
      );

      // 4개 쿼리 모두 존재
      expect(tagsDropDefault).toBeGreaterThanOrEqual(0);
      expect(tagsTypeChange).toBeGreaterThanOrEqual(0);
      expect(langDropDefault).toBeGreaterThanOrEqual(0);
      expect(langTypeChange).toBeGreaterThanOrEqual(0);

      // DROP DEFAULT가 반드시 해당 컬럼 TYPE 변경보다 먼저
      expect(tagsDropDefault).toBeLessThan(tagsTypeChange);
      expect(langDropDefault).toBeLessThan(langTypeChange);
    });

    it('jsonb 전환 후 SET DEFAULT를 재설정하지 않는다 (entity가 default 미선언 → 암묵 NULL 정합)', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const seq = sqlSequence(queryRunner.query);

      expect(indexOfContaining(seq, 'ALTER COLUMN tags SET DEFAULT')).toBe(-1);
      expect(
        indexOfContaining(seq, 'ALTER COLUMN allowed_languages SET DEFAULT'),
      ).toBe(-1);
    });

    it('USING NULL 가드를 유지한다 (데이터 보정 없음)', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const seq = sqlSequence(queryRunner.query);

      expect(
        seq.some((s) =>
          s.includes('ALTER COLUMN tags TYPE jsonb USING CASE WHEN tags IS NULL THEN NULL ELSE tags::jsonb END'),
        ),
      ).toBe(true);
    });

    it('CONCURRENTLY 인덱스 보호: TYPE 변경 → COMMIT → 세션 timeout 재설정 → CREATE INDEX CONCURRENTLY → BEGIN 순서를 보존한다', async () => {
      await migration.up(queryRunner as unknown as QueryRunner);
      const seq = sqlSequence(queryRunner.query);

      const typeChange = indexOfContaining(seq, 'ALTER COLUMN allowed_languages TYPE jsonb');
      const commit = seq.indexOf('COMMIT');
      const sessionTimeout = seq.indexOf('SET statement_timeout = 0');
      const createIndex = indexOfContaining(
        seq,
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_problems_tags_gin',
      );
      const begin = seq.indexOf('BEGIN');

      expect(typeChange).toBeGreaterThanOrEqual(0);
      expect(commit).toBeGreaterThan(typeChange);
      expect(sessionTimeout).toBeGreaterThan(commit);
      expect(createIndex).toBeGreaterThan(sessionTimeout);
      expect(begin).toBeGreaterThan(createIndex);
    });
  });

  describe('down()', () => {
    it('GIN 인덱스 DROP을 ALTER TYPE 역변환보다 먼저 발행한다', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);
      const seq = sqlSequence(queryRunner.query);

      const dropIndex = indexOfContaining(seq, 'DROP INDEX IF EXISTS idx_problems_tags_gin');
      const tagsRevert = indexOfContaining(seq, 'ALTER COLUMN tags TYPE varchar(500)');

      expect(dropIndex).toBeGreaterThanOrEqual(0);
      expect(tagsRevert).toBeGreaterThan(dropIndex);
    });

    it('jsonb → varchar(500) 역변환 후 tags DEFAULT NULL을 복원한다 (완전 가역)', async () => {
      await migration.down(queryRunner as unknown as QueryRunner);
      const seq = sqlSequence(queryRunner.query);

      const tagsRevert = indexOfContaining(seq, 'ALTER COLUMN tags TYPE varchar(500)');
      const langRevert = indexOfContaining(seq, 'ALTER COLUMN allowed_languages TYPE varchar(500)');
      const tagsSetDefault = indexOfContaining(seq, 'ALTER COLUMN tags SET DEFAULT NULL');

      expect(tagsRevert).toBeGreaterThanOrEqual(0);
      expect(langRevert).toBeGreaterThanOrEqual(0);
      expect(tagsSetDefault).toBeGreaterThanOrEqual(0);
      // DEFAULT 복원은 타입 역변환 이후
      expect(tagsSetDefault).toBeGreaterThan(tagsRevert);
    });
  });
});
