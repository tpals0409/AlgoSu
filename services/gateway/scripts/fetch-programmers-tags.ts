/**
 * @file fetch-programmers-tags.ts — 프로그래머스 tags 2차 패스 크롤러
 * @domain problem
 * @layer script
 * @related fetch-programmers-problems.ts, programmers.service.ts, data/programmers-problems.json
 *
 * programmers-problems.json의 빈 tags 배열을 채우는 2차 패스 스크립트.
 * 각 문제 상세 페이지의 breadcrumb/카테고리 링크를 Playwright chromium headless로 파싱해
 * tags: string[]를 추출하고 JSON을 덮어쓴다.
 *
 * 사전 준비: npx playwright install chromium
 * 실행:      npm run fetch-programmers-tags           (전수 373건 — curator 담당)
 * 드라이런:  npm run fetch-programmers-tags -- --dry-run  (샘플 3건만 검증)
 *
 * 보안:
 *   - HTML 본문 / URL 내용 로깅 절대 금지
 *   - 수집 통계(건수·실패 목록)만 구조화 로그로 출력
 *   - 요청 간 300~500ms 랜덤 딜레이
 */

import { chromium } from 'playwright';
import type { Page } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

// ═══════════════════════════════════════════════════════════
//  Zod 스키마
// ═══════════════════════════════════════════════════════════

/** 최종 검증용 — tags.min(1) 포함 */
const itemValidationSchema = z.object({
  problemId: z.number().int().positive(),
  title: z.string().min(1).max(300),
  level: z.number().int().min(0).max(5),
  tags: z.array(z.string().max(60)).min(1).max(10),
  sourceUrl: z.string().url(),
});

// ═══════════════════════════════════════════════════════════
//  타입 정의
// ═══════════════════════════════════════════════════════════

interface RawItem {
  problemId: number;
  title: string;
  level: number;
  tags: string[];
  sourceUrl: string;
}

interface RawEnvelope {
  version: string;
  items: RawItem[];
}

// ═══════════════════════════════════════════════════════════
//  상수
// ═══════════════════════════════════════════════════════════

const LESSON_BASE =
  'https://school.programmers.co.kr/learn/courses/30/lessons';
const DELAY_MIN_MS = 300;
const DELAY_MAX_MS = 500;
const MAX_RETRIES_PER_ITEM = 3;
const BACKOFF_BASE_MS = 1_000;

/** 드라이런 샘플 ID — 모의고사(42840), 폰켓몬(1845), 2016년(12901) */
const DRY_RUN_SAMPLE_IDS: number[] = [42840, 1845, 12901];

/**
 * breadcrumb 셀렉터 우선순위 목록.
 * 상위 셀렉터가 결과를 반환하면 하위는 시도하지 않는다.
 */
const BREADCRUMB_SELECTORS = [
  'nav.breadcrumb a',
  'ol.breadcrumb a',
  'ul.breadcrumb a',
  '.breadcrumb li a',
  '[class*="breadcrumb"] a',
  '[class*="lesson-category"] a',
  '[class*="category"] a',
] as const;

/**
 * tags에서 제외할 최상위 범주 키워드.
 * 모든 문제에 공통으로 붙는 대분류(사이트 네비게이션)라 유의미한 태그가 아님.
 */
const SKIP_KEYWORDS = [
  '코딩테스트 연습',
  '코딩테스트',
  'Programmers',
  '프로그래머스',
  'Home',
  '홈',
];

// ═══════════════════════════════════════════════════════════
//  유틸리티 (fetch-programmers-problems.ts 패턴 동일)
// ═══════════════════════════════════════════════════════════

/**
 * 구조화 로그 출력 — stdout.
 * HTML 본문·URL 내용은 절대 포함하지 않는다.
 */
function sLog(
  severity: 'info' | 'warn' | 'error',
  event: string,
  data: Record<string, unknown>,
): void {
  process.stdout.write(
    JSON.stringify({ timestamp: new Date().toISOString(), severity, event, ...data }) + '\n',
  );
}

/** 오류 전용 stderr 구조화 출력 */
function sErr(event: string, data: Record<string, unknown>): void {
  process.stderr.write(
    JSON.stringify({ timestamp: new Date().toISOString(), severity: 'error', event, ...data }) + '\n',
  );
}

