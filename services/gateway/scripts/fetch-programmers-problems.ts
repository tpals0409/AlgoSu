/**
 * @file fetch-programmers-problems.ts — 프로그래머스 문제 메타데이터 크롤러
 * @domain problem
 * @layer script
 * @related programmers.service.ts, data/programmers-problems.json
 *
 * Playwright Chromium headless로 코딩테스트 연습 페이지(Lv.0~5)를 순회하여
 * 문제 메타데이터를 수집한다.
 * Lv.0은 코딩기초트레이닝 문제 (challenges?levels=0)로, 동일 URL 구조에 포함된다.
 * 결과는 services/gateway/data/programmers-problems.json에 저장.
 *
 * 사전 준비: npx playwright install chromium
 * 실행:      npm run fetch-programmers  (services/gateway 디렉터리에서)
 *
 * 보안:
 *   - HTML 본문 / URL 내용 로깅 절대 금지
 *   - 수집 통계(건수·레벨 분포)만 구조화 로그로 출력
 *   - 요청 간 300~500ms 딜레이
 */

import { chromium } from 'playwright';
import type { Page } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

// ═══════════════════════════════════════════════════════════
//  Zod 스키마
// ═══════════════════════════════════════════════════════════

const itemSchema = z.object({
  problemId: z.number().int().positive(),
  title: z.string().min(1).max(300),
  level: z.number().int().min(0).max(5),
  tags: z.array(z.string().max(60)).max(10),
  sourceUrl: z.string().url(),
});

const dataSchema = z.object({
  version: z.string().min(1),
  items: z.array(itemSchema),
});

/** 스크립트가 저장할 아이템 타입 */
type ProblemItem = z.infer<typeof itemSchema>;

// ═══════════════════════════════════════════════════════════
//  상수
// ═══════════════════════════════════════════════════════════

const CHALLENGES_BASE = 'https://school.programmers.co.kr/learn/challenges';
const LESSON_BASE =
  'https://school.programmers.co.kr/learn/courses/30/lessons';
// Sprint 98: 레벨 0(코딩기초트레이닝) 포함 — challenges?levels=0 동일 URL 구조 사용
const LEVELS = [0, 1, 2, 3, 4, 5] as const;
type Level = (typeof LEVELS)[number];

const DELAY_MIN_MS = 300;
const DELAY_MAX_MS = 500;
const MAX_PAGES_PER_LEVEL = 100;
// Lv.0 포함 후 총 예상 건수: 기존 373 + 코딩기초트레이닝(~200건 이상) = 600+ 목표
const MIN_REQUIRED_COUNT = 600;
/** 검증용 문제 ID — "모의고사" */
const VERIFY_PROBLEM_ID = 42840;
/**
 * 정렬 순서.
 * 실험 결과 Programmers 챌린지 리스트는 정렬 방식과 무관하게
 * 동일한 373개 공개 문제 집합을 반환하므로 acceptance_desc 단일 패스로 충분.
 * (멀티-패스 방식은 성능 낭비 없이 동일 결과 → 단순화)
 */
const ORDERS = ['acceptance_desc'] as const;
type Order = (typeof ORDERS)[number];

// ═══════════════════════════════════════════════════════════
//  유틸리티
// ═══════════════════════════════════════════════════════════

/**
 * 구조화 로그 출력.
 * HTML 본문·URL 내용은 절대 포함하지 않는다.
 */
function sLog(
  severity: 'info' | 'warn' | 'error',
  event: string,
  data: Record<string, unknown>,
): void {
  process.stdout.write(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      severity,
      event,
      ...data,
    }) + '\n',
  );
}

/**
 * 300~500ms 랜덤 지연 — 과도한 요청 속도 방지
 */
function randomDelay(): Promise<void> {
  const ms =
    DELAY_MIN_MS + Math.floor(Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS));
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * 레벨 텍스트("Lv. 1", "★★★" 등)에서 정수 레벨 추출.
 * 파싱 실패 시 defaultLevel 반환.
 */
function parseLevelText(text: string, defaultLevel: Level): number {
  const lvMatch = text.match(/[Ll]v\.?\s*(\d)/);
  if (lvMatch !== null && lvMatch[1] !== undefined) {
    return parseInt(lvMatch[1], 10);
  }
  const starCount = (text.match(/★/g) ?? []).length;
  if (starCount >= 1 && starCount <= 5) return starCount;
  return defaultLevel;
}

// ═══════════════════════════════════════════════════════════
//  브라우저 컨텍스트 데이터 구조
// ═══════════════════════════════════════════════════════════

/** page.evaluate 반환용 원시 카드 데이터 */
interface RawCard {
  problemId: number;
  title: string;
  levelText: string;
  tagTexts: string[];
}

// ═══════════════════════════════════════════════════════════
//  크롤러 — 페이지 추출 함수
// ═══════════════════════════════════════════════════════════

