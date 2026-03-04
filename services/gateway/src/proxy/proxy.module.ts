import {
  Module,
  Controller,
  Get,
  All,
  Res,
  Injectable,
  NestMiddleware,
  Inject,
  NestModule,
  MiddlewareConsumer,
  RequestMethod,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware, RequestHandler } from 'http-proxy-middleware';
import type { IncomingMessage, ServerResponse, ClientRequest } from 'http';
import { SERVICE_ROUTING_TABLE } from '../common/config/service-keys.config';
import Redis from 'ioredis';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

@Controller()
class HealthController {
  private readonly redis: Redis;

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
  }

  @Get('health')
  check(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('health/ready')
  async readiness(): Promise<{ status: string; timestamp: string }> {
    try {
      await this.redis.ping();
      return { status: 'ok', timestamp: new Date().toISOString() };
    } catch {
      throw new ServiceUnavailableException('Redis not ready');
    }
  }
}

@Controller()
class CatchAllController {
  @All('*')
  notFound(@Res() res: Response): void {
    res.status(404).json({ message: '라우팅 대상 서비스를 찾을 수 없습니다.' });
  }
}

@Injectable()
class ProxyDispatchMiddleware implements NestMiddleware {
  constructor(
    @Inject('PROXY_MIDDLEWARE_MAP') private readonly map: Map<string, RequestHandler>,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    for (const [prefix, handler] of this.map.entries()) {
      if (req.path.startsWith(prefix)) {
        handler(req, res, next);
        return;
      }
    }
    next();
  }
}

/**
 * ProxyModule — 서비스별 라우팅 + 서비스별 Internal Key 주입
 *
 * 보안 요구사항:
 * - 서비스별 고유 X-Internal-Key 주입 (키 공유 금지)
 * - X-User-ID / X-Study-ID 헤더 전달 (JWT 미들웨어에서 주입/검증)
 * - 원본 Authorization 헤더는 JWT 미들웨어에서 제거됨
 * - 화이트리스트 기반 라우팅 (등록되지 않은 경로 404)
 */
@Module({
  controllers: [HealthController, CatchAllController],
  providers: [
    ProxyDispatchMiddleware,
    StructuredLoggerService,
    {
      provide: 'PROXY_MIDDLEWARE_MAP',
      inject: [ConfigService, StructuredLoggerService],
      useFactory: (configService: ConfigService, logger: StructuredLoggerService) => {
        logger.setContext('ProxyModule');
        const map = new Map<string, RequestHandler>();

        for (const route of SERVICE_ROUTING_TABLE) {
          const targetUrl = configService.get<string>(route.urlEnvKey);
          if (!targetUrl) {
            logger.warn(
              `환경변수 ${route.urlEnvKey} 미설정 — ${route.prefix} 라우팅 비활성화`,
            );
            continue;
          }

          const serviceKey = configService.get<string>(route.keyEnvKey);
          if (!serviceKey) {
            logger.warn(
              `환경변수 ${route.keyEnvKey} 미설정 — ${route.prefix} 내부 인증 없이 라우팅`,
            );
          }

          const proxy = createProxyMiddleware({
            target: targetUrl,
            changeOrigin: true,
            pathRewrite: { [`^${route.prefix}`]: '' },
            onProxyReq: (proxyReq: ClientRequest, req: IncomingMessage) => {
              if (serviceKey) {
                proxyReq.setHeader('X-Internal-Key', serviceKey);
              }
              const userId = req.headers['x-user-id'];
              const studyId = req.headers['x-study-id'];
              if (userId) proxyReq.setHeader('X-User-ID', String(userId));
              if (studyId) proxyReq.setHeader('X-Study-ID', String(studyId));

              // body-parser가 이미 body를 파싱한 경우 스트림을 재구성해서 전송
              const expressReq = req as Request;
              if (expressReq.body && Object.keys(expressReq.body as object).length > 0) {
                const bodyData = JSON.stringify(expressReq.body);
                proxyReq.setHeader('Content-Type', 'application/json');
                proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
                proxyReq.write(bodyData);
              }

              logger.log(`프록시: ${req.method} ${route.prefix} → ${route.description}`);
            },
            onError: (_err: Error, _req: IncomingMessage, res: ServerResponse) => {
              logger.error(`프록시 오류: ${route.prefix}`);
              if (typeof (res as unknown as Response).status === 'function') {
                (res as unknown as Response).status(502).json({ message: '내부 서비스 응답 오류' });
              }
            },
          });

          map.set(route.prefix, proxy);
          logger.log(`라우팅 등록: ${route.prefix} → ${route.description}`);
        }

        return map;
      },
    },
  ],
})
export class ProxyModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(ProxyDispatchMiddleware)
      .exclude(
        { path: 'health', method: RequestMethod.GET },
        { path: 'health/ready', method: RequestMethod.GET },
        { path: 'metrics', method: RequestMethod.GET },
      )
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
