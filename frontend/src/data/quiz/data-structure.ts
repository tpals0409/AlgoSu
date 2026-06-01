/**
 * @file 자료구조 분야 CS 퀴즈 문항 (12문항)
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
];
