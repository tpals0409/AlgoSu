/**
 * @file       loader.ts
 * @domain     blog / adr
 * @layer      lib
 * @related    parser.ts, types.ts, posts.ts (fork 원본)
 *
 * docs/adr/**\/*.md 파일시스템 로더.
 * blog/ 디렉토리 기준으로 상위 docs/adr/ 3 하위 디렉토리를 스캔한다.
 * 모듈 레벨 메모이제이션으로 빌드 당 한 번만 파싱.
 */
import fs from 'fs';
import path from 'path';

import type { AdrDoc, AdrKind } from './types';
import { parseAdr } from './parser';

/** ADR SSOT 루트 — blog/ 기준 상위 docs/adr/ */
const ADR_BASE = path.resolve(process.cwd(), '..', 'docs', 'adr');

/** 하위 디렉토리별 kind 매핑 */
const DIR_KIND_MAP: ReadonlyArray<[string, AdrKind]> = [
  ['sprints', 'sprint'],
  ['topics', 'topic'],
];

/* ─── 파일 읽기 ──────────────────────────────────── */

/**
 * 지정 디렉토리의 .md 파일을 읽어 raw 텍스트를 반환한다.
 * README.md는 제외한다.
 * @param dir  - 스캔 대상 절대 경로
 * @param kind - ADR 분류
 */
function readAdrFiles(
  dir: string,
  kind: AdrKind,
): { slug: string; raw: string; filePath: string; kind: AdrKind }[] {
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .map((filename) => {
      const raw = fs.readFileSync(path.join(dir, filename), 'utf-8');
      const slug = deriveSlug(filename, kind);
      const filePath = path.relative(ADR_BASE, path.join(dir, filename));
      return { slug, raw, filePath, kind };
    });
}

/**
 * 파일명으로부터 slug를 결정한다.
 * sprint -> 숫자만 (sprint-110.md -> '110')
 * permanent -> ADR-NNN에서 NNN ('001')
 * topic -> 전체 파일명에서 .md 제거
 */
function deriveSlug(filename: string, kind: AdrKind): string {
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

/* ─── 루트 ADR 스캔 ──────────────────────────────── */

/**
 * ADR 루트 디렉토리(docs/adr/)의 ADR-*.md 파일을 읽는다.
 */
function readRootAdrs(): {
  slug: string;
  raw: string;
  filePath: string;
  kind: AdrKind;
}[] {
  if (!fs.existsSync(ADR_BASE)) return [];

  return fs
    .readdirSync(ADR_BASE)
    .filter((f) => f.startsWith('ADR-') && f.endsWith('.md'))
    .map((filename) => {
      const raw = fs.readFileSync(path.join(ADR_BASE, filename), 'utf-8');
      const slug = deriveSlug(filename, 'permanent');
      return { slug, raw, filePath: filename, kind: 'permanent' as AdrKind };
    });
}

/* ─── 메모이제이션 캐시 ──────────────────────────── */

let cache: AdrDoc[] | null = null;

/**
 * 전체 ADR을 파싱하여 AdrDoc[]을 반환한다.
 * 모듈 레벨 메모이제이션으로 동일 빌드 내 재호출 시 캐시 반환.
 */
export function getAllAdrs(): AdrDoc[] {
  if (cache) return cache;

  const entries = [
    ...readRootAdrs(),
    ...DIR_KIND_MAP.flatMap(([dir, kind]) =>
      readAdrFiles(path.join(ADR_BASE, dir), kind),
    ),
  ];

  cache = entries.map(({ slug, raw, filePath, kind }) =>
    parseAdr(raw, filePath, kind, slug),
  );

  return cache;
}

/**
 * 캐시를 무효화한다 (테스트/핫 리로드용).
 */
export function invalidateCache(): void {
  cache = null;
}
