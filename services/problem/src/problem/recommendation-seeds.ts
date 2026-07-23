/**
 * @file recommendation-seeds.ts — 추천 콜드스타트용 정적 seed 문제 목록
 * @domain problem
 * @layer constant
 * @related problem.service.ts, dto/recommend-query.dto.ts
 *
 * 목적: 신규 스터디(등록 문제 0개) 또는 cross-study 풀이 부족할 때 Tier 3 폴백으로 사용.
 * 출처: 실제 프로그래머스 lesson (URL: https://school.programmers.co.kr/learn/courses/30/lessons/<ID>)
 * 프로그래머스 난이도 = Lv.N(사용자 노출 라벨). difficulty 필드는 gateway
 *   levelToDifficulty(programmers.service.ts) 정본 매핑(Lv.1~5→BRONZE~DIAMOND)의
 *   내부 정규화값일 뿐 — 추천 필터 키/뱃지 색상용이며 화면 라벨은 FE가 Lv.N으로 표기.
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

/** 백준(BOJ) 문제 URL 조립 */
const bojUrl = (id: number): string => `https://www.acmicpc.net/problem/${id}`;

/**
 * 프로그래머스 대표 lesson 34선 — Lv.1~5 전 구간 커버(Lv.1/2/3 각 8, Lv.4 6, Lv.5 4).
 * level=프로그래머스 Lv 숫자(1~5, 사용자 노출 라벨). difficulty는 정본 매핑
 *   levelToDifficulty(Lv.1→BRONZE, Lv.2→SILVER, Lv.3→GOLD, Lv.4→PLATINUM, Lv.5→DIAMOND)
 *   내부 정규화값(필터/색상용).
 * lesson ID·제목·level은 gateway data/programmers-problems.json(크롤러 SSOT)로 검증.
 *   Lv.4/Lv.5 항목은 SPA HTML 미노출이라 해당 데이터셋 level 필드를 정본으로 사용.
 */
