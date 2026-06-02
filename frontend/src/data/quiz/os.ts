/**
 * @file 운영체제 분야 CS 퀴즈 문항 (30문항)
 * @domain quiz
 * @layer data
 * @related src/data/quiz/types.ts, src/data/quiz/index.ts
 */
import { QuizCategory, type QuizQuestion } from './types';

/** 운영체제(Operating System) 분야 단답형 문항 목록. */
export const OS_QUESTIONS: readonly QuizQuestion[] = [
  {
    id: 'os-01',
    category: QuizCategory.OS,
    prompt: {
      ko: '운영체제가 실행 중인 프로세스의 상태·PID·레지스터 등 정보를 저장하는 자료구조는?',
      en: 'Which OS data structure stores a running process’s state, PID, registers, and other info?',
    },
    acceptedAnswers: ['PCB', '프로세스제어블록', '프로세스 제어 블록', 'process control block'],
    explanation: {
      ko: 'PCB(Process Control Block)는 프로세스의 상태, PID, 프로그램 카운터, 레지스터 등을 담는 커널 자료구조입니다.',
      en: 'The PCB (Process Control Block) is a kernel structure holding a process’s state, PID, program counter, and registers.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'os-02',
    category: QuizCategory.OS,
    prompt: {
      ko: 'CPU가 실행하던 프로세스를 멈추고 다른 프로세스로 전환하며 상태를 저장·복원하는 작업은?',
      en: 'What is the operation of saving and restoring state when the CPU switches from one process to another?',
    },
    acceptedAnswers: ['컨텍스트스위칭', '컨텍스트 스위칭', '문맥교환', '문맥 교환', '문맥전환', 'context switch', 'context switching'],
    explanation: {
      ko: '컨텍스트 스위칭은 현재 프로세스의 컨텍스트를 PCB에 저장하고 다음 프로세스의 컨텍스트를 복원하는 과정입니다.',
      en: 'Context switching saves the current process’s context into its PCB and restores the next process’s context.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'os-03',
    category: QuizCategory.OS,
    prompt: {
      ko: '한 프로세스 내에서 코드·데이터·힙은 공유하되 스택과 레지스터는 별도로 갖는 실행 단위는?',
      en: 'Which execution unit within a process shares code/data/heap but has its own stack and registers?',
    },
    acceptedAnswers: ['스레드', '쓰레드', 'thread'],
    explanation: {
      ko: '스레드는 프로세스의 자원(코드·데이터·힙)을 공유하면서 각자 스택과 레지스터를 갖는 실행 흐름입니다.',
      en: 'A thread is a flow of execution that shares the process’s resources while keeping its own stack and registers.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'os-04',
    category: QuizCategory.OS,
    prompt: {
      ko: '준비 큐의 프로세스를 도착 순서대로 처리하는 비선점 CPU 스케줄링 기법은?',
      en: 'Which non-preemptive CPU scheduling policy serves ready-queue processes in arrival order?',
    },
    acceptedAnswers: ['FCFS', '선입선처리', 'first come first served', 'first-come first-served'],
    explanation: {
      ko: 'FCFS(First-Come, First-Served)는 먼저 도착한 프로세스를 먼저 실행하는 비선점 스케줄링입니다.',
      en: 'FCFS (First-Come, First-Served) runs processes in arrival order without preemption.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'os-05',
    category: QuizCategory.OS,
    prompt: {
      ko: '실행 시간이 가장 짧은 프로세스를 먼저 실행해 평균 대기시간을 최소화하는 스케줄링은?',
      en: 'Which scheduling runs the process with the shortest burst time first to minimize average waiting time?',
    },
    acceptedAnswers: ['SJF', '최단작업우선', 'shortest job first', 'shortest-job-first'],
    explanation: {
      ko: 'SJF(Shortest Job First)는 CPU 버스트가 가장 짧은 프로세스를 먼저 실행하여 평균 대기시간을 최소화합니다.',
      en: 'SJF (Shortest Job First) runs the process with the smallest CPU burst first, minimizing average waiting time.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'os-06',
    category: QuizCategory.OS,
    prompt: {
      ko: '각 프로세스에 동일한 시간 할당량(타임 퀀텀)을 부여하고 순환하는 선점형 스케줄링은?',
      en: 'Which preemptive scheduling gives each process an equal time quantum and rotates through them?',
    },
    acceptedAnswers: ['라운드로빈', '라운드 로빈', 'round robin', 'round-robin', 'RR'],
    explanation: {
      ko: '라운드 로빈(RR)은 각 프로세스에 고정 시간 할당량을 주고 만료 시 다음 프로세스로 선점 전환합니다.',
      en: 'Round Robin (RR) assigns each process a fixed time quantum and preempts to the next when it expires.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'os-07',
    category: QuizCategory.OS,
    prompt: {
      ko: '실행 중인 프로세스의 CPU를 운영체제가 강제로 회수할 수 있는 스케줄링 방식은?',
      en: 'Which scheduling type lets the OS forcibly reclaim the CPU from a running process?',
    },
    acceptedAnswers: ['선점', '선점형', '선점스케줄링', 'preemptive', 'preemptive scheduling'],
    explanation: {
      ko: '선점형 스케줄링은 더 높은 우선순위나 타임 퀀텀 만료 시 OS가 CPU를 강제로 회수합니다. 반대는 비선점형입니다.',
      en: 'Preemptive scheduling lets the OS forcibly take back the CPU on higher priority or quantum expiry; non-preemptive is the opposite.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'os-08',
    category: QuizCategory.OS,
    prompt: {
      ko: '공유 자원에 한 번에 하나의 프로세스만 접근하도록 보호해야 하는 코드 영역은?',
      en: 'Which code region accessing shared resources must allow only one process at a time?',
    },
    acceptedAnswers: ['임계구역', '임계 구역', '임계영역', '크리티컬섹션', 'critical section', 'critical region'],
    explanation: {
      ko: '임계구역(critical section)은 공유 자원에 접근하는 코드 영역으로, 동시 접근을 막기 위해 상호배제가 필요합니다.',
      en: 'A critical section is code accessing shared resources; mutual exclusion is required to prevent concurrent access.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'os-09',
    category: QuizCategory.OS,
    prompt: {
      ko: '한 번에 하나의 프로세스만 임계구역에 진입하도록 보장하는 동시성 제어 원칙은?',
      en: 'Which concurrency principle guarantees only one process enters the critical section at a time?',
    },
    acceptedAnswers: ['상호배제', '상호 배제', 'mutual exclusion', 'mutex 원칙'],
    explanation: {
      ko: '상호배제(mutual exclusion)는 임계구역에 동시에 둘 이상의 프로세스가 진입하지 못하게 하는 원칙입니다.',
      en: 'Mutual exclusion ensures no two processes are inside the critical section simultaneously.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'os-10',
    category: QuizCategory.OS,
    prompt: {
      ko: '정수 카운터로 여러 자원의 동시 접근 개수를 제어하는 동기화 도구는? (wait/signal 연산 사용)',
      en: 'Which synchronization tool uses an integer counter (wait/signal) to control concurrent access to multiple resources?',
    },
    acceptedAnswers: ['세마포어', '세마포', 'semaphore'],
    explanation: {
      ko: '세마포어는 정수 값과 wait(P)/signal(V) 연산으로 동시에 자원에 접근 가능한 프로세스 수를 제어합니다.',
      en: 'A semaphore uses an integer with wait(P)/signal(V) operations to control how many processes access resources concurrently.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'os-11',
    category: QuizCategory.OS,
    prompt: {
      ko: '잠금을 획득한 스레드만 해제할 수 있는, 상호배제 전용 이진(0/1) 동기화 도구는?',
      en: 'Which binary (0/1) lock for mutual exclusion can only be released by the thread that acquired it?',
    },
    acceptedAnswers: ['뮤텍스', 'mutex', 'mutual exclusion lock'],
    explanation: {
      ko: '뮤텍스는 소유권(ownership) 개념이 있는 잠금으로, 잠근 스레드만 해제할 수 있어 상호배제를 보장합니다.',
      en: 'A mutex is a lock with ownership; only the locking thread can unlock it, guaranteeing mutual exclusion.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'os-12',
    category: QuizCategory.OS,
    prompt: {
      ko: '두 개 이상의 프로세스가 서로 상대가 가진 자원을 무한히 기다리며 진행하지 못하는 상태는?',
      en: 'What state has two or more processes each waiting forever for resources held by the other?',
    },
    acceptedAnswers: ['데드락', '교착상태', '교착 상태', 'deadlock'],
    explanation: {
      ko: '교착상태(deadlock)는 프로세스들이 서로의 자원을 순환 대기하여 어느 쪽도 진행하지 못하는 상태입니다.',
      en: 'A deadlock occurs when processes circularly wait for each other’s resources and none can proceed.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'os-13',
    category: QuizCategory.OS,
    prompt: {
      ko: '교착상태 발생의 4가지 필요조건 중, 자원을 점유한 채 다른 자원을 기다리는 조건의 이름은?',
      en: 'Among the four deadlock conditions, what is the name of holding a resource while waiting for another?',
    },
    acceptedAnswers: ['점유와대기', '점유 대기', 'hold and wait', 'hold-and-wait'],
    explanation: {
      ko: '교착상태 4조건은 상호배제, 점유와 대기(hold and wait), 비선점, 순환 대기입니다. 그중 하나가 점유와 대기입니다.',
      en: 'The four deadlock conditions are mutual exclusion, hold and wait, no preemption, and circular wait.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'os-14',
    category: QuizCategory.OS,
    prompt: {
      ko: '자원 할당이 안전 상태를 유지하는지 검사해 교착상태를 회피하는 다익스트라의 알고리즘은?',
      en: 'Which Dijkstra algorithm avoids deadlock by checking whether an allocation keeps a safe state?',
    },
    acceptedAnswers: ['은행원알고리즘', '은행원 알고리즘', 'bankers algorithm', "banker's algorithm", 'banker algorithm'],
    explanation: {
      ko: '은행원 알고리즘은 자원 요청을 승인하기 전 시스템이 안전 상태를 유지하는지 검사하여 교착상태를 회피합니다.',
      en: 'The banker’s algorithm checks if granting a request leaves the system in a safe state to avoid deadlock.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'os-15',
    category: QuizCategory.OS,
    prompt: {
      ko: '여러 프로세스가 공유 데이터에 동시 접근할 때 실행 순서에 따라 결과가 달라지는 문제는?',
      en: 'Which problem makes results depend on execution order when processes access shared data concurrently?',
    },
    acceptedAnswers: ['경쟁상태', '경쟁 상태', '경합조건', 'race condition'],
    explanation: {
      ko: '경쟁상태(race condition)는 둘 이상의 프로세스/스레드가 공유 자원에 동시 접근해 실행 순서에 따라 결과가 비결정적으로 달라지는 문제입니다.',
      en: 'A race condition arises when concurrent accesses to shared data make outcomes depend on timing/order.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'os-16',
    category: QuizCategory.OS,
    prompt: {
      ko: '물리 메모리보다 큰 주소 공간을 디스크를 활용해 제공하는 메모리 관리 기법은?',
      en: 'Which memory management technique provides an address space larger than physical memory using disk?',
    },
    acceptedAnswers: ['가상메모리', '가상 메모리', 'virtual memory'],
    explanation: {
      ko: '가상 메모리는 일부만 물리 메모리에 두고 나머지는 디스크(스왑)에 두어, 물리 메모리보다 큰 주소 공간을 제공합니다.',
      en: 'Virtual memory keeps part of a process in RAM and the rest on disk, offering an address space larger than physical memory.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'os-17',
    category: QuizCategory.OS,
    prompt: {
      ko: '메모리를 고정 크기 블록으로 나누어 외부 단편화를 없애는 가상 메모리 관리 기법은?',
      en: 'Which technique divides memory into fixed-size blocks to eliminate external fragmentation?',
    },
    acceptedAnswers: ['페이징', 'paging'],
    explanation: {
      ko: '페이징은 논리 메모리를 고정 크기 페이지, 물리 메모리를 프레임으로 나누어 외부 단편화를 제거합니다.',
      en: 'Paging splits logical memory into fixed-size pages and physical memory into frames, eliminating external fragmentation.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'os-18',
    category: QuizCategory.OS,
    prompt: {
      ko: '메모리를 논리적 의미 단위(코드·스택·힙 등)의 가변 크기 블록으로 나누는 기법은?',
      en: 'Which technique divides memory into variable-size logical units like code, stack, and heap?',
    },
    acceptedAnswers: ['세그멘테이션', '세그먼테이션', 'segmentation'],
    explanation: {
      ko: '세그멘테이션은 메모리를 논리적 의미 단위의 가변 크기 세그먼트로 나누며, 외부 단편화가 발생할 수 있습니다.',
      en: 'Segmentation divides memory into variable-size logical segments and can suffer external fragmentation.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'os-19',
    category: QuizCategory.OS,
    prompt: {
      ko: '접근하려는 페이지가 물리 메모리에 없어 디스크에서 가져와야 할 때 발생하는 인터럽트는?',
      en: 'Which fault occurs when the requested page is not in physical memory and must be loaded from disk?',
    },
    acceptedAnswers: ['페이지폴트', '페이지 폴트', '페이지부재', '페이지 부재', 'page fault'],
    explanation: {
      ko: '페이지 폴트는 참조한 페이지가 물리 메모리에 없을 때 발생하며, OS가 디스크에서 해당 페이지를 적재합니다.',
      en: 'A page fault occurs when a referenced page is not in RAM, prompting the OS to load it from disk.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'os-20',
    category: QuizCategory.OS,
    prompt: {
      ko: '가장 오래 전에 사용된 페이지를 먼저 교체하는 페이지 교체 알고리즘은?',
      en: 'Which page replacement algorithm evicts the page that was used least recently?',
    },
    acceptedAnswers: ['LRU', 'least recently used', '엘알유'],
    explanation: {
      ko: 'LRU(Least Recently Used)는 가장 오랫동안 참조되지 않은 페이지를 교체 대상으로 선택합니다.',
      en: 'LRU (Least Recently Used) evicts the page that has not been referenced for the longest time.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'os-21',
    category: QuizCategory.OS,
    prompt: {
      ko: '앞으로 가장 오랫동안 사용되지 않을 페이지를 교체하여 페이지 폴트를 최소화하는 이론상 최적 알고리즘은?',
      en: 'Which theoretically optimal algorithm replaces the page not needed for the longest future time?',
    },
    acceptedAnswers: ['optimal', '최적페이지교체', '최적 알고리즘', 'opt', 'belady optimal'],
    explanation: {
      ko: 'Optimal(OPT) 알고리즘은 미래에 가장 늦게 사용될 페이지를 교체해 페이지 폴트를 최소화하나, 미래 참조를 알 수 없어 실제로는 구현이 불가능한 이론적 기준입니다.',
      en: 'The Optimal (OPT) algorithm evicts the page used farthest in the future, minimizing faults, but is impractical since future references are unknown.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'os-22',
    category: QuizCategory.OS,
    prompt: {
      ko: '과도한 페이지 교체로 CPU가 실제 작업보다 페이징에 더 많은 시간을 쓰는 현상은?',
      en: 'What phenomenon has the CPU spending more time paging than doing useful work due to excessive page swaps?',
    },
    acceptedAnswers: ['스래싱', '스레싱', '쓰래싱', 'thrashing'],
    explanation: {
      ko: '스래싱은 다중 프로그래밍 정도가 지나쳐 페이지 폴트가 폭증, CPU가 페이징에만 매달려 처리율이 급락하는 현상입니다.',
      en: 'Thrashing occurs when excessive page faults cause the CPU to spend most time swapping, collapsing throughput.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'os-23',
    category: QuizCategory.OS,
    prompt: {
      ko: '가상 주소를 물리 주소로 변환하는 페이지 테이블 항목을 캐싱해 변환 속도를 높이는 하드웨어 캐시는?',
      en: 'Which hardware cache stores recent page-table entries to speed up virtual-to-physical address translation?',
    },
    acceptedAnswers: ['TLB', 'translation lookaside buffer', '변환색인버퍼'],
    explanation: {
      ko: 'TLB(Translation Lookaside Buffer)는 최근 사용한 페이지 테이블 항목을 캐싱해 주소 변환 시 페이지 테이블 접근을 줄입니다.',
      en: 'The TLB (Translation Lookaside Buffer) caches recent page-table entries to reduce page-table lookups during translation.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'os-24',
    category: QuizCategory.OS,
    prompt: {
      ko: '최근 참조한 데이터/주변 데이터가 다시 참조될 가능성이 높다는, 캐시 효율의 근거가 되는 성질은?',
      en: 'Which property—recently or nearby referenced data is likely reused—underlies cache effectiveness?',
    },
    acceptedAnswers: ['지역성', '참조지역성', '참조 지역성', 'locality', 'locality of reference'],
    explanation: {
      ko: '지역성은 시간 지역성(최근 참조 재참조)과 공간 지역성(인접 주소 참조)으로 나뉘며, 캐시·페이징 성능의 이론적 근거입니다.',
      en: 'Locality includes temporal (recently used reused) and spatial (nearby addresses) locality, underpinning cache and paging efficiency.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'os-25',
    category: QuizCategory.OS,
    prompt: {
      ko: '사용자 프로그램이 커널의 서비스(파일 입출력 등)를 요청하기 위해 호출하는 인터페이스는?',
      en: 'Which interface does a user program invoke to request kernel services such as file I/O?',
    },
    acceptedAnswers: ['시스템콜', '시스템 콜', '시스템호출', 'system call', 'syscall'],
    explanation: {
      ko: '시스템 콜은 사용자 모드 프로그램이 커널 모드의 기능(파일·프로세스·네트워크 등)을 요청하는 인터페이스입니다.',
      en: 'A system call is the interface a user-mode program uses to request kernel-mode services.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'os-26',
    category: QuizCategory.OS,
    prompt: {
      ko: 'CPU 사용 권한을 특권 모드(커널)와 비특권 모드(사용자)로 나눌 때, 사용자 프로그램이 동작하는 모드는?',
      en: 'When CPU privilege is split into kernel and user modes, in which mode do user programs run?',
    },
    acceptedAnswers: ['유저모드', '사용자모드', '사용자 모드', 'user mode', 'usermode'],
    explanation: {
      ko: '사용자 모드(user mode)는 권한이 제한된 모드로, 하드웨어 직접 접근이 필요하면 시스템 콜로 커널 모드로 전환합니다.',
      en: 'User mode is the restricted mode; hardware access requires switching to kernel mode via a system call.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'os-27',
    category: QuizCategory.OS,
    prompt: {
      ko: '하드웨어나 소프트웨어가 CPU에 비동기적으로 처리를 요청해 현재 실행 흐름을 중단시키는 신호는?',
      en: 'Which signal lets hardware or software asynchronously request CPU attention, halting current execution?',
    },
    acceptedAnswers: ['인터럽트', 'interrupt'],
    explanation: {
      ko: '인터럽트는 입출력 완료·타이머 등 이벤트가 CPU에 비동기로 신호를 보내 현재 작업을 멈추고 핸들러를 실행하게 합니다.',
      en: 'An interrupt asynchronously signals the CPU (e.g., I/O completion, timer) to pause and run a handler.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'os-28',
    category: QuizCategory.OS,
    prompt: {
      ko: 'CPU를 거치지 않고 입출력 장치가 메모리에 직접 데이터를 전송하게 하는 기술은? (약어)',
      en: 'Which technique lets I/O devices transfer data directly to memory without the CPU? (acronym)',
    },
    acceptedAnswers: ['DMA', 'direct memory access', '직접메모리접근'],
    explanation: {
      ko: 'DMA(Direct Memory Access)는 DMA 컨트롤러가 CPU 개입 없이 장치와 메모리 간 데이터를 직접 전송해 CPU 부담을 줄입니다.',
      en: 'DMA (Direct Memory Access) lets a controller move data between devices and memory without CPU intervention.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'os-29',
    category: QuizCategory.OS,
    prompt: {
      ko: '실행을 마쳤지만 부모 프로세스가 아직 종료 상태를 회수(wait)하지 않아 PCB만 남은 프로세스는?',
      en: 'Which process has finished but remains as a PCB because the parent has not yet reaped its exit status?',
    },
    acceptedAnswers: ['좀비프로세스', '좀비 프로세스', '좀비', 'zombie', 'zombie process', 'defunct'],
    explanation: {
      ko: '좀비 프로세스는 종료됐지만 부모가 wait()로 종료 상태를 수거하지 않아 프로세스 테이블에 항목(PCB)만 남은 상태입니다.',
      en: 'A zombie process has terminated but its PCB lingers because the parent has not called wait() to reap it.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'os-30',
    category: QuizCategory.OS,
    prompt: {
      ko: '유닉스 계열에서 호출한 프로세스를 복제해 새로운 자식 프로세스를 생성하는 시스템 콜은?',
      en: 'Which Unix system call creates a new child process by duplicating the calling process?',
    },
    acceptedAnswers: ['fork', 'fork()', '포크'],
    explanation: {
      ko: 'fork()는 호출한 프로세스를 복제하여 자식 프로세스를 만들며, 자식에는 0, 부모에는 자식 PID를 반환합니다.',
      en: 'fork() duplicates the calling process to create a child, returning 0 to the child and the child’s PID to the parent.',
    },
    difficulty: 'EASY',
  },
];
