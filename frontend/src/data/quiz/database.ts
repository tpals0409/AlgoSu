/**
 * @file 데이터베이스 분야 CS 퀴즈 문항 (30문항)
 * @domain quiz
 * @layer data
 * @related src/data/quiz/types.ts, src/data/quiz/index.ts
 */
import { QuizCategory, type QuizQuestion } from './types';

/** 데이터베이스(Database) 분야 단답형 문항 목록. */
export const DATABASE_QUESTIONS: readonly QuizQuestion[] = [
  {
    id: 'db-01',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: '데이터를 행과 열로 구성된 테이블 형태로 저장하는 데이터베이스 모델은?',
      en: 'Which database model stores data in tables made of rows and columns?',
    },
    acceptedAnswers: ['관계형데이터베이스', '관계형 데이터베이스', 'RDB', 'RDBMS', 'relational database', '관계형DB'],
    explanation: {
      ko: '관계형 데이터베이스(RDB)는 데이터를 행(튜플)과 열(속성)로 이루어진 테이블(릴레이션)에 저장하고 SQL로 다룹니다.',
      en: 'A relational database (RDB) stores data in tables (relations) of rows and columns and is queried with SQL.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'db-02',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: '테이블의 각 행을 유일하게 식별하며 NULL을 허용하지 않는 키는?',
      en: 'Which key uniquely identifies each row in a table and cannot be NULL?',
    },
    acceptedAnswers: ['기본키', '기본 키', 'primary key', 'PK', '주키'],
    explanation: {
      ko: '기본키(PK)는 각 튜플을 유일하게 식별하는 후보키 중 하나로, 유일성과 NOT NULL을 보장합니다.',
      en: 'A primary key (PK) is a chosen candidate key that uniquely identifies each tuple and is guaranteed unique and NOT NULL.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'db-03',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: '다른 테이블의 기본키를 참조하여 테이블 간 관계를 맺는 키는?',
      en: 'Which key references the primary key of another table to relate the two tables?',
    },
    acceptedAnswers: ['외래키', '외래 키', 'foreign key', 'FK', '참조키'],
    explanation: {
      ko: '외래키(FK)는 다른(또는 자기) 테이블의 기본키를 참조해 참조 무결성(referential integrity)을 유지합니다.',
      en: 'A foreign key (FK) references another (or the same) table’s primary key to enforce referential integrity.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'db-04',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: '튜플을 유일하게 식별할 수 있는 속성(집합)으로, 유일성과 최소성을 모두 만족하는 키는?',
      en: 'Which key uniquely identifies a tuple while satisfying both uniqueness and minimality?',
    },
    acceptedAnswers: ['후보키', '후보 키', 'candidate key', '캔디데이트키'],
    explanation: {
      ko: '후보키는 유일성(uniqueness)과 최소성(irreducibility)을 모두 만족하는 키이며, 이 중 하나가 기본키로 선택됩니다.',
      en: 'A candidate key satisfies both uniqueness and minimality; one of them is chosen as the primary key.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'db-05',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: '튜플을 유일하게 식별하지만 최소성은 만족하지 않을 수 있는 속성 집합은?',
      en: 'Which attribute set uniquely identifies a tuple but need not satisfy minimality?',
    },
    acceptedAnswers: ['슈퍼키', '슈퍼 키', 'super key', 'superkey'],
    explanation: {
      ko: '슈퍼키는 유일성만 만족하면 되는 키로, 불필요한 속성을 포함할 수 있습니다. 최소성까지 만족하면 후보키가 됩니다.',
      en: 'A super key only needs uniqueness and may contain extra attributes; if it also satisfies minimality it becomes a candidate key.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'db-06',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: '모든 속성이 더 이상 나눌 수 없는 원자값(atomic)만 갖도록 하는 정규형은?',
      en: 'Which normal form requires every attribute to hold only atomic (indivisible) values?',
    },
    acceptedAnswers: ['1NF', '제1정규형', '제 1 정규형', 'first normal form', '1정규형'],
    explanation: {
      ko: '제1정규형(1NF)은 모든 속성 값이 원자값이어야 하며, 반복 그룹이나 다중값 속성을 허용하지 않습니다.',
      en: 'First normal form (1NF) requires all attribute values to be atomic, disallowing repeating groups or multivalued attributes.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'db-07',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: '1NF를 만족하면서 기본키의 일부에만 종속되는 부분 함수 종속을 제거한 정규형은?',
      en: 'Which normal form is in 1NF and removes partial functional dependency on part of the primary key?',
    },
    acceptedAnswers: ['2NF', '제2정규형', '제 2 정규형', 'second normal form', '2정규형'],
    explanation: {
      ko: '제2정규형(2NF)은 1NF를 만족하고 기본키의 일부에만 종속되는 부분 함수 종속을 제거한 상태입니다.',
      en: 'Second normal form (2NF) is in 1NF and eliminates partial functional dependencies on part of the primary key.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'db-08',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: '2NF를 만족하면서 기본키가 아닌 속성 간의 이행적 함수 종속을 제거한 정규형은?',
      en: 'Which normal form is in 2NF and removes transitive functional dependencies among non-key attributes?',
    },
    acceptedAnswers: ['3NF', '제3정규형', '제 3 정규형', 'third normal form', '3정규형'],
    explanation: {
      ko: '제3정규형(3NF)은 2NF를 만족하고 비주요 속성이 기본키에 이행적으로 종속되지 않는 상태입니다.',
      en: 'Third normal form (3NF) is in 2NF and removes transitive dependencies of non-key attributes on the primary key.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'db-09',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: '모든 결정자가 후보키가 되도록 요구하는, 3NF보다 강한 정규형은?',
      en: 'Which normal form, stronger than 3NF, requires every determinant to be a candidate key?',
    },
    acceptedAnswers: ['BCNF', '보이스코드정규형', '보이스 코드 정규형', 'boyce codd normal form', 'boyce-codd normal form'],
    explanation: {
      ko: 'BCNF(보이스-코드 정규형)는 모든 함수 종속의 결정자가 후보키여야 하는, 3NF를 강화한 정규형입니다.',
      en: 'BCNF (Boyce-Codd Normal Form) strengthens 3NF by requiring every functional-dependency determinant to be a candidate key.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'db-10',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: '조회 성능을 위해 의도적으로 중복을 허용하며 정규화를 일부 되돌리는 기법은?',
      en: 'Which technique intentionally introduces redundancy to improve read performance by partly reversing normalization?',
    },
    acceptedAnswers: ['반정규화', '역정규화', 'denormalization', '비정규화'],
    explanation: {
      ko: '반정규화(denormalization)는 조인 비용을 줄여 조회 성능을 높이기 위해 의도적으로 중복을 허용하는 기법입니다.',
      en: 'Denormalization intentionally adds redundancy to reduce join cost and improve read performance.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'db-11',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: '더 이상 분리할 수 없는 하나의 논리적 작업 단위로 묶인 연산들의 집합은?',
      en: 'What is a set of operations grouped as a single indivisible logical unit of work?',
    },
    acceptedAnswers: ['트랜잭션', 'transaction', '거래'],
    explanation: {
      ko: '트랜잭션은 더 이상 나눌 수 없는 하나의 논리적 작업 단위로, 전부 반영(commit)되거나 전부 취소(rollback)됩니다.',
      en: 'A transaction is a single indivisible logical unit of work that is either fully committed or fully rolled back.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'db-12',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: '트랜잭션이 가져야 할 원자성·일관성·격리성·지속성 네 가지 성질을 통칭하는 약어는?',
      en: 'Which acronym names the four transaction properties: atomicity, consistency, isolation, durability?',
    },
    acceptedAnswers: ['ACID', '에이시드', '원자성일관성격리성지속성'],
    explanation: {
      ko: 'ACID는 원자성(Atomicity), 일관성(Consistency), 격리성(Isolation), 지속성(Durability)을 뜻하는 트랜잭션의 4대 성질입니다.',
      en: 'ACID stands for Atomicity, Consistency, Isolation, and Durability — the four key transaction properties.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'db-13',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: '트랜잭션의 모든 연산이 전부 수행되거나 전혀 수행되지 않음을 보장하는 ACID 성질은?',
      en: 'Which ACID property guarantees that all operations of a transaction are performed entirely or not at all?',
    },
    acceptedAnswers: ['원자성', 'atomicity', '아토미시티'],
    explanation: {
      ko: '원자성(Atomicity)은 트랜잭션의 연산이 모두 반영되거나(All) 하나도 반영되지 않음(Nothing)을 보장합니다.',
      en: 'Atomicity guarantees that a transaction’s operations are applied all-or-nothing.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'db-14',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: '커밋된 데이터의 변경 결과가 영구적으로 보존됨을 보장하는 ACID 성질은?',
      en: 'Which ACID property guarantees that committed changes are permanently preserved?',
    },
    acceptedAnswers: ['지속성', '영속성', 'durability', '내구성'],
    explanation: {
      ko: '지속성(Durability)은 커밋된 트랜잭션의 결과가 시스템 장애가 발생해도 영구적으로 유지됨을 보장합니다.',
      en: 'Durability guarantees that the results of a committed transaction persist permanently even after a system failure.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'db-15',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: '커밋되지 않은 다른 트랜잭션의 변경까지 읽을 수 있어 더티 리드가 발생하는 가장 낮은 격리수준은?',
      en: 'Which lowest isolation level allows reading uncommitted changes, permitting dirty reads?',
    },
    acceptedAnswers: ['read uncommitted', 'readuncommitted', '리드언커밋티드', '미완료읽기'],
    explanation: {
      ko: 'Read Uncommitted는 커밋되지 않은 변경까지 읽을 수 있는 최하위 격리수준으로 더티 리드(dirty read)가 허용됩니다.',
      en: 'Read Uncommitted is the lowest isolation level that allows reading uncommitted changes, permitting dirty reads.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'db-16',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: '더티 리드를 막지만 같은 행을 다시 읽으면 값이 바뀔 수 있는(non-repeatable read) 격리수준은?',
      en: 'Which isolation level prevents dirty reads but still allows non-repeatable reads of the same row?',
    },
    acceptedAnswers: ['read committed', 'readcommitted', '리드커밋티드', '완료읽기'],
    explanation: {
      ko: 'Read Committed는 커밋된 데이터만 읽어 더티 리드를 막지만, 같은 행을 재조회할 때 값이 달라지는 non-repeatable read는 발생할 수 있습니다.',
      en: 'Read Committed reads only committed data so dirty reads are prevented, but non-repeatable reads can still occur.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'db-17',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: '같은 행을 여러 번 읽어도 동일한 값을 보장하지만 팬텀 리드는 발생할 수 있는 격리수준은?',
      en: 'Which isolation level guarantees the same value on repeated reads of a row but may still allow phantom reads?',
    },
    acceptedAnswers: ['repeatable read', 'repeatableread', '리피터블리드', '반복읽기'],
    explanation: {
      ko: 'Repeatable Read는 동일 행의 반복 읽기에 같은 값을 보장하지만, 범위 조건에 새 행이 끼어드는 팬텀 리드(phantom read)는 발생할 수 있습니다.',
      en: 'Repeatable Read guarantees identical values for repeated reads of the same row, but phantom reads can still occur on range queries.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'db-18',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: '트랜잭션을 완전히 직렬 실행한 것과 동일한 결과를 보장하는 가장 높은 격리수준은?',
      en: 'Which highest isolation level guarantees results identical to fully serial execution of transactions?',
    },
    acceptedAnswers: ['serializable', '시리얼라이저블', '직렬화가능', '직렬화'],
    explanation: {
      ko: 'Serializable은 트랜잭션을 순차 실행한 것과 동일한 결과를 보장하는 최상위 격리수준으로, 더티/논리피터블/팬텀 리드를 모두 막습니다.',
      en: 'Serializable is the highest isolation level, guaranteeing results equivalent to serial execution and preventing dirty, non-repeatable, and phantom reads.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'db-19',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: '읽기는 여러 트랜잭션이 동시에 가능하지만 쓰기는 막는, 공유 목적의 락은?',
      en: 'Which lock allows concurrent reads by multiple transactions but blocks writes?',
    },
    acceptedAnswers: ['공유락', '공유 락', 'shared lock', 'sharedlock', 's락', '읽기락', 'read lock'],
    explanation: {
      ko: '공유 락(S Lock)은 여러 트랜잭션이 동시에 읽을 수 있게 허용하지만 배타 락과 양립하지 않아 쓰기는 막습니다.',
      en: 'A shared (read) lock lets multiple transactions read concurrently but is incompatible with exclusive locks, blocking writes.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'db-20',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: '한 트랜잭션만 자원을 점유하여 다른 모든 읽기·쓰기를 막는, 쓰기 목적의 락은?',
      en: 'Which write-oriented lock is held by only one transaction, blocking all other reads and writes?',
    },
    acceptedAnswers: ['배타락', '배타 락', 'exclusive lock', 'exclusivelock', 'x락', '쓰기락', 'write lock'],
    explanation: {
      ko: '배타 락(X Lock)은 한 트랜잭션이 독점적으로 점유하여 다른 트랜잭션의 읽기와 쓰기를 모두 차단합니다.',
      en: 'An exclusive (write) lock is held exclusively by one transaction, blocking all other reads and writes.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'db-21',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: '두 트랜잭션이 서로가 점유한 자원을 기다리며 무한히 진행하지 못하는 상태는?',
      en: 'What is the state where two transactions each wait for resources held by the other and cannot proceed?',
    },
    acceptedAnswers: ['교착상태', '교착 상태', 'deadlock', '데드락'],
    explanation: {
      ko: '교착 상태(deadlock)는 둘 이상의 트랜잭션이 서로의 락 해제를 무한히 기다려 모두 진행하지 못하는 상황입니다.',
      en: 'A deadlock is a state where two or more transactions wait indefinitely for each other to release locks.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'db-22',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: '락을 확장 단계에서 획득만, 수축 단계에서 해제만 하도록 규정하는 직렬성 보장 프로토콜은?',
      en: 'Which serializability protocol acquires locks only in a growing phase and releases only in a shrinking phase?',
    },
    acceptedAnswers: ['2PL', '2단계락킹', '2단계 락킹', 'two phase locking', '이단계락킹'],
    explanation: {
      ko: '2단계 락킹(2PL)은 확장 단계에서 락 획득만, 수축 단계에서 락 해제만 허용하여 직렬 가능성을 보장합니다.',
      en: 'Two-phase locking (2PL) only acquires locks in the growing phase and only releases them in the shrinking phase to ensure serializability.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'db-23',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: '특정 컬럼 값으로 데이터를 빠르게 찾기 위해 별도로 만드는, 책의 색인 같은 보조 구조는?',
      en: 'Which auxiliary structure, like a book’s index, is created to quickly locate rows by a column value?',
    },
    acceptedAnswers: ['인덱스', 'index', '색인'],
    explanation: {
      ko: '인덱스는 특정 컬럼 값을 정렬·구조화해 조회 속도를 높이는 보조 자료구조로, 쓰기 비용 증가라는 트레이드오프가 있습니다.',
      en: 'An index is an auxiliary structure that organizes column values to speed up lookups, at the cost of slower writes.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'db-24',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: '대부분의 RDBMS가 인덱스 구현에 사용하는, 균형 잡힌 다진 트리 자료구조는?',
      en: 'Which balanced multi-way tree structure is used by most RDBMSs to implement indexes?',
    },
    acceptedAnswers: ['B트리', 'B-트리', 'btree', 'b tree', 'b-tree', 'B플러스트리', 'b+tree', 'b+ tree'],
    explanation: {
      ko: 'B-트리(및 변형인 B+트리)는 균형 잡힌 다진 트리로, 범위 검색과 정렬에 유리해 대부분의 인덱스 구현에 쓰입니다.',
      en: 'The B-tree (and its B+ tree variant) is a balanced multi-way tree well suited to range scans and ordering, used for most indexes.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'db-25',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: '테이블의 실제 데이터 행이 인덱스 키 순서대로 물리적으로 정렬·저장되는 인덱스는?',
      en: 'Which index physically orders and stores the actual table rows in index-key order?',
    },
    acceptedAnswers: ['클러스터드인덱스', '클러스터드 인덱스', 'clustered index', 'clusteredindex', '군집인덱스'],
    explanation: {
      ko: '클러스터드 인덱스는 데이터 행 자체를 인덱스 키 순으로 물리적으로 정렬해 저장하므로 테이블당 하나만 존재할 수 있습니다.',
      en: 'A clustered index physically orders the table rows by the index key, so a table can have only one.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'db-26',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: '키를 해시 함수로 변환해 등호(=) 검색을 평균 O(1)로 처리하지만 범위 검색에는 부적합한 인덱스는?',
      en: 'Which index hashes keys for average O(1) equality lookups but is unsuitable for range queries?',
    },
    acceptedAnswers: ['해시인덱스', '해시 인덱스', 'hash index', 'hashindex'],
    explanation: {
      ko: '해시 인덱스는 해시 함수로 키를 버킷에 매핑해 등호 검색에 평균 O(1)을 제공하지만, 순서를 보존하지 않아 범위 검색에는 부적합합니다.',
      en: 'A hash index maps keys to buckets via a hash function for average O(1) equality lookups but cannot serve range queries.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'db-27',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: '인덱스를 사용하지 않고 테이블의 모든 행을 처음부터 끝까지 읽는 접근 방식은?',
      en: 'Which access method reads every row of a table from start to end without using an index?',
    },
    acceptedAnswers: ['풀스캔', '풀 스캔', 'full scan', 'fullscan', 'full table scan', '전체스캔', '테이블풀스캔'],
    explanation: {
      ko: '풀 스캔(full table scan)은 인덱스 없이 모든 행을 순차적으로 읽으며, 조회 대상이 테이블의 큰 비율일 때 인덱스 스캔보다 효율적일 수 있습니다.',
      en: 'A full table scan reads every row sequentially without an index and can outperform an index scan when a large fraction of rows is selected.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'db-28',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: '두 테이블에서 조인 조건을 만족하는 행만 결과로 반환하는 가장 기본적인 조인은?',
      en: 'Which most basic join returns only the rows that satisfy the join condition in both tables?',
    },
    acceptedAnswers: ['inner join', 'innerjoin', '내부조인', '이너조인', '교집합조인'],
    explanation: {
      ko: 'INNER JOIN은 두 테이블에서 조인 조건이 일치하는 행만 결합해 반환합니다. (불일치 행은 결과에서 제외)',
      en: 'An INNER JOIN returns only the rows where the join condition matches in both tables, excluding non-matching rows.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'db-29',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: '한 쿼리의 결과를 다른 쿼리의 WHERE나 FROM 절에서 사용하는, 쿼리 안에 중첩된 쿼리는?',
      en: 'What is a query nested inside another query, used in its WHERE or FROM clause?',
    },
    acceptedAnswers: ['서브쿼리', '서브 쿼리', 'subquery', '하위쿼리', '부속질의'],
    explanation: {
      ko: '서브쿼리는 다른 SQL 문 안에 중첩된 쿼리로, 그 결과가 바깥 쿼리의 조건이나 데이터 원본으로 사용됩니다.',
      en: 'A subquery is a query nested inside another SQL statement whose result feeds the outer query’s condition or data source.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'db-30',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: '하나 이상의 테이블에서 유도된, 실제 데이터를 저장하지 않는 가상 테이블은?',
      en: 'What is a virtual table derived from one or more tables that stores no data of its own?',
    },
    acceptedAnswers: ['뷰', 'view', '가상테이블', '가상 테이블'],
    explanation: {
      ko: '뷰(view)는 하나 이상의 테이블에서 정의된 쿼리로 만들어진 가상 테이블로, 물리적 데이터 없이 조회 시점에 결과를 보여줍니다.',
      en: 'A view is a virtual table defined by a query over one or more tables, holding no physical data and producing results on access.',
    },
    difficulty: 'EASY',
  },
];