/** 300~500ms 랜덤 지연 — 과도한 요청 속도 방지 */
function randomDelay(): Promise<void> {
  const ms = DELAY_MIN_MS + Math.floor(Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS));
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** 지수 백오프. attempt=1 → 1s, attempt=2 → 2s, attempt=3 → 4s */
function exponentialBackoff(attempt: number): Promise<void> {
  const ms = BACKOFF_BASE_MS * Math.pow(2, attempt - 1);
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** 최상위 범주 네비게이션 텍스트 여부 판별 */
function isSkippable(text: string): boolean {
  return SKIP_KEYWORDS.some((kw) => text.includes(kw));
}

// ═══════════════════════════════════════════════════════════
//  breadcrumb 파싱
// ═══════════════════════════════════════════════════════════

/**
 * 셀렉터 하나에 대해 페이지에서 링크 텍스트 배열을 추출한다.
 * 브라우저 컨텍스트(DOM API)에서 실행.
 */
async function extractBySelector(page: Page, selector: string): Promise<string[]> {
  return page.evaluate((sel: string): string[] => {
    const anchors = document.querySelectorAll<HTMLAnchorElement>(sel);
    const results: string[] = [];
    anchors.forEach((a) => {
      const text = (a.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (text.length > 0 && text.length <= 60) results.push(text);
    });
    return results;
  }, selector);
}

/**
 * breadcrumb 셀렉터 우선순위 순서로 시도해 첫 번째 유효 결과를 반환한다.
 * 불필요한 최상위 범주 키워드는 필터링하고 중복 제거, 최대 5개 반환.
 */
async function extractBreadcrumbTags(page: Page): Promise<string[]> {
  for (const selector of BREADCRUMB_SELECTORS) {
    const texts = await extractBySelector(page, selector);
    const filtered = texts.filter((t) => !isSkippable(t));
    if (filtered.length > 0) {
      return [...new Set(filtered)].slice(0, 5);
    }
  }
  return [];
}

// ═══════════════════════════════════════════════════════════
//  페이지 네비게이션
// ═══════════════════════════════════════════════════════════

/**
 * 문제 상세 페이지로 이동하고 breadcrumb 렌더링을 대기한다.
 * 429 응답 시 지수 백오프 후 false 반환 (재시도 요청).
 * 성공 시 true 반환.
 */
async function navigateToLesson(
  page: Page,
  problemId: number,
  attempt: number,
): Promise<boolean> {
  const url = `${LESSON_BASE}/${problemId}`;
  let response: Awaited<ReturnType<typeof page.goto>>;
  try {
    response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
  } catch {
    response = await page.goto(url, { waitUntil: 'load', timeout: 30_000 });
  }

  if (response && response.status() === 429) {
    sLog('warn', '[RATE_LIMIT]', { problemId, attempt });
    await exponentialBackoff(attempt);
    return false;
  }

  // breadcrumb/카테고리 요소 렌더링 대기 (없어도 계속 진행)
  await page
    .waitForSelector('[class*="breadcrumb"], [class*="category"]', { timeout: 8_000 })
    .catch(() => { /* 셀렉터 없는 페이지는 무시 */ });

  return true;
}

// ═══════════════════════════════════════════════════════════
//  개별 문제 tags 수집 (재시도 포함)
// ═══════════════════════════════════════════════════════════

/**
 * 단일 문제 상세 페이지에서 tags를 수집한다.
 * 최대 MAX_RETRIES_PER_ITEM 회 재시도.
 * 429 응답 → exponentialBackoff, 기타 오류 → warn 후 재시도.
 */
async function fetchTagsWithRetry(page: Page, problemId: number): Promise<string[]> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES_PER_ITEM; attempt++) {
    try {
      const ok = await navigateToLesson(page, problemId, attempt);
      if (!ok) continue; // 429: 백오프 완료, 재시도

      const tags = await extractBreadcrumbTags(page);
      return tags;
    } catch (err) {
      lastError = err;
      sLog('warn', '[FETCH_RETRY]', {
        problemId,
        attempt,
        maxRetries: MAX_RETRIES_PER_ITEM,
        error: err instanceof Error ? err.message : String(err),
      });
      if (attempt < MAX_RETRIES_PER_ITEM) {
        await exponentialBackoff(attempt);
      }
    }
  }

  throw lastError ?? new Error(`fetchTagsWithRetry: 알 수 없는 오류 (problemId=${problemId})`);
}

// ═══════════════════════════════════════════════════════════
//  데이터 로드 / 저장
// ═══════════════════════════════════════════════════════════

/**
 * programmers-problems.json을 로드한다.
 * version + items 봉투 구조를 확인.
 */
function loadData(dataPath: string): RawEnvelope {
  const raw = JSON.parse(readFileSync(dataPath, 'utf-8')) as unknown;
  if (
    typeof raw !== 'object' ||
    raw === null ||
    !('version' in raw) ||
    !('items' in raw) ||
    !Array.isArray((raw as Record<string, unknown>)['items'])
  ) {
    throw new Error('잘못된 데이터 봉투 구조 (version + items[] 필요)');
  }
  return raw as RawEnvelope;
}

/**
 * 갱신된 items를 JSON으로 저장한다.
 * version을 현재 ISO 타임스탬프로 갱신.
 */
function saveData(dataPath: string, items: RawItem[]): void {
  const payload: RawEnvelope = {
    version: new Date().toISOString(),
    items,
  };
  writeFileSync(dataPath, JSON.stringify(payload, null, 2), 'utf-8');
  sLog('info', '[SAVE_DONE]', {
    file: 'data/programmers-problems.json',
    items: items.length,
    version: payload.version,
  });
}

// ═══════════════════════════════════════════════════════════
//  Zod 검증
// ═══════════════════════════════════════════════════════════

/**
 * 모든 items의 tags.length >= 1 여부를 Zod로 검증한다.
 * @returns 검증 실패한 problemId 배열 (빈 배열이면 전체 통과)
 */
