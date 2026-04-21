/**
 * @file fetch-programmers-problems.spec.ts — stripSqlTitleSuffix / parseLevelText 단위 테스트
 * @domain problem
 * @layer script
 * @related fetch-programmers-problems.ts
 *
 * Jest rootDir='src'이므로 표준 `pnpm test` 스캔 범위 외.
 * 독립 실행: npx ts-jest --testPathPattern scripts/ (또는 ts-node로 직접 검증)
 * Sprint 108 W4.5: SQL 타이틀 suffix 오염 수정 검증용.
 * Sprint 109 W2-c2: parseLevelText 경계값 테스트 보강.
 */

import { stripSqlTitleSuffix, parseLevelText } from './fetch-programmers-problems';
import type { Level } from './fetch-programmers-problems';

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

describe('parseLevelText', () => {
  // ── Lv. 형식 (알고리즘 챌린지 표준) ──

  it('Lv.1 형식을 파싱한다', () => {
    expect(parseLevelText('Lv.1', 0 as Level)).toBe(1);
  });

  it('Lv. 3 (공백 포함) 형식을 파싱한다', () => {
    expect(parseLevelText('Lv. 3', 0 as Level)).toBe(3);
  });

  it('Lv5 (점 없음) 형식을 파싱한다', () => {
    expect(parseLevelText('Lv5', 0 as Level)).toBe(5);
  });

  // ── Level 형식 (SQL Kit) ──

  it('Level 1 형식을 파싱한다', () => {
    expect(parseLevelText('Level 1', 0 as Level)).toBe(1);
  });

  it('level 4 (소문자) 형식을 파싱한다', () => {
    expect(parseLevelText('level 4', 0 as Level)).toBe(4);
  });

  // ── ★ 형식 ──

  it('★★★ (별 3개)를 레벨 3으로 파싱한다', () => {
    expect(parseLevelText('★★★', 0 as Level)).toBe(3);
  });

  it('★ (별 1개)를 레벨 1로 파싱한다', () => {
    expect(parseLevelText('★', 0 as Level)).toBe(1);
  });

  // ── 경계값 / fallback ──

  it('빈 문자열은 defaultLevel을 반환한다', () => {
    expect(parseLevelText('', 2 as Level)).toBe(2);
  });

  it('매칭 없는 텍스트는 defaultLevel을 반환한다', () => {
    expect(parseLevelText('난이도 없음', 0 as Level)).toBe(0);
  });

  it('Lv 패턴과 ★ 모두 없으면 defaultLevel을 반환한다', () => {
    expect(parseLevelText('어떤 텍스트', 3 as Level)).toBe(3);
  });

  // ── 우선순위: Lv/Level 패턴이 ★보다 우선 ──

  it('Lv 패턴이 ★보다 우선한다', () => {
    expect(parseLevelText('Lv.2 ★★★★★', 0 as Level)).toBe(2);
  });

  // ── 단일 자릿수 캡처 확인 (regex \d 하나만 캡처) ──

  it('Level 뒤 첫 자릿수만 캡처한다', () => {
    expect(parseLevelText('Level 10', 0 as Level)).toBe(1);
  });

  // ── ★ 범위 경계 (6개 이상은 defaultLevel) ──

  it('★ 6개 이상은 defaultLevel을 반환한다', () => {
    expect(parseLevelText('★★★★★★', 0 as Level)).toBe(0);
  });
});
