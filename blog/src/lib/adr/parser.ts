/**
 * @file       parser.ts
 * @domain     blog / adr
 * @layer      lib
 * @related    types.ts, section-aliases.ts, loader.ts
 *
 * ADR 마크다운 파싱 — frontmatter/body/섹션/메타데이터 추출.
 * frontmatter 없는 영구 ADR(ADR-001 H2 상태, ADR-002~028 dash-list) fallback 대응.
 */
import matter from 'gray-matter';

import type {
  AdrCarryoverEntry,
  AdrDecision,
  AdrDoc,
  AdrKind,
  AdrLessonEntry,
  AdrMeta,
  AdrPhaseEntry,
  AdrSection,
  AdrStatus,
  Impact,
  ParseWarning,
  PrTableRow,
} from './types';
import { resolveCanonical } from './section-aliases';

/* ─── 상태 정규화 매핑 ────────────────────────────── */

const STATUS_MAP: ReadonlyMap<string, AdrStatus> = new Map([
  ['완료', 'completed'],
  ['구현 완료', 'completed'],
  ['수락됨', 'accepted'],
  ['수용됨', 'accepted'],
  ['보류', 'deferred'],
  ['제안됨', 'proposed'],
  ['부분 적용됨', 'partial'],
  ['implemented', 'completed'],
  ['deferred', 'deferred'],
  ['accepted', 'accepted'],
  ['proposed', 'proposed'],
  ['completed', 'completed'],
  ['complete', 'completed'],
  ['rejected', 'rejected'],
  ['accepted-partial', 'partial'],
]);

/* ─── 임팩트 키워드 ──────────────────────────────── */

const CRITICAL_KEYWORDS = /incident|rollback|hard\s*block/i;

/* ─── 외부 링크 추출 정규식 ──────────────────────── */

const ADR_LINK_RE = /\[([^\]]*)\]\(([^)]*(?:docs\/adr|sprint-\d+)[^)]*)\)/g;

/* ─── 헬퍼 함수들 ────────────────────────────────── */

/**
 * ADR ID를 정규화한다.
 * '83' -> 'sprint-83', 'sprint-83.md' -> 'sprint-83',
 * '../sprints/sprint-83.md' -> 'sprint-83', 'ADR-001-...' -> 'ADR-001'
 */
export function normalizeAdrId(raw: string): string {
  const trimmed = raw.trim();

  const adrMatch = trimmed.match(/^(ADR-\d+)/i);
  if (adrMatch) return adrMatch[1].toUpperCase();

  const sprintMatch = trimmed.match(/sprint-(\d+)/i);
  if (sprintMatch) return `sprint-${sprintMatch[1]}`;

  if (/^\d+$/.test(trimmed)) return `sprint-${trimmed}`;

  return trimmed.replace(/\.md$/, '');
}

/**
 * frontmatter 또는 fallback에서 추출한 raw 상태 문자열을 AdrStatus로 변환한다.
 */
export function normalizeStatus(raw: string): AdrStatus {
  const cleaned = raw
    .replace(/\(.*?\)/g, '')
    .replace(/—.*$/, '')
    .trim()
    .toLowerCase();

  const direct = STATUS_MAP.get(cleaned);
  if (direct) return direct;

  for (const [key, val] of STATUS_MAP) {
    if (cleaned.includes(key)) return val;
  }

  return 'unknown';
}

/**
 * 텍스트를 kebab-case 앵커 ID로 변환한다.
 */
function toAnchorId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s가-힣-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * 한글 기준 읽기 시간(분)을 계산한다. (분당 500자)
 */
function calcReadingTime(text: string): number {
  const charCount = text.replace(/\s/g, '').length;
  return Math.max(1, Math.ceil(charCount / 500));
}

/**
 * 단어수 + PR행 + 키워드 기반 영향도 휴리스틱을 적용한다.
 */
function calcImpact(body: string, prRowCount: number): Impact {
  const wordCount = body.replace(/\s+/g, ' ').trim().length;

  if (wordCount > 8000 || CRITICAL_KEYWORDS.test(body)) return 'critical';
  if (wordCount > 4000 || prRowCount >= 5) return 'high';
  if (wordCount >= 1500) return 'medium';
  return 'low';
}

/**
 * GFM 표에서 PR 헤더를 감지하고 PrTableRow[]를 추출한다.
 */
