/**
 * @file programmers.service.spec.ts — ProgrammersService 단위 테스트
 * @domain problem
 * @layer service
 *
 * JSON fixture 를 직접 주입하여 fs.readFileSync 의존 없이 테스트한다.
 * loadFromFile() 을 stub 경로로 호출하되, readFileSync 를 jest.mock 으로 대체.
 */
import { NotFoundException } from '@nestjs/common';
import { ProgrammersService } from './programmers.service';

// readFileSync 모킹 — 실제 파일시스템 접근 방지
const mockReadFileSync = jest.fn<string, [string, string]>();

jest.mock('node:fs', () => ({
  readFileSync: (...args: [string, string]) => mockReadFileSync(...args),
}));

// ─── Fixture ──────────────────────────────────────────────────────────────────

const FIXTURE_ITEMS = [
  {
    problemId: 42840,
    title: '모의고사',
    level: 1,
    tags: ['완전탐색'],
    sourceUrl: 'https://school.programmers.co.kr/learn/courses/30/lessons/42840',
  },
  {
    problemId: 42586,
    title: '기능개발',
    level: 2,
    tags: ['스택/큐'],
    sourceUrl: 'https://school.programmers.co.kr/learn/courses/30/lessons/42586',
  },
  {
    problemId: 43162,
    title: '네트워크',
    level: 3,
    tags: ['깊이/너비 우선 탐색(DFS/BFS)'],
    sourceUrl: 'https://school.programmers.co.kr/learn/courses/30/lessons/43162',
  },
  {
    problemId: 49191,
    title: '순위',
    level: 4,
    tags: ['그래프'],
    sourceUrl: 'https://school.programmers.co.kr/learn/courses/30/lessons/49191',
  },
  {
    problemId: 42895,
    title: 'N으로 표현',
    level: 5,
    tags: ['동적계획법(Dynamic Programming)'],
    sourceUrl: 'https://school.programmers.co.kr/learn/courses/30/lessons/42895',
  },
  // Sprint 97 tags 보강 회귀용 — 실제 크롤링 결과(해시) 반영
  {
    problemId: 1845,
    title: '폰켓몬',
    level: 1,
    tags: ['해시'],
    sourceUrl: 'https://school.programmers.co.kr/learn/courses/30/lessons/1845',
  },
];

const FIXTURE_JSON = JSON.stringify(FIXTURE_ITEMS);

// ─── Helper ───────────────────────────────────────────────────────────────────