/**
 * 현재 렌더링된 페이지에서 문제 카드 데이터 추출.
 * 내부 함수는 브라우저 컨텍스트에서 실행되므로 DOM API만 사용.
 */
async function extractCards(page: Page): Promise<RawCard[]> {
  return page.evaluate(
    (): Array<{
      problemId: number;
      title: string;
      levelText: string;
      tagTexts: string[];
    }> => {
      const results: Array<{
        problemId: number;
        title: string;
        levelText: string;
        tagTexts: string[];
      }> = [];
      const seen = new Set<number>();

      // 레슨 링크를 찾아 문제 ID와 주변 메타데이터 추출
      const anchors = document.querySelectorAll<HTMLAnchorElement>(
        'a[href*="/learn/courses/30/lessons/"]',
      );

      anchors.forEach((anchor) => {
        const href = anchor.getAttribute('href') ?? '';
        const idMatch = href.match(/\/lessons\/(\d+)/);
        if (idMatch === null || idMatch[1] === undefined) return;

        const problemId = parseInt(idMatch[1], 10);
        if (!Number.isFinite(problemId) || problemId <= 0) return;
        if (seen.has(problemId)) return;
        seen.add(problemId);

        // 제목: 링크 텍스트 기반 (공백 정규화)
        const title = (anchor.textContent ?? '')
          .replace(/\s+/g, ' ')
          .trim();
        if (!title) return;

        // 카드 컨테이너 탐색 (최대 8단계 위)
        let card: Element = anchor;
        for (let depth = 0; depth < 8; depth++) {
          const parent = card.parentElement;
          if (parent === null) break;
          card = parent;
          const tag = card.tagName.toLowerCase();
          if (tag === 'li' || tag === 'article' || tag === 'tr') break;
          const cls = (card.getAttribute('class') ?? '').toLowerCase();
          if (
            cls.includes('item') ||
            cls.includes('challenge') ||
            cls.includes('card') ||
            cls.includes('problem')
          ) {
            break;
          }
        }

        // 레벨 텍스트
        const lvEl = card.querySelector<HTMLElement>(
          '[class*="level"],[class*="difficult"],[class*="lv-"],[class*="-lv"]',
        );
        const levelText = (lvEl?.textContent ?? '').trim();

        // 태그 텍스트 (레벨 표시 제외, 최대 5개)
        const tagTexts: string[] = [];
        const tagEls = card.querySelectorAll<HTMLElement>(
          '[class*="tag"],[class*="badge"],[class*="category"],[class*="label"],[class*="skill"]',
        );
        tagEls.forEach((el) => {
          const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
          if (
            text.length > 0 &&
            text.length <= 60 &&
            !/[Ll]v\./.test(text) &&
            tagTexts.length < 5
          ) {
            tagTexts.push(text);
          }
        });

        results.push({ problemId, title, levelText, tagTexts });
      });

      return results;
    },
  );
}

// ═══════════════════════════════════════════════════════════
//  크롤러 — 레벨별 수집 (URL 기반 페이지네이션)
// ═══════════════════════════════════════════════════════════

/**
 * 특정 레벨·정렬 조합의 모든 문제를 URL ?page=N 방식으로 순회하며 수집.
 *
 * 프로그래머스 챌린지 페이지는 React SPA로, 버튼 클릭 방식의 페이지 전환은
 * 클라이언트 상태 변경이라 Playwright에서 신뢰도가 낮다.
 * 대신 ?page=N URL 파라미터를 직접 증가시켜 새 페이지를 독립적으로 로드한다.
 * @param globalSeen 전역 중복 제거 Set — 이미 수집된 ID는 건너뜀
 */
async function collectLevel(
  page: Page,
  level: Level,
  order: Order,
  globalSeen: Set<number>,
): Promise<ProblemItem[]> {
  const collected: ProblemItem[] = [];
  /** 이번 레벨+정렬 조합 내 중복 방지용 */
  const localSeen = new Set<number>();

  sLog('info', '[MQ_CONSUME]', { action: 'LEVEL_START', level, order });

  for (let pageNum = 1; pageNum <= MAX_PAGES_PER_LEVEL; pageNum++) {
    const url = `${CHALLENGES_BASE}?levels=${level}&order=${order}&page=${pageNum}`;

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
    } catch {
      sLog('warn', '[GOTO_FALLBACK]', {
        level,
        pageNum,
        action: 'load_event_fallback',
      });
      await page.goto(url, { waitUntil: 'load', timeout: 30_000 });
    }

    // 문제 링크 렌더링 대기
    try {
      await page.waitForSelector('a[href*="/learn/courses/30/lessons/"]', {
        timeout: 10_000,
      });
    } catch {
      // 더 이상 문제가 없는 페이지 → 종료
      sLog('info', '[LEVEL_END]', { level, reason: 'no_more_lessons', pageNum });
      break;
    }

    await randomDelay();

    const cards = await extractCards(page);
    /**
     * 이번 페이지에서 localSeen에 신규 진입한 항목 수.
     * 0이면 사이트가 이전 페이지 내용을 반복 반환 → 루프 종료.
     */
    let pageLocalNew = 0;

    for (const card of cards) {
      // localSeen: 이 레벨+정렬 조합 내 중복 방지 (stop condition 판단용)
      if (localSeen.has(card.problemId)) continue;
      localSeen.add(card.problemId);
      pageLocalNew++;

      // globalSeen: 전체 실행 기준 중복 방지 (진짜 새 문제만 저장)
      if (globalSeen.has(card.problemId)) continue;
      globalSeen.add(card.problemId);

      const lvNum = parseLevelText(card.levelText, level);
      const deduped = [...new Set(card.tagTexts)].slice(0, 5);

      collected.push({
        problemId: card.problemId,
        title: card.title,
        level: lvNum,
        tags: deduped,
        sourceUrl: `${LESSON_BASE}/${card.problemId}`,
      });
    }

    sLog('info', '[PAGE_SCRAPED]', {
      level,
      order,
      pageNum,
      pageLocalNew,
      globalNew: collected.length,
    });

    // localSeen 기준 신규 항목이 없으면 페이지 반복 → 종료
    if (pageLocalNew === 0) break;
  }

  return collected;
}

