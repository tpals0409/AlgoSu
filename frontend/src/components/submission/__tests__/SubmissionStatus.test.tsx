import { screen } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
import { SubmissionStatus, type StepStatus } from '../SubmissionStatus';

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    Check: Icon,
    Loader2: Icon,
    Clock: Icon,
    XCircle: Icon,
  };
});

function makeStep(label: string, status: StepStatus, detail?: string) {
  return { label, status, detail };
}

describe('SubmissionStatus', () => {
  it('제출 진행 상태 제목을 렌더링한다', () => {
    renderWithI18n(<SubmissionStatus steps={[makeStep('제출', 'done')]} />);
    expect(screen.getByText('제출 진행 상태')).toBeInTheDocument();
  });

  it('모든 단계 라벨을 표시한다', () => {
    const steps = [
      makeStep('제출 완료', 'done'),
      makeStep('GitHub 동기화', 'in_progress'),
      makeStep('AI 분석', 'pending'),
    ];
    renderWithI18n(<SubmissionStatus steps={steps} />);
    expect(screen.getByText('제출 완료')).toBeInTheDocument();
    expect(screen.getByText('GitHub 동기화')).toBeInTheDocument();
    expect(screen.getByText('AI 분석')).toBeInTheDocument();
  });

  it('failed 상태일 때 에러 메시지를 표시한다', () => {
    const steps = [
      makeStep('제출', 'done'),
      makeStep('GitHub 동기화', 'failed', 'GitHub 연동 오류'),
    ];
    renderWithI18n(<SubmissionStatus steps={steps} />);
    expect(screen.getByText('GitHub 연동 오류')).toBeInTheDocument();
  });

  it('failed 상태에 detail이 없으면 기본 메시지를 표시한다', () => {
    const steps = [makeStep('GitHub 동기화', 'failed')];
    renderWithI18n(<SubmissionStatus steps={steps} />);
    expect(screen.getByText('GitHub 동기화 실패')).toBeInTheDocument();
  });

  it('실패가 없으면 에러 메시지 영역이 없다', () => {
    const steps = [makeStep('제출', 'done'), makeStep('분석', 'pending')];
    const { container } = renderWithI18n(<SubmissionStatus steps={steps} />);
    expect(container.querySelector('.text-error')).not.toBeInTheDocument();
  });
});
