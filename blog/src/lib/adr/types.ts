/**
 * @file       types.ts
 * @domain     blog / adr
 * @layer      lib
 * @related    loader.ts, parser.ts, index-builder.ts
 *
 * ADR 도메인 타입 정의 — Data Model SSOT.
 */

/** ADR 분류: 영구(permanent), 토픽(topic), 스프린트(sprint) */
export type AdrKind = 'permanent' | 'topic' | 'sprint';

/** ADR 상태 (한글/영문 정규화 이후) */
export type AdrStatus =
  | 'proposed'
  | 'accepted'
  | 'completed'
  | 'implemented'
  | 'deferred'
  | 'partial'
  | 'rejected'
  | 'unknown';

/** 영향도 등급 (단어수 + PR 행 + 키워드 기반 휴리스틱) */
export type Impact = 'low' | 'medium' | 'high' | 'critical';

/** 섹션 정규 키 — 영문/한글 alias를 하나로 합산 */
export type CanonicalSection =
  | 'context'
  | 'goals'
  | 'decisions'
  | 'alternatives'
  | 'implementation'
  | 'verification'
  | 'branch-discipline'
  | 'patterns'
  | 'lessons'
  | 'carryover'
  | 'related-docs'
  | 'status'
  | 'risks'
  | 'consequences'
  | 'other';

/** ADR 파일 메타데이터 */
export interface AdrMeta {
  kind: AdrKind;
  id: string;
  slug: string;
  filePath: string;
  sprint?: number;
  title: string;
  date?: string;
  status: AdrStatus;
  rawStatus?: string;
  agents?: string[];
  relatedAdrs?: string[];
  relatedMemory?: string[];
  hasFrontmatter: boolean;
  impact: Impact;
  readingTimeMin: number;
  /**
   * 영문 ADR 본문 존재 여부 — locale='en'일 때 loader에서 설정.
   * true면 docs/adr-en/<path>의 영문판이 로드되었음을 의미하며,
   * false면 docs/adr/<path>의 한국어 원본이 fallback으로 로드됨.
   * locale='ko'일 때는 항상 false (영문 디렉토리 미참조).
   * Sprint 157 P10에서 도입.
   */
  hasEnTranslation?: boolean;
  /** Hero 영역 TL;DR 텍스트 — frontmatter tldr 또는 목표 섹션 자동 추출 */
  tldr?: string;
  /**
   * frontmatter topics — ADR 주제 분류 id 목록, KR SSOT.
   * EN locale의 경우 loader가 KR topics를 주입한다(EN frontmatter에 topics를 넣지 않음).
   * Sprint 189 D2에서 도입 — 6주제: operations, agents, cicd, data, security, product.
   */
  topics?: string[];
}

/** H2/H3 섹션 파싱 결과 */
export interface AdrSection {
  heading: string;
  canonical: CanonicalSection;
  level: 2 | 3;
  anchorId: string;
  rawMarkdown: string;
  containsMermaid: boolean;
  prTable?: PrTableRow[];
}

/** PR 테이블 행 (GFM 표 파싱) */
export interface PrTableRow {
  prNumber?: string;
  title: string;
  scope?: string;
  rawCells: string[];
}

/** 파싱 경고 */
export interface ParseWarning {
  level: 'info' | 'warn';
  code:
    | 'no-frontmatter'
    | 'no-date'
    | 'unknown-section'
    | 'invalid-related-adr'
    | 'no-pr-table';
  detail: string;
}

/** 결정 항목 (decisions 섹션에서 추출) */
export interface AdrDecision {
  title: string;
  description: string;
}

/** Phase 항목 (implementation 섹션 PR 표에서 추출) */
export interface AdrPhaseEntry {
  phase: string;
  prNumber?: string;
  prUrl?: string;
  owner: string;
  summary: string;
  lines?: string;
}

/** 교훈 항목 (lessons 섹션 list item에서 추출) */
export interface AdrLessonEntry {
  /** `- **bold**: text` 패턴의 bold 부분. 없으면 undefined */
  title?: string;
  /** stripMarkdown 적용된 평문 본문 */
  description: string;
}

/** 이월 항목 (carryover 섹션 list item에서 추출) */
export interface AdrCarryoverEntry {
  /** `- **bold**: text` 패턴의 bold 부분. 없으면 undefined */
  title?: string;
  /** stripMarkdown 적용된 평문 본문 */
  description: string;
  /** title에서 "Sprint NNN" 패턴이 감지되면 추출 */
  sprint?: string;
}

/** 단일 ADR 파싱 완료 객체 */
export interface AdrDoc {
  meta: AdrMeta;
  sections: AdrSection[];
  /** 원본 마크다운 (frontmatter 제거 후) — 메타데이터/외부 링크 추출 등 SSOT */
  bodyMarkdown: string;
  /**
   * detail-view prose 영역 전용 본문. lessons/carryover 섹션 raw 마크다운 +
   * implementation PR 표 라인을 제거한 결과 — Hero/Strip/Grid/Callout 와의 중복 차단.
   * graceful degradation: 해당 섹션/표 검출 실패 시 bodyMarkdown과 동일.
   */
  bodyMarkdownForProse: string;
  warnings: ParseWarning[];
  decisions?: AdrDecision[];
  phases?: AdrPhaseEntry[];
  lessons?: AdrLessonEntry[];
  carryover?: AdrCarryoverEntry[];
}

/** 검색 인덱스용 문서 */
export interface SearchDoc {
  id: string;
  url: string;
  title: string;
  sprint?: number;
  status: AdrStatus;
  kind: AdrKind;
  body: string;
  agents: string[];
}

/** 전체 ADR 인덱스 */
export interface AdrIndex {
  all: AdrMeta[];
  byKind: Record<AdrKind, AdrMeta[]>;
  bySprint: Map<number, AdrMeta>;
  searchDocs: SearchDoc[];
}
