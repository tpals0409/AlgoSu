/**
 * @file       section-aliases.ts
 * @domain     blog / adr
 * @layer      lib
 * @related    parser.ts, types.ts
 *
 * 영문/한글 섹션명 -> canonical 매핑.
 * 실측 데이터: sprint-62~87, 92, 130~136은 영문 섹션 혼용.
 */
import type { CanonicalSection } from './types';

/** canonical 키별 alias 목록 (trim + lowercase 비교) */
const ALIAS_MAP: ReadonlyArray<[CanonicalSection, ReadonlyArray<string>]> = [
  ['context', ['컨텍스트', '맥락', 'context']],
  ['goals', ['목표', '배경', 'background', 'goals']],
  [
    'decisions',
    ['결정', '결정 사항', '선택', 'decisions', 'decision', '의사결정'],
  ],
  ['alternatives', ['대안', '대안 (기각)', 'alternatives']],
  [
    'implementation',
    ['구현', '웨이브 실행 기록', '수정 내용', 'implementation', 'execution', '구현 결과'],
  ],
  [
    'verification',
    ['검증', '검증 결과', 'verification', 'validation', 'outcome'],
  ],
  ['branch-discipline', ['브랜치 규율', 'branch discipline']],
  ['patterns', ['신규 패턴', 'new patterns', 'patterns', '패턴']],
  ['lessons', ['교훈', 'lessons', 'lessons learned', 'gotchas']],
  [
    'carryover',
    ['이월', 'carryover', '후속', '다음 sprint', '이월 항목'],
  ],
  [
    'related-docs',
    ['관련 문서', 'related docs', 'references', '참고', '관련'],
  ],
  ['status', ['상태', 'status']],
  ['risks', ['리스크', 'risks', '위험']],
  ['consequences', ['결과', 'consequences']],
];

/** 정규화된 alias → canonical 1:1 매핑 (런타임 O(1) 조회) */
const normalizedMap = new Map<string, CanonicalSection>();

for (const [canonical, aliases] of ALIAS_MAP) {
  for (const alias of aliases) {
    normalizedMap.set(alias.trim().toLowerCase(), canonical);
  }
}

/**
 * "Sprint NNN 이월" 또는 "Sprint NNN 이월 시드" 패턴 정규식.
 * `\b`는 한국어 글자에서 word boundary가 false라 ASCII 의존 — 공백/끝/한국어 후속 명시.
 */
const CARRYOVER_RE = /^(sprint\s+\d+\s+)?이월(?:\s|$|시드|항목)/i;

/**
 * 섹션 제목 텍스트를 canonical 키로 매핑한다.
 * @param heading - H2/H3 텍스트 (## 기호 제거 후)
 * @returns 매핑된 canonical 키 또는 'other'
 */
export function resolveCanonical(heading: string): CanonicalSection {
  const normalized = heading.trim().toLowerCase();

  const direct = normalizedMap.get(normalized);
  if (direct) return direct;

  if (CARRYOVER_RE.test(heading.trim())) return 'carryover';

  return 'other';
}
