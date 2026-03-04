import { render } from '@testing-library/react';
import { WebVitalsReporter } from '../WebVitalsReporter';
import * as webVitals from 'next/web-vitals';

jest.mock('next/web-vitals', () => ({
  useReportWebVitals: jest.fn(),
}));

describe('WebVitalsReporter', () => {
  it('renders without error', () => {
    const { container } = render(<WebVitalsReporter />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null (no visible UI)', () => {
    const { container } = render(<WebVitalsReporter />);
    expect(container.innerHTML).toBe('');
  });

  it('calls useReportWebVitals hook', () => {
    render(<WebVitalsReporter />);
    expect(webVitals.useReportWebVitals).toHaveBeenCalled();
  });
});
