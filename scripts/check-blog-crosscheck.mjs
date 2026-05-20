#!/usr/bin/env node
/**
 * @file  scripts/check-blog-crosscheck.mjs
 * @domain  ci / blog
 * @layer  script
 * @related blog/src/lib/posts.ts, blog/src/lib/adr/rehype-adr-link-rewrite.ts, scripts/check-adr-index-count.mjs
 *
 * 블로그 글(KR/EN)을 머지 전에 결정론적으로 cross-check 하는 CI hard gate.
 *
 * 기존에는 블로그 글의 정합성(KR↔EN 짝, frontmatter 스키마, 깨진 내부 링크)을
 * 사람 눈으로만 확인했다. 본 스크립트로 구조적·결정론적 검증만 CI hard gate
 * 화한다(Sprint 177 #18). 회고록 시점의 도메인 사실(스프린트 수·테스트 수·
 * 커버리지 등)은 과거 스냅샷이라 절대 검증하지 않는다(false-positive 방지).
 *
 * 의존성 0: quality-docs 잡은 npm install 없이 repo 루트에서 실행하므로
 * 외부 모듈(gray-matter 등)을 쓸 수 없다. node 내장 모듈만 사용하고
 * frontmatter는 경량 파서로 직접 파싱한다(실제 글의 형식만 처리).
 *
 * 검증 3축 (모두 --strict 에서 hard gate):
 *   축 1 — KR↔EN 정합(parity): slug 양방향 짝 + locale 공통 구조 필드 일치
 *           (date/category/order/tags/series/seriesOrder; title/excerpt 제외)
 *   축 2 — frontmatter 스키마: 필수 필드 존재 + category enum + date 형식 + order 유일
 *   축 3 — 내부 링크 무결성: 파일시스템 이탈 경로 거부 + 내부 post 라우트 대상 존재
 *
 * - 기본 모드: 통계 + 위반 목록 출력 후 exit 0 (자료 수집용)
 * - --lint 모드: 위반을 WARN 으로 나열 (fail 아님)
 * - --strict 모드: 위반이 1건이라도 있으면 exit 1 (CI hard gate 용)
 *
 * exit
 *   0: 점검 완료 (--strict 외에는 항상 0)
 *   1: --strict 모드에서 위반 발견
 *   2: I/O 오류 / 콘텐츠 디렉토리 없음 / 잘못된 옵션
 *
 * 사용법
 *   node scripts/check-blog-crosscheck.mjs            # 통계만
 *   node scripts/check-blog-crosscheck.mjs --lint     # WARN 출력
 *   node scripts/check-blog-crosscheck.mjs --strict   # 위반 시 fail
 */
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..');
const CONTENT_ROOT = resolve(ROOT, 'blog', 'content');
const KO_DIR = join(CONTENT_ROOT, 'posts');
const EN_DIR = join(CONTENT_ROOT, 'posts-en');

/**
 * 유효한 category 값 집합.
 * SSOT: blog/src/lib/posts.ts VALID_CATEGORIES (Category union type).
 */
const VALID_CATEGORIES = new Set(['journey', 'challenge']);

/** date 필드 형식 (YYYY-MM-DD). */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** frontmatter 필수 필드 (양 locale 각각). */
const REQUIRED_FIELDS = ['title', 'date', 'excerpt', 'tags', 'category'];

/** locale 간 일치해야 하는 구조 필드 (title/excerpt 는 번역 대상이라 제외). */
const PARITY_FIELDS = ['date', 'category', 'order', 'tags', 'series', 'seriesOrder'];

// ──────────────────────────────────────────────────────────────────
// CLI entry point
// ──────────────────────────────────────────────────────────────────

/**
 * 인자를 해석하고 점검을 실행한다.
 */
function runMain() {
  const args = parseArgs(process.argv.slice(2));

  if (!existsSync(KO_DIR) || !existsSync(EN_DIR)) {
    console.error(
      `[FAIL] 블로그 콘텐츠 디렉토리 없음: ${relative(ROOT, KO_DIR)} / ${relative(ROOT, EN_DIR)}`,
    );
    process.exit(2);
  }

  const koPosts = loadPosts(KO_DIR);
  const enPosts = loadPosts(EN_DIR);

  const violations = [
    ...checkParity(koPosts, enPosts),
    ...checkFrontmatter(koPosts, 'ko'),
    ...checkFrontmatter(enPosts, 'en'),
    ...checkLinks(koPosts, 'ko'),
    ...checkLinks(enPosts, 'en'),
  ];

  console.log(
    `[INFO] 블로그 글: KR ${koPosts.length}개 / EN ${enPosts.length}개 — 위반 ${violations.length}건`,
  );

  reportViolations(violations, args);
  process.exit(0);
}