function parsePrTable(markdown: string): PrTableRow[] | undefined {
  const lines = markdown.split('\n');
  const headerIdx = lines.findIndex(
    (l) => /\|/.test(l) && /pr|pull\s*request/i.test(l),
  );
  if (headerIdx < 0) return undefined;

  const headerCells = splitTableRow(lines[headerIdx]);
  const prCol = headerCells.findIndex((c) => /pr|pull\s*request/i.test(c));
  if (prCol < 0) return undefined;

  const rows: PrTableRow[] = [];
  for (let i = headerIdx + 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes('|')) break;
    const cells = splitTableRow(line);
    if (cells.length === 0) break;

    const prCell = cells[prCol]?.trim() ?? '';
    const prMatch = prCell.match(/#?(\d+)/);

    rows.push({
      prNumber: prMatch ? prMatch[1] : undefined,
      title: cells[1]?.trim() ?? '',
      scope: cells[2]?.trim(),
      rawCells: cells,
    });
  }

  return rows.length > 0 ? rows : undefined;
}

/**
 * 파이프 구분 GFM 행을 셀 배열로 분리한다.
 * escaped pipe(`\|`)를 placeholder로 치환하여 의도치 않은 셀 분리를 방지한다.
 */
function splitTableRow(line: string): string[] {
  const PLACEHOLDER = '\x00PIPE\x00';
  return line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .replace(/\\\|/g, PLACEHOLDER)
    .split('|')
    .map((c) => c.replace(/\x00PIPE\x00/g, '|').trim());
}

/**
 * 본문에서 outgoing ADR 링크를 추출한다.
 */
function extractOutgoingLinks(body: string): string[] {
  const links: string[] = [];
  let match: RegExpExecArray | null;
  ADR_LINK_RE.lastIndex = 0;

  while ((match = ADR_LINK_RE.exec(body)) !== null) {
    links.push(normalizeAdrId(match[2]));
  }

  return [...new Set(links)];
}

/**
 * frontmatter 없는 영구 ADR에서 상태를 fallback 추출한다.
 * ADR-001: `## 상태` H2 직후 한 줄
 * ADR-002~028: `- **상태**: ...` dash-list
 */
function extractFallbackStatus(body: string): string | undefined {
  const h2Match = body.match(
    /^##\s*상태\s*\n+(.+)/m,
  );
  if (h2Match) return h2Match[1].trim();

  const dashMatch = body.match(
    /^-\s*\*{2}상태\*{2}\s*:\s*(.+)/m,
  );
  if (dashMatch) return dashMatch[1].trim();

  return undefined;
}

/**
 * H1 텍스트에서 title을 추출한다.
 */
