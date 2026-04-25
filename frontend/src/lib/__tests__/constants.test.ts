import {
  DIFFICULTIES,
  DIFFICULTIES_DISPLAY,
  DIFFICULTY_LABELS,
  DIFFICULTY_COLORS,
  LANGUAGES,
  LANGUAGE_VALUES,
  PROBLEM_STATUSES,
  PROBLEM_STATUS_LABELS,
  SAGA_STEP_CONFIG,
} from '@/lib/constants';
import type { SagaStep } from '@/lib/constants';

describe('DIFFICULTIES (백엔드 호환)', () => {
  it('6개 백엔드 enum 난이도를 포함한다 (BRONZE~RUBY)', () => {
    expect(DIFFICULTIES).toHaveLength(6);
  });

  it('UNCLASSIFIED를 포함하지 않는다 (백엔드 enum과 정합)', () => {
    expect(DIFFICULTIES).not.toContain('UNCLASSIFIED');
  });

  it('모든 난이도에 라벨이 있다', () => {
    for (const d of DIFFICULTIES) {
      expect(DIFFICULTY_LABELS[d]).toBeDefined();
      expect(typeof DIFFICULTY_LABELS[d]).toBe('string');
    }
  });

  it('모든 난이도에 색상이 있다', () => {
    for (const d of DIFFICULTIES) {
      expect(DIFFICULTY_COLORS[d]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe('DIFFICULTIES_DISPLAY (UI 표시 전용)', () => {
  it('7개 항목을 포함한다 (DIFFICULTIES + UNCLASSIFIED)', () => {
    expect(DIFFICULTIES_DISPLAY).toHaveLength(7);
  });

  it('UNCLASSIFIED를 포함한다', () => {
    expect(DIFFICULTIES_DISPLAY).toContain('UNCLASSIFIED');
  });

  it('DIFFICULTIES를 prefix로 가진다', () => {
    expect(DIFFICULTIES_DISPLAY.slice(0, DIFFICULTIES.length)).toEqual([...DIFFICULTIES]);
  });

  it('UNCLASSIFIED 라벨/색상이 정의되어 있다', () => {
    expect(DIFFICULTY_LABELS.UNCLASSIFIED).toBe('Unclassified');
    expect(DIFFICULTY_COLORS.UNCLASSIFIED).toBe('#8B8B95');
  });
});

describe('LANGUAGES', () => {
  it('10개 언어를 포함한다 (Sprint 108: sql 추가)', () => {
    expect(LANGUAGES).toHaveLength(10);
  });

  it('sql 언어를 포함한다 (Sprint 108)', () => {
    expect(LANGUAGES.some((l) => l.value === 'sql')).toBe(true);
    const sql = LANGUAGES.find((l) => l.value === 'sql');
    expect(sql?.label).toBe('SQL');
  });

  it('LANGUAGE_VALUES와 LANGUAGES가 일치한다', () => {
    expect(LANGUAGE_VALUES).toEqual(LANGUAGES.map((l) => l.value));
  });

  it('각 언어에 value와 label이 있다', () => {
    for (const lang of LANGUAGES) {
      expect(lang.value).toBeTruthy();
      expect(lang.label).toBeTruthy();
    }
  });
});

describe('PROBLEM_STATUSES', () => {
  it('3개 상태를 포함한다', () => {
    expect(PROBLEM_STATUSES).toHaveLength(3);
  });

  it('모든 상태에 라벨이 있다', () => {
    for (const s of PROBLEM_STATUSES) {
      expect(PROBLEM_STATUS_LABELS[s]).toBeDefined();
    }
  });
});

describe('SAGA_STEP_CONFIG', () => {
  const steps: SagaStep[] = ['DB_SAVED', 'GITHUB_QUEUED', 'AI_QUEUED', 'DONE', 'FAILED'];

  it('5개 단계를 포함한다', () => {
    expect(Object.keys(SAGA_STEP_CONFIG)).toHaveLength(5);
  });

  it('각 단계에 label과 variant가 있다', () => {
    for (const step of steps) {
      expect(SAGA_STEP_CONFIG[step].label).toBeTruthy();
      expect(SAGA_STEP_CONFIG[step].variant).toBeTruthy();
    }
  });
});
