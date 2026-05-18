/**
 * @file       index-builder.ts
 * @domain     blog / adr
 * @layer      lib
 * @related    types.ts, loader.ts, parser.ts
 *
 * AdrDoc[] -> AdrIndex 구축.
 * byKind 분류, bySprint 매핑, AdjacencyList 그래프, SearchDoc 플레인텍스트 인덱스.
 */
import type { Locale } from '../i18n';
import type {
  AdjacencyList,
  AdrDoc,
  AdrIndex,
  AdrKind,
  AdrMeta,
  SearchDoc,
} from './types';

/* ─── 플레인텍스트 변환 ──────────────────────────── */

/** 코드 펜스 블록 제거 */
const CODE_FENCE_RE = /```[\s\S]*?```/g;

/** 마크다운 기호 제거 (헤딩 #, 볼드, 이탤릭, 링크) */
const MD_SYMBOL_RE = /#{1,6}\s|[*_~`]|\[([^\]]*)\]\([^)]*\)/g;

/**
 * 마크다운 본문을 검색용 플레인텍스트로 변환한다.
 * mermaid 블록, 코드 펜스, 마크다운 기호를 제거한다.
 */
function toPlainText(markdown: string): string {
  return markdown
    .replace(CODE_FENCE_RE, '')
    .replace(MD_SYMBOL_RE, '$1')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/* ─── URL 생성 ───────────────────────────────────── */

/**
 * ADR 메타에서 URL 경로를 생성한다.
 *
 * locale='en' 일 때 `/en/adr/...` prefix를 반환한다. 기본값 'ko' 는 prefix 없음.
 *
 * @param meta   - ADR 메타
 * @param locale - 'ko' (기본) | 'en'
 */
export function buildUrl(meta: AdrMeta, locale: Locale = 'ko'): string {
  const prefix = locale === 'en' ? '/en' : '';
  if (meta.kind === 'sprint') return `${prefix}/adr/sprints/${meta.slug}`;
  if (meta.kind === 'permanent') return `${prefix}/adr/permanent/${meta.slug}`;
  return `${prefix}/adr/topics/${meta.slug}`;
}

/* ─── SearchDoc 생성 ─────────────────────────────── */

/**
 * AdrDoc에서 SearchDoc을 추출한다.
 */
function toSearchDoc(doc: AdrDoc): SearchDoc {
  return {
    id: doc.meta.id,
    url: buildUrl(doc.meta),
    title: doc.meta.title,
    sprint: doc.meta.sprint,
    status: doc.meta.status,
    kind: doc.meta.kind,
    body: toPlainText(doc.bodyMarkdown),
    agents: doc.meta.agents ?? [],
  };
}

/* ─── 그래프 구축 ────────────────────────────────── */

/**
 * AdrDoc[]에서 AdjacencyList를 구축한다.
 * 각 문서의 relatedAdrs + outgoingLinks를 edge로 변환한다.
 */
function buildGraph(docs: AdrDoc[]): AdjacencyList {
  const idSet = new Set(docs.map((d) => d.meta.id));

  const nodes = docs.map((d) => ({
    id: d.meta.id,
    label: d.meta.title,
    kind: d.meta.kind,
    sprint: d.meta.sprint,
  }));

  const edgeSet = new Set<string>();
  const edges: AdjacencyList['edges'] = [];

  for (const doc of docs) {
    const targets = mergeTargets(doc);
    for (const to of targets) {
      const key = `${doc.meta.id}->${to}`;
      if (edgeSet.has(key)) continue;
      edgeSet.add(key);
      edges.push({ from: doc.meta.id, to, resolved: idSet.has(to) });
    }
  }

  return { nodes, edges };
}

/**
 * relatedAdrs + outgoingLinks를 중복 제거하여 병합한다.
 */
function mergeTargets(doc: AdrDoc): string[] {
  const set = new Set<string>();
  if (doc.meta.relatedAdrs) {
    for (const r of doc.meta.relatedAdrs) set.add(r);
  }
  for (const l of doc.outgoingLinks) set.add(l);
  return [...set];
}

/* ─── byKind 분류 ────────────────────────────────── */

/**
 * AdrMeta[]를 kind별로 분류한다.
 */
function groupByKind(metas: AdrMeta[]): Record<AdrKind, AdrMeta[]> {
  const result: Record<AdrKind, AdrMeta[]> = {
    permanent: [],
    topic: [],
    sprint: [],
  };
  for (const m of metas) {
    result[m.kind].push(m);
  }
  return result;
}

/* ─── bySprint 매핑 ──────────────────────────────── */

/**
 * sprint kind의 AdrMeta를 번호 -> 메타 Map으로 변환한다.
 */
function mapBySprint(metas: AdrMeta[]): Map<number, AdrMeta> {
  const map = new Map<number, AdrMeta>();
  for (const m of metas) {
    if (m.kind === 'sprint' && m.sprint != null) {
      map.set(m.sprint, m);
    }
  }
  return map;
}

/* ─── 서브그래프 추출 ────────────────────────────── */

/**
 * 특정 노드를 중심으로 1-hop 서브그래프를 추출한다.
 * @param full    - 전체 AdjacencyList
 * @param focusId - 중심 노드 ID
 */
export function getSubgraph(
  full: AdjacencyList,
  focusId: string,
): AdjacencyList {
  const neighborIds = new Set<string>([focusId]);

  for (const e of full.edges) {
    if (e.from === focusId) neighborIds.add(e.to);
    if (e.to === focusId) neighborIds.add(e.from);
  }

  const nodes = full.nodes.filter((n) => neighborIds.has(n.id));
  const edges = full.edges.filter(
    (e) => neighborIds.has(e.from) && neighborIds.has(e.to),
  );

  return { nodes, edges };
}

/* ─── 메인 빌더 ──────────────────────────────────── */

/**
 * AdrDoc[]에서 AdrIndex를 구축한다.
 * @param docs - 파싱 완료된 ADR 문서 배열
 */
export function buildAdrIndex(docs: AdrDoc[]): AdrIndex {
  const all = docs.map((d) => d.meta);

  return {
    all,
    byKind: groupByKind(all),
    bySprint: mapBySprint(all),
    graph: buildGraph(docs),
    searchDocs: docs.map(toSearchDoc),
  };
}
