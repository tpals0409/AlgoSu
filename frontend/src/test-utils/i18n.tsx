/**
 * @file i18n 테스트 유틸리티 — NextIntlClientProvider 래핑 렌더 헬퍼
 * @domain test
 * @layer utility
 * @related src/lib/test-utils.tsx, src/i18n/routing.ts
 *
 * 테스트에서 useTranslations 훅이 동작하도록
 * NextIntlClientProvider로 래핑하는 공용 헬퍼.
 * 네임스페이스별 메시지를 선택적으로 주입할 수 있다.
 */

import { render, type RenderOptions } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { AbstractIntlMessages } from 'use-intl';

import koLanding from '../../messages/ko/landing.json';
import koAuth from '../../messages/ko/auth.json';
import koCommon from '../../messages/ko/common.json';
import koErrors from '../../messages/ko/errors.json';
import koDashboard from '../../messages/ko/dashboard.json';
import koSubmissions from '../../messages/ko/submissions.json';
import koReviews from '../../messages/ko/reviews.json';
import koLayout from '../../messages/ko/layout.json';

/** Default ko messages (all namespaces merged) */
const DEFAULT_MESSAGES: AbstractIntlMessages = {
  landing: koLanding,
  auth: koAuth,
  common: koCommon,
  errors: koErrors,
  dashboard: koDashboard,
  submissions: koSubmissions,
  reviews: koReviews,
  layout: koLayout,
};

interface RenderWithI18nOptions extends Omit<RenderOptions, 'wrapper'> {
  /** 로케일 (기본: 'ko') */
  readonly locale?: string;
  /** 메시지 오버라이드 (기본: ko 전체 네임스페이스) */
  readonly messages?: AbstractIntlMessages;
}

/**
 * NextIntlClientProvider 래핑 렌더 헬퍼.
 *
 * @param ui - 렌더링할 React 엘리먼트
 * @param options - locale, messages 등 오버라이드 옵션
 * @returns @testing-library/react render 결과
 */
export function renderWithI18n(
  ui: React.ReactElement,
  { locale = 'ko', messages, ...rest }: RenderWithI18nOptions = {},
) {
  const mergedMessages = messages ?? DEFAULT_MESSAGES;

  return render(
    <NextIntlClientProvider locale={locale} messages={mergedMessages}>
      {ui}
    </NextIntlClientProvider>,
    rest,
  );
}
