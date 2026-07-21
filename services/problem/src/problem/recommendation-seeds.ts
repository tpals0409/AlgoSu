/**
 * @file recommendation-seeds.ts — 추천 콜드스타트용 정적 seed 문제 목록
 * @domain problem
 * @layer constant
 * @related problem.service.ts, dto/recommend-query.dto.ts
 *
 * 목적: 신규 스터디(등록 문제 0개) 또는 cross-study 풀이 부족할 때 Tier 3 폴백으로 사용.
 * 출처: 실제 프로그래머스 lesson (URL: https://school.programmers.co.kr/learn/courses/30/lessons/<ID>)
 * 난이도 매핑: Lv.1→BRONZE, Lv.2→SILVER, Lv.3→GOLD (level=프로그래머스 Lv 숫자)
 */
import { Difficulty, ProblemCategory } from './problem.entity';

/**
 * 추천 응답 아이템 — 외부 식별 메타만 투영 (cross-study 누출 방지)
 * description/studyId/createdBy/id/publicId/deadline 등 절대 미포함
 */
export interface RecommendationItem {
  title: string;
  sourceUrl: string;
  sourcePlatform: string;
  difficulty: Difficulty | null;
  level: number | null;
  tags: string[] | null;
  category: ProblemCategory;
}

/** 프로그래머스 lesson URL 조립 */
const lessonUrl = (id: number): string =>
  `https://school.programmers.co.kr/learn/courses/30/lessons/${id}`;

/**
 * 정적 seed 목록 — 프로그래머스 대표 lesson 12선
 * 각 항목은 RecommendationItem 형태로 그대로 반환 가능하도록 사전 투영됨.
 */
export const RECOMMENDATION_SEEDS: readonly RecommendationItem[] = [
  { title: '완주하지 못한 선수', sourceUrl: lessonUrl(42576), sourcePlatform: 'PROGRAMMERS', difficulty: Difficulty.BRONZE, level: 1, tags: ['해시'], category: ProblemCategory.ALGORITHM },
  { title: '모의고사', sourceUrl: lessonUrl(42840), sourcePlatform: 'PROGRAMMERS', difficulty: Difficulty.BRONZE, level: 1, tags: ['완전탐색'], category: ProblemCategory.ALGORITHM },
  { title: 'K번째수', sourceUrl: lessonUrl(42748), sourcePlatform: 'PROGRAMMERS', difficulty: Difficulty.BRONZE, level: 1, tags: ['정렬'], category: ProblemCategory.ALGORITHM },
  { title: '두 개 뽑아서 더하기', sourceUrl: lessonUrl(68644), sourcePlatform: 'PROGRAMMERS', difficulty: Difficulty.BRONZE, level: 1, tags: ['완전탐색'], category: ProblemCategory.ALGORITHM },
  { title: '체육복', sourceUrl: lessonUrl(42862), sourcePlatform: 'PROGRAMMERS', difficulty: Difficulty.BRONZE, level: 1, tags: ['탐욕법'], category: ProblemCategory.ALGORITHM },
  { title: '폰켓몬', sourceUrl: lessonUrl(1845), sourcePlatform: 'PROGRAMMERS', difficulty: Difficulty.SILVER, level: 2, tags: ['해시'], category: ProblemCategory.ALGORITHM },
  { title: '큰 수 만들기', sourceUrl: lessonUrl(42883), sourcePlatform: 'PROGRAMMERS', difficulty: Difficulty.SILVER, level: 2, tags: ['탐욕법'], category: ProblemCategory.ALGORITHM },
  { title: '타겟 넘버', sourceUrl: lessonUrl(43165), sourcePlatform: 'PROGRAMMERS', difficulty: Difficulty.SILVER, level: 2, tags: ['DFS/BFS'], category: ProblemCategory.ALGORITHM },
  { title: '게임 맵 최단거리', sourceUrl: lessonUrl(1844), sourcePlatform: 'PROGRAMMERS', difficulty: Difficulty.SILVER, level: 2, tags: ['BFS'], category: ProblemCategory.ALGORITHM },
  { title: '정수 삼각형', sourceUrl: lessonUrl(43105), sourcePlatform: 'PROGRAMMERS', difficulty: Difficulty.GOLD, level: 3, tags: ['DP'], category: ProblemCategory.ALGORITHM },
  { title: '네트워크', sourceUrl: lessonUrl(43162), sourcePlatform: 'PROGRAMMERS', difficulty: Difficulty.GOLD, level: 3, tags: ['DFS/BFS'], category: ProblemCategory.ALGORITHM },
  { title: '단어 변환', sourceUrl: lessonUrl(43163), sourcePlatform: 'PROGRAMMERS', difficulty: Difficulty.GOLD, level: 3, tags: ['BFS'], category: ProblemCategory.ALGORITHM },
];
