/**
 * @file 컴퓨터구조(Computer Architecture) 분야 CS 퀴즈 문항 (20문항)
 * @domain quiz
 * @layer data
 * @related src/data/quiz/types.ts, src/data/quiz/index.ts
 */
import { QuizCategory, type QuizQuestion } from './types';

/** 컴퓨터구조(Computer Architecture) 분야 단답형 문항 목록. */
export const COMPUTER_ARCHITECTURE_QUESTIONS: readonly QuizQuestion[] = [
  {
    id: 'arch-01',
    category: QuizCategory.COMPUTER_ARCHITECTURE,
    prompt: {
      ko: '프로그램 내장 방식을 채택하여 CPU·메모리·입출력 장치를 버스로 연결하는 컴퓨터 구조 모델은?',
      en: 'Which computer architecture model uses a stored-program concept with CPU, memory, and I/O connected by a bus?',
    },
    acceptedAnswers: ['폰노이만', '폰 노이만', 'von neumann', 'vonneumann', '폰노이만구조', 'von neumann architecture'],
    explanation: {
      ko: '폰노이만 구조는 프로그램을 메모리에 저장하고 CPU가 명령어를 순차적으로 읽어 실행하는 프로그램 내장 방식 모델입니다.',
      en: 'The von Neumann architecture stores programs in memory and has the CPU sequentially fetch and execute instructions.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'arch-02',
    category: QuizCategory.COMPUTER_ARCHITECTURE,
    prompt: {
      ko: 'CPU에서 실제 산술·논리 연산을 수행하는 회로 장치는?',
      en: 'Which CPU unit performs arithmetic and logical operations?',
    },
    acceptedAnswers: ['ALU', '산술논리연산장치', '산술 논리 연산 장치', 'arithmetic logic unit'],
    explanation: {
      ko: 'ALU(Arithmetic Logic Unit)는 덧셈·뺄셈 같은 산술 연산과 AND·OR 같은 논리 연산을 직접 수행하는 회로입니다.',
      en: 'The ALU (Arithmetic Logic Unit) executes arithmetic operations like addition and logical operations like AND/OR.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'arch-03',
    category: QuizCategory.COMPUTER_ARCHITECTURE,
    prompt: {
      ko: '다음에 실행할 명령어의 메모리 주소를 항상 가리키는 CPU 레지스터는?',
      en: 'Which CPU register always points to the address of the next instruction to be executed?',
    },
    acceptedAnswers: ['PC', '프로그램카운터', '프로그램 카운터', 'program counter'],
    explanation: {
      ko: 'PC(Program Counter)는 다음 실행할 명령어의 메모리 주소를 저장하며, 명령어를 페치할 때마다 증가합니다.',
      en: 'The PC (Program Counter) holds the address of the next instruction and increments after each fetch.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'arch-04',
    category: QuizCategory.COMPUTER_ARCHITECTURE,
    prompt: {
      ko: '명령어 사이클에서 메모리에서 명령어를 읽어 CPU로 가져오는 단계를 무엇이라 하는가?',
      en: 'What is the instruction cycle stage where an instruction is read from memory into the CPU?',
    },
    acceptedAnswers: ['인출', 'fetch', '명령어 인출', '페치'],
    explanation: {
      ko: 'Fetch 단계에서는 PC가 가리키는 주소의 명령어를 메모리에서 읽어 IR(명령어 레지스터)에 저장합니다.',
      en: 'In the Fetch stage, the instruction at the address in the PC is read from memory into the IR (Instruction Register).',
    },
    difficulty: 'EASY',
  },
  {
    id: 'arch-05',
    category: QuizCategory.COMPUTER_ARCHITECTURE,
    prompt: {
      ko: '여러 명령어를 단계별로 겹쳐 실행해 처리량(throughput)을 높이는 CPU 기법은?',
      en: 'Which CPU technique overlaps multiple instruction stages to increase throughput?',
    },
    acceptedAnswers: ['파이프라이닝', '파이프라인', 'pipelining', 'pipeline'],
    explanation: {
      ko: '파이프라이닝은 명령어를 Fetch·Decode·Execute 등 단계로 분리하여 여러 명령어를 동시에 처리함으로써 처리량을 높입니다.',
      en: 'Pipelining splits instruction execution into stages (Fetch, Decode, Execute, etc.) and overlaps them to increase throughput.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'arch-06',
    category: QuizCategory.COMPUTER_ARCHITECTURE,
    prompt: {
      ko: 'CPU와 주기억장치 사이에 위치하며, 자주 접근하는 데이터를 빠르게 제공하는 고속 소용량 메모리는?',
      en: 'What small, fast memory sits between the CPU and main memory to provide frequently accessed data quickly?',
    },
    acceptedAnswers: ['캐시', '캐시 메모리', 'cache', 'cache memory'],
    explanation: {
      ko: '캐시 메모리는 CPU와 주기억장치의 속도 차이를 완충하기 위해 자주 쓰는 데이터를 고속 SRAM에 저장합니다.',
      en: 'Cache memory uses fast SRAM to bridge the speed gap between the CPU and main memory by storing frequently used data.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'arch-07',
    category: QuizCategory.COMPUTER_ARCHITECTURE,
    prompt: {
      ko: 'CPU가 메모리에 접근하지 않고 직접 데이터를 저장·조작하는 가장 빠른 임시 저장 공간은?',
      en: 'What is the fastest temporary storage inside the CPU that holds data without accessing main memory?',
    },
    acceptedAnswers: ['레지스터', 'register', '레지스터 파일'],
    explanation: {
      ko: '레지스터는 CPU 내부에 위치하는 가장 빠른 저장 공간으로, 연산에 필요한 데이터와 주소를 임시 저장합니다.',
      en: 'Registers are the fastest storage inside the CPU, temporarily holding data and addresses needed for operations.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'arch-08',
    category: QuizCategory.COMPUTER_ARCHITECTURE,
    prompt: {
      ko: '파이프라인에서 이전 명령어의 결과를 다음 명령어가 아직 받지 못해 지연이 발생하는 해저드 유형은?',
      en: 'Which pipeline hazard occurs when an instruction depends on the result of a previous instruction not yet available?',
    },
    acceptedAnswers: ['데이터 해저드', '데이터해저드', 'data hazard', 'datahazard', '데이터 위험'],
    explanation: {
      ko: '데이터 해저드는 앞 명령어의 결과가 준비되기 전에 뒤 명령어가 해당 값을 읽으려 할 때 발생하며, 포워딩이나 스톨로 해결합니다.',
      en: 'A data hazard occurs when an instruction tries to use a result not yet produced; it is resolved by forwarding or stalling.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'arch-09',
    category: QuizCategory.COMPUTER_ARCHITECTURE,
    prompt: {
      ko: '최근에 사용한 데이터가 가까운 미래에 다시 사용될 가능성이 높다는 캐시 지역성의 유형은?',
      en: 'Which type of cache locality states that recently used data is likely to be used again soon?',
    },
    acceptedAnswers: ['시간적 지역성', 'temporal locality', '시간지역성', 'temporal'],
    explanation: {
      ko: '시간적 지역성은 최근 접근한 데이터일수록 재접근 가능성이 높다는 원리로, 캐시 히트율을 높이는 근거가 됩니다.',
      en: 'Temporal locality means recently accessed data is likely to be accessed again, forming the basis for high cache hit rates.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'arch-10',
    category: QuizCategory.COMPUTER_ARCHITECTURE,
    prompt: {
      ko: '각 캐시 라인이 메모리 주소에 따라 정해진 한 슬롯에만 매핑되는 캐시 구조 방식은?',
      en: 'Which cache mapping scheme maps each memory block to exactly one cache line determined by its address?',
    },
    acceptedAnswers: ['직접 매핑', '직접매핑', 'direct mapping', 'directmapping', 'direct mapped'],
    explanation: {
      ko: '직접 매핑은 메모리 블록을 주소의 하위 비트로 결정된 특정 캐시 라인에만 배치하여 구현이 단순하지만 충돌 미스가 발생할 수 있습니다.',
      en: 'Direct mapping places each memory block into one specific cache line determined by the address, simple to implement but prone to conflict misses.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'arch-11',
    category: QuizCategory.COMPUTER_ARCHITECTURE,
    prompt: {
      ko: 'RISC 아키텍처에서 메모리 접근을 Load/Store 명령어로만 제한하는 설계 원칙을 무엇이라 하는가?',
      en: 'What RISC design principle restricts memory access to only Load and Store instructions?',
    },
    acceptedAnswers: ['load store 아키텍처', 'load store architecture', '로드 스토어', 'loadstore', 'load/store'],
    explanation: {
      ko: 'RISC의 Load/Store 아키텍처는 메모리 접근을 두 명령어로 제한하여 나머지 명령어가 레지스터만 사용하게 해 파이프라인 설계를 단순화합니다.',
      en: 'RISC load/store architecture limits memory access to two instructions, so all others operate on registers, simplifying pipeline design.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'arch-12',
    category: QuizCategory.COMPUTER_ARCHITECTURE,
    prompt: {
      ko: '가상 주소를 물리 주소로 변환하는 하드웨어 장치로, MMU 내에서 페이지 테이블 항목을 빠르게 캐시하는 구조는?',
      en: 'Which hardware structure caches page table entries inside the MMU to speed up virtual-to-physical address translation?',
    },
    acceptedAnswers: ['TLB', '변환 색인 버퍼', '변환색인버퍼', 'translation lookaside buffer'],
    explanation: {
      ko: 'TLB(Translation Lookaside Buffer)는 최근 사용된 페이지 테이블 항목을 캐시하여 주소 변환 시 메모리 접근을 줄이고 속도를 높입니다.',
      en: 'The TLB (Translation Lookaside Buffer) caches recent page table entries to reduce memory accesses during address translation.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'arch-13',
    category: QuizCategory.COMPUTER_ARCHITECTURE,
    prompt: {
      ko: '음수를 표현하기 위해 양수의 비트를 모두 반전한 뒤 1을 더하는 이진수 표현 방식은?',
      en: 'Which binary representation method inverts all bits of a positive number and adds 1 to represent its negative?',
    },
    acceptedAnswers: ['2의 보수', '2의보수', 'twos complement', "two's complement", '이의 보수'],
    explanation: {
      ko: "2의 보수 표현은 음수를 비트 반전+1로 구하며, 가산기 하나로 덧셈·뺄셈을 모두 처리할 수 있어 현대 CPU의 표준 정수 표현입니다.",
      en: "Two's complement represents negatives by inverting bits and adding 1, allowing a single adder to handle both addition and subtraction.",
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'arch-14',
    category: QuizCategory.COMPUTER_ARCHITECTURE,
    prompt: {
      ko: 'CPU가 I/O 장치의 완료를 기다리는 동안 루프를 돌며 상태를 반복 확인하는 I/O 방식은?',
      en: 'Which I/O method has the CPU repeatedly check device status in a loop while waiting for completion?',
    },
    acceptedAnswers: ['폴링', 'polling', '바쁜 대기', 'busy wait', 'busy waiting'],
    explanation: {
      ko: '폴링(Polling)은 CPU가 I/O 장치 상태를 반복 확인하여 완료를 감지하지만, CPU 자원을 낭비하는 단점이 있습니다.',
      en: 'Polling has the CPU loop-check device status to detect completion, but wastes CPU cycles compared to interrupts.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'arch-15',
    category: QuizCategory.COMPUTER_ARCHITECTURE,
    prompt: {
      ko: 'CPU 개입 없이 주변장치와 메모리 간 데이터를 직접 전송하는 I/O 방식은?',
      en: 'Which I/O technique transfers data directly between peripherals and memory without CPU intervention?',
    },
    acceptedAnswers: ['DMA', '직접 메모리 접근', '직접메모리접근', 'direct memory access'],
    explanation: {
      ko: 'DMA(Direct Memory Access)는 전용 컨트롤러가 CPU 대신 메모리와 I/O 장치 간 데이터를 전송하여 CPU를 다른 작업에 쓸 수 있게 합니다.',
      en: 'DMA uses a dedicated controller to transfer data between I/O devices and memory, freeing the CPU for other tasks.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'arch-16',
    category: QuizCategory.COMPUTER_ARCHITECTURE,
    prompt: {
      ko: 'IEEE 754 단정밀도 부동소수점에서 지수(exponent) 필드의 비트 수는?',
      en: 'How many bits does the exponent field occupy in an IEEE 754 single-precision floating-point number?',
    },
    acceptedAnswers: ['8', '8비트', '8 bits'],
    explanation: {
      ko: 'IEEE 754 단정밀도(32비트)는 부호 1비트, 지수 8비트, 가수 23비트로 구성됩니다.',
      en: 'IEEE 754 single-precision (32-bit) consists of 1 sign bit, 8 exponent bits, and 23 mantissa bits.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'arch-17',
    category: QuizCategory.COMPUTER_ARCHITECTURE,
    prompt: {
      ko: '멀티바이트 데이터를 저장할 때 가장 낮은 주소에 최상위 바이트(MSB)를 먼저 저장하는 방식은?',
      en: 'Which byte order stores the most significant byte (MSB) at the lowest memory address?',
    },
    acceptedAnswers: ['빅 엔디안', '빅엔디안', 'big endian', 'bigendian', 'big-endian'],
    explanation: {
      ko: '빅 엔디안(Big-Endian)은 사람이 수를 읽는 순서와 같이 최상위 바이트를 낮은 주소에 저장하며, 네트워크 바이트 순서로 사용됩니다.',
      en: 'Big-endian stores the most significant byte at the lowest address, matching human-readable order and used as network byte order.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'arch-18',
    category: QuizCategory.COMPUTER_ARCHITECTURE,
    prompt: {
      ko: '하나의 프로세서 코어가 두 개의 스레드를 동시에 실행하여 파이프라인 자원을 최대 활용하는 기술은?',
      en: 'Which technology allows a single processor core to execute two threads simultaneously to maximize pipeline utilization?',
    },
    acceptedAnswers: ['하이퍼스레딩', '하이퍼 스레딩', 'hyperthreading', 'hyper threading', 'simultaneous multithreading', 'SMT'],
    explanation: {
      ko: '하이퍼스레딩(SMT)은 하나의 물리 코어가 레지스터 집합을 복수로 두어 두 스레드를 동시에 실행함으로써 유휴 실행 유닛을 채웁니다.',
      en: 'Hyperthreading (SMT) duplicates register sets so one physical core runs two threads simultaneously, filling otherwise idle execution units.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'arch-19',
    category: QuizCategory.COMPUTER_ARCHITECTURE,
    prompt: {
      ko: '분기 명령어의 결과를 미리 추정하여 파이프라인을 계속 채워두는 CPU 기법은?',
      en: 'Which CPU technique predicts the outcome of a branch instruction to keep the pipeline continuously filled?',
    },
    acceptedAnswers: ['분기 예측', '분기예측', 'branch prediction', 'branchprediction'],
    explanation: {
      ko: '분기 예측은 조건 분기의 방향을 사전에 예측하여 파이프라인 지연(버블)을 최소화하고, 예측 실패 시 파이프라인을 플러시합니다.',
      en: 'Branch prediction forecasts the direction of conditional branches to minimize pipeline stalls; a misprediction causes a pipeline flush.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'arch-20',
    category: QuizCategory.COMPUTER_ARCHITECTURE,
    prompt: {
      ko: '하나의 CPU가 여러 실행 유닛을 통해 클럭 사이클당 두 개 이상의 명령어를 동시에 발행(issue)할 수 있는 마이크로아키텍처는?',
      en: 'Which microarchitecture can issue more than one instruction per clock cycle using multiple execution units?',
    },
    acceptedAnswers: ['슈퍼스칼라', 'superscalar', '슈퍼 스칼라'],
    explanation: {
      ko: '슈퍼스칼라 프로세서는 다수의 실행 유닛을 갖추어 독립적인 명령어를 같은 사이클에 병렬 발행·실행하여 IPC(사이클당 명령어 수)를 높입니다.',
      en: 'A superscalar processor issues multiple independent instructions in the same cycle across multiple execution units, increasing IPC.',
    },
    difficulty: 'HARD',
  },
];
