/**
 * @file public-routes.spec.ts — 공개 경로 명세 테스트 (드리프트 차단 SSOT 검증)
 * @domain common
 * @layer test
 * @related public-routes.ts, public.decorator.ts, jwt.middleware.ts
 *
 * 검증 목표 (ADR-030 S-1):
 *   ① 컨트롤러 스캔 결과(@Public() 부착된 클래스/핸들러) ↔ PUBLIC_ROUTES 양방향 일치
 *   ② 공개 표면 스냅샷 고정(drift 차단)
 *   ③ 네거티브 가드 — 명백한 보호 경로(`auth/profile`, `auth/heartbeat`, …)가 공개 목록에 없음을 단언
 *
 * 앱 부팅 없이 순수 리플렉션으로 동작한다.
 * - controller 클래스 메타데이터(`PATH_METADATA`/`METHOD_METADATA`/`IS_PUBLIC_KEY`)만 읽는다.
 * - DI 그래프 컴파일/Redis 연결/환경변수 부담 없음.
 */

import 'reflect-metadata';
import * as path from 'path';
import * as fs from 'fs';
import { RequestMethod } from '@nestjs/common';
import type { RouteInfo } from '@nestjs/common/interfaces';
import {
  PATH_METADATA,
  METHOD_METADATA,
  MODULE_METADATA,
} from '@nestjs/common/constants';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PUBLIC_ROUTES } from './public-routes';

/* ───────── 1. 스캐너: src 하위 모든 *.controller.ts + proxy.module.ts 의 컨트롤러 클래스 수집 ───────── */

const SRC_ROOT = path.resolve(__dirname, '..', '..');

interface ScannedRoute {
  controllerName: string;
  path: string;
  method: RequestMethod;
}

/** 디렉터리 재귀 순회 — `*.controller.ts` 파일만 수집(테스트/스펙 제외). */
function findControllerFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...findControllerFiles(full));
    } else if (
      entry.isFile() &&
      entry.name.endsWith('.controller.ts') &&
      !entry.name.endsWith('.spec.ts')
    ) {
      out.push(full);
    }
  }
  return out;
}

/** 모듈 파일에서 export된 모든 클래스(함수형 생성자) 수집. */
function loadClasses(filePath: string): Array<new (...args: unknown[]) => unknown> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const mod = require(filePath) as Record<string, unknown>;
  return Object.values(mod).filter(
    (v): v is new (...args: unknown[]) => unknown => typeof v === 'function',
  );
}

/** 클래스가 NestJS 컨트롤러인지 판정 (PATH_METADATA 보유). */
function isController(cls: new (...args: unknown[]) => unknown): boolean {
  return Reflect.hasMetadata(PATH_METADATA, cls);
}

/** 컨트롤러 prefix와 모든 핸들러의 method/path를 추출하여 ScannedRoute[]로 펼친다. */
function extractRoutes(cls: new (...args: unknown[]) => unknown): ScannedRoute[] {
  const controllerPrefix = (Reflect.getMetadata(PATH_METADATA, cls) as string | string[]) ?? '';
  const prefix = Array.isArray(controllerPrefix) ? controllerPrefix[0] : controllerPrefix;
  const classIsPublic = Reflect.getMetadata(IS_PUBLIC_KEY, cls) === true;

  const prototype = cls.prototype as Record<string, unknown>;
  const routes: ScannedRoute[] = [];

  for (const propName of Object.getOwnPropertyNames(prototype)) {
    if (propName === 'constructor') continue;
    const handler = prototype[propName];
    if (typeof handler !== 'function') continue;

    const handlerPath = Reflect.getMetadata(PATH_METADATA, handler) as string | string[] | undefined;
    const handlerMethod = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
    if (handlerPath === undefined || handlerMethod === undefined) continue;

    const handlerIsPublic = Reflect.getMetadata(IS_PUBLIC_KEY, handler) === true;
    const isPublic = classIsPublic || handlerIsPublic;
    if (!isPublic) continue;

    const handlerPathStr = Array.isArray(handlerPath) ? handlerPath[0] : handlerPath;
    const fullPath = joinPath(prefix, handlerPathStr);
    routes.push({
      controllerName: cls.name,
      path: fullPath,
      method: handlerMethod,
    });
  }
  return routes;
}

/** Nest `@Controller(prefix)` + `@Get(handler)` 경로를 슬래시 정규화하여 합친다. */
function joinPath(prefix: string, handlerPath: string): string {
  const a = prefix.replace(/^\/+|\/+$/g, '');
  const b = (handlerPath ?? '').replace(/^\/+|\/+$/g, '');
  if (!a) return b;
  if (!b) return a;
  return `${a}/${b}`;
}

/** ProxyModule에 등록된 내부 컨트롤러(HealthController/CatchAllController)도 수집한다. */
function loadProxyModuleControllers(): Array<new (...args: unknown[]) => unknown> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const { ProxyModule } = require(path.join(SRC_ROOT, 'proxy', 'proxy.module.ts')) as {
    ProxyModule: new (...args: unknown[]) => unknown;
  };
  const controllers =
    (Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, ProxyModule) as Array<
      new (...args: unknown[]) => unknown
    >) ?? [];
  return controllers;
}

