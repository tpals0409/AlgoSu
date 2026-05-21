/**
 * @file       fixtures.ts
 * @domain     blog / adr
 * @layer      lib (test)
 * @related    parser.ts, loader.ts, index-builder.ts, types.ts
 *
 * 12개 regression fixture — 파싱/인덱스 정합성 검증.
 * Sprint 189 D2: F1/F2 hasFrontmatter 갱신 + F11/F12 topics/filterAdrsByTopic 추가.
 */
import { filterAdrsByTopic } from './index-builder';
import type { AdrDoc, AdrIndex } from './types';

interface FixtureResult {
  pass: number;
  fail: number;
  details: string[];
}

interface Fixture {
  name: string;
  run: (docs: AdrDoc[], index: AdrIndex) => boolean;
}

/* ─── 헬퍼 ───────────────────────────────────────── */

/** id로 AdrDoc을 조회한다. */
function findDoc(docs: AdrDoc[], id: string): AdrDoc | undefined {
  return docs.find((d) => d.meta.id === id);
}

/** id로 AdrMeta를 조회한다. */
function findMeta(index: AdrIndex, id: string) {
  return index.all.find((m) => m.id === id);
}

/* ─── Fixture 정의 ───────────────────────────────── */

const FIXTURES: ReadonlyArray<Fixture> = [
  {
    // Sprint 189 D2: topics frontmatter 추가 → hasFrontmatter=true, status는 H2 fallback 유지
    name: 'F1: ADR-001 topics frontmatter, H2 상태 fallback, status=completed',
    run: (docs) => {
      const doc = findDoc(docs, 'ADR-001');
      if (!doc) return false;
      return (
        doc.meta.hasFrontmatter &&
        doc.meta.status === 'completed' &&
        doc.meta.title.includes('Gateway') &&
        doc.meta.kind === 'permanent'
      );
    },
  },
  {
    // Sprint 189 D2: topics frontmatter 추가 → hasFrontmatter=true, dash-list status 여전히 동작
    name: 'F2: ADR-002 topics frontmatter, dash-list 상태, status=deferred',
    run: (docs) => {
      const doc = findDoc(docs, 'ADR-002');
      if (!doc) return false;
      return doc.meta.hasFrontmatter && doc.meta.status === 'deferred';
    },
  },
  {
    name: 'F3: ADR-028 Accepted-Partial -> partial',
    run: (docs) => {
      const doc = findDoc(docs, 'ADR-028');
      if (!doc) return false;
      return doc.meta.status === 'partial';
    },
  },
  {
    name: 'F4: sprint-62 영문 섹션 Decisions -> decisions',
    run: (docs) => {
      const doc = findDoc(docs, 'sprint-62');
      if (!doc) return false;
      return doc.sections.some((s) => s.canonical === 'decisions');
    },
  },
  {
    name: 'F5: sprint-110 period -> date 별칭',
    run: (docs) => {
      const doc = findDoc(docs, 'sprint-110');
      if (!doc) return false;
      return typeof doc.meta.date === 'string' && doc.meta.date.length > 0;
    },
  },
  {
    name: 'F6: sprint-75 related_adrs 빈 배열 아닌 경우',
    run: (docs) => {
      const doc = findDoc(docs, 'sprint-75');
      if (!doc) return false;
      return (
        doc.meta.relatedAdrs !== undefined &&
        doc.meta.relatedAdrs.length > 0
      );
    },
  },
  {
    name: 'F7: topics/sprint-95 kind=topic, related_adrs edge resolved',
    run: (docs, index) => {
      const doc = findDoc(docs, 'sprint-95-programmers-dataset');
      if (!doc) return false;
      if (doc.meta.kind !== 'topic') return false;

      const edges = index.graph.edges.filter(
        (e) => e.from === doc.meta.id,
      );
      return edges.some((e) => e.resolved);
    },
  },
  {
    name: 'F8: sprint-9999 가상 참조 resolved=false',
    run: (_docs, index) => {
      const edges = index.graph.edges.filter(
        (e) => e.to === 'sprint-9999',
      );
      return edges.length === 0 || edges.every((e) => !e.resolved);
    },
  },
  {
    name: 'F9: sprint-156 bySprint 존재',
    run: (_docs, index) => {
      return index.bySprint.has(156);
    },
  },
  {
    name: 'F10: sprint-40 bySprint 존재',
    run: (_docs, index) => {
      return index.bySprint.has(40);
    },
  },
  {
    // Sprint 189 D2: filterAdrsByTopic — operations 주제로 ADR-026 포함 검증
    name: 'F11: filterAdrsByTopic(operations) → ADR-026 포함',
    run: (_docs, index) => {
      const members = filterAdrsByTopic(index.all, 'operations');
      return members.some((m) => m.id === 'ADR-026');
    },
  },
  {
    // Sprint 189 D2: filterAdrsByTopic — 다중 주제(ADR-003 = operations + security) 검증
    name: 'F12: filterAdrsByTopic(security) → ADR-003 포함(multi-topic)',
    run: (_docs, index) => {
      const byOps = filterAdrsByTopic(index.all, 'operations');
      const bySec = filterAdrsByTopic(index.all, 'security');
      const adr003InOps = byOps.some((m) => m.id === 'ADR-003');
      const adr003InSec = bySec.some((m) => m.id === 'ADR-003');
      return adr003InOps && adr003InSec;
    },
  },
];

/* ─── 실행기 ─────────────────────────────────────── */

/**
 * 10개 fixture를 실행하고 결과를 반환한다.
 * @param docs  - 파싱 완료된 AdrDoc[]
 * @param index - 구축 완료된 AdrIndex
 */
export function runFixtures(docs: AdrDoc[], index: AdrIndex): FixtureResult {
  let pass = 0;
  let fail = 0;
  const details: string[] = [];

  for (const fixture of FIXTURES) {
    try {
      const ok = fixture.run(docs, index);
      if (ok) {
        pass++;
        details.push(`PASS: ${fixture.name}`);
      } else {
        fail++;
        details.push(`FAIL: ${fixture.name}`);
      }
    } catch (err) {
      fail++;
      const msg = err instanceof Error ? err.message : String(err);
      details.push(`FAIL: ${fixture.name} — ${msg}`);
    }
  }

  return { pass, fail, details };
}
