/**
 * @file       generate-search-index.mjs
 * @domain     blog / adr
 * @layer      build
 * @related    src/lib/adr/loader.ts, src/lib/adr/index-builder.ts
 *
 * 빌드 전 ADR 검색 인덱스를 public/adr/search-index.json으로 생성한다.
 * output:'export' 환경에서 Route Handler를 대체하는 정적 인덱스 생성기.
 *
 * Usage: node scripts/generate-search-index.mjs
 */
import fs from 'fs';
import path from 'path';

/* ─── ADR 루트 경로 ─────────────────────────────── */

const BLOG_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ADR_BASE = path.resolve(BLOG_ROOT, '..', 'docs', 'adr');
const OUT_DIR = path.join(BLOG_ROOT, 'public', 'adr');
const OUT_FILE = path.join(OUT_DIR, 'search-index.json');

/* ─── 간이 frontmatter 파서 ─────────────────────── */

const FM_RE = /^---\n([\s\S]*?)\n---/;

/** YAML frontmatter에서 키-값을 추출한다. */
function parseFrontmatter(raw) {
  const match = raw.match(FM_RE);
  if (!match) return {};
  const lines = match[1].split('\n');
  const meta = {};
  for (const line of lines) {
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    meta[key] = val;
  }
  return meta;
}

/* ─── 플레인텍스트 변환 ─────────────────────────── */

const CODE_FENCE_RE = /```[\s\S]*?```/g;
const MD_SYMBOL_RE = /#{1,6}\s|[*_~`]|\[([^\]]*)\]\([^)]*\)/g;

/** 마크다운 본문을 검색용 플레인텍스트로 변환한다. */
function toPlainText(markdown) {
  return markdown
    .replace(CODE_FENCE_RE, '')
    .replace(MD_SYMBOL_RE, '$1')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/* ─── slug 결정 ─────────────────────────────────── */

/** 파일명에서 slug를 결정한다. */
function deriveSlug(filename, kind) {
  const base = filename.replace(/\.md$/, '');
  if (kind === 'sprint') {
    const num = base.match(/sprint-(\d+)/)?.[1];
    return num ?? base;
  }
  if (kind === 'permanent') {
    const num = base.match(/^ADR-(\d+)/)?.[1];
    return num ?? base;
  }
  return base;
}

/** kind + slug로 URL 경로를 생성한다. */
function buildUrl(kind, slug) {
  if (kind === 'sprint') return `/adr/sprints/${slug}/`;
  if (kind === 'permanent') return `/adr/permanent/${slug}/`;
  return `/adr/topics/${slug}/`;
}

/* ─── 파일 수집 ─────────────────────────────────── */

/** 디렉토리에서 .md 파일을 읽어 SearchDoc 배열로 변환한다. */
function readDir(dir, kind) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .map((filename) => {
      const raw = fs.readFileSync(path.join(dir, filename), 'utf-8');
      const slug = deriveSlug(filename, kind);
      return toSearchDoc(raw, kind, slug);
    });
}

/** 루트 ADR-*.md 파일을 읽는다. */
function readRootAdrs() {
  if (!fs.existsSync(ADR_BASE)) return [];
  return fs
    .readdirSync(ADR_BASE)
    .filter((f) => f.startsWith('ADR-') && f.endsWith('.md'))
    .map((filename) => {
      const raw = fs.readFileSync(path.join(ADR_BASE, filename), 'utf-8');
      const slug = deriveSlug(filename, 'permanent');
      return toSearchDoc(raw, 'permanent', slug);
    });
}

/* ─── SearchDoc 변환 ────────────────────────────── */

/** status 정규화 — accepted/proposed/completed 등 */
function normalizeStatus(raw) {
  if (!raw) return 'unknown';
  const lower = raw.toLowerCase();
  const MAP = {
    proposed: 'proposed', accepted: 'accepted',
    completed: 'completed', implemented: 'implemented',
    deferred: 'deferred', partial: 'partial',
    rejected: 'rejected',
    '제안': 'proposed', '수락': 'accepted',
    '완료': 'completed', '구현': 'implemented',
  };
  return MAP[lower] ?? 'unknown';
}

/** raw 마크다운에서 title(H1)을 추출한다. */
function extractTitle(raw) {
  const match = raw.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : 'Untitled';
}

/** raw 마크다운에서 SearchDoc을 생성한다. */
function toSearchDoc(raw, kind, slug) {
  const fm = parseFrontmatter(raw);
  const bodyStart = raw.match(FM_RE) ? raw.indexOf('---', 4) + 3 : 0;
  const body = raw.slice(bodyStart);

  const title = fm.title || extractTitle(body) || slug;
  const sprint = kind === 'sprint' ? Number(slug) || undefined : undefined;
  const status = normalizeStatus(fm.status);
  const agents = fm.agents
    ? fm.agents.replace(/[\[\]]/g, '').split(',').map((a) => a.trim()).filter(Boolean)
    : [];

  return {
    id: kind === 'sprint' ? `sprint-${slug}` : kind === 'permanent' ? `ADR-${slug}` : slug,
    url: buildUrl(kind, slug),
    title,
    sprint,
    status,
    kind,
    body: toPlainText(body).slice(0, 2000),
    agents,
  };
}

/* ─── 메인 ──────────────────────────────────────── */

/** 검색 인덱스를 생성하여 JSON 파일로 기록한다. */
function main() {
  const docs = [
    ...readRootAdrs(),
    ...readDir(path.join(ADR_BASE, 'sprints'), 'sprint'),
    ...readDir(path.join(ADR_BASE, 'topics'), 'topic'),
  ];

  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(docs, null, 0), 'utf-8');

  /* eslint-disable no-console */
  console.log(`[search-index] ${docs.length} ADR docs → ${OUT_FILE}`);
  /* eslint-enable no-console */
}

main();
