/**
 * @file next-intl 요청별 설정 (i18n/request.ts)
 * @domain i18n
 * @layer config
 * @related src/i18n/routing.ts, next.config.ts
 *
 * createNextIntlPlugin이 이 파일을 i18n 설정 진입점으로 사용한다.
 * 네임스페이스를 동적 import하여
 * 단일 messages 객체로 병합 후 반환한다.
 */

import { getRequestConfig } from 'next-intl/server';
import type { AbstractIntlMessages } from 'use-intl';
import { routing } from './routing';

/** 지원하는 번역 네임스페이스 목록 */
const NAMESPACES = ['common', 'landing', 'auth', 'difficulty', 'errors', 'dashboard', 'problems', 'submissions', 'reviews', 'account'] as const;

/**
 * 단일 네임스페이스 JSON을 동적 import한다.
 * 파일 미존재 시 빈 객체로 graceful fallback.
 */
async function loadNamespace(
  locale: string,
  ns: (typeof NAMESPACES)[number],
): Promise<AbstractIntlMessages> {
  try {
    const mod = await import(`../../messages/${locale}/${ns}.json`);
    return mod.default as AbstractIntlMessages;
  } catch (err: unknown) {
    // eslint-disable-next-line no-console -- i18n 로드 실패 구조화 경고 (런타임 디버깅 필수)
    console.warn(
      JSON.stringify({
        level: 'warn',
        event: 'i18n_namespace_load_failed',
        locale,
        namespace: ns,
        error: String(err),
      }),
    );
    return {};
  }
}

export default getRequestConfig(async ({ requestLocale }) => {
  const raw = await requestLocale;

  // 유효하지 않은 locale은 기본 locale(ko)로 대체
  const locale: string =
    raw && (routing.locales as readonly string[]).includes(raw)
      ? raw
      : routing.defaultLocale;

  // 모든 네임스페이스를 병렬 로드 후 단일 객체로 병합
  const loaded = await Promise.all(
    NAMESPACES.map(async (ns) => {
      const data = await loadNamespace(locale, ns);
      return [ns, data] as const;
    }),
  );

  const messages: AbstractIntlMessages = {};
  for (const [ns, data] of loaded) {
    messages[ns] = data;
  }

  return {
    locale,
    messages,
  };
});
