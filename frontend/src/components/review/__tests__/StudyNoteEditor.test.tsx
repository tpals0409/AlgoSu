import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StudyNoteEditor } from '../StudyNoteEditor';

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return { FileText: Icon, Save: Icon };
});

jest.mock('@/components/ui/Button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/Skeleton', () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}));

const mockGet = jest.fn();
const mockUpsert = jest.fn();

jest.mock('@/lib/api', () => ({
  studyNoteApi: {
    get: (...args: unknown[]) => mockGet(...args),
    upsert: (...args: unknown[]) => mockUpsert(...args),
  },
}));

describe('StudyNoteEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('로딩 중에는 Skeleton을 표시한다', () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    render(<StudyNoteEditor problemId="p-1" />);
    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });

  it('노트가 있으면 내용을 표시한다', async () => {
    mockGet.mockResolvedValue({
      id: 1, publicId: 'n-1', problemId: 'p-1', studyId: 's-1',
      content: '기존 노트 내용', createdAt: '2025-01-15T00:00:00Z',
    });
    render(<StudyNoteEditor problemId="p-1" />);
    await waitFor(() => {
      expect(screen.getByText('기존 노트 내용')).toBeInTheDocument();
    });
  });

  it('노트가 없으면 안내 메시지를 표시한다', async () => {
    mockGet.mockResolvedValue(null);
    render(<StudyNoteEditor problemId="p-1" />);
    await waitFor(() => {
      expect(screen.getByText('아직 작성된 노트가 없습니다.')).toBeInTheDocument();
    });
  });

  it('헤더에 "스터디 노트" 제목을 표시한다', async () => {
    mockGet.mockResolvedValue(null);
    render(<StudyNoteEditor problemId="p-1" />);
    await waitFor(() => {
      expect(screen.getByText('스터디 노트')).toBeInTheDocument();
    });
  });

  it('노트가 없으면 "작성" 버튼을 표시한다', async () => {
    mockGet.mockResolvedValue(null);
    render(<StudyNoteEditor problemId="p-1" />);
    await waitFor(() => {
      expect(screen.getByText('작성')).toBeInTheDocument();
    });
  });

  it('노트가 있으면 "수정" 버튼을 표시한다', async () => {
    mockGet.mockResolvedValue({
      id: 1, publicId: 'n-1', problemId: 'p-1', studyId: 's-1',
      content: '내용', createdAt: '2025-01-15T00:00:00Z',
    });
    render(<StudyNoteEditor problemId="p-1" />);
    await waitFor(() => {
      expect(screen.getByText('수정')).toBeInTheDocument();
    });
  });

  it('수정 버튼 클릭 시 편집 모드로 전환된다', async () => {
    mockGet.mockResolvedValue({
      id: 1, publicId: 'n-1', problemId: 'p-1', studyId: 's-1',
      content: '내용', createdAt: '2025-01-15T00:00:00Z',
    });
    render(<StudyNoteEditor problemId="p-1" />);
    await waitFor(() => {
      expect(screen.getByText('수정')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('수정'));
    expect(screen.getByLabelText('스터디 노트 편집')).toBeInTheDocument();
  });

  it('취소 버튼 클릭 시 편집 모드를 종료한다', async () => {
    mockGet.mockResolvedValue({
      id: 1, publicId: 'n-1', problemId: 'p-1', studyId: 's-1',
      content: '내용', createdAt: '2025-01-15T00:00:00Z',
    });
    render(<StudyNoteEditor problemId="p-1" />);
    await waitFor(() => {
      expect(screen.getByText('수정')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('수정'));
    fireEvent.click(screen.getByText('취소'));
    expect(screen.queryByLabelText('스터디 노트 편집')).not.toBeInTheDocument();
  });

  it('저장 버튼 클릭 시 upsert를 호출하고 편집 모드를 종료한다', async () => {
    const savedNote = {
      id: 1, publicId: 'n-1', problemId: 'p-1', studyId: 's-1',
      content: '새 내용', createdAt: '2025-01-15T00:00:00Z',
    };
    mockGet.mockResolvedValue(null);
    mockUpsert.mockResolvedValue(savedNote);

    render(<StudyNoteEditor problemId="p-1" />);
    await waitFor(() => {
      expect(screen.getByText('작성')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('작성'));

    const textarea = screen.getByLabelText('스터디 노트 편집');
    fireEvent.change(textarea, { target: { value: '새 내용' } });

    fireEvent.click(screen.getByText('저장'));

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalledWith({ problemId: 'p-1', content: '새 내용' });
    });
    await waitFor(() => {
      expect(screen.queryByLabelText('스터디 노트 편집')).not.toBeInTheDocument();
    });
  });

  it('노트 API 호출 실패 시 빈 내용으로 처리한다', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));
    render(<StudyNoteEditor problemId="p-1" />);
    await waitFor(() => {
      expect(screen.getByText('아직 작성된 노트가 없습니다.')).toBeInTheDocument();
    });
  });

  it('취소 시 원래 내용으로 복원된다', async () => {
    mockGet.mockResolvedValue({
      id: 1, publicId: 'n-1', problemId: 'p-1', studyId: 's-1',
      content: '원본 내용', createdAt: '2025-01-15T00:00:00Z',
    });
    render(<StudyNoteEditor problemId="p-1" />);
    await waitFor(() => {
      expect(screen.getByText('수정')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('수정'));
    const textarea = screen.getByLabelText('스터디 노트 편집');
    fireEvent.change(textarea, { target: { value: '변경된 내용' } });
    fireEvent.click(screen.getByText('취소'));

    await waitFor(() => {
      expect(screen.getByText('원본 내용')).toBeInTheDocument();
    });
  });

  it('전체 공개 배지가 표시된다', async () => {
    mockGet.mockResolvedValue(null);
    render(<StudyNoteEditor problemId="p-1" />);
    await waitFor(() => {
      expect(screen.getByText('전체 공개')).toBeInTheDocument();
    });
  });
});
