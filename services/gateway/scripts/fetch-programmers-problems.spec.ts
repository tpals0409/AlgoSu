/**
 * @file fetch-programmers-problems.spec.ts — stripSqlTitleSuffix 단위 테스트
 * @domain problem
 * @layer script
 * @related fetch-programmers-problems.ts
 *
 * Jest rootDir='src'이므로 표준 `pnpm test` 스캔 범위 외.
 * 독립 실행: npx ts-jest --testPathPattern scripts/ (또는 ts-node로 직접 검증)
 * Sprint 108 W4.5: SQL 타이틀 suffix 오염 수정 검증용.
 */

import { stripSqlTitleSuffix } from './fetch-programmers-problems';

describe('stripSqlTitleSuffix', () => {
  it('Lv.1 suffix를 제거한다', () => {
    expect(
      stripSqlTitleSuffix('모든 레코드 조회하기 Level 1 94,495명 완료'),
    ).toBe('모든 레코드 조회하기');
  });

  it('Lv.4 suffix를 제거한다', () => {
    expect(
      stripSqlTitleSuffix(
        '식품분류별 가장 비싼 식품의 정보 조회하기 Level 4 19,647명 완료',
      ),
    ).toBe('식품분류별 가장 비싼 식품의 정보 조회하기');
  });

  it('suffix 없는 정상 타이틀은 그대로 반환한다', () => {
    expect(stripSqlTitleSuffix('평균 일일 대여 요금 구하기')).toBe(
      '평균 일일 대여 요금 구하기',
    );
  });

  it('앞뒤 공백을 trim한다', () => {
    expect(stripSqlTitleSuffix('  역순 정렬하기 Level 1 95,852명 완료  ')).toBe(
      '역순 정렬하기',
    );
  });
});
