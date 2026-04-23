/**
 * @file next-intl locale-aware 내비게이션 헬퍼
 * @domain i18n
 * @layer navigation
 * @related src/i18n/routing.ts, src/middleware.ts, src/components/landing/LandingContent.tsx
 *
 * createNavigation(routing)으로 locale prefix를 자동 관리하는
 * Link, redirect, usePathname, useRouter를 export한다.
 *
 * 사용 예시:
 * - import { Link } from '@/i18n/navigation';
 * - <Link href="/login">  →  /en 로케일에서 /en/login으로 자동 변환
 */

import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/**
 * locale-aware 내비게이션 유틸리티.
 *
 * - Link: locale prefix 자동 추가 <a> 컴포넌트
 * - redirect: Server Action/Route Handler용 locale-aware 리다이렉트
 * - usePathname: 현재 경로에서 locale prefix 제거 후 반환
 * - useRouter: locale-aware push/replace
 */
export const { Link, redirect, usePathname, useRouter } =
  createNavigation(routing);