function makeService(): ProgrammersService {
  const mockLogger = {
    setContext: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
  const svc = new ProgrammersService(mockLogger as never);
  // fixture JSON 주입
  mockReadFileSync.mockReturnValue(FIXTURE_JSON);
  svc.loadFromFile('/fake/programmers-problems.json');
  return svc;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ProgrammersService', () => {
  let service: ProgrammersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = makeService();
  });

  // ── loadFromFile ────────────────────────────────────────────────────────────

  describe('loadFromFile', () => {
    it('정상 JSON — 캐시에 문제 수 반영', () => {
      // service 이미 fixture 로드됨 — fetchProblem 으로 검증
      const result = service.fetchProblem(42840);
      expect(result.title).toBe('모의고사');
    });

    it('봉투 형식 { version, items } — isDataEnvelope true 분기 캐시 로드 성공', () => {
      // isDataEnvelope(parsed) === true 분기 커버
      const mockLogger = {
        setContext: jest.fn(),
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };
      const svc = new ProgrammersService(mockLogger as never);
      const envelope = { version: '2024-01-01', items: FIXTURE_ITEMS };
      mockReadFileSync.mockReturnValue(JSON.stringify(envelope));

      svc.loadFromFile('/envelope.json');

      const result = svc.fetchProblem(42840);
      expect(result.title).toBe('모의고사');
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('로드 완료'),
      );
    });

    it('파일 읽기 실패 — 경고만 남기고 예외 미전파 (빈 캐시)', () => {
      const mockLogger = {
        setContext: jest.fn(),
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };
      const svc = new ProgrammersService(mockLogger as never);
      mockReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });

      expect(() => svc.loadFromFile('/missing.json')).not.toThrow();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('ENOENT'),
      );
    });

    it('잘못된 JSON — 경고만 남기고 예외 미전파', () => {
      const mockLogger = {
        setContext: jest.fn(),
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };
      const svc = new ProgrammersService(mockLogger as never);
      mockReadFileSync.mockReturnValue('{invalid json}');

      expect(() => svc.loadFromFile('/bad.json')).not.toThrow();
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  // ── onApplicationBootstrap ──────────────────────────────────────────────────

  describe('onApplicationBootstrap', () => {
    it('부트스트랩 시 loadFromFile 호출 — lines 126-127 커버', () => {
      // onApplicationBootstrap() 미호출로 인한 line 126-127 미커버 해소
      const mockLogger = {
        setContext: jest.fn(),
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };
      const svc = new ProgrammersService(mockLogger as never);
      // readFileSync 는 이미 전역 mock — fixture JSON 반환
      mockReadFileSync.mockReturnValue(FIXTURE_JSON);

      expect(() => svc.onApplicationBootstrap()).not.toThrow();
      // readFileSync 가 __dirname 기반 경로로 호출됐는지 확인
      expect(mockReadFileSync).toHaveBeenCalled();
      // 로드 후 캐시에서 조회 가능
      expect(svc.fetchProblem(42840).title).toBe('모의고사');
    });

    it('부트스트랩 시 JSON 없음 — 경고 로그 후 빈 캐시로 기동 허용', () => {
      const mockLogger = {
        setContext: jest.fn(),
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };
      const svc = new ProgrammersService(mockLogger as never);
      mockReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT: no such file');
      });

      expect(() => svc.onApplicationBootstrap()).not.toThrow();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('ENOENT'),
      );
    });
  });

  // ── fetchProblem ────────────────────────────────────────────────────────────

  describe('fetchProblem', () => {
    it('존재하는 ID — 정보 반환', () => {
      const result = service.fetchProblem(42840);
      expect(result).toEqual({
        problemId: 42840,
        title: '모의고사',
        level: 1,
        difficulty: 'BRONZE',
        tags: ['완전탐색'],
        sourceUrl: 'https://school.programmers.co.kr/learn/courses/30/lessons/42840',
      });
    });

    it('존재하지 않는 ID — NotFoundException', () => {
      expect(() => service.fetchProblem(99999)).toThrow(NotFoundException);
    });

    it('존재하지 않는 ID — 메시지에 문제 번호 포함', () => {
      expect(() => service.fetchProblem(99999)).toThrow('99999');
    });

    // Sprint 97 tags 보강 회귀 — 실제 크롤링 완료 후 tags 비어있지 않음 보장
    it('fetchProblem(1845) — tags.length >= 1 (Sprint 97 tags 보강 회귀)', () => {
      const result = service.fetchProblem(1845);
      expect(result.tags.length).toBeGreaterThanOrEqual(1);
      expect(result.tags[0]).toBe('해시');
    });

    // 레벨 → 난이도 매핑 전체 검증
    it.each([
      [42840, 'BRONZE'],   // Lv.1
      [42586, 'SILVER'],   // Lv.2
      [43162, 'GOLD'],     // Lv.3
      [49191, 'PLATINUM'], // Lv.4
      [42895, 'DIAMOND'],  // Lv.5
    ])('problemId %i → difficulty %s', (id, expected) => {
      expect(service.fetchProblem(id).difficulty).toBe(expected);
    });

    it('level=0 문제 — difficulty null 반환 (levelToDifficulty ?? null 분기)', () => {
      // levelToDifficulty의 `?? null` null 분기 커버 (level 0 = 미분류)
      const mockLogger = {
        setContext: jest.fn(),
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };
      const svc = new ProgrammersService(mockLogger as never);
      const zeroLevelItems = [
        {
          problemId: 99001,
          title: 'PCCP 미분류',
          level: 0,
          tags: ['구현'],
          sourceUrl: 'https://school.programmers.co.kr/learn/courses/30/lessons/99001',
        },
      ];
      mockReadFileSync.mockReturnValue(JSON.stringify(zeroLevelItems));
      svc.loadFromFile('/zero-level.json');

      const result = svc.fetchProblem(99001);
      expect(result.difficulty).toBeNull();
      expect(result.level).toBe(0);
    });
  });

  // ── searchProblem ───────────────────────────────────────────────────────────

  describe('searchProblem', () => {
    it('제목 키워드 매칭 — 결과 반환', () => {
      const result = service.searchProblem('모의고사');
      expect(result.count).toBe(1);
      expect(result.items[0].problemId).toBe(42840);
    });

    it('태그 키워드 매칭', () => {
      const result = service.searchProblem('스택');
      expect(result.count).toBe(1);
      expect(result.items[0].problemId).toBe(42586);
    });

    it('대소문자 무시 매칭', () => {
      const result = service.searchProblem('DFS');
      expect(result.count).toBe(1);
      expect(result.items[0].problemId).toBe(43162);
    });

    it('매칭 없는 쿼리 — 빈 결과 반환', () => {
      const result = service.searchProblem('존재하지않는문제XYZ');
      expect(result.count).toBe(0);
      expect(result.items).toHaveLength(0);
    });

    it('기본 page=1 정상 작동', () => {
      const result = service.searchProblem('개');
      expect(result.count).toBeGreaterThan(0);
    });

    it('페이지네이션 — page 2 는 10건 초과분 반환', () => {
      // fixture 6건이므로 page=2 → 빈 결과 (Sprint 97: 폰켓몬 항목 추가로 5→6)
      const result = service.searchProblem('', 2);
      // 빈 query 는 전체 매칭 → 6건, page2 offset=10 → 0건
      expect(result.items).toHaveLength(0);
      expect(result.count).toBe(6);
    });

    it('page=1 — 전체 10건 이하면 전부 반환', () => {
      // 빈 query → 전체 6건 매칭 (Sprint 97: 폰켓몬 항목 추가로 5→6)
      const result = service.searchProblem('');
      expect(result.count).toBe(6);
      expect(result.items).toHaveLength(6);
    });

    it('반환 항목 구조 검증', () => {
      const result = service.searchProblem('모의고사');
      const item = result.items[0];
      expect(item).toHaveProperty('problemId');
      expect(item).toHaveProperty('title');
      expect(item).toHaveProperty('level');
      expect(item).toHaveProperty('difficulty');
      expect(item).toHaveProperty('sourceUrl');
      expect(item).toHaveProperty('tags');
    });
  });
});