/**
 * 수집된 위반을 모드에 맞춰 출력하고, --strict 위반 시 종료한다.
 *
 * @param {Array<{axis:string, slug:string, locale:string, detail:string}>} violations
 * @param {{lint:boolean, strict:boolean}} args
 */
function reportViolations(violations, args) {
  if (violations.length === 0) {
    if (args.lint || args.strict) {
      console.log('[OK]   블로그 cross-check 위반 없음.');
    }
    return;
  }

  const level = args.strict ? 'FAIL' : 'WARN';
  console.log(`[${level}] ${violations.length}건 위반:`);
  for (const v of violations) {
    console.log(`       - [${v.axis}] ${v.locale}/${v.slug}: ${v.detail}`);
  }

  if (args.strict) {
    console.error('[FAIL] --strict 모드에서 블로그 cross-check 위반 → exit 1');
    process.exit(1);
  }
}

// ──────────────────────────────────────────────────────────────────
// CLI argument parsing
// ──────────────────────────────────────────────────────────────────

/**
 * argv 에서 CLI 옵션을 파싱한다.
 *
 * @param {string[]} argv
 * @returns {{lint:boolean, strict:boolean}}
 */
export function parseArgs(argv) {
  const result = { lint: false, strict: false };
  for (const token of argv) {
    if (token === '--lint') result.lint = true;
    else if (token === '--strict') result.strict = true;
    else if (token === '--help' || token === '-h') {
      console.log(
        '사용법: node scripts/check-blog-crosscheck.mjs [--lint] [--strict]',
      );
      process.exit(0);
    } else {
      console.error(`[FAIL] 알 수 없는 옵션: ${token}`);
      process.exit(2);
    }
  }
  return result;
}

// ──────────────────────────────────────────────────────────────────
// Post loading
// ──────────────────────────────────────────────────────────────────

/**
 * 디렉토리 내 모든 .mdx 글을 읽어 {slug, meta, body} 목록으로 반환한다.
 *
 * @param {string} dir  콘텐츠 디렉토리 절대 경로
 * @returns {Array<{slug:string, meta:Record<string,unknown>, body:string}>}
 */
export function loadPosts(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.mdx'))
    .map((filename) => {
      const raw = readFileSync(join(dir, filename), 'utf-8');
      const { meta, body } = parseFrontmatter(raw);
      return { slug: filename.replace(/\.mdx$/, ''), meta, body };
    });
}

// ──────────────────────────────────────────────────────────────────
// Lightweight frontmatter parser
// ──────────────────────────────────────────────────────────────────

/**
 * MDX 원문에서 frontmatter(상단 --- 블록)와 본문을 분리해 파싱한다.
 * 실제 글의 형식만 처리한다: 단순 key-value + 배열 [a, b] + 따옴표 문자열.
 *
 * @param {string} raw  .mdx 파일 원문
 * @returns {{meta:Record<string,unknown>, body:string}}
 */
export function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };

  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    meta[kv[1]] = parseScalar(kv[2].trim());
  }
  return { meta, body: match[2] ?? '' };
}

/**
 * frontmatter 값 하나를 JS 값으로 변환한다.
 * 배열 [a, b] → string[], 따옴표 문자열 → string, 숫자 → number.
 *
 * @param {string} value  raw 값 문자열
 * @returns {unknown}
 */
function parseScalar(value) {
  if (value === '') return undefined;
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    if (inner === '') return [];
    return inner.split(',').map((el) => unquote(el.trim()));
  }
  if (/^-?\d+$/.test(value)) return Number(value);
  return unquote(value);
}

/**
 * 양끝의 짝맞는 따옴표(' 또는 ")를 제거한다.
 *
 * @param {string} s
 * @returns {string}
 */
function unquote(s) {
  if (s.length >= 2 && (s[0] === '"' || s[0] === "'") && s[s.length - 1] === s[0]) {
    return s.slice(1, -1);
  }
  return s;
}

// ──────────────────────────────────────────────────────────────────
// 축 1 — KR↔EN 정합 (parity)
// ──────────────────────────────────────────────────────────────────

/**
 * KR/EN 글의 slug 짝(양방향)과 locale 공통 구조 필드 일치를 검증한다.
 * title/excerpt 는 번역 대상이라 비교에서 제외한다.
 *
 * @param {Array<{slug:string, meta:Record<string,unknown>}>} koPosts
 * @param {Array<{slug:string, meta:Record<string,unknown>}>} enPosts
 * @returns {Array<{axis:string, slug:string, locale:string, detail:string}>}
 */
