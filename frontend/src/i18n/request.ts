/**
 * @file next-intl 요청별 설정 (i18n/request.ts)
 * @domain i18n
 * @layer config
 * @related src/i18n/routing.ts, next.config.ts
 *
 * createNextIntlPlugin이 이 파일을 i18n 설정 진입점으로 사용한다.
 * Phase B: 파일 로더 기반 준비. 실제 messages JSON은 Phase C에서 생성.
 * 네임스페이스 4개(common, landing, auth, difficulty)는 Phase C에서 추가된다.
 */

import { getRequestConfig } from 'next-intl/server';
import type { AbstractIntlMessages } from 'use-intl';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  // requestLocale은 Promise<string | undefined> (next-intl 3.22+)
  const raw = await requestLocale;

  // 유효하지 않은 locale은 기본 locale(ko)로 대체
  const locale: string =
    raw && (routing.locales as readonly string[]).includes(raw)
      ? raw
      : routing.defaultLocale;

  // Phase B: messages 디렉토리가 아직 존재하지 않으므로 graceful 처리
  // Phase C에서 messages/{locale}/*.json 파일이 생성되면 실제 로딩으로 전환
  let messages: AbstractIntlMessages = {};
  try {
    // messages/{locale}/common.json을 동적 import — Phase C에서 활성화됨
    const mod = await import(`../../messages/${locale}/common.json`);
    messages = mod.default as AbstractIntlMessages;
  } catch {
    // Phase B: 번역 파일 미존재 — 빈 messages로 안전하게 계속
    messages = {};
  }

  return {
    locale,
    messages,
  };
});
