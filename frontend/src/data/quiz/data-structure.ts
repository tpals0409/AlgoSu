/**
 * @file 자료구조 분야 CS 퀴즈 문항 (50문항)
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
  {
    id: 'ds-31',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: '이진 트리에서 왼쪽→오른쪽→루트 순으로 방문하는 순회 방식은?',
      en: 'Which binary tree traversal visits nodes in left, right, then root order?',
    },
    acceptedAnswers: ['후위순회', '후위 순회', 'postorder', 'post order', '포스트오더'],
    explanation: {
      ko: '후위 순회(postorder)는 왼쪽·오른쪽 서브트리를 먼저 방문한 뒤 루트를 방문하며, 트리 삭제·수식 계산에 쓰입니다.',
      en: 'Postorder traversal visits left and right subtrees first then the root; it is used for tree deletion and expression evaluation.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'ds-32',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: '이진 트리를 레벨 순서(위→아래, 왼→오른)로 방문하는 순회 방식은? (큐 사용)',
      en: 'Which tree traversal visits nodes level by level, top to bottom and left to right, using a queue?',
    },
    acceptedAnswers: ['레벨순회', '레벨 순회', 'levelorder', 'level order', 'bfs traversal', '너비우선순회', '너비 우선 순회'],
    explanation: {
      ko: '레벨 순회(BFS 순회)는 큐를 이용해 루트부터 각 레벨을 왼쪽에서 오른쪽으로 방문합니다.',
      en: 'Level-order (BFS) traversal uses a queue to visit each level from left to right, starting at the root.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'ds-33',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: '모든 노드가 0 또는 2개의 자식을 가지는 이진 트리의 명칭은? (리프 아닌 노드는 반드시 자식 2개)',
      en: 'What is the binary tree where every non-leaf node has exactly two children (no node has only one child)?',
    },
    acceptedAnswers: ['포화이진트리', '포화 이진 트리', 'full binary tree', 'fullbinarytree', '정이진트리', '정 이진 트리'],
    explanation: {
      ko: '포화 이진 트리(Full Binary Tree)는 모든 내부 노드가 자식을 정확히 2개 가지며 자식이 1개인 노드가 없는 트리입니다.',
      en: 'A full binary tree requires every internal node to have exactly two children with no single-child nodes.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'ds-34',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: '마지막 레벨을 제외한 모든 레벨이 꽉 차고, 마지막 레벨은 왼쪽부터 채워지는 이진 트리는?',
      en: 'Which binary tree has all levels completely filled except possibly the last, which is filled from the left?',
    },
    acceptedAnswers: ['완전이진트리', '완전 이진 트리', 'complete binary tree', 'completebinarytree'],
    explanation: {
      ko: '완전 이진 트리(Complete Binary Tree)는 마지막 레벨을 제외하고 모든 레벨이 가득 차며 마지막 레벨은 왼쪽부터 노드가 채워집니다.',
      en: 'A complete binary tree fills all levels except the last, which is filled left to right; it enables efficient array storage.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'ds-35',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: 'B-트리에서 리프 노드만 실제 레코드를 저장하고 내부 노드는 키만 갖는 변형 트리는?',
      en: 'Which variant of the B-tree stores actual records only in leaf nodes, while internal nodes hold only keys?',
    },
    acceptedAnswers: ['B+트리', 'B+ 트리', 'bplustree', 'b plus tree', 'b+tree'],
    explanation: {
      ko: 'B+트리는 내부 노드에 키만 두고 리프 노드에만 레코드를 저장하며, 리프끼리 연결해 순차 접근을 최적화합니다.',
      en: 'A B+tree stores records only in leaf nodes (connected as a linked list) and keys only in internal nodes, optimizing range scans.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'ds-36',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: 'AVL 트리에서 왼쪽 자식의 왼쪽 서브트리에 삽입되어 오른쪽 단순 회전 한 번으로 해결하는 불균형 케이스는?',
      en: 'Which AVL imbalance case, caused by insertion in the left subtree of the left child, is fixed with a single right rotation?',
    },
    acceptedAnswers: ['LL회전', 'LL 회전', 'llrotation', 'll rotation', 'll case', 'llcase', '좌좌회전'],
    explanation: {
      ko: 'LL 케이스는 불균형 노드의 왼쪽 자식 왼쪽 서브트리 삽입으로 발생하며, 단일 오른쪽 회전(right rotation)으로 해소합니다.',
      en: 'The LL case arises when a node is inserted in the left subtree of the left child; a single right rotation restores balance.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'ds-37',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: 'AVL 트리에서 왼쪽 자식의 오른쪽 서브트리에 삽입되어 왼쪽-오른쪽 두 번 회전으로 해결하는 불균형 케이스는?',
      en: 'Which AVL imbalance case requires a left rotation followed by a right rotation (left-right double rotation)?',
    },
    acceptedAnswers: ['LR회전', 'LR 회전', 'lrrotation', 'lr rotation', 'lr case', 'lrcase', '좌우회전'],
    explanation: {
      ko: 'LR 케이스는 왼쪽 자식의 오른쪽 서브트리 삽입으로 발생하며, 왼쪽 자식을 왼쪽 회전 후 루트를 오른쪽 회전하는 이중 회전으로 해소합니다.',
      en: 'The LR case occurs when inserting in the right subtree of the left child; it requires a left rotation on the child then a right rotation on the root.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'ds-38',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: '레드-블랙 트리의 불변식 중 루트 노드의 색깔 규칙은?',
      en: 'What color must the root node always be in a red-black tree invariant?',
    },
    acceptedAnswers: ['검정', '검은색', '블랙', 'black', '검정색'],
    explanation: {
      ko: '레드-블랙 트리 불변식: 루트는 항상 검정(Black)이어야 합니다. 이 규칙이 삽입 후 루트가 빨강이 되면 재착색으로 검정으로 바꾸도록 강제합니다.',
      en: 'A red-black tree invariant requires the root to always be black; if recoloring makes it red after insertion, it is re-colored black.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'ds-39',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: '레드-블랙 트리에서 루트부터 임의의 NIL 리프까지의 경로에 있는 블랙 노드 수가 모두 같다는 불변식을 무엇이라 하는가?',
      en: 'What property of a red-black tree states that every path from root to a NIL leaf contains the same number of black nodes?',
    },
    acceptedAnswers: ['블랙높이', '블랙 높이', 'black height', 'blackheight', '흑색높이', '흑색 높이'],
    explanation: {
      ko: '블랙 높이(Black Height) 불변식은 루트→NIL 리프 모든 경로의 블랙 노드 수가 동일함을 보장해 트리 높이를 O(log n)으로 제한합니다.',
      en: 'The black-height invariant guarantees equal black-node counts on all root-to-nil paths, bounding tree height to O(log n).',
    },
    difficulty: 'HARD',
  },
  {
    id: 'ds-40',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: '최근 탐색된 노드를 루트로 끌어올리는 스플레이 연산을 사용하는 자기 조정 이진 탐색 트리는?',
      en: 'Which self-adjusting BST uses a splay operation to move the most recently accessed node to the root?',
    },
    acceptedAnswers: ['스플레이트리', '스플레이 트리', 'splaytree', 'splay tree'],
    explanation: {
      ko: '스플레이 트리는 접근한 노드를 Zig/Zig-Zig/Zig-Zag 회전으로 루트까지 올려 반복 접근 패턴에서 O(log n) 분할 상환 복잡도를 달성합니다.',
      en: 'A splay tree rotates the accessed node to the root via Zig/Zig-Zig/Zig-Zag steps, achieving O(log n) amortized cost for repeated accesses.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'ds-41',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: '해시 테이블에서 저장된 원소 수를 전체 버킷 수로 나눈 값으로, 재해싱(rehashing) 기준이 되는 지표는?',
      en: 'What metric divides the number of stored elements by the total number of buckets and triggers rehashing when exceeded?',
    },
    acceptedAnswers: ['부하율', '로드팩터', 'load factor', 'loadfactor', '적재율'],
    explanation: {
      ko: '부하율(load factor)은 n/m(원소 수/버킷 수)으로 정의하며, 임계값(보통 0.7~0.75)을 넘으면 재해싱을 수행해 성능을 유지합니다.',
      en: 'Load factor is n/m (elements/buckets); when it exceeds a threshold (typically 0.7–0.75), rehashing is triggered to maintain performance.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'ds-42',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: '개방 주소법에서 충돌 시 탐사 간격을 1씩 늘려 다음 빈 슬롯을 순차로 찾는 방식은?',
      en: 'Which open-addressing probe sequence checks consecutive slots (step size 1) to resolve a collision?',
    },
    acceptedAnswers: ['선형탐사', '선형 탐사', 'linear probing', 'linearprobing'],
    explanation: {
      ko: '선형 탐사는 충돌 시 h(k)+1, h(k)+2 … 순으로 다음 빈 슬롯을 찾으며 클러스터링 문제가 발생할 수 있습니다.',
      en: 'Linear probing checks h(k)+1, h(k)+2, … for an empty slot on collision; it is simple but can cause primary clustering.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'ds-43',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: '충돌 시 두 번째 해시 함수를 탐사 간격으로 사용해 클러스터링을 최소화하는 개방 주소법 변형은?',
      en: 'Which open-addressing variant uses a second hash function as the probe step size to minimize clustering?',
    },
    acceptedAnswers: ['이중해싱', '이중 해싱', 'double hashing', 'doublehashing'],
    explanation: {
      ko: '이중 해싱은 h(k, i) = (h1(k) + i·h2(k)) mod m 으로 탐사하여 클러스터링을 크게 줄이는 개방 주소법 기법입니다.',
      en: 'Double hashing probes using h(k,i) = (h1(k) + i·h2(k)) mod m, significantly reducing clustering compared to linear or quadratic probing.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'ds-44',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: '해시 테이블이 부하율 임계값을 초과할 때 더 큰 배열을 할당하고 모든 원소를 재삽입하는 과정은?',
      en: 'What is the process of allocating a larger array and reinserting all elements when a hash table exceeds its load factor threshold?',
    },
    acceptedAnswers: ['재해싱', '리해싱', 'rehashing', '재해시'],
    explanation: {
      ko: '재해싱(rehashing)은 부하율 초과 시 보통 2배 크기 배열에 모든 원소를 새 해시 함수로 재삽입해 충돌을 줄이는 과정입니다.',
      en: 'Rehashing allocates a larger array (usually 2× size) and reinserts all elements with the new hash function to reduce collisions.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'ds-45',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: 'LRU 캐시를 O(1) get/put으로 구현할 때 일반적으로 결합하는 두 자료구조는? (두 자료구조 모두 답하세요)',
      en: 'What two data structures are typically combined to implement an LRU cache with O(1) get and put?',
    },
    acceptedAnswers: ['해시맵이중연결리스트', '해시맵 이중 연결 리스트', 'hashmap doubly linked list', 'hash map doubly linked list', '해시테이블이중연결리스트', '딕셔너리이중연결리스트'],
    explanation: {
      ko: 'LRU 캐시는 해시맵(key→노드 O(1) 조회)과 이중 연결 리스트(접근 순서 O(1) 재정렬)를 결합해 get/put 모두 O(1)을 달성합니다.',
      en: 'An LRU cache combines a hash map (O(1) key-to-node lookup) and a doubly linked list (O(1) order update) to achieve O(1) get and put.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'ds-46',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: '유니온-파인드에서 find 연산 시 탐색 경로의 모든 노드를 루트에 직접 연결해 이후 탐색을 빠르게 하는 최적화 기법은?',
      en: 'Which union-find optimization makes every node on the find path point directly to the root, speeding up future finds?',
    },
    acceptedAnswers: ['경로압축', '경로 압축', 'path compression', 'pathcompression'],
    explanation: {
      ko: '경로 압축(path compression)은 find 중 거친 모든 노드를 루트에 직접 연결해 트리를 평탄하게 만들고 이후 find를 거의 O(1)로 만듭니다.',
      en: 'Path compression flattens the tree during find by pointing all traversed nodes directly to the root, making subsequent finds near O(1).',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'ds-47',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: '유니온-파인드에서 union 시 높이가 낮은 트리를 높은 트리에 붙여 깊이 증가를 억제하는 최적화 기법은?',
      en: 'Which union-find optimization attaches the shorter tree under the taller one during union to prevent depth growth?',
    },
    acceptedAnswers: ['랭크기반합치기', '랭크 기반 합치기', 'union by rank', 'unionbyrank', '랭크결합', '랭크 결합'],
    explanation: {
      ko: '랭크 기반 합치기(union by rank)는 두 집합의 트리 높이(랭크)를 비교해 작은 쪽을 큰 쪽 아래에 붙여 트리 높이를 O(log n)으로 제한합니다.',
      en: 'Union by rank compares tree heights (ranks) and attaches the shorter tree under the taller, keeping height O(log n).',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'ds-48',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: 'k차원 공간에서 점을 k-d 초평면으로 분할해 k-최근접 이웃 탐색을 효율화하는 트리 구조는?',
      en: 'Which tree structure partitions k-dimensional points by hyperplanes to speed up k-nearest-neighbor searches?',
    },
    acceptedAnswers: ['KD트리', 'KD 트리', 'kdtree', 'kd tree', 'k-d tree', 'k-dtree'],
    explanation: {
      ko: 'KD 트리는 각 레벨에서 하나의 차원을 기준으로 공간을 분할하는 BST로, k-최근접 이웃 및 범위 탐색을 효율적으로 수행합니다.',
      en: 'A KD-tree is a BST that splits space along one dimension per level, enabling efficient k-nearest-neighbor and range queries.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'ds-49',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: '피보나치 힙에서 삽입·감소키 연산의 분할 상환 시간 복잡도는? (빅오 표기)',
      en: 'What is the amortized time complexity of insert and decrease-key operations in a Fibonacci heap? (Big-O)',
    },
    acceptedAnswers: ['O(1)', '상수시간', '상수 시간', 'constant time'],
    explanation: {
      ko: '피보나치 힙은 삽입·감소키를 O(1) 분할 상환으로 지원해 다익스트라·프림 알고리즘을 이론적으로 최적화합니다(extract-min만 O(log n)).',
      en: 'A Fibonacci heap supports insert and decrease-key in O(1) amortized, theoretically optimizing Dijkstra and Prim (extract-min is O(log n)).',
    },
    difficulty: 'HARD',
  },
  {
    id: 'ds-50',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: {
      ko: '위상 정렬(Kahn 알고리즘)에서 각 정점의 선행 간선 수를 추적하는 데 사용하는 배열의 이름은?',
      en: 'What is the array used in Kahn\'s topological sort algorithm to track the number of incoming edges per vertex?',
    },
    acceptedAnswers: ['진입차수배열', '진입 차수 배열', 'indegree array', 'indegreearrary', 'in-degree array', '진입차수', '진입 차수'],
    explanation: {
      ko: '진입 차수(in-degree) 배열은 각 정점으로 들어오는 간선 수를 기록하며, Kahn 알고리즘은 진입 차수 0인 정점을 큐에 넣어 위상 순서를 구합니다.',
      en: 'An in-degree array records incoming edge counts per vertex; Kahn\'s algorithm enqueues vertices with in-degree 0 to produce topological order.',
    },
    difficulty: 'HARD',
  },
];
