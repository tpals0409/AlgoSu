/**
 * @file 외부 플랫폼 API — Solved.ac + Programmers
 * @domain external
 * @layer api
 * @related ProblemService, Gateway 프록시
 */

import { fetchApi } from './client';

// ── Solved.ac ──

export interface SolvedacProblemInfo {
  problemId: number;
  title: string;
  difficulty: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND' | null;
  level: number;
  sourceUrl: string;
  tags: string[];
}

/** Gateway 프록시(search) 응답 — solved.ac /search/problem 원본을 얇게 감싼 형태 */
export interface SolvedacSearchItem {
  problemId: number;
  titleKo?: string;
  title?: string;
  level: number;
  difficulty?: SolvedacProblemInfo['difficulty'];
  sourceUrl?: string;
  tags: string[];
  acceptedUserCount?: number;
}

export interface SolvedacSearchResult {
  count: number;
  items: SolvedacSearchItem[];
}

export const solvedacApi = {
  search: (problemId: number): Promise<SolvedacProblemInfo> =>
    fetchApi(`/api/external/solvedac/problem/${problemId}`),

  /** 문자열 쿼리(문제 번호·제목) 기반 검색 — Gateway가 solved.ac 프록시 (Referer 우회) */
  searchByQuery: (query: string, page = 1): Promise<SolvedacSearchResult> =>
    fetchApi(
      `/api/external/solvedac/search?query=${encodeURIComponent(query)}&page=${page}`,
    ),
};

// ── Programmers ──

export interface ProgrammersProblemInfo {
  problemId: number;
  title: string;
  level: number;
  difficulty: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND' | null;
  tags: string[];
  sourceUrl: string;
}

export interface ProgrammersSearchItem {
  problemId: number;
  title: string;
  level: number;
  difficulty: ProgrammersProblemInfo['difficulty'];
  sourceUrl: string;
  tags: string[];
  /** Sprint 108: 문제 카테고리 (algorithm | sql) */
  category: 'algorithm' | 'sql';
}

export interface ProgrammersSearchResult {
  count: number;
  items: ProgrammersSearchItem[];
}

export const programmersApi = {
  /** 프로그래머스 문제 번호로 단일 문제 조회 */
  search: (problemId: number): Promise<ProgrammersProblemInfo> =>
    fetchApi(`/api/external/programmers/problem/${problemId}`),

  /** 문자열 쿼리(문제 번호·제목) 기반 프로그래머스 검색 */
  searchByQuery: (query: string, page = 1): Promise<ProgrammersSearchResult> =>
    fetchApi(
      `/api/external/programmers/search?query=${encodeURIComponent(query)}&page=${page}`,
    ),
};
