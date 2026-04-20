/**
 * @file AddProblemModal 플랫폼 토글 동작 테스트
 * @domain problem
 * @layer component
 * @related AddProblemModal, solvedacApi, programmersApi
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

// ── lucide-react 아이콘 경량 mock ──────────────────
jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    Search: Icon,
    X: Icon,
    ArrowLeft: Icon,
    Plus: Icon,
    Loader2: Icon,
    ExternalLink: Icon,
    AlertCircle: Icon,
  };
});

// ── API mock ───────────────────────────────────────
const mockSearchByQuerySolvedac = jest.fn();
const mockSearchByQueryProgrammers = jest.fn();
jest.mock('@/lib/api', () => ({
  solvedacApi: { searchByQuery: (...args: unknown[]) => mockSearchByQuerySolvedac(...args) },
  programmersApi: { searchByQuery: (...args: unknown[]) => mockSearchByQueryProgrammers(...args) },
  problemApi: { create: jest.fn() },
  studyApi: { notifyProblemCreated: jest.fn() },
}));

// ── StudyContext mock ──────────────────────────────
jest.mock('@/contexts/StudyContext', () => ({
  useStudy: () => ({ currentStudyId: 'test-study' }),
}));

import { AddProblemModal } from '../AddProblemModal';

describe('AddProblemModal — 플랫폼 토글', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('모달이 열리면 기본 플랫폼이 PROGRAMMERS 토글이 활성화되어 있다', () => {
    render(<AddProblemModal open={true} onClose={jest.fn()} />);

    const tabs = screen.getAllByRole('tab');
    const programmersTab = tabs.find((t) => t.textContent === '프로그래머스');
    const bojTab = tabs.find((t) => t.textContent === '백준');

    expect(programmersTab).toBeTruthy();
    expect(bojTab).toBeTruthy();
    expect(programmersTab!.getAttribute('aria-selected')).toBe('true');
    expect(bojTab!.getAttribute('aria-selected')).toBe('false');
  });

  it('플랫폼 토글 전환 시 보조 문구가 변경된다', () => {
    render(<AddProblemModal open={true} onClose={jest.fn()} />);

    // 초기 상태: PROGRAMMERS — '프로그래머스' 보조 문구
    expect(screen.getByText('프로그래머스 문제를 검색합니다.')).toBeTruthy();

    // BOJ 탭 클릭
    const bojTab = screen.getAllByRole('tab').find((t) => t.textContent === '백준')!;
    fireEvent.click(bojTab);

    // BOJ — 'solved.ac' 보조 문구
    expect(screen.getByText('solved.ac 기반으로 검색됩니다.')).toBeTruthy();

    // 다시 PROGRAMMERS 탭 클릭
    const programmersTab = screen.getAllByRole('tab').find((t) => t.textContent === '프로그래머스')!;
    fireEvent.click(programmersTab);

    expect(screen.getByText('프로그래머스 문제를 검색합니다.')).toBeTruthy();
  });

  it('searchFn이 올바른 플랫폼의 API를 호출한다', async () => {
    jest.useFakeTimers();

    // 검색 결과 빈 배열 반환
    mockSearchByQueryProgrammers.mockResolvedValue({ items: [] });
    mockSearchByQuerySolvedac.mockResolvedValue({ items: [] });

    render(<AddProblemModal open={true} onClose={jest.fn()} />);

    // PROGRAMMERS 상태에서 검색 입력
    const input = screen.getByPlaceholderText('프로그래머스 문제 검색…');
    fireEvent.change(input, { target: { value: '폰켓몬' } });

    // 디바운스 400ms 경과
    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    expect(mockSearchByQueryProgrammers).toHaveBeenCalledWith('폰켓몬', 1);
    expect(mockSearchByQuerySolvedac).not.toHaveBeenCalled();

    // BOJ 탭으로 전환 후 검색
    const bojTab = screen.getAllByRole('tab').find((t) => t.textContent === '백준')!;
    fireEvent.click(bojTab);

    const bojInput = screen.getByPlaceholderText('문제 번호 또는 제목으로 검색…');
    fireEvent.change(bojInput, { target: { value: '1000' } });

    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    expect(mockSearchByQuerySolvedac).toHaveBeenCalledWith('1000', 1);
  });
});