export function checkParity(koPosts, enPosts) {
  const out = [];
  const koMap = new Map(koPosts.map((p) => [p.slug, p]));
  const enMap = new Map(enPosts.map((p) => [p.slug, p]));

  for (const slug of koMap.keys()) {
    if (!enMap.has(slug)) {
      out.push({ axis: 'parity', slug, locale: 'ko', detail: 'EN 짝 글 없음 (고아)' });
    }
  }
  for (const slug of enMap.keys()) {
    if (!koMap.has(slug)) {
      out.push({ axis: 'parity', slug, locale: 'en', detail: 'KR 짝 글 없음 (고아)' });
    }
  }

  for (const [slug, ko] of koMap) {
    const en = enMap.get(slug);
    if (!en) continue;
    for (const field of PARITY_FIELDS) {
      if (!fieldEquals(ko.meta[field], en.meta[field])) {
        out.push({
          axis: 'parity',
          slug,
          locale: 'ko/en',
          detail: `${field} 불일치: KR=${fmt(ko.meta[field])} ≠ EN=${fmt(en.meta[field])}`,
        });
      }
    }
  }
  return out;
}

/**
 * 두 frontmatter 값이 동등한지 비교한다 (배열은 순서 포함 동등).
 *
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
function fieldEquals(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  return a === b;
}

/** 위반 메시지용 값 포맷. */
function fmt(v) {
  if (v === undefined) return '(없음)';
  if (Array.isArray(v)) return `[${v.join(', ')}]`;
  return String(v);
}

// ──────────────────────────────────────────────────────────────────
// 축 2 — frontmatter 스키마
// ──────────────────────────────────────────────────────────────────

/**
 * 한 locale 글들의 frontmatter 스키마를 검증한다.
 * 필수 필드 존재 / category enum / date 형식 / order 유일성.
 *
 * order 유일성은 locale 전역이 아니라 "동일 date 내"로 한정한다.
 * getAllPosts(blog/src/lib/posts.ts)가 date 내림차순 우선 정렬 후 동일 date
 * 안에서만 order 를 tiebreaker 로 사용하므로, 서로 다른 date 의 글이 같은
 * order 값을 재사용하는 것은 정상이다(전역 유일성 검사 시 false-positive).
 *
 * @param {Array<{slug:string, meta:Record<string,unknown>}>} posts
 * @param {string} locale
 * @returns {Array<{axis:string, slug:string, locale:string, detail:string}>}
 */