function extractH1Title(body: string): string | undefined {
  const match = body.match(/^#\s+(.+)/m);
  return match ? match[1].trim() : undefined;
}

/* ─── 섹션 토큰화 ────────────────────────────────── */

/** H2 기준으로 body를 섹션 배열로 분리한다. */
function tokenizeSections(
  body: string,
  warnings: ParseWarning[],
): AdrSection[] {
  const sections: AdrSection[] = [];
  const h2Re = /^(#{2,3})\s+(.+)/gm;
  const matches: { level: 2 | 3; heading: string; start: number }[] = [];
  let m: RegExpExecArray | null;

  while ((m = h2Re.exec(body)) !== null) {
    const level = m[1].length as 2 | 3;
    matches.push({ level, heading: m[2].trim(), start: m.index });
  }

  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const end = i + 1 < matches.length ? matches[i + 1].start : body.length;
    const rawMarkdown = body.slice(cur.start, end).trim();
    const canonical = resolveCanonical(cur.heading);

    if (canonical === 'other') {
      warnings.push({
        level: 'info',
        code: 'unknown-section',
        detail: `Unrecognized section: "${cur.heading}"`,
      });
    }

    const containsMermaid = /```mermaid/i.test(rawMarkdown);
    const prTable =
      canonical === 'implementation' ? parsePrTable(rawMarkdown) : undefined;

    sections.push({
      heading: cur.heading,
      canonical,
      level: cur.level,
      anchorId: toAnchorId(cur.heading),
      rawMarkdown,
      containsMermaid,
      prTable,
    });
  }

  return sections;
}

/* ─── TL;DR / 결정 / Phase 추출 ─────────────────── */

/** 마크다운 서식(bold, link, code)을 제거하여 평문 텍스트로 변환한다. */
function stripMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

/**
 * Hero 영역 TL;DR 텍스트를 추출한다.
 * frontmatter tldr > 목표 섹션 첫 번째 list item fallback.
 */
export function extractTldr(
  fm: Record<string, unknown>,
  sections: AdrSection[],
): string | undefined {
  if (typeof fm.tldr === 'string' && fm.tldr.length > 0) {
    return fm.tldr;
  }

  const goalsSection = sections.find((s) => s.canonical === 'goals');
  if (!goalsSection) return undefined;

  const listMatch = goalsSection.rawMarkdown.match(/^-\s+(.+)/m);
  if (!listMatch) return undefined;

  return stripMarkdown(listMatch[1]);
}

/**
 * decisions 섹션에서 `- **제목**: 설명` 패턴의 결정 항목을 추출한다.
 */
export function extractDecisionItems(
  sections: AdrSection[],
): AdrDecision[] | undefined {
  const section = sections.find((s) => s.canonical === 'decisions');
  if (!section) return undefined;

  const items: AdrDecision[] = [];
  const re = /^-\s+\*{2}([^*]+)\*{2}\s*:\s*(.+)/gm;
  let match: RegExpExecArray | null;

  while ((match = re.exec(section.rawMarkdown)) !== null) {
    items.push({
      title: match[1].trim(),
      description: stripMarkdown(match[2]),
    });
  }

  return items.length > 0 ? items : undefined;
}

/**
 * implementation 섹션의 PR 표에서 Phase 엔트리를 추출한다.
 * 표 헤더 열에서 Phase/Owner/Lines/변경 내용 열 인덱스를 동적 탐색한다.
 */
export function extractPhaseEntries(
  sections: AdrSection[],
): AdrPhaseEntry[] | undefined {
  const implSection = sections.find(
    (s) => s.canonical === 'implementation' && s.prTable,
  );
  if (!implSection?.prTable) return undefined;

  const headerMatch = implSection.rawMarkdown.match(
    /^(\|[^\n]+)/m,
  );
  if (!headerMatch) return undefined;

  const headers = splitTableRow(headerMatch[0]).map((h) =>
    h.toLowerCase(),
  );
  const phaseCol = findColIndex(headers, ['phase']);
  if (phaseCol < 0) return undefined; // Phase 열 없으면 PR 표가 아님 — bogus 카드 차단
  const ownerCol = findColIndex(headers, ['owner', '담당']);
  const summaryCol = findColIndex(headers, ['변경 내용', '변경내용', '변경', 'summary', 'description']);
  const linesCol = findColIndex(headers, ['lines', '라인']);

  const entries: AdrPhaseEntry[] = [];

  for (const row of implSection.prTable) {
    const cells = row.rawCells;
    const prUrl = extractPrUrl(cells);

    entries.push({
      phase: safeCell(cells, phaseCol) || row.title || '',
      prNumber: row.prNumber,
      prUrl,
      owner: safeCell(cells, ownerCol) || '',
      summary: stripMarkdown(safeCell(cells, summaryCol) || row.title),
      lines: safeCell(cells, linesCol) || undefined,
    });
  }

  return entries.length > 0 ? entries : undefined;
}

/** 헤더 배열에서 후보 키워드 중 첫 매치 인덱스를 반환한다. */
function findColIndex(headers: string[], candidates: string[]): number {
  return headers.findIndex((h) =>
    candidates.some((c) => h.includes(c)),
  );
}

/** rawCells에서 안전하게 셀 값을 가져온다. */
function safeCell(cells: string[], idx: number): string {
  if (idx < 0 || idx >= cells.length) return '';
  return cells[idx].trim();
}

/** rawCells에서 markdown 링크 URL을 추출한다. */
function extractPrUrl(cells: string[]): string | undefined {
  for (const cell of cells) {
    const match = cell.match(/\[#?\d+\]\(([^)]+)\)/);
    if (match) return match[1];
  }
  return undefined;
}

/* ─── Lessons / Carryover 추출 ──────────────────── */

/** "Sprint NNN" 패턴을 title에서 감지하여 sprint 번호 문자열을 반환한다. */
function extractSprintTag(title: string): string | undefined {
  const match = title.match(/sprint\s+(\d+)/i);
  return match ? match[1] : undefined;
}

/**
 * 섹션 rawMarkdown에서 top-level list item을 추출한다.
 * 지원 패턴:
 *  - `- **bold**: text` → { title, description }
 *  - `- 일반 텍스트` → { description }
 *  - `1. **bold** — text` / `1. 일반 텍스트` (숫자 list, ADR-160 등에서 사용)
 * 들여쓰기된 sub-list(`  -`/`  1.`)는 현재 item 본문에 통합한다.
 */
function extractListItems(
  rawMarkdown: string,
): { title?: string; description: string }[] {
  // H2/H3 header 라인은 결과에서 제외 (gm 플래그로 전체 매치)
  const body = rawMarkdown.replace(/^#{2,3}\s+.+$/gm, '');
  const lines = body.split('\n');
  const items: { title?: string; description: string }[] = [];

  let currentTitle: string | undefined;
  let currentBody: string[] = [];
  let active = false;

  const flush = () => {
    if (!active) return;
    const joined = currentBody.join(' ').trim();
    if (joined.length === 0 && !currentTitle) return;
    items.push({
      title: currentTitle,
      description: stripMarkdown(joined),
    });
    currentTitle = undefined;
    currentBody = [];
    active = false;
  };

  // top-level list item: `-` 또는 `1.` 시작
  const TOP_LIST_RE = /^(?:-|\d+\.)\s+(.+)$/;
  // sub-list (2+ 공백 들여쓰기)
  const SUB_LIST_RE = /^\s{2,}(?:-|\d+\.)\s+(.+)$/;
  // `- **bold**: text` 또는 `1. **bold** — text` 같은 bold-title 패턴
  // : 또는 — (em-dash) 또는 - (hyphen, 공백 양옆) 구분자 허용
  const BOLD_TITLE_RE = /^\*{2}([^*]+)\*{2}\s*(?::|—|–|\s-\s)\s*(.+)$/;

  for (const line of lines) {
    const topMatch = line.match(TOP_LIST_RE);
    if (topMatch) {
      flush();
      active = true;
      const text = topMatch[1];
      const boldMatch = text.match(BOLD_TITLE_RE);
      if (boldMatch) {
        currentTitle = boldMatch[1].trim();
        currentBody = [boldMatch[2]];
      } else {
        currentTitle = undefined;
        currentBody = [text];
      }
      continue;
    }

    const subMatch = line.match(SUB_LIST_RE);
    if (subMatch && active) {
      currentBody.push(subMatch[1]);
      continue;
    }

    if (line.trim() === '') {
      flush();
      continue;
    }
    if (active) currentBody.push(line.trim());
  }
  flush();

  return items;
}

/**
 * canonical H2 섹션이 본문에서 "terminal" 위치(뒤에 의미 있는 H2 없음)인지 검사한다.
 *
 * 본문 순서가 `... → carryover → verification` 같은 경우 carryover만 callout으로
 * 들어내면 verification이 carryover 자리로 올라와 순서 회귀가 발생한다(Critic Sprint 163 R2 P2).
 * Terminal 검사로 회귀 회피: terminal일 때만 strip + callout 적용, 그 외에는 본문 prose에 유지.
 *
 * `allowedAfter` 에 포함된 canonical(`related-docs` 등)은 "뒤에 와도 무방한 마무리 섹션"으로
 * 간주하여 terminal 판정을 통과시킨다.
 */
export function isCanonicalTerminal(
  sections: AdrSection[],
  canonical: AdrSection['canonical'],
  allowedAfter: ReadonlySet<AdrSection['canonical']> = new Set(['related-docs']),
): boolean {
  const collected = collectCanonicalSectionMarkdown(sections, canonical);
  if (!collected) return false;

  const lastIdx = Math.max(...collected.sectionIndices);
  for (let i = lastIdx + 1; i < sections.length; i++) {
    if (sections[i].level === 2 && !allowedAfter.has(sections[i].canonical)) {
      return false;
    }
  }
  return true;
}

/**
 * canonical H2 + 인접 H3 그룹에 속한 모든 section index 를 반환한다.
 * detail-view가 TOC filter 시 활용한다.
 */
export function getCanonicalSectionIndices(
  sections: AdrSection[],
  canonical: AdrSection['canonical'],
): number[] | undefined {
  return collectCanonicalSectionMarkdown(sections, canonical)?.sectionIndices;
}

/**
 * canonical H2 섹션 + 그 다음 H2 직전까지의 모든 H3 sub-section rawMarkdown을 결합한다.
 *
 * 이월 섹션이 `## Sprint N+1 이월\n### Sprint M 이월 (...)` 형태로 H3 sub-section을
 * 가질 때(ADR sprint-160 등), H2 section.rawMarkdown 만으로는 list item을 놓치므로
 * 인접 H3 들의 rawMarkdown 도 같이 합쳐서 반환한다.
 */
function collectCanonicalSectionMarkdown(
  sections: AdrSection[],
  canonical: AdrSection['canonical'],
): { combined: string; sectionIndices: number[] } | undefined {
  const startIdx = sections.findIndex(
    (s) => s.canonical === canonical && s.level === 2,
  );
  if (startIdx < 0) return undefined;

  const indices = [startIdx];
  const parts = [sections[startIdx].rawMarkdown];

  for (let j = startIdx + 1; j < sections.length; j++) {
    if (sections[j].level === 2) break; // 다음 H2 도달 → 그룹 종료
    indices.push(j);
    parts.push(sections[j].rawMarkdown);
  }

  return { combined: parts.join('\n\n'), sectionIndices: indices };
}

/**
 * lessons 섹션에서 교훈 항목을 추출한다.
 * `- **bold**: text` / `1. **bold** — text` / 일반 list item 모두 지원.
 *
 * Terminal 검사 통과(뒤에 의미 있는 H2 없음)한 경우에만 결과 반환 — non-terminal일 때
 * callout으로 추출하면 본문 순서가 회귀하므로 본문 prose에 자연 유지시킨다(Sprint 163 R2 P2).
 */
export function extractLessons(
  sections: AdrSection[],
): AdrLessonEntry[] | undefined {
  if (!isCanonicalTerminal(sections, 'lessons')) return undefined;

  const collected = collectCanonicalSectionMarkdown(sections, 'lessons');
  if (!collected) return undefined;

  const items = extractListItems(collected.combined);
  return items.length > 0 ? items : undefined;
}

/**
 * carryover 섹션에서 이월 항목을 추출한다.
 * title 또는 H3 sub-section heading에 "Sprint NNN" 포함 시 sprint 필드를 채운다.
 * H2/H3 sub-section 별로 분리 처리하여 각 항목의 sprint 컨텍스트를 정확히 매핑한다.
 *
 * Terminal 검사 통과한 경우에만 결과 반환 — Sprint 163 R2 P2 회귀 차단.
 */
export function extractCarryover(
  sections: AdrSection[],
): AdrCarryoverEntry[] | undefined {
  if (!isCanonicalTerminal(sections, 'carryover')) return undefined;

  const collected = collectCanonicalSectionMarkdown(sections, 'carryover');
  if (!collected) return undefined;

  const results: AdrCarryoverEntry[] = [];

  for (const idx of collected.sectionIndices) {
    const section = sections[idx];
    const sprintFromHeading = extractSprintTag(section.heading);
    const items = extractListItems(section.rawMarkdown);

    for (const item of items) {
      const sprintFromTitle = item.title
        ? extractSprintTag(item.title)
        : undefined;
      results.push({
        ...item,
        sprint: sprintFromTitle ?? sprintFromHeading,
      });
    }
  }

  return results.length > 0 ? results : undefined;
}

/* ─── 본문 prose 영역 strip ─────────────────────── */

/**
 * 본문에서 implementation 섹션 내 PR 표(헤더 + separator + 데이터 라인)만 정밀 strip한다.
 * 본문에서 implementation 섹션 자체는 유지하고, 표 라인 범위만 제거한다.
 */
function stripPrTableLines(rawMarkdown: string): string {
  const lines = rawMarkdown.split('\n');
  const headerIdx = lines.findIndex(
    (l) => /\|/.test(l) && /pr|pull\s*request/i.test(l),
  );
  if (headerIdx < 0) return rawMarkdown;
  // separator 검증 (`| --- | ...`)
  const sepIdx = headerIdx + 1;
  if (
    sepIdx >= lines.length ||
    !/^\s*\|?\s*[:\-\s|]+\|?\s*$/.test(lines[sepIdx])
  ) {
    return rawMarkdown;
  }

  let endIdx = sepIdx;
  for (let i = sepIdx + 1; i < lines.length; i++) {
    if (!lines[i].includes('|')) break;
    endIdx = i;
  }

  const before = lines.slice(0, headerIdx);
  const after = lines.slice(endIdx + 1);
  // 표 제거 후 연속된 빈 줄 정리
  const merged = [...before, ...after].join('\n');
  return merged.replace(/\n{3,}/g, '\n\n');
}

/**
 * canonical H2 섹션 + 그 다음 H2 직전까지의 H3 sub-section rawMarkdown 을 본문에서 제거한다.
 * H2 + H3 인접 그룹 전체를 단일 단위로 strip하여 callout으로 대체 가능하게 만든다.
 */
function stripCanonicalSectionGroup(
  body: string,
  sections: AdrSection[],
  canonical: AdrSection['canonical'],
): string {
  const collected = collectCanonicalSectionMarkdown(sections, canonical);
  if (!collected) return body;

  let result = body;
  for (const idx of collected.sectionIndices) {
    result = result.replace(sections[idx].rawMarkdown, '');
  }
  return result;
}

/**
 * detail-view prose 영역 전용 본문을 생성한다.
 *
 * 1. phases 추출 성공 → implementation 섹션 PR 표 라인 strip
 * 2. lessons 추출 성공 → lessons H2 + 인접 H3 sub-section 전체 제거
 * 3. carryover 추출 성공 → carryover H2 + 인접 H3 sub-section 전체 제거
 *
 * graceful degradation: 추출 실패 시 해당 strip skip → 본문 prose에 자연 fallback.
 */
export function buildBodyMarkdownForProse(
  bodyMarkdown: string,
  sections: AdrSection[],
  phases?: AdrPhaseEntry[],
  lessons?: AdrLessonEntry[],
  carryover?: AdrCarryoverEntry[],
): string {
  let result = bodyMarkdown;

  // (1) implementation PR 표 strip — 정밀: 표 라인 범위만 제거
  if (phases && phases.length > 0) {
    const implSection = sections.find(
      (s) => s.canonical === 'implementation' && s.prTable,
    );
    if (implSection) {
      const stripped = stripPrTableLines(implSection.rawMarkdown);
      if (stripped !== implSection.rawMarkdown) {
        result = result.replace(implSection.rawMarkdown, stripped);
      }
    }
  }

  // (2) lessons 섹션 그룹 strip (H2 + 인접 H3 sub-section)
  if (lessons && lessons.length > 0) {
    result = stripCanonicalSectionGroup(result, sections, 'lessons');
  }

  // (3) carryover 섹션 그룹 strip (H2 + 인접 H3 sub-section)
  if (carryover && carryover.length > 0) {
    result = stripCanonicalSectionGroup(result, sections, 'carryover');
  }

  // 연속된 빈 줄 정리
  return result.replace(/\n{3,}/g, '\n\n').trim();
}

/* ─── 메인 파싱 ──────────────────────────────────── */

/**
 * 단일 ADR 마크다운을 파싱하여 AdrDoc을 반환한다.
 * @param raw      - 원본 마크다운 문자열
 * @param filePath - 파일 상대 경로
 * @param kind     - ADR 분류
 * @param slug     - URL 슬러그
 */
export function parseAdr(
  raw: string,
  filePath: string,
  kind: AdrKind,
  slug: string,
): AdrDoc {
  const warnings: ParseWarning[] = [];

  const { data: fm, content: body } = matter(raw);
  const hasFrontmatter = Object.keys(fm).length > 0;

  if (!hasFrontmatter) {
    warnings.push({
      level: 'info',
      code: 'no-frontmatter',
      detail: 'No YAML frontmatter found',
    });
  }

  const title = resolveTitle(fm, body, slug);
  const rawStatus = resolveRawStatus(fm, body);
  const status = rawStatus ? normalizeStatus(rawStatus) : 'unknown';
  const date = resolveDate(fm);
  const sprint = resolveSprint(fm, kind, slug);
  const agents = resolveAgents(fm);
  const relatedAdrs = resolveRelatedAdrs(fm, warnings);
  const relatedMemory = resolveRelatedMemory(fm);
  const id = buildId(kind, slug);

  if (!date) {
    warnings.push({
      level: 'warn',
      code: 'no-date',
      detail: 'No date found in frontmatter',
    });
  }

  const sections = tokenizeSections(body, warnings);
  const prRowCount = countPrRows(sections);
  const impact = calcImpact(body, prRowCount);
  const readingTimeMin = calcReadingTime(raw);
  const outgoingLinks = extractOutgoingLinks(body);

  const tldr = extractTldr(fm, sections);
  const decisions = extractDecisionItems(sections);
  const phases = extractPhaseEntries(sections);
  const lessons = extractLessons(sections);
  const carryover = extractCarryover(sections);
  const bodyMarkdownForProse = buildBodyMarkdownForProse(
    body,
    sections,
    phases,
    lessons,
    carryover,
  );

  const meta: AdrMeta = {
    kind,
    id,
    slug,
    filePath,
    sprint,
    title,
    date,
    status,
    rawStatus: rawStatus ?? undefined,
    agents: agents.length > 0 ? agents : undefined,
    relatedAdrs: relatedAdrs.length > 0 ? relatedAdrs : undefined,
    relatedMemory: relatedMemory.length > 0 ? relatedMemory : undefined,
    hasFrontmatter,
    impact,
    readingTimeMin,
    tldr,
  };

  return {
    meta,
    sections,
    bodyMarkdown: body,
    bodyMarkdownForProse,
    outgoingLinks,
    warnings,
    decisions,
    phases,
    lessons,
    carryover,
  };
}

/* ─── 필드 추출 헬퍼 ─────────────────────────────── */

/** title 해결: frontmatter > H1 > slug fallback */
function resolveTitle(
  fm: Record<string, unknown>,
  body: string,
  slug: string,
): string {
  if (typeof fm.title === 'string' && fm.title.length > 0) return fm.title;
  return extractH1Title(body) ?? slug;
}

/** 원시 상태 문자열 추출: frontmatter > body fallback */
function resolveRawStatus(
  fm: Record<string, unknown>,
  body: string,
): string | null {
  if (typeof fm.status === 'string') return fm.status;
  return extractFallbackStatus(body) ?? null;
}

/** 날짜 추출: frontmatter date 또는 period */
function resolveDate(fm: Record<string, unknown>): string | undefined {
  if (typeof fm.date === 'string') return fm.date;
  if (typeof fm.period === 'string') return fm.period;
  return undefined;
}

/** 스프린트 번호 추출: frontmatter > slug 파싱 */
function resolveSprint(
  fm: Record<string, unknown>,
  kind: AdrKind,
  slug: string,
): number | undefined {
  if (typeof fm.sprint === 'number') return fm.sprint;
  if (kind === 'sprint') {
    const num = parseInt(slug, 10);
    return isNaN(num) ? undefined : num;
  }
  return undefined;
}

/** agents 배열 추출 */
function resolveAgents(fm: Record<string, unknown>): string[] {
  if (Array.isArray(fm.agents)) {
    return fm.agents.filter((a): a is string => typeof a === 'string');
  }
  return [];
}

/** related_adrs 추출 + 정규화 */
function resolveRelatedAdrs(
  fm: Record<string, unknown>,
  warnings: ParseWarning[],
): string[] {
  if (!Array.isArray(fm.related_adrs)) return [];

  return fm.related_adrs
    .filter((r): r is string => {
      if (typeof r !== 'string') {
        warnings.push({
          level: 'warn',
          code: 'invalid-related-adr',
          detail: `Non-string related_adrs entry: ${String(r)}`,
        });
        return false;
      }
      return true;
    })
    .map(normalizeAdrId);
}

/** related_memory 추출 */
function resolveRelatedMemory(fm: Record<string, unknown>): string[] {
  if (Array.isArray(fm.related_memory)) {
    return fm.related_memory.filter(
      (r): r is string => typeof r === 'string',
    );
  }
  return [];
}

/** ADR ID 구성 */
function buildId(kind: AdrKind, slug: string): string {
  if (kind === 'sprint') return `sprint-${slug}`;
  if (kind === 'permanent') return `ADR-${slug}`;
  return slug;
}

/** 전체 섹션에서 PR 행 수를 합산한다. */
function countPrRows(sections: AdrSection[]): number {
  let count = 0;
  for (const s of sections) {
    if (s.prTable) count += s.prTable.length;
  }
  return count;
}
