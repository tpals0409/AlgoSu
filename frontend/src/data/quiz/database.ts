/**
 * @file 데이터베이스 분야 CS 퀴즈 문항 (50문항)
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
  {
    id: 'db-31',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: 'SQL에서 데이터를 집계할 때 특정 열 기준으로 행을 묶는 절은?',
      en: 'Which SQL clause groups rows by a specific column for aggregation?',
    },
    acceptedAnswers: ['GROUP BY', 'groupby', '그룹바이', '그룹 바이'],
    explanation: {
      ko: 'GROUP BY 절은 지정한 열의 값이 같은 행들을 하나의 그룹으로 묶어 COUNT, SUM, AVG 등 집계 함수를 적용할 수 있게 합니다.',
      en: 'The GROUP BY clause groups rows with the same value in a specified column so aggregate functions like COUNT, SUM, and AVG can be applied per group.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'db-32',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: 'SQL에서 GROUP BY 결과에 조건을 거는 절은? (WHERE는 그룹 전 행 필터링)',
      en: 'Which SQL clause filters grouped results after GROUP BY? (WHERE filters rows before grouping)',
    },
    acceptedAnswers: ['HAVING', 'having', '해빙'],
    explanation: {
      ko: 'HAVING 절은 GROUP BY로 만들어진 그룹에 조건을 적용합니다. WHERE는 그룹화 전 개별 행 필터링에 사용됩니다.',
      en: 'The HAVING clause applies a filter condition to groups produced by GROUP BY, whereas WHERE filters individual rows before grouping.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'db-33',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: '두 릴레이션의 공통 속성을 기준으로 일치하는 행을 결합하는 관계대수 연산은?',
      en: 'Which relational algebra operation combines matching rows from two relations on a common attribute?',
    },
    acceptedAnswers: ['조인', 'join', 'natural join', '자연조인'],
    explanation: {
      ko: '조인(join)은 두 릴레이션에서 공통 속성 값이 같은 행을 결합하는 관계대수 연산으로, SQL에서 INNER JOIN 등으로 구현됩니다.',
      en: 'A join combines rows from two relations that share matching values on a common attribute, implemented in SQL as INNER JOIN and others.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'db-34',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: '데이터베이스에서 테이블 간 참조 관계가 항상 유효하도록 보장하는 무결성 제약은?',
      en: 'Which integrity constraint ensures that table references are always valid?',
    },
    acceptedAnswers: ['참조무결성', '참조 무결성', 'referential integrity', '외래키무결성'],
    explanation: {
      ko: '참조 무결성(referential integrity)은 외래키가 참조하는 기본키 값이 반드시 존재하거나 NULL임을 보장하는 제약입니다.',
      en: 'Referential integrity constrains foreign keys to reference only existing primary key values or be NULL.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'db-35',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: '트랜잭션 시작 전 데이터베이스가 일관성 있는 상태였다면 트랜잭션 후에도 일관성을 유지해야 함을 보장하는 ACID 성질은?',
      en: 'Which ACID property guarantees that a database moves from one consistent state to another after a transaction?',
    },
    acceptedAnswers: ['일관성', 'consistency', '컨시스턴시'],
    explanation: {
      ko: '일관성(Consistency)은 트랜잭션 전후로 데이터베이스가 정의된 규칙과 무결성 제약을 모두 만족하는 상태임을 보장합니다.',
      en: 'Consistency guarantees that a transaction brings the database from one valid state to another, satisfying all defined rules and constraints.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'db-36',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: 'OLTP와 대비되는 개념으로, 대용량 이력 데이터를 분석·집계하는 데 특화된 데이터 처리 방식은?',
      en: 'What is the data processing approach, contrasted with OLTP, specialized for analyzing and aggregating large historical datasets?',
    },
    acceptedAnswers: ['OLAP', '올랩', 'online analytical processing'],
    explanation: {
      ko: 'OLAP(Online Analytical Processing)는 대량의 이력 데이터를 복잡한 집계·분석 쿼리로 처리하며, 데이터웨어하우스 환경에서 주로 사용됩니다.',
      en: 'OLAP (Online Analytical Processing) handles complex aggregation and analysis queries over large historical datasets, typically in a data warehouse.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'db-37',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: '실시간 소수 행의 삽입·수정·삭제를 빠르게 처리하는 운영 데이터베이스 처리 방식의 약어는?',
      en: 'What is the acronym for the operational database processing style that handles fast single-row inserts, updates, and deletes?',
    },
    acceptedAnswers: ['OLTP', '올티피', 'online transaction processing'],
    explanation: {
      ko: 'OLTP(Online Transaction Processing)는 짧고 빈번한 트랜잭션(주문·결제 등)을 실시간으로 처리하는 방식으로, 정규화된 구조와 빠른 쓰기에 최적화됩니다.',
      en: 'OLTP (Online Transaction Processing) handles frequent short transactions such as orders and payments in real time, optimized for normalized schema and fast writes.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'db-38',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: '4NF는 어떤 비정상적인 종속을 제거하는 정규형인가?',
      en: 'What type of anomalous dependency does 4NF eliminate?',
    },
    acceptedAnswers: ['다치종속', '다치 종속', '다중값종속', 'multivalued dependency', 'MVD'],
    explanation: {
      ko: '제4정규형(4NF)은 BCNF를 만족하면서 비자명(non-trivial) 다치 종속(multivalued dependency)까지 제거한 정규형입니다.',
      en: 'Fourth normal form (4NF) extends BCNF by also eliminating non-trivial multivalued dependencies (MVDs).',
    },
    difficulty: 'HARD',
  },
  {
    id: 'db-39',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: '속성 A가 속성 B를 함수적으로 결정할 때, A→B로 표기하는 이 관계를 무엇이라 하는가?',
      en: 'When attribute A determines attribute B, written A→B, what is this relationship called?',
    },
    acceptedAnswers: ['함수종속', '함수 종속', 'functional dependency', 'FD'],
    explanation: {
      ko: '함수 종속(FD, Functional Dependency)은 한 속성(집합)의 값이 다른 속성의 값을 유일하게 결정하는 관계로, 정규화의 이론적 기반입니다.',
      en: 'A functional dependency (FD) means one attribute (set) uniquely determines another; it is the theoretical basis for normalization.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'db-40',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: '락을 획득하지 않고 버전 정보를 이용해 동시성을 제어하며, 읽기가 쓰기를 막지 않는 동시성 제어 기법은?',
      en: 'Which concurrency control technique uses version snapshots instead of locks, allowing reads and writes not to block each other?',
    },
    acceptedAnswers: ['MVCC', '다중버전동시성제어', '다중 버전 동시성 제어', 'multiversion concurrency control'],
    explanation: {
      ko: 'MVCC(Multi-Version Concurrency Control)는 데이터의 여러 버전을 유지해 읽기와 쓰기가 서로 차단하지 않도록 하는 동시성 제어 기법으로 PostgreSQL, InnoDB 등에서 사용됩니다.',
      en: 'MVCC (Multi-Version Concurrency Control) maintains multiple versions of data so reads and writes do not block each other, as used in PostgreSQL and InnoDB.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'db-41',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: '커밋되지 않은 변경 사항을 다른 트랜잭션이 읽는 데이터 불일치 현상은?',
      en: 'What is the anomaly where one transaction reads uncommitted changes made by another transaction?',
    },
    acceptedAnswers: ['더티리드', '더티 리드', 'dirty read', 'dirtyread'],
    explanation: {
      ko: '더티 리드(dirty read)는 트랜잭션 A가 커밋 전 변경한 데이터를 트랜잭션 B가 읽은 뒤, A가 롤백하면 B는 존재하지 않는 데이터를 읽은 것이 되는 이상현상입니다.',
      en: 'A dirty read occurs when transaction B reads uncommitted changes from transaction A; if A rolls back, B has read data that never existed.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'db-42',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: '한 트랜잭션 내에서 같은 행을 두 번 읽었을 때 다른 트랜잭션의 커밋으로 인해 값이 달라지는 이상현상은?',
      en: 'Which anomaly causes a row to return different values on two reads within the same transaction due to another committed transaction?',
    },
    acceptedAnswers: ['반복불가능읽기', '반복 불가능 읽기', 'non-repeatable read', 'nonrepeatable read', '비반복읽기'],
    explanation: {
      ko: '반복 불가능 읽기(non-repeatable read)는 같은 트랜잭션 내에서 동일 행을 두 번 읽을 때 중간에 다른 트랜잭션의 커밋으로 값이 변경되어 다른 결과를 반환하는 이상현상입니다.',
      en: 'A non-repeatable read happens when the same row returns different values on two reads in one transaction because another committed transaction updated it in between.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'db-43',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: '범위 쿼리를 두 번 실행했을 때 다른 트랜잭션의 삽입으로 새 행이 나타나는 이상현상은?',
      en: 'Which anomaly causes a range query to return new rows on a second execution because another transaction inserted rows?',
    },
    acceptedAnswers: ['팬텀리드', '팬텀 리드', 'phantom read', 'phantomread', '유령읽기'],
    explanation: {
      ko: '팬텀 리드(phantom read)는 동일 트랜잭션 내에서 범위 조건 쿼리를 두 번 수행할 때 중간에 다른 트랜잭션이 삽입한 행이 보이는 이상현상입니다.',
      en: 'A phantom read occurs when a range query run twice in the same transaction returns additional rows inserted by another committed transaction.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'db-44',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: '트랜잭션이 충돌을 가정하지 않고 작업 후 커밋 시점에 충돌 여부를 검사하는 동시성 제어 전략은?',
      en: 'Which concurrency control strategy assumes no conflict and checks for conflicts only at commit time?',
    },
    acceptedAnswers: ['낙관적락', '낙관적 락', 'optimistic locking', 'optimistic lock', 'optimistic concurrency control', 'OCC'],
    explanation: {
      ko: '낙관적 락(Optimistic Locking)은 충돌이 드물다고 가정해 락 없이 작업하고 커밋 전에 버전·타임스탬프로 충돌을 감지합니다.',
      en: 'Optimistic locking assumes conflicts are rare, skips locks during the operation, and detects conflicts via version or timestamp at commit time.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'db-45',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: '쿼리 결과를 물리적으로 저장해 빠른 재조회를 지원하는, 실제 데이터를 보관하는 뷰는?',
      en: 'Which type of view physically stores query results to support fast re-queries?',
    },
    acceptedAnswers: ['머티리얼라이즈드뷰', '머티리얼라이즈드 뷰', 'materialized view', '구체화된뷰', '구체화뷰'],
    explanation: {
      ko: '머티리얼라이즈드 뷰(Materialized View)는 쿼리 결과를 실제 데이터로 저장해 재조회 시 빠른 성능을 제공하며, 주기적으로 갱신(refresh)이 필요합니다.',
      en: 'A materialized view physically stores query results for fast re-access and must be periodically refreshed to stay current.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'db-46',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: '대규모 테이블을 범위·해시·리스트 등의 기준으로 여러 물리 파티션으로 나누는 기법은?',
      en: 'Which technique splits a large table into multiple physical partitions by range, hash, or list?',
    },
    acceptedAnswers: ['파티셔닝', 'partitioning', '파티션'],
    explanation: {
      ko: '파티셔닝(partitioning)은 테이블을 논리적으로 하나로 유지하면서 물리적으로 여러 파티션으로 나눠 쿼리 성능과 관리 효율을 높이는 기법입니다.',
      en: 'Partitioning splits a table into multiple physical segments while presenting a single logical table, improving query performance and manageability.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'db-47',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: '데이터를 여러 노드에 수평 분산 저장하여 수평 확장(scale-out)을 가능하게 하는 기법은?',
      en: 'Which technique horizontally distributes data across multiple nodes to enable scale-out?',
    },
    acceptedAnswers: ['샤딩', 'sharding', '수평분할'],
    explanation: {
      ko: '샤딩(sharding)은 데이터를 샤드 키 기준으로 여러 노드에 수평 분산해 단일 노드 한계를 초과하는 데이터 처리 및 쓰기 확장을 가능하게 합니다.',
      en: 'Sharding distributes data across multiple nodes by a shard key, enabling write scale-out beyond the limits of a single node.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'db-48',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: '분산 시스템에서 일관성(Consistency)·가용성(Availability)·분단 허용성(Partition tolerance) 중 셋 모두를 동시에 보장할 수 없다는 이론은?',
      en: 'Which theorem states that a distributed system cannot simultaneously guarantee consistency, availability, and partition tolerance?',
    },
    acceptedAnswers: ['CAP정리', 'CAP 정리', 'CAP theorem', 'cap', '캡정리'],
    explanation: {
      ko: 'CAP 정리(Brewer 정리)는 네트워크 분단(partition) 상황에서 일관성(C)과 가용성(A) 중 하나를 포기해야 한다는 분산 시스템 이론입니다.',
      en: "The CAP theorem (Brewer's theorem) states that during a network partition, a distributed system must sacrifice either consistency or availability.",
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'db-49',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: '데이터베이스 변경 사항을 실제 데이터 파일에 반영하기 전에 먼저 순차 기록하는 로그 방식은?',
      en: 'Which logging strategy writes changes to a sequential log before applying them to the actual data files?',
    },
    acceptedAnswers: ['WAL', 'write ahead log', 'write-ahead log', '선행기록로그', '선행 기록 로그', '사전기록로그'],
    explanation: {
      ko: 'WAL(Write-Ahead Logging)은 변경 사항을 순차 로그에 먼저 기록한 뒤 데이터 파일에 반영하여 장애 복구(redo/undo) 및 내구성을 보장합니다.',
      en: 'Write-Ahead Logging (WAL) records changes to a sequential log before applying them to data files, enabling crash recovery via redo/undo.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'db-50',
    category: QuizCategory.DATABASE,
    prompt: {
      ko: '복합 인덱스에서 쿼리가 인덱스 열만으로 결과를 완성해 테이블 접근을 생략하는 인덱스는?',
      en: 'Which index satisfies a query entirely from indexed columns without accessing the table?',
    },
    acceptedAnswers: ['커버링인덱스', '커버링 인덱스', 'covering index', 'index only scan', '인덱스온리스캔'],
    explanation: {
      ko: '커버링 인덱스(covering index)는 쿼리에 필요한 모든 열이 인덱스에 포함되어 테이블 접근(table lookup)을 생략해 성능을 크게 높입니다.',
      en: 'A covering index includes all columns needed by a query, allowing it to be answered entirely from the index without a table lookup.',
    },
    difficulty: 'HARD',
  },
];
