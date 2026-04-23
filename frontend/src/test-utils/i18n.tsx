/**
 * @file i18n test utility — NextIntlClientProvider wrapping render helper
 * @domain test
 * @layer utility
 * @related src/lib/test-utils.tsx, src/i18n/routing.ts
 *
 * Wraps components with NextIntlClientProvider so useTranslations
 * hooks work in tests. Supports selective namespace message injection.
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
import koProblems from '../../messages/ko/problems.json';
import koAnalytics from '../../messages/ko/analytics.json';
import koFeedback from '../../messages/ko/feedback.json';
import koAccount from '../../messages/ko/account.json';
import koUI from '../../messages/ko/ui.json';

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
  problems: koProblems,
  analytics: koAnalytics,
  feedback: koFeedback,
  account: koAccount,
  ui: koUI,
};

interface RenderWithI18nOptions extends RenderOptions {
  /** Locale (default: 'ko') */
  readonly locale?: string;
  /** Message override (default: all ko namespaces) */
  readonly messages?: AbstractIntlMessages;
}

/**
 * NextIntlClientProvider wrapping render helper.
 *
 * When an outer `wrapper` is provided (e.g. SWRConfig), the tree is:
 *   OuterWrapper > NextIntlClientProvider > ui
 *
 * @param ui - React element to render
 * @param options - locale, messages, wrapper overrides
 * @returns @testing-library/react render result
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
