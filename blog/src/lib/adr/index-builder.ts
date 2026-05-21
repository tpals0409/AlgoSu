/**
 * @file       index-builder.ts
 * @domain     blog / adr
 * @layer      lib
 * @related    types.ts, loader.ts, parser.ts
 *
 * AdrDoc[] -> AdrIndex 구축.
 * byKind 분류, bySprint 매핑, SearchDoc 플레인텍스트 인덱스.
 */
import type { Locale } from '../i18n';
import type {
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

/* ─── 토픽 필터 ──────────────────────────────────── */

/**
 * topicId에 해당하는 ADR 메타 목록을 반환한다.
 * meta.topics 배열에 topicId가 포함된 항목만 선별하고,
 * date 내림차순으로 정렬한다(동률·미정은 id 사전순 오름차순).
 *
 * @param metas   - 필터 대상 AdrMeta 배열
 * @param topicId - 조회할 주제 id (ADR_TOPICS[].id)
 */
export function filterAdrsByTopic(metas: AdrMeta[], topicId: string): AdrMeta[] {
  return metas
    .filter((m) => m.topics?.includes(topicId))
    .sort((a, b) => {
      const dateA = a.date ?? '';
      const dateB = b.date ?? '';
      if (dateA !== dateB) return dateB.localeCompare(dateA);
      return a.id.localeCompare(b.id);
    });
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
    searchDocs: docs.map(toSearchDoc),
  };
}