const PROGRAMMERS_SEEDS: readonly RecommendationItem[] = [
  // Lv.1 → BRONZE (8)
  { title: '완주하지 못한 선수', sourceUrl: lessonUrl(42576), sourcePlatform: 'PROGRAMMERS', difficulty: Difficulty.BRONZE, level: 1, tags: ['해시'], category: ProblemCategory.ALGORITHM },
  { title: '모의고사', sourceUrl: lessonUrl(42840), sourcePlatform: 'PROGRAMMERS', difficulty: Difficulty.BRONZE, level: 1, tags: ['완전탐색'], category: ProblemCategory.ALGORITHM },
  { title: 'K번째수', sourceUrl: lessonUrl(42748), sourcePlatform: 'PROGRAMMERS', difficulty: Difficulty.BRONZE, level: 1, tags: ['정렬'], category: ProblemCategory.ALGORITHM },
  { title: '두 개 뽑아서 더하기', sourceUrl: lessonUrl(68644), sourcePlatform: 'PROGRAMMERS', difficulty: Difficulty.BRONZE, level: 1, tags: ['완전탐색'], category: ProblemCategory.ALGORITHM },
  { title: '체육복', sourceUrl: lessonUrl(42862), sourcePlatform: 'PROGRAMMERS', difficulty: Difficulty.BRONZE, level: 1, tags: ['탐욕법'], category: ProblemCategory.ALGORITHM },
  { title: '실패율', sourceUrl: lessonUrl(42889), sourcePlatform: 'PROGRAMMERS', difficulty: Difficulty.BRONZE, level: 1, tags: ['정렬'], category: ProblemCategory.ALGORITHM },
  { title: '[1차] 비밀지도', sourceUrl: lessonUrl(17681), sourcePlatform: 'PROGRAMMERS', difficulty: Difficulty.BRONZE, level: 1, tags: ['구현'], category: ProblemCategory.ALGORITHM },
  { title: '[1차] 다트 게임', sourceUrl: lessonUrl(17682), sourcePlatform: 'PROGRAMMERS', difficulty: Difficulty.BRONZE, level: 1, tags: ['구현'], category: ProblemCategory.ALGORITHM },
  // Lv.2 → SILVER (8)
  { title: '폰켓몬', sourceUrl: lessonUrl(1845), sourcePlatform: 'PROGRAMMERS', difficulty: Difficulty.SILVER, level: 2, tags: ['해시'], category: ProblemCategory.ALGORITHM },
  { title: '큰 수 만들기', sourceUrl: lessonUrl(42883), sourcePlatform: 'PROGRAMMERS', difficulty: Difficulty.SILVER, level: 2, tags: ['탐욕법'], category: ProblemCategory.ALGORITHM },
  { title: '타겟 넘버', sourceUrl: lessonUrl(43165), sourcePlatform: 'PROGRAMMERS', difficulty: Difficulty.SILVER, level: 2, tags: ['DFS/BFS'], category: ProblemCategory.ALGORITHM },
  { title: '게임 맵 최단거리', sourceUrl: lessonUrl(1844), sourcePlatform: 'PROGRAMMERS', difficulty: Difficulty.SILVER, level: 2, tags: ['BFS'], category: ProblemCategory.ALGORITHM },
  { title: '기능개발', sourceUrl: lessonUrl(42586), sourcePlatform: 'PROGRAMMERS', difficulty: Difficulty.SILVER, level: 2, tags: ['스택/큐'], category: ProblemCategory.ALGORITHM },
  { title: '프로세스', sourceUrl: lessonUrl(42587), sourcePlatform: 'PROGRAMMERS', difficulty: Difficulty.SILVER, level: 2, tags: ['스택/큐'], category: ProblemCategory.ALGORITHM },
  { title: 'H-Index', sourceUrl: lessonUrl(42747), sourcePlatform: 'PROGRAMMERS', difficulty: Difficulty.SILVER, level: 2, tags: ['정렬'], category: ProblemCategory.ALGORITHM },
  { title: '더 맵게', sourceUrl: lessonUrl(42626), sourcePlatform: 'PROGRAMMERS', difficulty: Difficulty.SILVER, level: 2, tags: ['힙'], category: ProblemCategory.ALGORITHM },
  // Lv.3 → GOLD (8)
  { title: '정수 삼각형', sourceUrl: lessonUrl(43105), sourcePlatform: 'PROGRAMMERS', difficulty: Difficulty.GOLD, level: 3, tags: ['DP'], category: ProblemCategory.ALGORITHM },
  { title: '네트워크', sourceUrl: lessonUrl(43162), sourcePlatform: 'PROGRAMMERS', difficulty: Difficulty.GOLD, level: 3, tags: ['DFS/BFS'], category: ProblemCategory.ALGORITHM },
  { title: '단어 변환', sourceUrl: lessonUrl(43163), sourcePlatform: 'PROGRAMMERS', difficulty: Difficulty.GOLD, level: 3, tags: ['BFS'], category: ProblemCategory.ALGORITHM },
  { title: '베스트앨범', sourceUrl: lessonUrl(42579), sourcePlatform: 'PROGRAMMERS', difficulty: Difficulty.GOLD, level: 3, tags: ['해시'], category: ProblemCategory.ALGORITHM },
  { title: '디스크 컨트롤러', sourceUrl: lessonUrl(42627), sourcePlatform: 'PROGRAMMERS', difficulty: Difficulty.GOLD, level: 3, tags: ['힙'], category: ProblemCategory.ALGORITHM },
  { title: '이중우선순위큐', sourceUrl: lessonUrl(42628), sourcePlatform: 'PROGRAMMERS', difficulty: Difficulty.GOLD, level: 3, tags: ['힙'], category: ProblemCategory.ALGORITHM },
  { title: '섬 연결하기', sourceUrl: lessonUrl(42861), sourcePlatform: 'PROGRAMMERS', difficulty: Difficulty.GOLD, level: 3, tags: ['탐욕법'], category: ProblemCategory.ALGORITHM },
  { title: '여행경로', sourceUrl: lessonUrl(43164), sourcePlatform: 'PROGRAMMERS', difficulty: Difficulty.GOLD, level: 3, tags: ['DFS/BFS'], category: ProblemCategory.ALGORITHM },
  // Lv.4 → PLATINUM (6)
  { title: '무지의 먹방 라이브', sourceUrl: lessonUrl(42891), sourcePlatform: 'PROGRAMMERS', difficulty: Difficulty.PLATINUM, level: 4, tags: ['힙'], category: ProblemCategory.ALGORITHM },
  { title: '징검다리', sourceUrl: lessonUrl(43236), sourcePlatform: 'PROGRAMMERS', difficulty: Difficulty.PLATINUM, level: 4, tags: ['이분탐색'], category: ProblemCategory.ALGORITHM },
  { title: '도둑질', sourceUrl: lessonUrl(42897), sourcePlatform: 'PROGRAMMERS', difficulty: Difficulty.PLATINUM, level: 4, tags: ['DP'], category: ProblemCategory.ALGORITHM },
  { title: '[3차] 자동완성', sourceUrl: lessonUrl(17685), sourcePlatform: 'PROGRAMMERS', difficulty: Difficulty.PLATINUM, level: 4, tags: ['트라이'], category: ProblemCategory.ALGORITHM },
  { title: '가사 검색', sourceUrl: lessonUrl(60060), sourcePlatform: 'PROGRAMMERS', difficulty: Difficulty.PLATINUM, level: 4, tags: ['트라이'], category: ProblemCategory.ALGORITHM },
  { title: '매출 하락 최소화', sourceUrl: lessonUrl(72416), sourcePlatform: 'PROGRAMMERS', difficulty: Difficulty.PLATINUM, level: 4, tags: ['DP'], category: ProblemCategory.ALGORITHM },
  // Lv.5 → DIAMOND (4)
  { title: '방의 개수', sourceUrl: lessonUrl(49190), sourcePlatform: 'PROGRAMMERS', difficulty: Difficulty.DIAMOND, level: 5, tags: ['DFS/BFS'], category: ProblemCategory.ALGORITHM },
  { title: '시험장 나누기', sourceUrl: lessonUrl(81305), sourcePlatform: 'PROGRAMMERS', difficulty: Difficulty.DIAMOND, level: 5, tags: ['이분탐색'], category: ProblemCategory.ALGORITHM },
  { title: 'RPG와 쿼리', sourceUrl: lessonUrl(76504), sourcePlatform: 'PROGRAMMERS', difficulty: Difficulty.DIAMOND, level: 5, tags: ['세그먼트트리'], category: ProblemCategory.ALGORITHM },
  { title: '문자열의 아름다움', sourceUrl: lessonUrl(68938), sourcePlatform: 'PROGRAMMERS', difficulty: Difficulty.DIAMOND, level: 5, tags: ['문자열'], category: ProblemCategory.ALGORITHM },
];

