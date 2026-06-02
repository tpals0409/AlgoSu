/**
 * @file 알고리즘 분야 CS 퀴즈 문항 (30문항)
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
];
