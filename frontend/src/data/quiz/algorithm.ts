/**
 * @file 알고리즘 분야 CS 퀴즈 문항 (12문항)
 * @domain quiz
 * @layer data
 * @related src/data/quiz/types.ts, src/data/quiz/index.ts
 */
import { QuizCategory, type QuizQuestion } from './types';

/** 알고리즘(Algorithm) 분야 단답형 문항 목록. */
export const ALGORITHM_QUESTIONS: readonly QuizQuestion[] = [
  {
    id: 'algo-01',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '정렬된 배열에서 탐색 범위를 절반씩 줄여 값을 찾는 O(log n) 탐색 알고리즘은?',
      en: 'Which O(log n) search halves the range on a sorted array to find a value?',
    },
    acceptedAnswers: ['이진탐색', '이진 탐색', 'binary search', 'binarysearch'],
    explanation: {
      ko: '이진 탐색은 정렬된 배열에서 중앙값과 비교하며 범위를 절반씩 줄여 O(log n)에 탐색합니다.',
      en: 'Binary search halves the range each step on a sorted array, achieving O(log n).',
    },
    difficulty: 'EASY',
  },
  {
    id: 'algo-02',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '그래프에서 시작 정점의 인접 정점을 레벨 단위로 탐색하며 큐를 사용하는 탐색 기법은?',
      en: 'Which graph traversal explores neighbors level by level using a queue?',
    },
    acceptedAnswers: ['BFS', '너비우선탐색', '너비 우선 탐색', 'breadth first search'],
    explanation: {
      ko: 'BFS(너비 우선 탐색)는 큐로 가까운 정점부터 레벨 단위로 방문하며 최단 경로(무가중치)에 적합합니다.',
      en: 'BFS visits closer vertices level by level using a queue, ideal for unweighted shortest paths.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'algo-03',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '한 경로를 끝까지 깊게 탐색한 뒤 되돌아오며, 스택이나 재귀를 사용하는 그래프 탐색은?',
      en: 'Which graph traversal goes as deep as possible then backtracks, using a stack or recursion?',
    },
    acceptedAnswers: ['DFS', '깊이우선탐색', '깊이 우선 탐색', 'depth first search'],
    explanation: {
      ko: 'DFS(깊이 우선 탐색)는 한 분기를 끝까지 탐색 후 백트래킹하며 재귀나 스택으로 구현합니다.',
      en: 'DFS explores one branch fully then backtracks, implemented with recursion or a stack.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'algo-04',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '음의 가중치가 없는 그래프에서 단일 출발점 최단 경로를 구하는 대표 알고리즘은?',
      en: 'Which algorithm finds single-source shortest paths in a graph with no negative weights?',
    },
    acceptedAnswers: ['다익스트라', 'dijkstra', '데이크스트라'],
    explanation: {
      ko: '다익스트라 알고리즘은 음의 가중치가 없는 그래프에서 우선순위 큐로 단일 출발점 최단 경로를 구합니다.',
      en: "Dijkstra's algorithm finds single-source shortest paths using a priority queue when there are no negative weights.",
    },
    difficulty: 'HARD',
  },
  {
    id: 'algo-05',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '문제를 부분 문제로 나누고 결과를 저장해 중복 계산을 피하는 최적화 기법은?',
      en: 'Which technique breaks a problem into subproblems and stores results to avoid recomputation?',
    },
    acceptedAnswers: ['동적계획법', '동적 계획법', 'DP', 'dynamic programming', '다이나믹프로그래밍'],
    explanation: {
      ko: '동적 계획법(DP)은 부분 문제의 답을 메모이제이션·테이블에 저장해 중복 계산을 제거합니다.',
      en: 'Dynamic programming stores subproblem results via memoization or tables to avoid recomputation.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'algo-06',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '각 단계에서 당장 최적인 선택을 하는 알고리즘 설계 기법은?',
      en: 'Which algorithm design technique makes the locally optimal choice at each step?',
    },
    acceptedAnswers: ['그리디', 'greedy', '탐욕법', '탐욕 알고리즘'],
    explanation: {
      ko: '그리디(탐욕) 알고리즘은 매 단계 지역 최적해를 선택하며, 특정 문제에서 전역 최적을 보장합니다.',
      en: 'A greedy algorithm picks the locally optimal choice each step, guaranteeing global optimum for certain problems.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'algo-07',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '피벗을 기준으로 분할하며 평균 O(n log n)인 분할 정복 정렬 알고리즘은?',
      en: 'Which divide-and-conquer sort partitions around a pivot with average O(n log n)?',
    },
    acceptedAnswers: ['퀵정렬', '퀵 정렬', 'quicksort', 'quick sort'],
    explanation: {
      ko: '퀵 정렬은 피벗으로 배열을 분할·정복하며 평균 O(n log n), 최악 O(n^2)입니다.',
      en: 'Quicksort partitions around a pivot via divide-and-conquer, averaging O(n log n) and O(n^2) worst case.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'algo-08',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '배열을 반으로 나눠 정렬 후 병합하며 항상 O(n log n)을 보장하는 안정 정렬은?',
      en: 'Which stable sort splits the array in half, sorts, and merges with guaranteed O(n log n)?',
    },
    acceptedAnswers: ['병합정렬', '병합 정렬', 'mergesort', 'merge sort', '합병정렬'],
    explanation: {
      ko: '병합 정렬은 분할 후 병합하며 항상 O(n log n)을 보장하는 안정 정렬입니다.',
      en: 'Merge sort splits then merges, guaranteeing O(n log n) and being stable.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'algo-09',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '입력 크기에 무관하게 실행 시간이 일정한 알고리즘의 시간 복잡도는? (빅오)',
      en: 'What is the time complexity of an algorithm whose runtime is constant regardless of input size? (Big-O)',
    },
    acceptedAnswers: ['O(1)', '상수시간', '상수 시간', 'constant', 'constant time'],
    explanation: {
      ko: 'O(1)은 입력 크기와 무관하게 일정한 시간이 드는 상수 시간 복잡도입니다.',
      en: 'O(1) denotes constant time, independent of input size.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'algo-10',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '큰 문제를 작은 부분 문제로 나눠 풀고 합치는, 퀵·병합 정렬의 기반이 되는 설계 기법은?',
      en: 'Which design paradigm splits a problem into subproblems and combines them, used by quicksort and mergesort?',
    },
    acceptedAnswers: ['분할정복', '분할 정복', 'divide and conquer', 'divideandconquer'],
    explanation: {
      ko: '분할 정복은 문제를 작은 부분으로 나눠 해결한 뒤 결과를 합치는 설계 기법입니다.',
      en: 'Divide and conquer splits a problem into smaller parts, solves them, and combines the results.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'algo-11',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '가능한 모든 후보를 탐색하다 조건 위반 시 되돌아가는 탐색 기법은?',
      en: 'Which technique explores candidates and reverts when a constraint is violated?',
    },
    acceptedAnswers: ['백트래킹', 'backtracking', '되추적'],
    explanation: {
      ko: '백트래킹은 후보를 단계적으로 구성하다 제약 위반 시 이전 상태로 되돌아가 탐색을 가지치기합니다.',
      en: 'Backtracking builds candidates incrementally and reverts on constraint violation, pruning the search.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'algo-12',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '인접한 두 원소를 비교·교환하며 정렬하는 가장 단순한 O(n^2) 정렬 알고리즘은?',
      en: 'Which simplest O(n^2) sort repeatedly compares and swaps adjacent elements?',
    },
    acceptedAnswers: ['버블정렬', '버블 정렬', 'bubblesort', 'bubble sort', '거품정렬'],
    explanation: {
      ko: '버블 정렬은 인접한 두 원소를 비교·교환하며 정렬하는 O(n^2) 단순 정렬입니다.',
      en: 'Bubble sort compares and swaps adjacent elements, an O(n^2) simple sort.',
    },
    difficulty: 'EASY',
  },
];