function collectAllPublicRoutes(): ScannedRoute[] {
  const files = findControllerFiles(SRC_ROOT);
  const seen = new Set<new (...args: unknown[]) => unknown>();
  const result: ScannedRoute[] = [];

  for (const file of files) {
    for (const cls of loadClasses(file)) {
      if (seen.has(cls) || !isController(cls)) continue;
      seen.add(cls);
      result.push(...extractRoutes(cls));
    }
  }

  // ProxyModule에 들어 있는 인라인 controllers(HealthController/CatchAllController)
  for (const cls of loadProxyModuleControllers()) {
    if (seen.has(cls) || !isController(cls)) continue;
    seen.add(cls);
    result.push(...extractRoutes(cls));
  }

  return result;
}

/* ───────── 2. 정규화 / 비교 헬퍼 ───────── */

function normalizeKey(route: { path: string; method: RequestMethod }): string {
  const cleanPath = route.path.replace(/^\/+|\/+$/g, '');
  return `${RequestMethod[route.method]} ${cleanPath}`;
}

/* ───────── 3. 명세 테스트 ───────── */

describe('PUBLIC_ROUTES — 공개 경로 명세', () => {
  const scanned = collectAllPublicRoutes();
  const scannedKeys = scanned.map(normalizeKey).sort();
  const declaredKeys = PUBLIC_ROUTES.map((r) => normalizeKey(r as RouteInfo & { method: RequestMethod }))
    .filter((k) => !k.startsWith('GET health') && !k.startsWith('GET metrics'))
    .sort();

  /**
   * 인프라 라우트(health, health/ready, metrics)는 HealthController/MetricsController에서도 스캔되므로
   * declared 쪽에서 제외 후 비교한다(중복은 위에 normalize 단계에서 set 제거 안 함 — 단순 sort 비교).
   *
   * 실제로는 scanned 쪽도 동일한 키를 한 번씩만 가지므로 그대로 비교한다.
   */
  it('① scanned(@Public()) ⊆ PUBLIC_ROUTES — 모든 공개 컨트롤러 핸들러가 PUBLIC_ROUTES에 등록되어 있다', () => {
    const declaredSet = new Set(
      PUBLIC_ROUTES.map((r) => normalizeKey(r as RouteInfo & { method: RequestMethod })),
    );
    const missing = scannedKeys.filter((k) => !declaredSet.has(k));
    expect(missing).toEqual([]);
  });

  it('② PUBLIC_ROUTES ⊆ scanned(@Public()) — PUBLIC_ROUTES의 모든 항목에 대응하는 @Public() 핸들러가 존재한다', () => {
    const scannedSet = new Set(scannedKeys);
    const missing = declaredKeys.filter((k) => !scannedSet.has(k));
    expect(missing).toEqual([]);
  });

  it('③ 공개 표면 스냅샷 (드리프트 차단)', () => {
    // 정렬된 declared keys를 스냅샷으로 고정 — 의도적 변경 시 toMatchSnapshot 갱신
    expect(
      PUBLIC_ROUTES.map((r) => normalizeKey(r as RouteInfo & { method: RequestMethod })).sort(),
    ).toMatchSnapshot();
  });

  describe('④ 네거티브 가드 — 보호 경로가 공개 목록에 없다', () => {
    const protectedRoutes: Array<{ method: RequestMethod; path: string }> = [
      { method: RequestMethod.GET, path: 'auth/profile' },
      { method: RequestMethod.PATCH, path: 'auth/profile' },
      { method: RequestMethod.GET, path: 'auth/heartbeat' },
      { method: RequestMethod.DELETE, path: 'auth/account' },
      { method: RequestMethod.POST, path: 'auth/github/link' },
      { method: RequestMethod.DELETE, path: 'auth/github/link' },
      { method: RequestMethod.POST, path: 'auth/github/relink' },
    ];

    it.each(protectedRoutes)('보호 경로 $method $path는 PUBLIC_ROUTES에 없다', (route) => {
      const declaredSet = new Set(
        PUBLIC_ROUTES.map((r) => normalizeKey(r as RouteInfo & { method: RequestMethod })),
      );
      const key = normalizeKey(route);
      expect(declaredSet.has(key)).toBe(false);
    });

    it.each(protectedRoutes)('보호 경로 $method $path 핸들러는 @Public() 부착이 없다', (route) => {
      const key = normalizeKey(route);
      const scannedSet = new Set(scannedKeys);
      expect(scannedSet.has(key)).toBe(false);
    });
  });

  it('PUBLIC_ROUTES에 와일드카드(`*`/`(.*)`)가 사용되지 않는다', () => {
    for (const route of PUBLIC_ROUTES) {
      expect(route.path).not.toMatch(/\*/);
      expect(route.path).not.toMatch(/\(\.\*\)/);
    }
  });
});
