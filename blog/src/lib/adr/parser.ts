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
  AdrDoc,
  AdrKind,
  AdrMeta,
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
 */
function splitTableRow(line: string): string[] {
  return line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
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
  };

  return { meta, sections, bodyMarkdown: body, outgoingLinks, warnings };
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
