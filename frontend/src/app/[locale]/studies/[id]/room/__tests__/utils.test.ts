/**
 * @file 스터디룸 utils 테스트 — 주차 정렬(#8) + 진행중 판별 + getSagaStatus(#13)
 * @domain study
 * @layer test
 * @related ../utils.ts
 */

import type { Problem } from '@/lib/api';
import { getSagaStatus, groupProblemsByWeek, isProblemActive } from '../utils';

const FUTURE = '2999-01-01T00:00:00.000Z';
const PAST = '2000-01-01T00:00:00.000Z';
const RECENT_PAST = '2020-06-01T00:00:00.000Z';
const OLD_PAST = '2019-01-01T00:00:00.000Z';

function mk(o: Partial<Problem>): Problem {
  return {
    id: 'x',
    title: 't',
    difficulty: 'GOLD',
    level: 11,
    weekNumber: '1월1주차',
    deadline: PAST,
    status: 'CLOSED',
    ...o,
  } as Problem;
}

describe('isProblemActive', () => {
  it('ACTIVE 상태 + 마감 미도래면 true', () => {
    expect(isProblemActive(mk({ status: 'ACTIVE', deadline: FUTURE }))).toBe(true);
  });

  it('ACTIVE 상태여도 마감 지났으면 false', () => {
    expect(isProblemActive(mk({ status: 'ACTIVE', deadline: PAST }))).toBe(false);
  });

  it('CLOSED 상태면 마감 미도래여도 false', () => {
    expect(isProblemActive(mk({ status: 'CLOSED', deadline: FUTURE }))).toBe(false);
  });
});

describe('groupProblemsByWeek', () => {
  it('주차 내에서 진행 중 문제가 종료된 문제보다 위로 정렬된다 (#8)', () => {
    const groups = groupProblemsByWeek([
      mk({ id: 'closed', weekNumber: '1월1주차', status: 'CLOSED', deadline: PAST }),
      mk({ id: 'active', weekNumber: '1월1주차', status: 'ACTIVE', deadline: FUTURE }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].problems.map((p) => p.id)).toEqual(['active', 'closed']);
    expect(groups[0].active).toBe(true);
  });

  it('진행 중 문제가 있는 주차가 종료 주차보다 상단에 온다 (최신순)', () => {
    const groups = groupProblemsByWeek([
      mk({ id: 'w1', weekNumber: '1월1주차', status: 'CLOSED', deadline: PAST }),
      mk({ id: 'w2', weekNumber: '1월2주차', status: 'ACTIVE', deadline: FUTURE }),
    ]);
    expect(groups.map((w) => w.label)).toEqual(['1월2주차', '1월1주차']);
  });

  it('종료 주차끼리는 최근 마감 주차가 위로 (연도 경계 무관)', () => {
    const groups = groupProblemsByWeek([
      mk({ id: 'old', weekNumber: '12월5주차', status: 'CLOSED', deadline: OLD_PAST }),
      mk({ id: 'recent', weekNumber: '1월1주차', status: 'CLOSED', deadline: RECENT_PAST }),
    ]);
    expect(groups.map((w) => w.label)).toEqual(['1월1주차', '12월5주차']);
  });

  it('weekNumber 없으면 미분류로 그룹핑된다', () => {
    const groups = groupProblemsByWeek([mk({ id: 'n', weekNumber: undefined as unknown as string })]);
    expect(groups[0].label).toBe('미분류');
  });
});

describe('getSagaStatus (Issue #13: GitHub 동기화 실패 오표기 방지)', () => {
  it('DONE + githubSyncStatus=FAILED → 완료가 아닌 "GitHub 동기화 실패"(error)로 표기한다', () => {
    expect(getSagaStatus('DONE', 'FAILED')).toEqual({ label: 'GitHub 동기화 실패', variant: 'error' });
  });

  it('DONE + githubSyncStatus=TOKEN_INVALID → "GitHub 동기화 실패"(error)로 표기한다', () => {
    expect(getSagaStatus('DONE', 'TOKEN_INVALID')).toEqual({ label: 'GitHub 동기화 실패', variant: 'error' });
  });

  it('DONE + githubSyncStatus=SYNCED → "분석 완료"(success) 유지', () => {
    expect(getSagaStatus('DONE', 'SYNCED')).toEqual({ label: '분석 완료', variant: 'success' });
  });

  it('DONE + githubSyncStatus 미지정 → "분석 완료"(success) 회귀 보장', () => {
    expect(getSagaStatus('DONE')).toEqual({ label: '분석 완료', variant: 'success' });
  });

  it('FAILED → "실패"(error) 회귀 보장', () => {
    expect(getSagaStatus('FAILED')).toEqual({ label: '실패', variant: 'error' });
  });

  it('AI_QUEUED → "분석 중"(warning) 회귀 보장', () => {
    expect(getSagaStatus('AI_QUEUED')).toEqual({ label: '분석 중', variant: 'warning' });
  });
});