/**
 * 백준(BOJ) 대표 문제 12선 — 플랫폼 토글이 BOJ일 때 콜드스타트 폴백.
 * 난이도는 solved.ac 티어 대분류(BRONZE/SILVER/GOLD)만 신뢰 가능 값으로 기입하고,
 * solved.ac 세부 숫자 티어는 단정하지 않으므로 level=null (FE가 difficulty로 대체 표시).
 */
const BOJ_SEEDS: readonly RecommendationItem[] = [
  { title: 'A+B', sourceUrl: bojUrl(1000), sourcePlatform: 'BOJ', difficulty: Difficulty.BRONZE, level: null, tags: ['사칙연산'], category: ProblemCategory.ALGORITHM },
  { title: '구구단', sourceUrl: bojUrl(2739), sourcePlatform: 'BOJ', difficulty: Difficulty.BRONZE, level: null, tags: ['반복문'], category: ProblemCategory.ALGORITHM },
  { title: '별 찍기 - 1', sourceUrl: bojUrl(2438), sourcePlatform: 'BOJ', difficulty: Difficulty.BRONZE, level: null, tags: ['구현'], category: ProblemCategory.ALGORITHM },
  { title: '최댓값', sourceUrl: bojUrl(2562), sourcePlatform: 'BOJ', difficulty: Difficulty.BRONZE, level: null, tags: ['구현'], category: ProblemCategory.ALGORITHM },
  { title: '바이러스', sourceUrl: bojUrl(2606), sourcePlatform: 'BOJ', difficulty: Difficulty.SILVER, level: null, tags: ['DFS/BFS'], category: ProblemCategory.ALGORITHM },
  { title: 'DFS와 BFS', sourceUrl: bojUrl(1260), sourcePlatform: 'BOJ', difficulty: Difficulty.SILVER, level: null, tags: ['DFS/BFS'], category: ProblemCategory.ALGORITHM },
  { title: '미로 탐색', sourceUrl: bojUrl(2178), sourcePlatform: 'BOJ', difficulty: Difficulty.SILVER, level: null, tags: ['BFS'], category: ProblemCategory.ALGORITHM },
  { title: '유기농 배추', sourceUrl: bojUrl(1012), sourcePlatform: 'BOJ', difficulty: Difficulty.SILVER, level: null, tags: ['DFS/BFS'], category: ProblemCategory.ALGORITHM },
  { title: '1로 만들기', sourceUrl: bojUrl(1463), sourcePlatform: 'BOJ', difficulty: Difficulty.SILVER, level: null, tags: ['DP'], category: ProblemCategory.ALGORITHM },
  { title: '2×n 타일링', sourceUrl: bojUrl(11726), sourcePlatform: 'BOJ', difficulty: Difficulty.SILVER, level: null, tags: ['DP'], category: ProblemCategory.ALGORITHM },
  { title: '1, 2, 3 더하기', sourceUrl: bojUrl(9095), sourcePlatform: 'BOJ', difficulty: Difficulty.SILVER, level: null, tags: ['DP'], category: ProblemCategory.ALGORITHM },
  { title: '동전 0', sourceUrl: bojUrl(11047), sourcePlatform: 'BOJ', difficulty: Difficulty.SILVER, level: null, tags: ['그리디'], category: ProblemCategory.ALGORITHM },
];

/**
 * 정적 seed 목록 — 프로그래머스 34선 + 백준 12선.
 * 플랫폼 토글 종속 추천: 서비스 레이어에서 sourcePlatform으로 필터한다.
 * 각 항목은 RecommendationItem 형태로 그대로 반환 가능하도록 사전 투영됨.
 */
export const RECOMMENDATION_SEEDS: readonly RecommendationItem[] = [
  ...PROGRAMMERS_SEEDS,
  ...BOJ_SEEDS,
];
