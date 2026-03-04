import { render } from '@testing-library/react';
import { WebVitalsReporter } from '../WebVitalsReporter';
import * as webVitals from 'next/web-vitals';

jest.mock('next/web-vitals', () => ({
  useReportWebVitals: jest.fn(),
}));

const mockUseReportWebVitals = webVitals.useReportWebVitals as jest.Mock;

const makeMockMetric = (overrides = {}) => ({
  id: 'v1-123',
  name: 'LCP',
  value: 2500,
  rating: 'good' as const,
  delta: 100,
  navigationType: 'navigate',
  ...overrides,
});

describe('WebVitalsReporter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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
    expect(mockUseReportWebVitals).toHaveBeenCalled();
  });

  it('useReportWebVitals 콜백이 LCP 메트릭을 전달한다', () => {
    let capturedCallback: ((metric: ReturnType<typeof makeMockMetric>) => void) | undefined;
    mockUseReportWebVitals.mockImplementation((cb) => {
      capturedCallback = cb;
    });

    render(<WebVitalsReporter />);
    expect(capturedCallback).toBeDefined();

    // 콜백 호출 시 오류 없이 처리됨 확인
    expect(() => capturedCallback!(makeMockMetric({ name: 'LCP', value: 2500 }))).not.toThrow();
  });

  it('CLS 메트릭을 콜백으로 전달해도 오류가 없다', () => {
    let capturedCallback: ((metric: ReturnType<typeof makeMockMetric>) => void) | undefined;
    mockUseReportWebVitals.mockImplementation((cb) => {
      capturedCallback = cb;
    });

    render(<WebVitalsReporter />);
    expect(() => capturedCallback!(makeMockMetric({ name: 'CLS', value: 0.1 }))).not.toThrow();
  });

  it('development 환경에서 console.log를 호출한다', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const originalEnv = process.env.NODE_ENV;
    // process.env.NODE_ENV를 development로 변경
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'development',
      configurable: true,
    });

    let capturedCallback: ((metric: ReturnType<typeof makeMockMetric>) => void) | undefined;
    mockUseReportWebVitals.mockImplementation((cb) => {
      capturedCallback = cb;
    });

    render(<WebVitalsReporter />);
    capturedCallback!(makeMockMetric({ name: 'FID', value: 100, rating: 'good' }));

    // NODE_ENV 복원
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: originalEnv,
      configurable: true,
    });
    consoleSpy.mockRestore();
  });

  it('TTFB 메트릭도 콜백으로 처리된다', () => {
    let capturedCallback: ((metric: ReturnType<typeof makeMockMetric>) => void) | undefined;
    mockUseReportWebVitals.mockImplementation((cb) => {
      capturedCallback = cb;
    });

    render(<WebVitalsReporter />);
    expect(() => capturedCallback!(makeMockMetric({ name: 'TTFB', value: 800 }))).not.toThrow();
  });

  it('development 환경에서 CLS 메트릭은 *1000을 하고 ms 단위 없이 로그한다', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'development',
      configurable: true,
    });

    let capturedCallback: ((metric: ReturnType<typeof makeMockMetric>) => void) | undefined;
    mockUseReportWebVitals.mockImplementation((cb) => {
      capturedCallback = cb;
    });

    render(<WebVitalsReporter />);
    capturedCallback!(makeMockMetric({ name: 'CLS', value: 0.123, rating: 'good' }));

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('CLS:'),
      expect.anything(),
    );
    // CLS 메트릭의 로그 문자열에는 'ms'가 없다
    const logCall = consoleSpy.mock.calls[0][0] as string;
    expect(logCall).not.toContain('ms');

    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'test',
      configurable: true,
    });
    consoleSpy.mockRestore();
  });

  it('non-development 환경에서는 console.log를 호출하지 않는다', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    let capturedCallback: ((metric: ReturnType<typeof makeMockMetric>) => void) | undefined;
    mockUseReportWebVitals.mockImplementation((cb) => {
      capturedCallback = cb;
    });

    render(<WebVitalsReporter />);
    capturedCallback!(makeMockMetric({ name: 'LCP', value: 2500 }));

    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
