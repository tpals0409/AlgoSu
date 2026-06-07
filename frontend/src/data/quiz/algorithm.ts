/**
 * @file 알고리즘 분야 CS 퀴즈 문항 (50문항)
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
  {
    id: 'algo-13',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '음의 가중치 간선이 있어도 단일 출발점 최단 경로를 구하고 음수 사이클을 탐지할 수 있는 알고리즘은?',
      en: 'Which single-source shortest-path algorithm handles negative edge weights and can detect negative cycles?',
    },
    acceptedAnswers: ['벨만포드', '벨만-포드', '벨만 포드', 'bellman ford', 'bellmanford', 'bellman-ford'],
    explanation: {
      ko: '벨만-포드 알고리즘은 간선을 V-1번 완화하며 음의 가중치를 처리하고 추가 완화로 음수 사이클을 탐지합니다(O(VE)).',
      en: 'Bellman-Ford relaxes edges V-1 times to handle negative weights and detects negative cycles with one extra pass (O(VE)).',
    },
    difficulty: 'HARD',
  },
  {
    id: 'algo-14',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '모든 정점 쌍 간 최단 경로를 O(n^3) 동적 계획법으로 한 번에 구하는 알고리즘은?',
      en: 'Which O(n^3) dynamic-programming algorithm computes shortest paths between all pairs of vertices?',
    },
    acceptedAnswers: ['플로이드워셜', '플로이드-워셜', '플로이드 워셜', 'floyd warshall', 'floydwarshall', 'floyd-warshall'],
    explanation: {
      ko: '플로이드-워셜은 경유 정점을 하나씩 추가하며 모든 정점 쌍 최단 경로를 O(n^3)에 구하는 DP 알고리즘입니다.',
      en: 'Floyd-Warshall computes all-pairs shortest paths in O(n^3) by progressively allowing intermediate vertices.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'algo-15',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '간선을 가중치 오름차순으로 정렬한 뒤 사이클을 만들지 않는 간선을 선택해 최소 신장 트리를 만드는 알고리즘은?',
      en: 'Which minimum spanning tree algorithm sorts edges by weight and adds those that do not form a cycle?',
    },
    acceptedAnswers: ['크루스칼', 'kruskal', '크루스칼알고리즘'],
    explanation: {
      ko: '크루스칼 알고리즘은 간선을 가중치순으로 정렬하고 유니온 파인드로 사이클을 피하며 MST를 구성합니다.',
      en: "Kruskal's algorithm sorts edges by weight and uses union-find to avoid cycles while building the MST.",
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'algo-16',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '한 정점에서 시작해 트리에 인접한 최소 가중치 간선을 반복 추가하며 최소 신장 트리를 만드는 알고리즘은?',
      en: 'Which minimum spanning tree algorithm grows the tree from one vertex by repeatedly adding the cheapest adjacent edge?',
    },
    acceptedAnswers: ['프림', 'prim', '프림알고리즘', '프림 알고리즘'],
    explanation: {
      ko: '프림 알고리즘은 한 정점에서 시작해 우선순위 큐로 트리에 닿는 최소 가중치 간선을 반복 추가해 MST를 만듭니다.',
      en: "Prim's algorithm grows the MST from a start vertex using a priority queue to pick the minimum adjacent edge each step.",
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'algo-17',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '방향 비순환 그래프(DAG)에서 모든 간선이 한 방향을 향하도록 정점을 선형으로 나열하는 정렬은?',
      en: 'Which ordering arranges vertices of a DAG linearly so that every edge points forward?',
    },
    acceptedAnswers: ['위상정렬', '위상 정렬', 'topological sort', 'topologicalsort', '토폴로지정렬'],
    explanation: {
      ko: '위상 정렬은 DAG에서 선행 관계를 지키며 정점을 선형 순서로 나열하며, 진입 차수나 DFS로 O(V+E)에 구합니다.',
      en: 'Topological sort linearly orders DAG vertices respecting precedence, computed in O(V+E) via in-degree or DFS.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'algo-18',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '재귀 호출의 결과를 캐시에 저장해 같은 부분 문제를 다시 계산하지 않는 하향식 DP 기법은?',
      en: 'Which top-down DP technique caches recursive results to avoid recomputing the same subproblem?',
    },
    acceptedAnswers: ['메모이제이션', 'memoization', '메모이재이션', '메모화'],
    explanation: {
      ko: '메모이제이션은 재귀(하향식)에서 부분 문제의 결과를 캐시에 저장해 중복 계산을 제거하는 기법입니다.',
      en: 'Memoization caches subproblem results in a top-down recursive approach to eliminate redundant computation.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'algo-19',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '카드를 손에 정리하듯 각 원소를 앞쪽 정렬된 부분의 알맞은 위치에 삽입하는 O(n^2) 정렬은?',
      en: 'Which O(n^2) sort inserts each element into its correct position in the already-sorted front portion?',
    },
    acceptedAnswers: ['삽입정렬', '삽입 정렬', 'insertion sort', 'insertionsort'],
    explanation: {
      ko: '삽입 정렬은 각 원소를 앞쪽 정렬 구간의 알맞은 자리에 삽입하며, 거의 정렬된 입력에서 빠르고 안정 정렬입니다.',
      en: 'Insertion sort places each element into its proper spot in the sorted prefix; it is stable and fast on nearly sorted data.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'algo-20',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '매 단계 남은 구간에서 최솟값을 찾아 맨 앞과 교환하는 O(n^2) 정렬 알고리즘은?',
      en: 'Which O(n^2) sort repeatedly finds the minimum of the remaining part and swaps it to the front?',
    },
    acceptedAnswers: ['선택정렬', '선택 정렬', 'selection sort', 'selectionsort'],
    explanation: {
      ko: '선택 정렬은 매번 남은 구간의 최솟값을 찾아 맨 앞과 교환하는 O(n^2) 정렬로 교환 횟수가 적습니다.',
      en: 'Selection sort finds the minimum of the unsorted part and swaps it to the front each pass, an O(n^2) sort with few swaps.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'algo-21',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '최대 힙(또는 최소 힙) 자료구조를 이용해 항상 O(n log n)에 정렬하는 알고리즘은?',
      en: 'Which sorting algorithm uses a heap data structure to sort in O(n log n) in all cases?',
    },
    acceptedAnswers: ['힙정렬', '힙 정렬', 'heapsort', 'heap sort'],
    explanation: {
      ko: '힙 정렬은 배열을 힙으로 구성한 뒤 최댓값을 반복 추출하며 제자리에서 O(n log n)에 정렬합니다.',
      en: 'Heap sort builds a heap then repeatedly extracts the max, sorting in place in O(n log n).',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'algo-22',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '값의 등장 횟수를 세어 정렬하며, 값의 범위가 작을 때 O(n+k)로 동작하는 비교 기반이 아닌 정렬은?',
      en: 'Which non-comparison sort counts occurrences of values and runs in O(n+k) when the value range is small?',
    },
    acceptedAnswers: ['계수정렬', '계수 정렬', 'counting sort', 'countingsort', '카운팅정렬'],
    explanation: {
      ko: '계수 정렬은 값의 빈도를 세어 누적합으로 위치를 정하는 비교 기반이 아닌 정렬로, 값 범위 k가 작을 때 O(n+k)입니다.',
      en: 'Counting sort tallies value frequencies and uses prefix sums to place elements, running in O(n+k) for a small range k.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'algo-23',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '자릿수를 낮은 자리부터 차례로 안정 정렬해 전체를 정렬하는 비교 기반이 아닌 정렬은?',
      en: 'Which non-comparison sort processes digits from least to most significant using a stable sort each pass?',
    },
    acceptedAnswers: ['기수정렬', '기수 정렬', 'radix sort', 'radixsort'],
    explanation: {
      ko: '기수 정렬은 자릿수별로 안정 정렬을 반복해 정수·문자열을 O(d(n+k))에 정렬하는 비교 기반이 아닌 정렬입니다.',
      en: 'Radix sort repeatedly applies a stable sort per digit, sorting integers/strings in O(d(n+k)) without comparisons.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'algo-24',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '접두사와 접미사가 일치하는 정보를 담은 실패 함수(파이 배열)로 O(n+m)에 문자열을 매칭하는 알고리즘은?',
      en: 'Which string matching algorithm uses a failure (prefix) function to match in O(n+m)?',
    },
    acceptedAnswers: ['KMP', '케이엠피', 'kmp algorithm', '커누스모리스프랫', 'knuth morris pratt'],
    explanation: {
      ko: 'KMP 알고리즘은 패턴의 접두사·접미사 정보를 담은 실패 함수로 불일치 시 비교를 건너뛰어 O(n+m)에 매칭합니다.',
      en: 'The KMP algorithm precomputes a failure function from prefixes/suffixes to skip comparisons, matching in O(n+m).',
    },
    difficulty: 'HARD',
  },
  {
    id: 'algo-25',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '두 수를 나눈 나머지를 반복 대입해 최대공약수를 구하는 고전 알고리즘은?',
      en: 'Which classic algorithm finds the greatest common divisor by repeatedly taking remainders?',
    },
    acceptedAnswers: ['유클리드호제법', '유클리드 호제법', 'euclidean algorithm', 'euclid', '호제법', 'euclidean'],
    explanation: {
      ko: '유클리드 호제법은 gcd(a, b) = gcd(b, a mod b)를 반복해 최대공약수를 O(log(min(a,b)))에 구합니다.',
      en: "Euclid's algorithm applies gcd(a, b) = gcd(b, a mod b) repeatedly to find the GCD in O(log(min(a,b))).",
    },
    difficulty: 'EASY',
  },
  {
    id: 'algo-26',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '2부터 차례로 배수를 지워 특정 범위 이하의 소수를 모두 구하는 고전 알고리즘은?',
      en: 'Which classic algorithm finds all primes up to a limit by iteratively marking multiples?',
    },
    acceptedAnswers: ['에라토스테네스의체', '에라토스테네스의 체', '에라토스테네스 체', 'sieve of eratosthenes', 'sieve', '에라토스테네스'],
    explanation: {
      ko: '에라토스테네스의 체는 2부터 각 소수의 배수를 지워 범위 내 소수를 O(n log log n)에 구합니다.',
      en: 'The Sieve of Eratosthenes marks multiples of each prime starting from 2, finding all primes up to n in O(n log log n).',
    },
    difficulty: 'EASY',
  },
  {
    id: 'algo-27',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '정렬된 배열 양 끝에서 두 인덱스를 좁혀가며 조건을 만족하는 쌍을 O(n)에 찾는 기법은?',
      en: 'Which technique moves two indices inward on a sorted array to find a target pair in O(n)?',
    },
    acceptedAnswers: ['투포인터', '투 포인터', 'two pointer', 'two pointers', 'twopointer', '두포인터'],
    explanation: {
      ko: '투 포인터는 정렬된 배열에서 양 끝(또는 같은 방향) 두 인덱스를 조건에 맞춰 이동시켜 O(n)에 쌍을 탐색합니다.',
      en: 'The two-pointer technique moves two indices over a sorted array to find pairs in O(n) without nested loops.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'algo-28',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '배열 위에서 일정 크기 구간을 한 칸씩 이동하며 구간 합·최댓값 등을 O(n)에 계산하는 기법은?',
      en: 'Which technique slides a fixed-size range across an array to compute window sums or maxima in O(n)?',
    },
    acceptedAnswers: ['슬라이딩윈도우', '슬라이딩 윈도우', 'sliding window', 'slidingwindow', '구간이동'],
    explanation: {
      ko: '슬라이딩 윈도우는 고정·가변 크기 구간을 한 칸씩 이동하며 이전 결과를 재활용해 O(n)에 구간 통계를 계산합니다.',
      en: 'The sliding window technique shifts a window over the array, reusing prior results to compute range stats in O(n).',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'algo-29',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '이중 반복문으로 모든 원소 쌍을 비교하는 알고리즘의 시간 복잡도는? (빅오)',
      en: 'What is the time complexity of an algorithm with nested loops comparing all pairs of elements? (Big-O)',
    },
    acceptedAnswers: ['O(n^2)', 'O(n²)', 'n^2', 'n2', '제곱시간', '이차시간', 'quadratic', 'on2'],
    explanation: {
      ko: 'O(n^2)은 이중 반복문처럼 입력 크기 제곱에 비례하는 이차(제곱) 시간 복잡도입니다.',
      en: 'O(n^2) is quadratic time, proportional to the square of the input size, as in nested loops.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'algo-30',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '동적 배열의 append처럼 개별 연산은 가끔 비싸도 연산 시퀀스 전체의 평균 비용을 따지는 분석 기법은?',
      en: 'Which analysis averages the cost over a sequence of operations, as with dynamic array append?',
    },
    acceptedAnswers: ['분할상환분석', '분할 상환 분석', 'amortized analysis', 'amortized', '상각분석', '분할상환'],
    explanation: {
      ko: '분할 상환 분석은 비용이 큰 연산이 드물게 발생할 때 연산 시퀀스 전체의 평균 비용을 평가하는 기법입니다(예: 동적 배열 append 평균 O(1)).',
      en: 'Amortized analysis averages cost over a sequence of operations when expensive ones are rare (e.g., dynamic array append is O(1) amortized).',
    },
    difficulty: 'HARD',
  },
  {
    id: 'algo-31',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '배열의 i번째 원소까지의 합을 미리 계산해 두어 구간 합 쿼리를 O(1)에 답하는 기법은?',
      en: 'Which technique precomputes cumulative sums so range-sum queries are answered in O(1)?',
    },
    acceptedAnswers: ['누적합', 'prefix sum', 'prefixsum', '구간합', '전처리합', 'cumulative sum'],
    explanation: {
      ko: '누적합(prefix sum) 배열을 만들어 두면 임의 구간 [l, r]의 합을 prefix[r] − prefix[l-1]로 O(1)에 구할 수 있습니다.',
      en: 'A prefix sum array lets you answer any range sum [l,r] in O(1) as prefix[r] − prefix[l-1].',
    },
    difficulty: 'EASY',
  },
  {
    id: 'algo-32',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '병합 정렬과 힙 정렬의 최악·평균 시간 복잡도는? (빅오)',
      en: 'What is the worst-case and average-case time complexity of merge sort and heap sort? (Big-O)',
    },
    acceptedAnswers: ['O(n log n)', 'onlogn', 'n log n', 'nlogn'],
    explanation: {
      ko: '병합 정렬과 힙 정렬은 입력에 관계없이 항상 O(n log n)의 시간 복잡도를 보장합니다.',
      en: 'Merge sort and heap sort both guarantee O(n log n) time in the worst case regardless of input.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'algo-33',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '값의 범위를 버킷으로 나눠 각 버킷을 별도로 정렬한 뒤 합치는 정렬 알고리즘은?',
      en: 'Which sorting algorithm divides values into buckets, sorts each separately, and then concatenates?',
    },
    acceptedAnswers: ['버킷정렬', '버킷 정렬', 'bucket sort', 'bucketsort'],
    explanation: {
      ko: '버킷 정렬은 입력을 균등 분포로 가정해 버킷에 배분하고 각 버킷을 삽입 정렬 등으로 정렬 후 합쳐 평균 O(n)을 달성합니다.',
      en: 'Bucket sort distributes input into buckets, sorts each bucket (e.g., insertion sort), and concatenates for average O(n).',
    },
    difficulty: 'EASY',
  },
  {
    id: 'algo-34',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '두 문자열에서 가장 긴 공통 부분 수열(연속 아니어도 됨)의 길이를 구하는 문제의 영문 약자는?',
      en: 'What is the abbreviation for the problem of finding the longest common subsequence of two strings?',
    },
    acceptedAnswers: ['LCS', 'longest common subsequence'],
    explanation: {
      ko: 'LCS(Longest Common Subsequence)는 두 문자열에서 순서를 유지하되 연속할 필요 없는 공통 부분 수열 중 가장 긴 것을 구하는 DP 문제입니다.',
      en: 'LCS (Longest Common Subsequence) finds the longest subsequence common to both strings preserving order, solved with O(mn) DP.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'algo-35',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '무게 제한이 있는 가방에 물건을 담아 가치를 최대화하는 조합 최적화 문제의 이름은?',
      en: 'Which combinatorial optimization problem maximizes value by selecting items subject to a weight capacity?',
    },
    acceptedAnswers: ['배낭문제', '배낭 문제', 'knapsack', 'knapsack problem', '냅색'],
    explanation: {
      ko: '배낭 문제(Knapsack Problem)는 용량 제한 내에서 가치 합을 최대화하는 NP-완전(0/1형) 문제로, DP로 의사다항 시간에 풀 수 있습니다.',
      en: 'The Knapsack Problem maximizes value within a weight limit; the 0/1 variant is NP-complete but solvable in pseudo-polynomial time with DP.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'algo-36',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '값의 범위가 클 때, 값들을 순위(rank)로 치환해 배열 크기를 줄이는 전처리 기법은?',
      en: 'Which preprocessing technique replaces large-range values with their rank to reduce array size?',
    },
    acceptedAnswers: ['좌표압축', '좌표 압축', 'coordinate compression', 'coordinatecompression', '값압축'],
    explanation: {
      ko: '좌표 압축은 값을 정렬 후 순위(0, 1, 2, …)로 대체해 값 범위를 O(n)으로 줄이고 세그먼트 트리·계수 정렬 등에 활용합니다.',
      en: 'Coordinate compression maps values to their sorted rank (0,1,2,…), reducing the value range to O(n) for use in segment trees or counting sort.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'algo-37',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '입력 크기 n에 비례해 실행 시간이 증가하는, 배열 순회 등에 해당하는 시간 복잡도는? (빅오)',
      en: 'What is the time complexity of algorithms whose runtime grows proportionally to input size, such as a single array traversal? (Big-O)',
    },
    acceptedAnswers: ['O(n)', 'on', 'n', '선형시간', 'linear', 'linear time'],
    explanation: {
      ko: 'O(n)은 입력 크기 n에 정비례하는 선형 시간 복잡도로, 배열 전체를 한 번 순회하는 연산이 대표 예입니다.',
      en: 'O(n) is linear time, growing proportionally to input size; a single array scan is a canonical example.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'algo-38',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '해시 함수로 패턴의 해시값과 텍스트 부분 문자열의 해시값을 비교해 평균 O(n+m)에 문자열을 매칭하는 알고리즘은?',
      en: 'Which string matching algorithm uses rolling hashes to compare pattern and text substrings in average O(n+m)?',
    },
    acceptedAnswers: ['라빈카프', '라빈-카프', '라빈 카프', 'rabin karp', 'rabinkarp', 'rabin-karp'],
    explanation: {
      ko: '라빈-카프 알고리즘은 롤링 해시로 텍스트의 각 부분 문자열 해시를 O(1)에 갱신하며 패턴 해시와 비교해 평균 O(n+m)에 매칭합니다.',
      en: "Rabin-Karp uses a rolling hash to update substring hashes in O(1) each step, comparing with the pattern hash for average O(n+m) matching.",
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'algo-39',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '작은 부분 문제부터 테이블에 채워 올라가는 상향식(Bottom-Up) DP 기법을 무엇이라 하는가?',
      en: 'What is the name of the bottom-up DP technique that fills a table starting from the smallest subproblems?',
    },
    acceptedAnswers: ['타뷸레이션', 'tabulation', '표화', '테이블채우기', 'bottom-up dp', 'bottom up dp'],
    explanation: {
      ko: '타뷸레이션(Tabulation)은 가장 작은 부분 문제부터 순서대로 테이블을 채워 올라가는 상향식 DP로, 재귀 오버헤드 없이 공간 최적화가 용이합니다.',
      en: 'Tabulation fills a DP table bottom-up from base cases, avoiding recursion overhead and enabling straightforward space optimization.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'algo-40',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '겹치지 않는 구간의 수를 최대화하기 위해 종료 시간 기준으로 그리디 선택을 하는 문제는?',
      en: 'Which classic greedy problem maximizes the number of non-overlapping intervals by selecting by earliest finish time?',
    },
    acceptedAnswers: ['활동선택문제', '활동 선택 문제', 'activity selection', 'activity selection problem', '구간스케줄링'],
    explanation: {
      ko: '활동 선택 문제는 종료 시간이 빠른 활동을 먼저 선택하는 그리디로 최대 비겹침 활동 수를 O(n log n)에 구합니다.',
      en: 'The activity selection problem greedily picks the activity with the earliest finish time, maximizing non-overlapping count in O(n log n).',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'algo-41',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '상태를 비트 집합으로 표현해 부분 집합의 방문 여부를 정수 하나에 저장하고 DP에 활용하는 기법은?',
      en: 'Which technique represents states as bit sets, storing subset membership in a single integer for use in DP?',
    },
    acceptedAnswers: ['비트마스킹', '비트 마스킹', 'bitmask', 'bitmask dp', '비트마스크dp', '비트마스크 dp'],
    explanation: {
      ko: '비트마스킹 DP는 방문한 정점 집합 등을 정수 비트로 표현해 2^n 상태를 다루며 외판원 문제(TSP) 등에 쓰입니다.',
      en: 'Bitmask DP encodes subsets as integer bits to handle 2^n states compactly, used in problems like the Travelling Salesman Problem.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'algo-42',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '방향 그래프에서 모든 정점 쌍이 서로 도달 가능한 최대 부분 그래프를 무엇이라 하는가?',
      en: 'What is the maximal subgraph of a directed graph in which every vertex is reachable from every other vertex?',
    },
    acceptedAnswers: ['강연결요소', '강한연결요소', 'SCC', 'strongly connected component', 'stronglyconnectedcomponent'],
    explanation: {
      ko: '강연결요소(SCC)는 방향 그래프에서 모든 정점 쌍이 상호 도달 가능한 최대 부분 그래프로, 타잔·코사라주 알고리즘이 O(V+E)에 구합니다.',
      en: 'A Strongly Connected Component (SCC) is a maximal subgraph where all vertices can reach each other; Tarjan or Kosaraju finds all SCCs in O(V+E).',
    },
    difficulty: 'HARD',
  },
  {
    id: 'algo-43',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '이분 탐색을 "답의 범위"에 적용해 최적값을 찾는 기법을 흔히 무엇이라 부르는가?',
      en: 'What is the common name for the technique that applies binary search over the "answer space" to find the optimal value?',
    },
    acceptedAnswers: ['매개변수탐색', '매개변수 탐색', 'parametric search', 'parametricsearch', '이분탐색 최적화', 'binary search on answer'],
    explanation: {
      ko: '매개변수 탐색(Parametric Search)은 답 자체를 이분 탐색 범위로 삼아 판별 함수의 참·거짓 경계를 O(log N · f(N))에 찾는 기법입니다.',
      en: 'Parametric search applies binary search over the answer space, using a decision function to find the boundary in O(log N · f(N)).',
    },
    difficulty: 'HARD',
  },
  {
    id: 'algo-44',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '두 문자열 사이의 삽입·삭제·교체 연산 최소 횟수를 구하는 DP 문제의 이름은?',
      en: 'What is the name of the DP problem that finds the minimum number of insert, delete, and replace operations to transform one string into another?',
    },
    acceptedAnswers: ['편집거리', '편집 거리', 'edit distance', 'editdistance', 'levenshtein', 'levenshtein distance'],
    explanation: {
      ko: '편집 거리(Edit Distance, Levenshtein Distance)는 삽입·삭제·교체 세 연산으로 한 문자열을 다른 문자열로 변환하는 최소 비용을 O(mn) DP로 구합니다.',
      en: 'Edit Distance (Levenshtein Distance) is the minimum number of insertions, deletions, and substitutions to transform one string to another, solved by O(mn) DP.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'algo-45',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '빈도가 높은 기호에 짧은 코드를 배정해 무손실 압축을 달성하는 그리디 기반 최적 접두사 코드 알고리즘은?',
      en: 'Which greedy algorithm assigns shorter codes to more frequent symbols to achieve optimal lossless prefix coding?',
    },
    acceptedAnswers: ['허프만코딩', '허프만 코딩', '허프만 부호화', 'huffman coding', 'huffmancoding', 'huffman'],
    explanation: {
      ko: '허프만 코딩은 최소 힙으로 빈도가 낮은 기호 두 개를 반복 병합해 평균 코드 길이를 최소화하는 그리디 최적 접두사 코드를 만듭니다.',
      en: 'Huffman coding uses a min-heap to repeatedly merge the two least-frequent symbols, building an optimal prefix code that minimizes average code length.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'algo-46',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: 'NP에 속하면서 NP의 모든 문제를 다항 시간에 환원할 수 있는 가장 어려운 문제 집합을 무엇이라 하는가?',
      en: 'What is the class of problems that are in NP and to which every problem in NP can be reduced in polynomial time?',
    },
    acceptedAnswers: ['NP완전', 'NP-완전', 'NP 완전', 'NP-complete', 'npcomplete', 'np complete'],
    explanation: {
      ko: 'NP-완전(NP-Complete) 문제는 NP에 속하면서 NP 내 모든 문제를 다항 시간에 귀납할 수 있는 가장 어려운 문제로, SAT·3-SAT·배낭 문제(0/1)가 대표적입니다.',
      en: 'NP-Complete problems are in NP and every NP problem reduces to them in polynomial time; canonical examples include SAT, 3-SAT, and 0/1 Knapsack.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'algo-47',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '수열에서 순서를 유지하며 단조 증가하는 부분 수열 중 가장 긴 것을 O(n log n)에 구할 때 사용하는 자료구조/기법은?',
      en: 'Which data structure or technique achieves O(n log n) time for the Longest Increasing Subsequence problem?',
    },
    acceptedAnswers: ['이진탐색', '이진 탐색', 'binary search', 'patience sorting', '인내 정렬', 'LIS with binary search'],
    explanation: {
      ko: 'LIS를 O(n log n)에 구하려면 현재까지의 후보 테일 배열을 유지하며 각 원소마다 lower_bound(이진 탐색)로 삽입 위치를 찾습니다.',
      en: 'O(n log n) LIS maintains a candidate tails array and uses binary search (lower_bound) to find the insertion position for each element.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'algo-48',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '알고리즘의 성장률을 위·아래 모두 상수 배 안에서 죄는 점근 표기법은? (정확한 성장 차수를 나타냄)',
      en: 'Which asymptotic notation bounds a function both above and below by constant multiples, representing the exact growth order?',
    },
    acceptedAnswers: ['빅세타', '빅 세타', 'big theta', 'bigtheta', 'Θ', 'theta notation', '세타 표기법'],
    explanation: {
      ko: '빅-세타(Θ)는 f(n) = Θ(g(n))이면 c₁g(n) ≤ f(n) ≤ c₂g(n)이 성립해 최악·최선 모두 같은 성장률임을 의미하는 정확한 점근 표기입니다.',
      en: 'Big-Theta (Θ) means f(n) is sandwiched between c₁g(n) and c₂g(n), representing the exact asymptotic growth rate in both worst and best cases.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'algo-49',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '다항 시간 검증은 가능하지만 다항 시간 풀이는 알려지지 않은 결정 문제 집합을 가리키는 복잡도 분류는?',
      en: 'Which complexity class contains decision problems verifiable in polynomial time but not known to be solvable in polynomial time?',
    },
    acceptedAnswers: ['NP', 'nondeterministic polynomial', 'np class'],
    explanation: {
      ko: 'NP(Non-deterministic Polynomial)는 해를 다항 시간에 검증할 수 있는 결정 문제의 집합으로, P ⊆ NP이며 P = NP 여부는 미해결 난제입니다.',
      en: 'NP (Nondeterministic Polynomial) is the class of decision problems whose solutions can be verified in polynomial time; whether P = NP remains unsolved.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'algo-50',
    category: QuizCategory.ALGORITHM,
    prompt: {
      ko: '가중치 없는 그래프에서 두 정점 간 최단 경로를 보장하는 탐색 알고리즘과, 그 시간 복잡도는? (형식: "알고리즘명, O(복잡도)"가 아닌 알고리즘 이름만 답하세요)',
      en: 'Which spanning-tree property states that the minimum spanning tree is unique if all edge weights are distinct?',
    },
    acceptedAnswers: ['유일성', '유일한 MST', 'unique MST', 'MST 유일성', 'uniqueness', 'unique minimum spanning tree'],
    explanation: {
      ko: '모든 간선의 가중치가 서로 다르면 최소 신장 트리(MST)는 유일합니다. 이는 크루스칼/프림 두 알고리즘 모두 동일한 트리를 구성함을 의미합니다.',
      en: 'If all edge weights are distinct, the minimum spanning tree is unique; both Kruskal and Prim will produce the same tree.',
    },
    difficulty: 'HARD',
  },
];
