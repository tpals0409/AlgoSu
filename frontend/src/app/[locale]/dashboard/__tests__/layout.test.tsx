import { render, screen } from '@testing-library/react';
import DashboardLayout, { generateMetadata } from '../layout';
import { NextIntlClientProvider } from 'next-intl';

const messages = {
  dashboard: {
    meta: { title: '대시보드', description: '학습 현황과 통계를 확인하세요.' },
  },
};

describe('DashboardLayout', () => {
  it('children을 그대로 렌더링한다', () => {
    render(
      <NextIntlClientProvider locale="ko" messages={messages}>
        <DashboardLayout params={Promise.resolve({ locale: 'ko' })}>
          <div data-testid="child">Dashboard Content</div>
        </DashboardLayout>
      </NextIntlClientProvider>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
  });

  it('generateMetadata가 export된다', () => {
    expect(typeof generateMetadata).toBe('function');
  });
});
