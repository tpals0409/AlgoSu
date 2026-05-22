/**
 * @file cache.constants.ts — Redis DI 토큰
 * @domain submission
 * @layer constants
 * @related cache.module.ts, stats-cache.service.ts
 *
 * 순환 의존성 방지를 위해 REDIS_CLIENT 토큰을 별도 파일로 분리.
 * cache.module.ts와 stats-cache.service.ts가 동일 토큰을 참조하되
 * 서로를 import하지 않도록 한다.
 */

/** Redis 클라이언트 DI 토큰 — CacheModule이 제공, 글로벌 resolve */
export const REDIS_CLIENT = 'REDIS_CLIENT';
