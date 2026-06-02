/**
 * @file 자료구조 분야 CS 퀴즈 문항 (30문항)
 * @domain quiz
 * @layer data
 * @related src/data/quiz/types.ts, src/data/quiz/index.ts
 */
import { QuizCategory, type QuizQuestion } from './types';

/** 자료구조(Data Structure) 분야 단답형 문항 목록. */
export const DATA_STRUCTURE_QUESTIONS: readonly QuizQuestion[] = [
  {
    id: 'ds-01',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: 'LIFO(후입선출) 원칙을 따르는 선형 자료구조는?',
      en: 'Which linear data structure follows the LIFO principle?',
    },
    acceptedAnswers: ['스택', 'stack', 'LIFO'],
    explanation: {
      ko: '스택은 가장 마지막에 넣은 데이터가 가장 먼저 나오는 LIFO 구조입니다.',
      en: 'A stack is a LIFO structure where the last pushed element is popped first.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'ds-02',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: 'FIFO(선입선출) 원칙을 따르는 선형 자료구조는?',
      en: 'Which linear data structure follows the FIFO principle?',
    },
    acceptedAnswers: ['큐', 'queue', 'FIFO'],
    explanation: {
      ko: '큐는 먼저 들어온 데이터가 먼저 나오는 FIFO 구조입니다.',
      en: 'A queue is a FIFO structure where the first enqueued element is dequeued first.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'ds-03',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: '각 노드가 데이터와 다음 노드의 포인터로 연결된 자료구조는?',
      en: 'Which structure links nodes where each node holds data and a pointer to the next node?',
    },
    acceptedAnswers: ['연결리스트', '링크드리스트', 'linkedlist', 'linked list', '연결 리스트'],
    explanation: {
      ko: '연결 리스트는 노드가 포인터로 이어진 동적 자료구조입니다.',
      en: 'A linked list is a dynamic structure of nodes connected by pointers.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'ds-04',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: '최솟값 또는 최댓값을 빠르게 꺼낼 수 있는 완전 이진 트리 기반 자료구조는?',
      en: 'Which complete binary tree based structure lets you extract the min or max quickly?',
    },
    acceptedAnswers: ['힙', 'heap'],
    explanation: {
      ko: '힙은 부모-자식 간 우선순위 조건을 만족하는 완전 이진 트리로, 우선순위 큐 구현에 쓰입니다.',
      en: 'A heap is a complete binary tree satisfying a parent-child priority order, used for priority queues.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'ds-05',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: '키를 해시 함수로 인덱스에 매핑해 평균 O(1) 탐색을 제공하는 자료구조는?',
      en: 'Which structure maps keys to indices via a hash function for average O(1) lookup?',
    },
    acceptedAnswers: ['해시테이블', '해시 테이블', 'hashtable', 'hash table', '해시맵', 'hashmap'],
    explanation: {
      ko: '해시 테이블은 해시 함수로 키를 버킷에 분배해 평균 상수 시간 접근을 제공합니다.',
      en: 'A hash table distributes keys into buckets via a hash function for average constant-time access.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'ds-06',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: '왼쪽 서브트리는 작고 오른쪽 서브트리는 큰 값을 갖는 정렬된 이진 트리는?',
      en: 'Which sorted binary tree keeps smaller values on the left and larger on the right subtree?',
    },
    acceptedAnswers: ['이진탐색트리', '이진 탐색 트리', 'BST', 'binary search tree'],
    explanation: {
      ko: '이진 탐색 트리(BST)는 좌측은 작은 값, 우측은 큰 값을 유지해 평균 O(log n) 탐색을 제공합니다.',
      en: 'A BST keeps smaller values left and larger values right, giving average O(log n) search.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'ds-07',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: '문자열 집합을 접두사 단위로 저장해 자동완성에 쓰이는 트리 자료구조는?',
      en: 'Which tree structure stores strings by prefix and is used for autocomplete?',
    },
    acceptedAnswers: ['트라이', 'trie', '접두사트리', '접두사 트리', 'prefix tree'],
    explanation: {
      ko: '트라이는 공통 접두사를 공유하는 노드로 문자열을 저장하는 접두사 트리입니다.',
      en: 'A trie is a prefix tree that stores strings via nodes sharing common prefixes.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'ds-08',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: '정점과 간선의 집합으로 객체 간 관계를 표현하는 비선형 자료구조는?',
      en: 'Which non-linear structure represents relationships using a set of vertices and edges?',
    },
    acceptedAnswers: ['그래프', 'graph'],
    explanation: {
      ko: '그래프는 정점(vertex)과 간선(edge)으로 개체 간 연결 관계를 표현합니다.',
      en: 'A graph represents connections between entities using vertices and edges.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'ds-09',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: '동일한 타입의 원소를 연속된 메모리에 저장하고 인덱스로 접근하는 자료구조는?',
      en: 'Which structure stores same-type elements in contiguous memory accessed by index?',
    },
    acceptedAnswers: ['배열', 'array'],
    explanation: {
      ko: '배열은 원소를 연속 메모리에 두어 인덱스로 O(1) 접근이 가능합니다.',
      en: 'An array stores elements in contiguous memory enabling O(1) index access.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'ds-10',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: '양쪽 끝에서 모두 삽입·삭제가 가능한 자료구조의 이름은?',
      en: 'What is the name of the structure allowing insertion and deletion at both ends?',
    },
    acceptedAnswers: ['덱', 'deque', '디큐', 'double ended queue'],
    explanation: {
      ko: '덱(deque)은 앞뒤 양쪽에서 삽입과 삭제가 가능한 양방향 큐입니다.',
      en: 'A deque is a double-ended queue allowing insertion and deletion at both ends.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'ds-11',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: '균형 이진 탐색 트리에서 탐색의 평균 시간 복잡도는? (빅오 표기)',
      en: 'What is the average time complexity of search in a balanced binary search tree? (Big-O)',
    },
    acceptedAnswers: ['O(log n)', 'logn', 'log n', '로그n', '로그 n'],
    explanation: {
      ko: '균형 BST는 높이가 log n에 비례하므로 탐색이 평균 O(log n)입니다.',
      en: 'A balanced BST has height proportional to log n, giving O(log n) average search.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'ds-12',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: '꺼낼 때 항상 우선순위가 가장 높은 원소가 나오는 추상 자료형은?',
      en: 'Which abstract data type always removes the highest-priority element first?',
    },
    acceptedAnswers: ['우선순위큐', '우선순위 큐', 'priority queue', 'priorityqueue'],
    explanation: {
      ko: '우선순위 큐는 우선순위가 가장 높은 원소가 먼저 나오며 보통 힙으로 구현합니다.',
      en: 'A priority queue removes the highest-priority element first, usually implemented with a heap.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'ds-13',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: '삽입·삭제 시 회전으로 좌우 서브트리 높이 차를 1 이하로 유지하는 자기 균형 이진 탐색 트리는?',
      en: 'Which self-balancing BST uses rotations to keep the height difference of subtrees at most one?',
    },
    acceptedAnswers: ['AVL트리', 'AVL 트리', 'avltree', 'avl tree', 'avl'],
    explanation: {
      ko: 'AVL 트리는 각 노드의 균형 인수를 -1~1로 유지하며 회전으로 균형을 잡는 자기 균형 이진 탐색 트리입니다.',
      en: 'An AVL tree is a self-balancing BST keeping each node’s balance factor between -1 and 1 via rotations.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'ds-14',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: '각 노드에 색을 부여하고 색 규칙으로 균형을 유지하는 이진 탐색 트리는?',
      en: 'Which BST keeps balance by coloring nodes and enforcing color rules?',
    },
    acceptedAnswers: ['레드블랙트리', '레드 블랙 트리', 'redblacktree', 'red black tree', 'rbtree', 'rb tree'],
    explanation: {
      ko: '레드-블랙 트리는 노드에 빨강/검정 색을 부여하고 색 규칙으로 높이를 제한해 균형을 유지합니다.',
      en: 'A red-black tree colors nodes red or black and uses color rules to bound height and stay balanced.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'ds-15',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: '한 노드가 여러 키와 여러 자식을 가질 수 있어 디스크 기반 DB·파일시스템 인덱스에 쓰이는 균형 트리는?',
      en: 'Which balanced tree lets a node hold many keys and children, used for disk-based DB and filesystem indexes?',
    },
    acceptedAnswers: ['B트리', 'B 트리', 'btree', 'b tree', 'b-tree'],
    explanation: {
      ko: 'B-트리는 한 노드에 다수의 키·자식을 두어 트리 높이를 낮춰 디스크 접근 횟수를 줄이는 균형 트리입니다.',
      en: 'A B-tree stores many keys and children per node to reduce height and disk accesses.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'ds-16',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: '구간 합·구간 최솟값 등 구간 질의와 갱신을 O(log n)에 처리하는 트리 자료구조는?',
      en: 'Which tree structure answers range queries and updates in O(log n), e.g. range sum or minimum?',
    },
    acceptedAnswers: ['세그먼트트리', '세그먼트 트리', 'segmenttree', 'segment tree'],
    explanation: {
      ko: '세그먼트 트리는 배열 구간을 노드로 분할해 구간 질의와 점 갱신을 O(log n)에 수행합니다.',
      en: 'A segment tree partitions array ranges into nodes to handle range queries and point updates in O(log n).',
    },
    difficulty: 'HARD',
  },
  {
    id: 'ds-17',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: '비트의 최하위 비트(LSB)를 이용해 누적합을 O(log n)에 갱신·질의하는 자료구조는? (별칭 BIT)',
      en: 'Which structure uses the lowest set bit to update and query prefix sums in O(log n)? (a.k.a. BIT)',
    },
    acceptedAnswers: ['펜윅트리', '펜윅 트리', 'fenwicktree', 'fenwick tree', 'BIT', 'binary indexed tree'],
    explanation: {
      ko: '펜윅 트리(BIT)는 인덱스의 최하위 비트로 부분합을 관리해 누적합 갱신·질의를 O(log n)에 처리합니다.',
      en: 'A Fenwick tree (BIT) manages partial sums via the lowest set bit, doing prefix-sum update and query in O(log n).',
    },
    difficulty: 'HARD',
  },
  {
    id: 'ds-18',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: '원소들을 서로소 집합으로 묶고 합치기(union)·찾기(find) 연산을 지원하는 자료구조는?',
      en: 'Which structure groups elements into disjoint sets supporting union and find operations?',
    },
    acceptedAnswers: ['유니온파인드', '유니온 파인드', 'unionfind', 'union find', '분리집합', '서로소집합', 'disjoint set'],
    explanation: {
      ko: '유니온-파인드(분리 집합)는 서로소 집합을 합치고 어느 집합에 속하는지 찾는 연산을 제공합니다.',
      en: 'Union-find (disjoint set) supports merging disjoint sets and finding which set an element belongs to.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'ds-19',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: '마지막 인덱스가 처음 인덱스와 이어지도록 배열 끝을 재사용하는 큐 구현 방식은?',
      en: 'Which queue implementation reuses the array end so the last index wraps to the first?',
    },
    acceptedAnswers: ['환형큐', '원형큐', '환형 큐', '원형 큐', 'circularqueue', 'circular queue', 'ring buffer'],
    explanation: {
      ko: '환형 큐는 배열의 끝과 처음을 논리적으로 연결해 고정 크기 공간을 재사용하는 큐입니다.',
      en: 'A circular queue logically links the array’s end to its front to reuse a fixed-size buffer.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'ds-20',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: '각 노드가 이전·다음 노드를 모두 가리켜 양방향 순회가 가능한 연결 리스트는?',
      en: 'Which linked list lets each node point to both previous and next nodes for bidirectional traversal?',
    },
    acceptedAnswers: ['이중연결리스트', '이중 연결 리스트', 'doublylinkedlist', 'doubly linked list', '양방향연결리스트'],
    explanation: {
      ko: '이중 연결 리스트는 각 노드가 앞·뒤 포인터를 모두 가져 양방향 순회가 가능합니다.',
      en: 'A doubly linked list gives each node both previous and next pointers for bidirectional traversal.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'ds-21',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: '여러 층의 정렬된 연결 리스트로 평균 O(log n) 탐색을 제공하는 확률적 자료구조는?',
      en: 'Which probabilistic structure uses multiple layered sorted linked lists for average O(log n) search?',
    },
    acceptedAnswers: ['스킵리스트', '스킵 리스트', 'skiplist', 'skip list'],
    explanation: {
      ko: '스킵 리스트는 정렬된 연결 리스트에 다층 지름길 포인터를 두어 평균 O(log n) 탐색을 제공합니다.',
      en: 'A skip list adds layered express pointers to a sorted linked list for average O(log n) search.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'ds-22',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: '원소의 존재 여부를 확률적으로 판정하며 거짓 양성은 있지만 거짓 음성은 없는 공간 효율 자료구조는?',
      en: 'Which space-efficient probabilistic structure tests membership with possible false positives but no false negatives?',
    },
    acceptedAnswers: ['블룸필터', '블룸 필터', 'bloomfilter', 'bloom filter'],
    explanation: {
      ko: '블룸 필터는 여러 해시 함수와 비트 배열로 멤버십을 판정하며, 거짓 양성은 가능하나 거짓 음성은 없습니다.',
      en: 'A Bloom filter uses several hash functions and a bit array; it may yield false positives but never false negatives.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'ds-23',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: '해시 충돌을 같은 버킷에 연결 리스트로 매다는 방식으로 해결하는 기법은?',
      en: 'Which technique resolves hash collisions by chaining entries into a linked list at the same bucket?',
    },
    acceptedAnswers: ['체이닝', 'chaining', '분리연결법', 'separate chaining'],
    explanation: {
      ko: '체이닝은 같은 해시 버킷에 충돌한 원소들을 연결 리스트 등으로 매달아 충돌을 해결합니다.',
      en: 'Chaining resolves collisions by storing colliding entries in a linked list at the same bucket.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'ds-24',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: '해시 충돌 시 빈 슬롯을 찾아 같은 배열 안에 저장하는 충돌 해결 기법은? (체이닝의 대안)',
      en: 'Which collision-resolution technique probes for an empty slot within the same array? (alternative to chaining)',
    },
    acceptedAnswers: ['개방주소법', '개방 주소법', 'open addressing', 'openaddressing', '오픈어드레싱'],
    explanation: {
      ko: '개방 주소법은 충돌 시 정해진 규칙으로 다음 빈 슬롯을 탐사해 배열 내부에 직접 저장합니다.',
      en: 'Open addressing probes for the next empty slot by a fixed rule and stores entries within the array itself.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'ds-25',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: '가장 오래 사용되지 않은 항목을 먼저 버리는 캐시 교체 정책의 이름은? (3글자 약어)',
      en: 'What is the cache eviction policy that discards the least recently used item first? (3-letter acronym)',
    },
    acceptedAnswers: ['LRU', 'least recently used', '엘알유'],
    explanation: {
      ko: 'LRU는 가장 오래 참조되지 않은 항목을 먼저 제거하는 캐시 교체 정책으로 보통 해시맵+이중 연결 리스트로 구현합니다.',
      en: 'LRU evicts the item unused for the longest time, typically implemented with a hash map plus a doubly linked list.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'ds-26',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: '정점 수가 V일 때 정점 간 간선 존재 여부를 V×V 2차원 배열로 표현하는 그래프 저장 방식은?',
      en: 'Which graph representation stores edge existence between vertices in a V×V two-dimensional array?',
    },
    acceptedAnswers: ['인접행렬', '인접 행렬', 'adjacencymatrix', 'adjacency matrix'],
    explanation: {
      ko: '인접 행렬은 V×V 배열로 간선 유무를 저장해 간선 조회는 O(1)이지만 O(V²) 공간을 씁니다.',
      en: 'An adjacency matrix stores edges in a V×V array, giving O(1) edge lookup but O(V²) space.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'ds-27',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: '각 정점마다 인접한 정점 목록을 저장해 희소 그래프에 메모리 효율적인 그래프 표현 방식은?',
      en: 'Which graph representation stores a list of neighbors per vertex, efficient for sparse graphs?',
    },
    acceptedAnswers: ['인접리스트', '인접 리스트', 'adjacencylist', 'adjacency list'],
    explanation: {
      ko: '인접 리스트는 정점마다 이웃 목록을 두어 간선 수에 비례한 공간을 써 희소 그래프에 유리합니다.',
      en: 'An adjacency list keeps a neighbor list per vertex, using space proportional to edges, ideal for sparse graphs.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'ds-28',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: '루트→왼쪽→오른쪽 순으로 노드를 방문하는 이진 트리 순회 방식은?',
      en: 'Which binary tree traversal visits nodes in root, left, then right order?',
    },
    acceptedAnswers: ['전위순회', '전위 순회', 'preorder', 'pre order', '프리오더'],
    explanation: {
      ko: '전위 순회(preorder)는 루트를 먼저 방문한 뒤 왼쪽·오른쪽 서브트리를 차례로 순회합니다.',
      en: 'Preorder traversal visits the root first, then the left and right subtrees in order.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'ds-29',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: '이진 탐색 트리에서 노드를 오름차순으로 방문하게 되는 순회 방식은? (왼쪽→루트→오른쪽)',
      en: 'Which traversal visits BST nodes in ascending order? (left, root, right)',
    },
    acceptedAnswers: ['중위순회', '중위 순회', 'inorder', 'in order', '인오더'],
    explanation: {
      ko: '중위 순회(inorder)는 왼쪽 서브트리→루트→오른쪽 서브트리 순으로 방문해 BST에서 오름차순 출력이 됩니다.',
      en: 'Inorder traversal visits left subtree, root, then right subtree, producing ascending order in a BST.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'ds-30',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: '부모를 인덱스 i, 두 자식을 2i+1·2i+2로 배열에 저장하는 완전 이진 트리의 표현 방식은?',
      en: 'Which representation stores a complete binary tree in an array with parent i and children 2i+1 and 2i+2?',
    },
    acceptedAnswers: ['배열표현', '배열 표현', 'arrayrepresentation', 'array representation', '배열기반', '암시적표현', '순차표현'],
    explanation: {
      ko: '완전 이진 트리는 포인터 없이 배열로 표현할 수 있으며, 인덱스 i의 자식은 2i+1과 2i+2에 위치합니다(0-기반).',
      en: 'A complete binary tree can be stored in an array without pointers, where node i’s children sit at 2i+1 and 2i+2 (0-based).',
    },
    difficulty: 'EASY',
  },
];
