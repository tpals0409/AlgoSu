/**
 * @file crawler.service.spec.ts — CrawlerService 단위 테스트
 * @domain problem
 * @layer test
 * @related crawler.service.ts
 */
import { Test, TestingModule } from '@nestjs/testing';
import { CrawlerService } from './crawler.service';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const makeLogger = () =>
  ({ setContext: jest.fn(), log: jest.fn(), warn: jest.fn(), error: jest.fn() } as unknown as StructuredLoggerService);

describe('CrawlerService', () => {
  let service: CrawlerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CrawlerService, { provide: StructuredLoggerService, useValue: makeLogger() }],
    }).compile();

    service = module.get<CrawlerService>(CrawlerService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('crawl', () => {
    it('지원하지 않는 플랫폼(BOJ)이면 null 반환', async () => {
      const result = await service.crawl('https://www.acmicpc.net/problem/1000', 'BOJ');
      expect(result).toBeNull();
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('Programmers URL — title·description 정상 파싱', async () => {
      const html = `
        <html><body>
          <h1 class="challenge-title">두 수의 합</h1>
          <div class="markdown"><p>두 정수 a, b가 주어집니다.</p><h5>제한사항</h5><ul><li>a &lt;= 100</li></ul></div>
        </body></html>`;
      mockedAxios.get = jest.fn().mockResolvedValue({ data: html });

      const result = await service.crawl('https://school.programmers.co.kr/learn/courses/30/lessons/12345', 'PROGRAMMERS');

      expect(result).not.toBeNull();
      expect(result!.title).toBe('두 수의 합');
      expect(result!.description).toContain('두 정수 a, b가 주어집니다');
    });

    it('Programmers URL — title만 있고 markdown 없으면 description null', async () => {
      const html = `<html><body><h1 class="challenge-title">문제</h1></body></html>`;
      mockedAxios.get = jest.fn().mockResolvedValue({ data: html });

      const result = await service.crawl('https://school.programmers.co.kr/learn/courses/30/lessons/99999', 'PROGRAMMERS');

      expect(result!.title).toBe('문제');
      expect(result!.description).toBeNull();
    });

    it('axios 오류 발생 시 null 반환 (warn 로그)', async () => {
      mockedAxios.get = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await service.crawl('https://school.programmers.co.kr/learn/courses/30/lessons/1', 'PROGRAMMERS');

      expect(result).toBeNull();
    });

    it('Error 인스턴스 아닌 예외(문자열) 발생 시 null 반환 — String() 변환 분기', async () => {
      mockedAxios.get = jest.fn().mockRejectedValue('non-error-string');

      const result = await service.crawl('https://school.programmers.co.kr/learn/courses/30/lessons/3', 'PROGRAMMERS');

      expect(result).toBeNull();
    });

    it('빈 title·description — null로 정규화', async () => {
      const html = `<html><body><h1 class="challenge-title">  </h1></body></html>`;
      mockedAxios.get = jest.fn().mockResolvedValue({ data: html });

      const result = await service.crawl('https://school.programmers.co.kr/learn/courses/30/lessons/2', 'PROGRAMMERS');

      expect(result!.title).toBeNull();
      expect(result!.description).toBeNull();
    });
  });
});
