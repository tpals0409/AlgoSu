#!/usr/bin/env node
/**
 * @file  scripts/check-adr-links.mjs
 * @domain  ci
 * @layer  script
 * @related scripts/check-adr-conversion.mjs, scripts/check-doc-refs.mjs
 *
 * ADR 빌드 산출물(blog/out/adr/) 내부 링크 무결성 검사.
 * HTML 파일의 href="/adr/..." 내부 링크가 대응하는 index.html로 해소되는지 검증.
 *
 * 검사 항목
 * - *.html 내 href="/adr/..." 패턴의 내부 링크 → 빌드 산출물 index.html 존재 여부
 * - search-index.json 존재 + entry count sanity check
 *
 * 면제
 * - 외부 URL (https://, http://, mailto:, tel:, ftp://, file:///) 자동 skip
 * - anchor-only (#...) 자동 skip
 * - /adr/ 접두어가 없는 내부 링크 자동 skip (다른 도메인)
 *
 * exit (직접 실행 시)
 *   0: 모든 내부 링크 정상
 *   1: broken link 존재
 *   2: search-index.json 누락 또는 비정상
 *
 * 사용법:
 *   node scripts/check-adr-links.mjs                 # 기본: blog/out/adr
 *   node scripts/check-adr-links.mjs blog/out/adr    # 명시 경로
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..');

/** 직접 실행 여부 (entry point guard) */
const __selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] === __selfPath) {
  runMain();
}

// ──────────────────────────────────────────────────────────────────
// CLI entry point
// ──────────────────────────────────────────────────────────────────

/**
 * 직접 실행 시 호출되는 메인 로직.
 * CLI 인자로 대상 디렉토리 지정 가능 (기본값 blog/out/adr).
 */
function runMain() {
  const targetArg = process.argv[2] || 'blog/out/adr';
  const targetDir = resolve(ROOT, targetArg);

  if (!existsSync(targetDir) || !statSync(targetDir).isDirectory()) {
    console.error(`[FAIL] Target directory not found: ${targetArg}`);
    process.exit(1);
  }

  /* out/ 루트 — /adr/ 링크 해소 시 blog/out 기준 */
  const outRoot = resolve(targetDir, '..');

  console.log(`[INFO] ADR link integrity check — scanning ${targetArg}/`);

  // 1. HTML 파일 수집
  const htmlFiles = collectHtmlFiles(targetDir);
  if (htmlFiles.length === 0) {
    console.error('[FAIL] No HTML files found in target directory');
    process.exit(1);
  }

  // 2. 내부 링크 추출 + 검증
  const { totalLinks, broken } = checkInternalLinks(htmlFiles, outRoot, targetArg);

  console.log(`[OK]   Scanned ${htmlFiles.length} HTML files, found ${totalLinks} internal links`);

  if (broken.length > 0) {
    console.error(`[FAIL] ${broken.length} broken internal link(s):`);
    for (const b of broken) {
      console.error(`  ${b.source}:  href="${b.href}" → missing ${b.expected}`);
    }
  } else {
    console.log('[OK]   All internal links resolved');
  }

  // 3. search-index.json sanity check
  const searchResult = checkSearchIndex(targetDir);
  if (searchResult.error) {
    console.error(`[FAIL] ${searchResult.error}`);
    process.exit(2);
  }
  console.log(`[OK]   search-index.json: ${searchResult.count} entries`);

  // 4. 결과 요약
  const warnings = 0;
  console.log(`[INFO] ${broken.length} broken, ${warnings} warnings`);

  if (broken.length > 0) {
    process.exit(1);
  }
  process.exit(0);
}

// ──────────────────────────────────────────────────────────────────
// 내부 함수
// ──────────────────────────────────────────────────────────────────

/**
 * 디렉토리 재귀 순회 → *.html 파일 절대 경로 수집.
 * @param {string} dir - 시작 디렉토리 절대 경로
 * @returns {string[]} HTML 파일 절대 경로 배열
 */
function collectHtmlFiles(dir) {
  const results = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectHtmlFiles(fullPath));
    } else if (entry.name.endsWith('.html')) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * 외부 URL 또는 anchor-only 여부 판정.
 * @param {string} href
 * @returns {boolean}
 */
function isExternalOrAnchor(href) {
  return /^(?:https?:\/\/|mailto:|tel:|ftp:\/\/|file:\/\/|#)/i.test(href);
}

/**
 * HTML 파일 내 href="/adr/..." 내부 링크 추출 + 존재 검증.
 * @param {string[]} htmlFiles - 절대 경로 배열
 * @param {string} outRoot - blog/out 절대 경로 (링크 해소 기준)
 * @param {string} targetArg - 로그 표시용 상대 경로
 * @returns {{ totalLinks: number, broken: Array<{ source: string, href: string, expected: string }> }}
 */
function checkInternalLinks(htmlFiles, outRoot, targetArg) {
  const hrefPattern = /href="(\/adr\/[^"#]*)(?:#[^"]*)?"/g;
  let totalLinks = 0;
  const broken = [];
  /** 이미 검증한 href 캐시 (중복 해소 효율화) */
  const resolved = new Map();

  for (const filePath of htmlFiles) {
    const content = readFileSync(filePath, 'utf-8');
    const relSource = relative(ROOT, filePath);
    let match;

    while ((match = hrefPattern.exec(content)) !== null) {
      const href = match[1];

      /* 외부 URL / anchor-only skip (방어) */
      if (isExternalOrAnchor(href)) continue;

      totalLinks++;

      if (resolved.has(href)) {
        if (!resolved.get(href)) {
          broken.push({ source: relSource, href, expected: expectedPath(href, outRoot) });
        }
        continue;
      }

      /* /adr/sprints/110/ → out/adr/sprints/110/index.html
       * /adr/sprints/110  → out/adr/sprints/110/index.html (trailing slash 없는 변형) */
      const normalizedHref = href.endsWith('/') ? href : href + '/';
      const fsPath = join(outRoot, normalizedHref, 'index.html');
      const exists = existsSync(fsPath);

      resolved.set(href, exists);

      if (!exists) {
        broken.push({ source: relSource, href, expected: relative(ROOT, fsPath) });
      }
    }
  }

  return { totalLinks, broken };
}

/**
 * broken link 로그용 expected 경로 생성.
 * @param {string} href
 * @param {string} outRoot
 * @returns {string}
 */
function expectedPath(href, outRoot) {
  const normalizedHref = href.endsWith('/') ? href : href + '/';
  return relative(ROOT, join(outRoot, normalizedHref, 'index.html'));
}

/**
 * search-index.json 존재 + entry count 검증.
 * @param {string} targetDir - adr 빌드 산출물 디렉토리 절대 경로
 * @returns {{ count?: number, error?: string }}
 */
function checkSearchIndex(targetDir) {
  const indexPath = join(targetDir, 'search-index.json');

  if (!existsSync(indexPath)) {
    return { error: 'search-index.json not found' };
  }

  try {
    const raw = readFileSync(indexPath, 'utf-8');
    const data = JSON.parse(raw);

    if (!Array.isArray(data)) {
      return { error: `search-index.json is not an array (got ${typeof data})` };
    }

    if (data.length === 0) {
      return { error: 'search-index.json is empty (0 entries)' };
    }

    return { count: data.length };
  } catch (err) {
    return { error: `search-index.json parse error: ${err.message}` };
  }
}

// ──────────────────────────────────────────────────────────────────
// Exports (라이브러리 재사용용)
// ──────────────────────────────────────────────────────────────────

export {
  collectHtmlFiles,
  isExternalOrAnchor,
  checkInternalLinks,
  checkSearchIndex,
};
