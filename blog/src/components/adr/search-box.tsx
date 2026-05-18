/**
 * @file       search-box.tsx
 * @domain     blog / adr
 * @layer      ui
 * @related    src/lib/adr/types.ts, scripts/generate-search-index.mjs
 *
 * ADR 전문 검색 컴포넌트 — MiniSearch 기반 클라이언트 사이드 검색.
 * `/` 단축키 포커스, `Esc` 닫기, 결과 드롭다운.
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import MiniSearch from 'minisearch';

/* ─── 타입 ──────────────────────────────────────── */

interface SearchDoc {
  id: string;
  url: string;
  title: string;
  sprint?: number;
  status: string;
  kind: string;
  body: string;
  agents: string[];
}

interface SearchResult {
  id: string;
  url: string;
  title: string;
  sprint?: number;
  status: string;
  kind: string;
}

/* ─── 상수 ──────────────────────────────────────── */

const MAX_RESULTS = 8;
const INDEX_URL = '/adr/search-index.json';

/* ─── status 뱃지 색상 ─────────────────────────── */

const STATUS_CLS: Record<string, string> = {
  completed: 'bg-callout-success-bg text-callout-success-fg',
  implemented: 'bg-callout-success-bg text-callout-success-fg',
  accepted: 'bg-callout-info-bg text-callout-info-fg',
  proposed: 'bg-callout-warn-bg text-callout-warn-fg',
  rejected: 'bg-callout-danger-bg text-callout-danger-fg',
};

/** status에 해당하는 Tailwind 클래스를 반환한다. */
function statusClass(status: string): string {
  return STATUS_CLS[status] ?? 'bg-surface-muted text-text-muted';
}

/* ─── kind 라벨 ─────────────────────────────────── */

/** kind + sprint에서 표시 라벨을 생성한다. */
function kindLabel(kind: string, sprint?: number): string {
  if (kind === 'sprint' && sprint != null) return `Sprint ${sprint}`;
  if (kind === 'permanent') return 'Permanent';
  return 'Topic';
}

/* ─── MiniSearch 생성 ───────────────────────────── */

/** 검색 인덱스를 로드하여 MiniSearch 인스턴스를 생성한다. */
async function createSearchEngine(): Promise<{
  engine: MiniSearch<SearchDoc>;
  docs: SearchDoc[];
}> {
  const res = await fetch(INDEX_URL);
  const docs: SearchDoc[] = await res.json();

  const engine = new MiniSearch<SearchDoc>({
    fields: ['title', 'agentsText', 'body'],
    storeFields: ['url', 'title', 'sprint', 'status', 'kind'],
    idField: 'id',
    searchOptions: {
      boost: { title: 3, agentsText: 2, body: 1 },
      prefix: true,
      fuzzy: 0.2,
    },
  });

  const indexed = docs.map((d) => ({
    ...d,
    agentsText: d.agents.join(' '),
  }));
  engine.addAll(indexed);

  return { engine, docs };
}

/* ─── 컴포넌트 ──────────────────────────────────── */

/** ADR 검색 박스를 렌더링한다. */
export function SearchBox() {
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [engine, setEngine] = useState<MiniSearch<SearchDoc> | null>(null);
  const [loading, setLoading] = useState(false);

  /* ── 인덱스 lazy load ─── */
  const ensureEngine = useCallback(async () => {
    if (engine) return engine;
    setLoading(true);
    try {
      const { engine: e } = await createSearchEngine();
      setEngine(e);
      return e;
    } finally {
      setLoading(false);
    }
  }, [engine]);

  /* ── 검색 실행 ─── */
  const doSearch = useCallback(
    async (q: string) => {
      if (q.trim().length < 2) {
        setResults([]);
        return;
      }
      const e = await ensureEngine();
      if (!e) return;
      const hits = e.search(q).slice(0, MAX_RESULTS);
      setResults(
        hits.map((h) => ({
          id: h.id as string,
          url: (h as unknown as SearchResult).url,
          title: (h as unknown as SearchResult).title,
          sprint: (h as unknown as SearchResult).sprint,
          status: (h as unknown as SearchResult).status,
          kind: (h as unknown as SearchResult).kind,
        })),
      );
    },
    [ensureEngine],
  );

  /* ── 키보드 단축키: `/` 포커스, `Esc` 닫기 ─── */
  useEffect(() => {
    /** 전역 키보드 이벤트를 처리한다. */
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === 'Escape') {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  /* ── 외부 클릭 닫기 ─── */
  useEffect(() => {
    /** 래퍼 외부 클릭 시 드롭다운을 닫는다. */
    function onClick(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  /* ── 입력 핸들러 ─── */
  /** 입력값 변경을 처리한다. */
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    setOpen(true);
    doSearch(val);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => setOpen(true)}
          placeholder="ADR 검색... ( / )"
          aria-label="ADR 검색"
          className="w-40 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text placeholder-text-subtle transition-all focus:w-56 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand sm:w-48"
        />
        {loading && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-text-muted">
            ...
          </span>
        )}
      </div>

      {/* 결과 드롭다운 */}
      {open && results.length > 0 && (
        <ul className="absolute right-0 top-full z-50 mt-1 max-h-80 w-80 overflow-y-auto rounded-lg border border-border bg-surface-elevated shadow-lg">
          {results.map((r) => (
            <li key={r.id}>
              <a
                href={r.url}
                className="flex items-start gap-2 px-3 py-2 text-sm transition-colors hover:bg-surface-muted"
              >
                <span className="shrink-0 rounded bg-brand-soft px-1.5 py-0.5 text-xs font-medium text-brand-strong">
                  {kindLabel(r.kind, r.sprint)}
                </span>
                <span className="min-w-0 flex-1 truncate text-text">
                  {r.title}
                </span>
                <span
                  className={`shrink-0 rounded-full px-1.5 py-0.5 text-xs ${statusClass(r.status)}`}
                >
                  {r.status}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {/* 빈 결과 */}
      {open && query.trim().length >= 2 && results.length === 0 && !loading && (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-lg border border-border bg-surface-elevated p-4 text-center text-sm text-text-muted shadow-lg">
          검색 결과가 없습니다.
        </div>
      )}
    </div>
  );
}
