/**
 * @file Calendar 영문 locale 매핑 회귀 차단 테스트 (Sprint 146 시드 #9)
 * @domain common
 * @layer test
 * @related calendar.tsx, react-day-picker, next-intl
 *
 * Sprint 141 PR #193에서 도입한 LOCALE_MAP + useLocale 동적 매핑이 회귀하지
 * 않도록 4가지 시나리오 보호:
 *   1. props.locale 명시적 전달 → 그대로 사용
 *   2. NextIntlClientProvider locale="en" → LOCALE_MAP["en"]=enUS 적용
 *   3. provider 부재 (useLocale throw) → ko fallback
 *   4. props.locale 우선순위 (next-intl보다 위)
 *
 * 회귀 시나리오 예시 — next-intl 메이저 업그레이드로 useLocale() 반환값 형식이
 * "en" → "en-US"로 바뀌면 LOCALE_MAP key miss → ko fallback → 영문 환경에서
 * 한국어 캘린더 표시 (사용자 환경 의존이라 UAT 없이는 발견 어려움).
 */
import * as React from 'react';
import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { enUS, ko } from 'react-day-picker/locale';

import { Calendar } from '../calendar';

// Sprint 140 스타일 — Chevron icon은 SVG 단순 mock으로 충분
jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return { ChevronLeft: Icon, ChevronRight: Icon };
});

const FIXED_MONTH = new Date(2026, 0, 15);

const ENGLISH_WEEKDAY_LABELS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];
const KOREAN_WEEKDAY_LABELS = [
  '일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일',
];

/**
 * react-day-picker v9는 weekday를 `<th aria-label="Sunday">Su</th>` 형태로 렌더링.
 * locale별로 aria-label은 풀이름(영문 "Sunday"/한국어 "일요일")이라 가장 견고한 검증 차원.
 */
function getWeekdayAriaLabels(): string[] {
  const cells = document.querySelectorAll('th[aria-label]');
  return Array.from(cells, (el) => el.getAttribute('aria-label') ?? '');
}

function expectLocale(expected: string[]): void {
  const labels = getWeekdayAriaLabels();
  expect(labels).toEqual(expect.arrayContaining(expected));
}

describe('Calendar locale 매핑 (Sprint 146 시드 #9)', () => {
  it('props.locale={enUS} 명시 시 영문 weekday aria-label 표시', () => {
    render(<Calendar mode="single" month={FIXED_MONTH} locale={enUS} />);
    expectLocale(ENGLISH_WEEKDAY_LABELS);
  });

  it('NextIntlClientProvider locale="en" → LOCALE_MAP["en"]=enUS 적용', () => {
    render(
      <NextIntlClientProvider locale="en" messages={{}}>
        <Calendar mode="single" month={FIXED_MONTH} />
      </NextIntlClientProvider>,
    );
    expectLocale(ENGLISH_WEEKDAY_LABELS);
  });

  it('NextIntlClientProvider 부재 시 useLocale throw → ko fallback (Sprint 141 PR #193 의도 보호)', () => {
    render(<Calendar mode="single" month={FIXED_MONTH} />);
    expectLocale(KOREAN_WEEKDAY_LABELS);
  });

  it('props.locale이 useLocale()보다 우선 — provider="en"이라도 props={ko} 우선', () => {
    render(
      <NextIntlClientProvider locale="en" messages={{}}>
        <Calendar mode="single" month={FIXED_MONTH} locale={ko} />
      </NextIntlClientProvider>,
    );
    expectLocale(KOREAN_WEEKDAY_LABELS);
  });
});
