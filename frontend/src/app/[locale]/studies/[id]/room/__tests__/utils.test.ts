/**
 * @file 스터디룸 utils 테스트 — 주차 정렬(#8) + 진행중 판별
 * @domain study
 * @layer test
 * @related ../utils.ts
 */

import type { Problem } from '@/lib/api';
import { groupProblemsByWeek, isProblemActive } from '../utils';

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
