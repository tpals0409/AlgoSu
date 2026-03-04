/**
 * metrics.ts 단위 테스트
 */

import { dlqMessagesTotal, mqMessagesProcessedTotal, startMetricsServer } from './metrics';
import http from 'http';

describe('metrics', () => {
  describe('Prometheus counters', () => {
    it('dlqMessagesTotal 카운터 증가', () => {
      dlqMessagesTotal.inc({ reason: 'parse_error' });
      // Counter가 에러 없이 호출되는지 확인
      expect(dlqMessagesTotal).toBeDefined();
    });

    it('mqMessagesProcessedTotal 카운터 증가', () => {
      mqMessagesProcessedTotal.inc({ result: 'ack' });
      mqMessagesProcessedTotal.inc({ result: 'nack_dlq' });
      mqMessagesProcessedTotal.inc({ result: 'skipped' });
      expect(mqMessagesProcessedTotal).toBeDefined();
    });
  });

  describe('startMetricsServer', () => {
    let server: http.Server;

    afterEach((done) => {
      if (server) {
        server.close(done);
      } else {
        done();
      }
    });

    it('/metrics 엔드포인트 정상 응답', (done) => {
      // createServer를 스파이하여 서버 인스턴스 캡처
      const originalCreateServer = http.createServer;
      jest.spyOn(http, 'createServer').mockImplementation((...args: any[]) => {
        server = originalCreateServer.apply(http, args as any);
        // 랜덤 포트에서 리슨
        const originalListen = server.listen.bind(server);
        server.listen = ((_port: any, ...rest: any[]) => {
          return originalListen(0, ...rest);
        }) as any;
        return server;
      });

      startMetricsServer();

      // 서버가 리슨 시작할 때까지 대기
      server.on('listening', () => {
        const addr = server.address() as { port: number };

        http.get(`http://localhost:${addr.port}/metrics`, (res) => {
          expect(res.statusCode).toBe(200);
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            expect(data).toContain('algosu_github_worker');
            (http.createServer as jest.Mock).mockRestore();
            done();
          });
        });
      });
    });

    it('/health 엔드포인트 정상 응답', (done) => {
      const originalCreateServer = http.createServer;
      jest.spyOn(http, 'createServer').mockImplementation((...args: any[]) => {
        server = originalCreateServer.apply(http, args as any);
        const originalListen = server.listen.bind(server);
        server.listen = ((_port: any, ...rest: any[]) => {
          return originalListen(0, ...rest);
        }) as any;
        return server;
      });

      startMetricsServer();

      server.on('listening', () => {
        const addr = server.address() as { port: number };

        http.get(`http://localhost:${addr.port}/health`, (res) => {
          expect(res.statusCode).toBe(200);
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            const parsed = JSON.parse(data);
            expect(parsed.status).toBe('ok');
            expect(parsed.timestamp).toBeDefined();
            (http.createServer as jest.Mock).mockRestore();
            done();
          });
        });
      });
    });

    it('알 수 없는 경로 -- 404 응답', (done) => {
      const originalCreateServer = http.createServer;
      jest.spyOn(http, 'createServer').mockImplementation((...args: any[]) => {
        server = originalCreateServer.apply(http, args as any);
        const originalListen = server.listen.bind(server);
        server.listen = ((_port: any, ...rest: any[]) => {
          return originalListen(0, ...rest);
        }) as any;
        return server;
      });

      startMetricsServer();

      server.on('listening', () => {
        const addr = server.address() as { port: number };

        http.get(`http://localhost:${addr.port}/unknown`, (res) => {
          expect(res.statusCode).toBe(404);
          (http.createServer as jest.Mock).mockRestore();
          done();
        });
      });
    });
  });
});
