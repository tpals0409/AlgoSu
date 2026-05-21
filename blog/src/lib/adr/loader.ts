/**
 * @file       loader.ts
 * @domain     blog / adr
 * @layer      lib
 * @related    parser.ts, types.ts, posts.ts (fork 원본)
 *
 * docs/adr/**\/*.md (KR SSOT) + docs/adr-en/**\/*.md (영문판) 파일시스템 로더.
 * blog/ 디렉토리 기준으로 상위 docs/adr/ 및 docs/adr-en/ 를 스캔한다.
 * locale별 메모이제이션으로 빌드 당 한 번만 파싱.
 *
 * Sprint 157 P10 — locale 인자 도입.
 * - locale='ko' (기본): docs/adr/ 그대로 read (기존 동작 유지)
 * - locale='en': 각 KR ADR에 대응하는 docs/adr-en/<path>가 존재하면 영문판 read +
 *   hasEnTranslation=true, 없으면 KR 그대로 read + hasEnTranslation=false.
 *   영문 페이지가 누락 없이 항상 ADR 전수를 반환하도록 보장한다.
 */
import fs from 'fs';
import path from 'path';

import type { Locale } from '../i18n';
import type { AdrDoc, AdrKind } from './types';
import { parseAdr } from './parser';

/** ADR KR SSOT 루트 — blog/ 기준 상위 docs/adr/ */
const ADR_BASE = path.resolve(process.cwd(), '..', 'docs', 'adr');

/** ADR EN 디렉토리 — blog/ 기준 상위 docs/adr-en/ */
const ADR_EN_BASE = path.resolve(process.cwd(), '..', 'docs', 'adr-en');

/** 하위 디렉토리별 kind 매핑 */
const DIR_KIND_MAP: ReadonlyArray<[string, AdrKind]> = [
  ['sprints', 'sprint'],
  ['topics', 'topic'],
];

/**
 * 파일명이 해당 kind의 ADR 문서인지 판정한다.
 * sprint ADR은 정확히 `sprint-NNN.md`만 인정 — `sprint-NNN-plan.md` 같은 비-ADR 파일이
 * deriveSlug의 `sprint-(\d+)` 추출에서 동일 슬러그로 충돌해 ADR 라우트를 덮어쓰는 것을 차단한다(Sprint 183).
 */
function isAdrFile(filename: string, kind: AdrKind): boolean {
  if (!filename.endsWith('.md') || filename === 'README.md') return false;
  if (kind === 'sprint') return /^sprint-\d+\.md$/.test(filename);
  return true;
}

/* ─── 파일 읽기 ──────────────────────────────────── */

/**
 * 지정 디렉토리의 .md 파일 메타 목록을 반환한다.
 * KR 베이스 경로 기준 filePath를 부여하고, 동일 경로의 EN 파일이 존재하면 본문을 교체한다.
 * README.md는 제외한다.
 *
 * @param dir    - 스캔 대상 KR 디렉토리 절대 경로
 * @param kind   - ADR 분류
 * @param locale - 'ko' | 'en'
 */
function readAdrFiles(
  dir: string,
  kind: AdrKind,
  locale: Locale,
): {
  slug: string;
  raw: string;
  filePath: string;
  kind: AdrKind;
  hasEnTranslation: boolean;
}[] {
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((f) => isAdrFile(f, kind))
    .map((filename) => {
      const koAbsPath = path.join(dir, filename);
      const filePath = path.relative(ADR_BASE, koAbsPath);
      const slug = deriveSlug(filename, kind);
      const { raw, hasEnTranslation } = readLocalized(filePath, locale);
      return { slug, raw, filePath, kind, hasEnTranslation };
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

/**
 * locale에 맞춰 ADR 본문을 읽는다.
 * 'en'이고 docs/adr-en/<filePath>가 존재하면 영문판을 반환하고 hasEnTranslation=true.
 * 그 외에는 KR 원본을 반환하고 hasEnTranslation=false.
 *
 * @param filePath - ADR_BASE 기준 상대 경로 (예: 'sprints/sprint-156.md')
 * @param locale   - 'ko' | 'en'
 */
function readLocalized(
  filePath: string,
  locale: Locale,
): { raw: string; hasEnTranslation: boolean } {
  const koAbs = path.join(ADR_BASE, filePath);

  if (locale === 'en') {
    const enAbs = path.join(ADR_EN_BASE, filePath);
    if (fs.existsSync(enAbs)) {
      return { raw: fs.readFileSync(enAbs, 'utf-8'), hasEnTranslation: true };
    }
  }

  return { raw: fs.readFileSync(koAbs, 'utf-8'), hasEnTranslation: false };
}

/* ─── 루트 ADR 스캔 ──────────────────────────────── */

/**
 * ADR 루트 디렉토리(docs/adr/)의 ADR-*.md 파일을 읽는다.
 * locale='en'일 때 docs/adr-en/<filename>이 있으면 영문판으로 교체한다.
 *
 * @param locale - 'ko' | 'en'
 */
function readRootAdrs(locale: Locale): {
  slug: string;
  raw: string;
  filePath: string;
  kind: AdrKind;
  hasEnTranslation: boolean;
}[] {
  if (!fs.existsSync(ADR_BASE)) return [];

  return fs
    .readdirSync(ADR_BASE)
    .filter((f) => f.startsWith('ADR-') && f.endsWith('.md'))
    .map((filename) => {
      const slug = deriveSlug(filename, 'permanent');
      const { raw, hasEnTranslation } = readLocalized(filename, locale);
      return {
        slug,
        raw,
        filePath: filename,
        kind: 'permanent' as AdrKind,
        hasEnTranslation,
      };
    });
}

/* ─── 메모이제이션 캐시 ──────────────────────────── */

let cacheKo: AdrDoc[] | null = null;
let cacheEn: AdrDoc[] | null = null;

/**
 * 전체 ADR을 파싱하여 AdrDoc[]을 반환한다.
 * locale별로 모듈 레벨 메모이제이션을 적용한다.
 *
 * @param locale - 'ko' (기본) | 'en'
 */
export function getAllAdrs(locale: Locale = 'ko'): AdrDoc[] {
  if (locale === 'ko' && cacheKo) return cacheKo;
  if (locale === 'en' && cacheEn) return cacheEn;

  const entries = [
    ...readRootAdrs(locale),
    ...DIR_KIND_MAP.flatMap(([dir, kind]) =>
      readAdrFiles(path.join(ADR_BASE, dir), kind, locale),
    ),
  ];

  const docs = entries.map(({ slug, raw, filePath, kind, hasEnTranslation }) => {
    const doc = parseAdr(raw, filePath, kind, slug);
    doc.meta.hasEnTranslation = hasEnTranslation;
    return doc;
  });

  if (locale === 'ko') cacheKo = docs;
  else cacheEn = docs;

  return docs;
}

/**
 * 캐시를 무효화한다 (테스트/핫 리로드용).
 */
export function invalidateCache(): void {
  cacheKo = null;
  cacheEn = null;
}