// ═══════════════════════════════════════════════════════════
//  메인
// ═══════════════════════════════════════════════════════════

/**
 * 크롤러 진입점.
 * Lv.1~5 × 3가지 정렬 순서를 순회하여 최대 커버리지 확보.
 * Zod 검증 후 JSON 저장.
 */
async function main(): Promise<void> {
  const t0 = Date.now();
  sLog('info', '[MQ_CONSUME]', {
    script: 'fetch-programmers-problems',
    levels: [...LEVELS],
    orders: [...ORDERS],
  });

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    extraHTTPHeaders: {
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    },
  });

  const page = await context.newPage();
  const allItems = new Map<number, ProblemItem>();
  /** 전체 실행 기준 중복 방지 Set — collectLevel에 공유됨 */
  const globalSeen = new Set<number>();

  try {
    for (const ord of ORDERS) {
      for (const lvl of LEVELS) {
        const items = await collectLevel(page, lvl, ord, globalSeen);
        for (const item of items) {
          // globalSeen은 collectLevel 내에서 이미 관리되므로 여기선 Map만 갱신
          allItems.set(item.problemId, item);
        }
        sLog('info', '[LEVEL_ORDER_DONE]', {
          level: lvl,
          order: ord,
          newItems: items.length,
          totalSoFar: allItems.size,
        });
        await new Promise<void>((r) => setTimeout(r, 400));
      }
      sLog('info', '[ORDER_PASS_DONE]', { order: ord, totalSoFar: allItems.size });
      await new Promise<void>((r) => setTimeout(r, 800));
    }
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }

  // 레벨 → problemId 순 정렬
  const sorted = Array.from(allItems.values()).sort((a, b) =>
    a.level !== b.level ? a.level - b.level : a.problemId - b.problemId,
  );

  // 레벨 분포 통계
  const levelDist: Record<string, number> = {};
  for (const item of sorted) {
    const key = `lv${item.level}`;
    levelDist[key] = (levelDist[key] ?? 0) + 1;
  }

  sLog('info', '[MQ_CONSUME_DONE]', {
    total: sorted.length,
    levelDistribution: levelDist,
    elapsedMs: Date.now() - t0,
  });

  if (sorted.length < MIN_REQUIRED_COUNT) {
    sLog('warn', '[LOW_COUNT_WARNING]', {
      collected: sorted.length,
      required: MIN_REQUIRED_COUNT,
    });
  }

  // 샘플 확인 (첫 5 / 마지막 5)
  const first5 = sorted
    .slice(0, 5)
    .map((i) => ({ id: i.problemId, title: i.title, lv: i.level }));
  const last5 = sorted
    .slice(-5)
    .map((i) => ({ id: i.problemId, title: i.title, lv: i.level }));
  const hasVerifyProblem = allItems.has(VERIFY_PROBLEM_ID);

  sLog('info', '[SAMPLE_VERIFY]', {
    first5,
    last5,
    [`has_${VERIFY_PROBLEM_ID}_모의고사`]: hasVerifyProblem,
  });

  // Zod 런타임 검증
  const payload = {
    version: new Date().toISOString(),
    items: sorted,
  };
  dataSchema.parse(payload);
  sLog('info', '[ZOD_PASSED]', { count: sorted.length });

  // 파일 저장
  const dataDir = join(__dirname, '..', 'data');
  mkdirSync(dataDir, { recursive: true });
  const outPath = join(dataDir, 'programmers-problems.json');
  writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf-8');

  sLog('info', '[SAVE_DONE]', {
    file: 'data/programmers-problems.json',
    items: sorted.length,
  });
}

main().catch((err: unknown) => {
  sLog('error', '[SCRIPT_ERROR]', {
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  process.exit(1);
});
