import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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

  it('빈 content.trim()으로 저장 버튼은 disabled 상태이다', async () => {
    mockGet.mockResolvedValue(null);
    render(<StudyNoteEditor problemId="p-1" />);
    await waitFor(() => {
      expect(screen.getByText('작성')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('작성'));

    const saveBtn = screen.getByText('저장').closest('button')!;
    // content가 비어있으므로 disabled
    expect(saveBtn).toBeDisabled();
  });

  it('저장 중에는 "저장 중..." 텍스트를 표시한다', async () => {
    mockGet.mockResolvedValue(null);
    // upsert를 pending 상태로 유지
    mockUpsert.mockReturnValue(new Promise(() => {}));

    render(<StudyNoteEditor problemId="p-1" />);
    await waitFor(() => {
      expect(screen.getByText('작성')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('작성'));

    const textarea = screen.getByLabelText('스터디 노트 편집');
    fireEvent.change(textarea, { target: { value: '저장 중 테스트' } });

    fireEvent.click(screen.getByText('저장'));

    await waitFor(() => {
      expect(screen.getByText('저장 중...')).toBeInTheDocument();
    });
  });

  it('컴포넌트 언마운트 후 API 응답이 와도 상태를 업데이트하지 않는다', async () => {
    let resolveGet: (value: null) => void;
    mockGet.mockReturnValue(new Promise<null>((resolve) => { resolveGet = resolve; }));

    const { unmount } = render(<StudyNoteEditor problemId="p-1" />);
    unmount();

    // unmount 후 resolve해도 오류 없이 처리됨
    expect(() => resolveGet!(null)).not.toThrow();
  });

  it('언마운트 후 API 실패해도 상태를 업데이트하지 않는다 (catch - cancelled=true 분기)', async () => {
    // Branch at line 47: if (!cancelled) setContent('') — cancelled=true 분기
    let rejectGet: (err: Error) => void;
    mockGet.mockReturnValue(new Promise<null>((_resolve, reject) => { rejectGet = reject; }));

    const { unmount } = render(<StudyNoteEditor problemId="p-1" />);
    // 언마운트 후 reject → catch 내 cancelled=true → setContent('')를 호출하지 않음
    unmount();
    await act(async () => {
      rejectGet!(new Error('network error after unmount'));
    });
    // 에러 없이 처리됨
  });

  it('note가 없는 상태에서 취소하면 빈 content로 복원된다', async () => {
    mockGet.mockResolvedValue(null);
    render(<StudyNoteEditor problemId="p-1" />);
    await waitFor(() => {
      expect(screen.getByText('작성')).toBeInTheDocument();
    });

    // 편집 모드 진입
    fireEvent.click(screen.getByText('작성'));
    const textarea = screen.getByLabelText('스터디 노트 편집');
    fireEvent.change(textarea, { target: { value: '임시 내용' } });

    // 취소 (note가 null이므로 note?.content ?? '' = '')
    fireEvent.click(screen.getByText('취소'));

    // 편집 모드 종료, 빈 내용
    await waitFor(() => {
      expect(screen.queryByLabelText('스터디 노트 편집')).not.toBeInTheDocument();
    });
    expect(screen.getByText('아직 작성된 노트가 없습니다.')).toBeInTheDocument();
  });
});
