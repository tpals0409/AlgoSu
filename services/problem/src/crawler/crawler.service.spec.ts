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

    it('SSRF — 비허용 호스트(internal IP)면 null 반환', async () => {
      const result = await service.crawl('https://169.254.169.254/latest/meta-data', 'PROGRAMMERS');
      expect(result).toBeNull();
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('SSRF — http:// 비허용 (https만 허용)', async () => {
      const result = await service.crawl('http://school.programmers.co.kr/learn/courses/30/lessons/1', 'PROGRAMMERS');
      expect(result).toBeNull();
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('SSRF — 유효하지 않은 URL이면 null 반환', async () => {
      const result = await service.crawl('not-a-url', 'PROGRAMMERS');
      expect(result).toBeNull();
    });

    it('빈 title·description — null로 정규화', async () => {
      const html = `<html><body><h1 class="challenge-title">  </h1></body></html>`;
      mockedAxios.get = jest.fn().mockResolvedValue({ data: html });

      const result = await service.crawl('https://school.programmers.co.kr/learn/courses/30/lessons/2', 'PROGRAMMERS');

      expect(result!.title).toBeNull();
      expect(result!.description).toBeNull();
    });

    it('Wave D — constraints: h5[제한사항] + ul/li 파싱', async () => {
      const html = `
        <html><body>
          <h1 class="challenge-title">테스트 문제</h1>
          <div class="markdown">
            <p>문제 설명</p>
            <h5>제한사항</h5>
            <ul><li>1 &lt;= n &lt;= 100</li><li>n은 자연수</li></ul>
          </div>
        </body></html>`;
      mockedAxios.get = jest.fn().mockResolvedValue({ data: html });

      const result = await service.crawl('https://school.programmers.co.kr/learn/courses/30/lessons/10001', 'PROGRAMMERS');

      expect(result).not.toBeNull();
      expect(result!.constraints).toContain('1 <= n <= 100');
      expect(result!.constraints).toContain('n은 자연수');
    });

    it('Wave D — constraints: h5[constraint] 영문 헤더도 파싱', async () => {
      const html = `
        <html><body>
          <div class="markdown">
            <h5>constraint</h5>
            <ul><li>0 &lt;= k &lt;= 50</li></ul>
          </div>
        </body></html>`;
      mockedAxios.get = jest.fn().mockResolvedValue({ data: html });

      const result = await service.crawl('https://school.programmers.co.kr/learn/courses/30/lessons/10002', 'PROGRAMMERS');

      expect(result!.constraints).toBe('0 <= k <= 50');
    });

    it('Wave D — constraints: h5 없으면 null', async () => {
      const html = `<html><body><div class="markdown"><p>설명만 있음</p></div></body></html>`;
      mockedAxios.get = jest.fn().mockResolvedValue({ data: html });

      const result = await service.crawl('https://school.programmers.co.kr/learn/courses/30/lessons/10003', 'PROGRAMMERS');

      expect(result!.constraints).toBeNull();
    });

    it('Wave D — examples: h5[입출력 예] + table 파싱', async () => {
      const html = `
        <html><body>
          <div class="markdown">
            <h5>입출력 예</h5>
            <table>
              <thead><tr><th>numbers</th><th>result</th></tr></thead>
              <tbody>
                <tr><td>[2, 1, 3, 4, 1]</td><td>12</td></tr>
                <tr><td>[5, 0, 2, 7]</td><td>35</td></tr>
              </tbody>
            </table>
          </div>
        </body></html>`;
      mockedAxios.get = jest.fn().mockResolvedValue({ data: html });

      const result = await service.crawl('https://school.programmers.co.kr/learn/courses/30/lessons/10004', 'PROGRAMMERS');

      expect(result).not.toBeNull();
      expect(result!.examples).toHaveLength(2);
      expect(result!.examples![0]).toEqual({ numbers: '[2, 1, 3, 4, 1]', result: '12' });
      expect(result!.examples![1]).toEqual({ numbers: '[5, 0, 2, 7]', result: '35' });
    });

    it('Wave D — examples: h5[입출력 예 설명] 제목은 무시', async () => {
      const html = `
        <html><body>
          <div class="markdown">
            <h5>입출력 예 설명</h5>
            <table>
              <thead><tr><th>설명</th></tr></thead>
              <tbody><tr><td>예시 1 설명</td></tr></tbody>
            </table>
          </div>
        </body></html>`;
      mockedAxios.get = jest.fn().mockResolvedValue({ data: html });

      const result = await service.crawl('https://school.programmers.co.kr/learn/courses/30/lessons/10005', 'PROGRAMMERS');

      expect(result!.examples).toBeNull();
    });

    it('Wave D — examples: table 없으면 null', async () => {
      const html = `<html><body><div class="markdown"><h5>입출력 예</h5><p>표 없음</p></div></body></html>`;
      mockedAxios.get = jest.fn().mockResolvedValue({ data: html });

      const result = await service.crawl('https://school.programmers.co.kr/learn/courses/30/lessons/10006', 'PROGRAMMERS');

      expect(result!.examples).toBeNull();
    });
  });
});
