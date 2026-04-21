/**
 * @file 게스트 모드 샘플 인덱스 — 타입 정의 및 샘플 목록
 * @domain guest
 * @layer data
 * @related /guest page, /guest/preview/[slug] page, GuestNav
 */

import type { AnalysisResult } from '@/lib/api';
import type { Difficulty } from '@/lib/constants';
import { TWO_SUM_SAMPLE } from './samples/two-sum';
import { LRU_CACHE_SAMPLE } from './samples/lru-cache';
import { SQL_WINDOW_SAMPLE } from './samples/sql-window';

// ─── TYPES ───────────────────────────────────

/** 게스트 샘플 문제 메타데이터 */
export interface GuestProblem {
  title: string;
  description: string;
  difficulty: Difficulty;
  source: string;
  sourceUrl: string;
  tags: string[];
}

/** 게스트 샘플 제출 코드 */
export interface GuestSubmission {
  language: string;
  code: string;
}

/** 게스트 샘플 분석 결과 (AnalysisResult + 카테고리별 점수) */
export type GuestAnalysis = AnalysisResult & {
  categoryScores: Record<string, number>;
};

/** 게스트 모드 샘플 전체 구조 — stateless, DB 불필요 */
export interface GuestSample {
  id: string;
  slug: string;
  problem: GuestProblem;
  submission: GuestSubmission;
  analysis: GuestAnalysis;
}

// ─── SAMPLES ─────────────────────────────────

/** 게스트 모드 사전 시딩 샘플 목록 (정적 픽스처, LLM 호출 없음) */
export const GUEST_SAMPLES: GuestSample[] = [
  TWO_SUM_SAMPLE,
  LRU_CACHE_SAMPLE,
  SQL_WINDOW_SAMPLE,
];