function validateAllTags(items: RawItem[]): number[] {
  return items
    .filter((item) => {
      const result = itemValidationSchema.safeParse(item);
      return !result.success;
    })
    .map((item) => item.problemId);
}

// ═══════════════════════════════════════════════════════════
//  수집 루프
// ═══════════════════════════════════════════════════════════

interface CollectResult {
  successCount: number;
  failedIds: number[];
}

/**
 * 대상 items를 순회하며 각 문제의 tags를 수집한다.
 * allItems를 in-place 갱신하고 성공/실패 통계를 반환한다.
 */
async function collectTags(
  page: Page,
  targets: RawItem[],
  allItems: RawItem[],
): Promise<CollectResult> {
  const failedIds: number[] = [];
  let successCount = 0;

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];

    try {
      const tags = await fetchTagsWithRetry(page, target.problemId);

      if (tags.length > 0) {
        const idx = allItems.findIndex((it) => it.problemId === target.problemId);
        if (idx !== -1) allItems[idx] = { ...allItems[idx], tags };
        successCount++;
        sLog('info', '[ITEM_DONE]', {
          problemId: target.problemId,
          title: target.title,
          tags,
          progress: `${i + 1}/${targets.length}`,
        });
      } else {
        failedIds.push(target.problemId);
        sLog('warn', '[NO_TAGS]', {
          problemId: target.problemId,
          title: target.title,
          progress: `${i + 1}/${targets.length}`,
        });
      }
    } catch (err) {
      failedIds.push(target.problemId);
      sLog('warn', '[ITEM_FAILED]', {
        problemId: target.problemId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    if (i < targets.length - 1) await randomDelay();
  }

  return { successCount, failedIds };
}

// ═══════════════════════════════════════════════════════════
//  브라우저 팩토리
// ═══════════════════════════════════════════════════════════

/**
 * Playwright 브라우저 컨텍스트를 생성한다.
 * User-Agent는 fetch-programmers-problems.ts와 동일 유지.
 */
async function createBrowserPage(): Promise<{
  browser: Awaited<ReturnType<typeof chromium.launch>>;
  page: Page;
}> {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    extraHTTPHeaders: { 'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7' },
  });
  const page = await context.newPage();
  return { browser, page };
}

// ═══════════════════════════════════════════════════════════
//  메인
// ═══════════════════════════════════════════════════════════

/**
 * tags 2차 패스 크롤러 진입점.
 * --dry-run 플래그 시 샘플 3건(42840, 1845, 12901)만 처리하고 JSON 저장을 건너뛴다.
 */
async function main(): Promise<void> {
  const isDryRun = process.argv.includes('--dry-run');
  const t0 = Date.now();

  sLog('info', '[TAGS_CRAWL_START]', {
    script: 'fetch-programmers-tags',
    dryRun: isDryRun,
  });

  const dataPath = join(__dirname, '..', 'data', 'programmers-problems.json');
  const envelope = loadData(dataPath);
  const allItems: RawItem[] = [...envelope.items];

  const targets = isDryRun
    ? allItems.filter((item) => DRY_RUN_SAMPLE_IDS.includes(item.problemId))
    : allItems;

  if (targets.length === 0) {
    sLog('warn', '[NO_TARGETS]', { dryRun: isDryRun, sampleIds: DRY_RUN_SAMPLE_IDS });
    return;
  }

  sLog('info', '[TARGET_COUNT]', {
    total: allItems.length,
    targets: targets.length,
    dryRun: isDryRun,
  });

  const { browser, page } = await createBrowserPage();

  let result: CollectResult;
  try {
    result = await collectTags(page, targets, allItems);
  } finally {
    await page.close();
    await browser.close();
  }

  sLog('info', '[CRAWL_DONE]', {
    success: result.successCount,
    failed: result.failedIds.length,
    elapsedMs: Date.now() - t0,
    dryRun: isDryRun,
  });

  // 드라이런: 저장 건너뜀, 파싱 결과만 출력
  if (isDryRun) {
    const samples = allItems
      .filter((it) => DRY_RUN_SAMPLE_IDS.includes(it.problemId))
      .map((it) => ({ problemId: it.problemId, title: it.title, tags: it.tags }));
    sLog('info', '[DRY_RUN_COMPLETE]', {
      note: 'JSON 저장 건너뜀 (--dry-run 모드)',
      results: samples,
    });
    return;
  }

  // 전수 수집 후 JSON 저장
  saveData(dataPath, allItems);

  // Zod 검증: 모든 items의 tags.length >= 1 확인
  const failedValidation = validateAllTags(allItems);
  if (failedValidation.length > 0) {
    sErr('[ZOD_FAILED]', {
      message: 'tags.length < 1 항목 발견 — 재수집 필요',
      failedProblemIds: failedValidation,
      count: failedValidation.length,
    });
    process.exit(1);
  }

  sLog('info', '[ZOD_PASSED]', { count: allItems.length });
}

main().catch((err: unknown) => {
  sLog('error', '[SCRIPT_ERROR]', {
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  process.exit(1);
});