export function checkFrontmatter(posts, locale) {
  const out = [];
  // 중복 판정 키: `${date}::${order}` — 같은 date AND 같은 order 일 때만 충돌.
  const orders = new Map();

  for (const { slug, meta } of posts) {
    for (const field of REQUIRED_FIELDS) {
      if (meta[field] === undefined) {
        out.push({ axis: 'schema', slug, locale, detail: `필수 필드 누락: ${field}` });
      }
    }
    if (meta.category !== undefined && !VALID_CATEGORIES.has(meta.category)) {
      out.push({
        axis: 'schema',
        slug,
        locale,
        detail: `category 값 무효: ${fmt(meta.category)} (허용: journey|challenge)`,
      });
    }
    // date 가 존재하면 문자열 + YYYY-MM-DD 형식이어야 한다.
    // (undefined 는 위 필수필드 검사가 처리하므로 여기선 present 한정.)
    // 경량 파서가 따옴표 없는 숫자(date: 20260409)를 number 로 파싱하면
    // 형식 검증이 우회되던 false-negative 를 막는다.
    if (meta.date !== undefined && (typeof meta.date !== 'string' || !DATE_RE.test(meta.date))) {
      out.push({
        axis: 'schema',
        slug,
        locale,
        detail: `date 형식 무효: ${fmt(meta.date)} (${typeof meta.date}, 기대 문자열 YYYY-MM-DD)`,
      });
    }
    if (meta.order !== undefined) {
      const key = `${meta.date}::${meta.order}`;
      const dup = orders.get(key);
      if (dup !== undefined) {
        out.push({
          axis: 'schema',
          slug,
          locale,
          detail: `order 중복: ${fmt(meta.order)} (date ${fmt(meta.date)}에서 이미 ${dup})`,
        });
      } else {
        orders.set(key, slug);
      }
    }
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────
// 축 3 — 내부 링크 무결성
// ──────────────────────────────────────────────────────────────────

/** 거부 대상 — 파일시스템 상대/이탈/절대 경로 prefix. */
const ESCAPE_PREFIXES = ['./', '../'];
/** 거부 대상 — OS 절대 경로 prefix (드라이브 문자는 별도 정규식). */
const OS_ABS_PREFIXES = ['/Users/', '/home/', '/root/', '/c/'];
/** Windows 드라이브 절대 경로 (예: C:\..., d:/...). */
const WIN_DRIVE_RE = /^[A-Za-z]:[\\/]/;

/**
 * 한 locale 글 본문의 마크다운 링크 무결성을 검증한다.
 * - 거부: 파일시스템 이탈/절대 경로(핵심 버그 클래스, 배포 사이트 404)
 * - 검증: /posts/<slug> 및 /en/posts/<slug> → 대상 .mdx 존재
 * - 통과: 외부 링크 / 앵커(#) / 그 외 루트 절대 링크(/adr/... 등 빌드 산출물)
 *
 * @param {Array<{slug:string, body:string}>} posts
 * @param {string} locale
 * @returns {Array<{axis:string, slug:string, locale:string, detail:string}>}
 */
export function checkLinks(posts, locale) {
  const out = [];
  for (const { slug, body } of posts) {
    for (const href of extractLinks(stripCode(body))) {
      const violation = classifyLink(href, locale);
      if (violation) out.push({ axis: 'link', slug, locale, detail: violation });
    }
  }
  return out;
}

/**
 * 본문에서 코드 영역(펜스드 블록 + 인라인 코드 스팬)을 공백으로 치환한다.
 * 코드 블록 안의 텍스트는 렌더되는 앵커가 아니라 예시 텍스트이므로 배포 사이트
 * 404 를 만들 수 없다 → 링크 무결성 검사에서 제외해 false-positive 를 막는다.
 * (예: MEMORY.md 인덱스 형식을 보여주는 ```markdown 펜스 내부의 상대경로.)
 *
 * @param {string} body
 * @returns {string}
 */
export function stripCode(body) {
  return body
    // 펜스드 코드 블록: ``` 또는 ~~~ (info string 포함), 라인 시작 기준.
    .replace(/^[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^[ \t]*\1[ \t]*$/gm, ' ')
    // 인라인 코드 스팬: 멀티 백틱(`` ``...`` ``)을 1개 백틱보다 먼저 제거.
    .replace(/``[\s\S]*?``/g, ' ')
    .replace(/`[^`\n]*`/g, ' ');
}

/**
 * 본문에서 마크다운 링크 타깃(`](target)`)을 추출한다.
 * 이미지(`![alt](...)`) 포함 — 둘 다 같은 무결성 규칙을 받는다.
 *
 * @param {string} body
 * @returns {string[]}
 */
export function extractLinks(body) {
  return [...body.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)].map((m) => m[1]);
}

/**
 * 링크 타깃 하나를 분류해 위반 사유 문자열을 반환한다(정상이면 null).
 *
 * @param {string} href
 * @param {string} locale  링크를 담은 글의 locale ('ko' | 'en')
 * @returns {string|null}
 */
function classifyLink(href, locale) {
  // 통과: 외부 링크 / 앵커
  if (/^(https?:|mailto:)/.test(href)) return null;
  if (href.startsWith('#')) return null;

  // 거부: 파일시스템 이탈/절대 경로
  if (ESCAPE_PREFIXES.some((p) => href.startsWith(p))) {
    return `파일시스템 이탈 경로 (배포 사이트 404): ${href}`;
  }
  if (OS_ABS_PREFIXES.some((p) => href.startsWith(p)) || WIN_DRIVE_RE.test(href)) {
    return `OS 절대 경로 (배포 사이트 404): ${href}`;
  }

  // 검증: 내부 post 라우트 → 자기 locale 라우트 + 대상 글 존재
  return checkPostRoute(href, locale);
}

/**
 * post 라우트 링크를 locale-aware 로 검증한다.
 * 글은 자기 locale 의 post 라우트로만 링크해야 한다(교차-locale 누수 차단):
 *   - KO 글: `/posts/<slug>` → KO_DIR 대상 존재. `/en/posts/<slug>` 는 누수 위반.
 *   - EN 글: `/en/posts/<slug>` → EN_DIR 대상 존재. bare `/posts/<slug>` 는 누수 위반.
 * 그 외 루트 절대 링크(/adr/... 등)는 본 게이트 범위 밖이라 통과(null).
 *
 * @param {string} href
 * @param {string} locale  링크를 담은 글의 locale ('ko' | 'en')
 * @returns {string|null}
 */
function checkPostRoute(href, locale) {
  const en = href.match(/^\/en\/posts\/([^/#?]+)\/?$/);
  if (en) {
    if (locale !== 'en') return `KO 글은 /posts/ 라우트를 써야 함 (locale 누수): ${href}`;
    return existsSync(join(EN_DIR, `${en[1]}.mdx`)) ? null : `EN post 대상 없음: ${href}`;
  }

  const ko = href.match(/^\/posts\/([^/#?]+)\/?$/);
  if (ko) {
    if (locale !== 'ko') return `EN 글은 /en/posts/ 라우트를 써야 함 (locale 누수): ${href}`;
    return existsSync(join(KO_DIR, `${ko[1]}.mdx`)) ? null : `KR post 대상 없음: ${href}`;
  }

  return null;
}

// ──────────────────────────────────────────────────────────────────
// Entry point guard — 모든 const 선언 이후에 호출 (TDZ 회피)
// ──────────────────────────────────────────────────────────────────

const __selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] === __selfPath) {
  runMain();
}
