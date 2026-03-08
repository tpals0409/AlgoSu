/**
 * @file 스터디룸 — 주차별 문제 타임라인 + 제출 현황
 * @domain study
 * @layer page
 * @related AppLayout, StudyContext, problemApi, submissionApi
 */

'use client';

import {
  useState,
  useEffect,
  useCallback,
  type ReactElement,
  type ReactNode,
  type CSSProperties,
} from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  BookOpen,
  Users,
  Sparkles,
  Code2,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Copy,
  Check,
  ChevronDown,
  Brain,
  BarChart3,
  Clock,
  Zap,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { ScoreGauge } from '@/components/ui/ScoreGauge';
import { CodeBlock } from '@/components/ui/CodeBlock';
import { useAuth } from '@/contexts/AuthContext';
import { useStudy } from '@/contexts/StudyContext';
import {
  problemApi,
  submissionApi,
  studyApi,
  ApiError,
  type Problem,
  type Submission,
} from '@/lib/api';
import { DiffBadge } from '@/components/ui/DiffBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';
import { StudyNoteEditor } from '@/components/review/StudyNoteEditor';
import { getAvatarPresetKey, getAvatarSrc } from '@/lib/avatars';

// ─── TYPES ────────────────────────────────

type DiffTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'ruby' | 'unrated';

interface MockRoomProblem {
  id: string;
  title: string;
  difficulty: string;
  tier: DiffTier;
  status: 'active' | 'ended';
  tags: string[];
  submitted: number;
  total: number;
  analyzed: number;
}

interface WeekGroup {
  label: string;
  active: boolean;
  problems: MockRoomProblem[];
}

interface MockMemberSubmission {
  id: string;
  name: string;
  initial: string;
  color: string;
  language: string;
  date: string;
  status: 'done' | 'analyzing' | 'waiting';
  score?: number;
}

// ─── MOCK DATA ───────────────────────────

const MOCK_STATS = { totalProblems: 10, totalSubmissions: 8, totalAnalyzed: 5 };

const MOCK_MEMBER_SUBMISSIONS: Record<string, MockMemberSubmission[]> = {
  p1: [
    { id: 's1', name: '김민준', initial: '김', color: '#7C6AAE', language: 'PYTHON', date: '3월 8일 오전 11:23', status: 'done', score: 92 },
    { id: 's2', name: '이지현', initial: '이', color: '#E8A830', language: 'JAVA', date: '3월 8일 오전 09:23', status: 'done', score: 88 },
    { id: 's3', name: '박서준', initial: '박', color: '#3B82CE', language: 'CPP', date: '3월 8일 오전 07:23', status: 'done', score: 79 },
    { id: 's4', name: '최하은', initial: '최', color: '#7C6AAE', language: 'PYTHON', date: '3월 8일 오후 12:23', status: 'analyzing' },
    { id: 's5', name: '정우진', initial: '정', color: '#E8A830', language: 'JAVASCRIPT', date: '3월 8일 오후 12:53', status: 'waiting' },
  ],
  p2: [
    { id: 's6', name: '김민준', initial: '김', color: '#7C6AAE', language: 'PYTHON', date: '3월 7일 오전 10:15', status: 'done', score: 85 },
    { id: 's7', name: '이지현', initial: '이', color: '#E8A830', language: 'JAVA', date: '3월 7일 오후 02:30', status: 'done', score: 91 },
    { id: 's8', name: '박서준', initial: '박', color: '#3B82CE', language: 'CPP', date: '3월 7일 오후 05:10', status: 'analyzing' },
  ],
};

const MOCK_WEEKS: WeekGroup[] = [
  {
    label: '3월1주차',
    active: true,
    problems: [
      { id: 'p1', title: '두 수의 합', difficulty: 'Silver 2', tier: 'silver', status: 'active', tags: ['해시', '배열'], submitted: 5, total: 5, analyzed: 3 },
      { id: 'p2', title: '최단 경로', difficulty: 'Gold 4', tier: 'gold', status: 'active', tags: ['다익스트라', '그래프'], submitted: 3, total: 5, analyzed: 2 },
    ],
  },
  {
    label: '2월4주차',
    active: false,
    problems: [
      { id: 'p3', title: '이분 탐색', difficulty: 'Silver 4', tier: 'silver', status: 'ended', tags: ['이분탐색'], submitted: 0, total: 5, analyzed: 0 },
    ],
  },
  {
    label: '2월3주차',
    active: false,
    problems: [
      { id: 'p4', title: 'DP 입문', difficulty: 'Bronze 1', tier: 'bronze', status: 'ended', tags: ['DP'], submitted: 0, total: 5, analyzed: 0 },
    ],
  },
  {
    label: '2월2주차',
    active: false,
    problems: [
      { id: 'p5', title: '트리의 지름', difficulty: 'Gold 2', tier: 'gold', status: 'ended', tags: ['트리', 'BFS'], submitted: 0, total: 5, analyzed: 0 },
    ],
  },
  {
    label: '2월1주차',
    active: false,
    problems: [
      { id: 'p6', title: '플로이드 워셜', difficulty: 'Gold 5', tier: 'gold', status: 'ended', tags: ['플로이드', '그래프'], submitted: 0, total: 5, analyzed: 0 },
    ],
  },
];

// Mock 분석 결과 데이터
interface MockAnalysisData {
  code: string;
  totalScore: number;
  summary: string;
  timeComplexity: string;
  spaceComplexity: string;
  categories: { name: string; score: number; comment: string }[];
  optimizedCode: string;
}

const MOCK_ANALYSIS: Record<string, MockAnalysisData> = {
  s1: {
    code: `def two_sum(nums, target):\n    seen = {}\n    for i, num in enumerate(nums):\n        complement = target - num\n        if complement in seen:\n            return [seen[complement], i]\n        seen[num] = i\n    raise ValueError("No solution")`,
    totalScore: 92,
    summary: '해시맵을 사용하여 O(n) 시간 복잡도로 문제를 효율적으로 해결했습니다. 변수명이 명확하고 코드 구조가 이해하기 쉽습니다.',
    timeComplexity: 'O(n)',
    spaceComplexity: 'O(n)',
    categories: [
      { name: 'efficiency', score: 95, comment: 'O(n) 시간, O(n) 공간으로 최적 솔루션입니다.' },
      { name: 'readability', score: 90, comment: '변수명이 직관적이고 코드 흐름이 명확합니다.' },
      { name: 'correctness', score: 92, comment: '엣지 케이스에 대한 처리가 잘 되어 있습니다.' },
    ],
    optimizedCode: `def two_sum(nums: list[int], target: int) -> list[int]:\n    seen: dict[int, int] = {}\n    for i, num in enumerate(nums):\n        if (comp := target - num) in seen:\n            return [seen[comp], i]\n        seen[num] = i\n    raise ValueError("No solution")`,
  },
  s2: {
    code: `class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        Map<Integer, Integer> map = new HashMap<>();\n        for (int i = 0; i < nums.length; i++) {\n            int comp = target - nums[i];\n            if (map.containsKey(comp)) {\n                return new int[]{map.get(comp), i};\n            }\n            map.put(nums[i], i);\n        }\n        throw new RuntimeException("No solution");\n    }\n}`,
    totalScore: 88,
    summary: 'HashMap을 활용한 표준적인 풀이입니다. 깔끔한 구현이지만 타입 안정성을 더 고려할 수 있습니다.',
    timeComplexity: 'O(n)',
    spaceComplexity: 'O(n)',
    categories: [
      { name: 'efficiency', score: 92, comment: '최적의 시간복잡도를 달성했습니다.' },
      { name: 'readability', score: 85, comment: 'Java 관례에 맞는 네이밍이지만 변수명이 축약되어 있습니다.' },
      { name: 'correctness', score: 88, comment: '예외 처리가 적절합니다.' },
    ],
    optimizedCode: `class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        Map<Integer, Integer> indexMap = new HashMap<>();\n        for (int i = 0; i < nums.length; i++) {\n            int complement = target - nums[i];\n            if (indexMap.containsKey(complement)) {\n                return new int[]{indexMap.get(complement), i};\n            }\n            indexMap.put(nums[i], i);\n        }\n        throw new IllegalArgumentException("No two sum solution");\n    }\n}`,
  },
  s3: {
    code: `#include <vector>\n#include <unordered_map>\nusing namespace std;\n\nvector<int> twoSum(vector<int>& nums, int target) {\n    unordered_map<int, int> mp;\n    for (int i = 0; i < nums.size(); i++) {\n        int comp = target - nums[i];\n        if (mp.count(comp)) return {mp[comp], i};\n        mp[nums[i]] = i;\n    }\n    return {};\n}`,
    totalScore: 79,
    summary: 'unordered_map을 사용한 효율적인 풀이이나, 에러 처리와 타입 안정성 개선이 필요합니다.',
    timeComplexity: 'O(n)',
    spaceComplexity: 'O(n)',
    categories: [
      { name: 'efficiency', score: 90, comment: '해시맵 기반 O(n) 풀이입니다.' },
      { name: 'readability', score: 72, comment: '변수명이 지나치게 축약되어 있습니다.' },
      { name: 'correctness', score: 75, comment: '빈 벡터 반환은 모호한 에러 처리입니다.' },
    ],
    optimizedCode: `#include <vector>\n#include <unordered_map>\n#include <stdexcept>\nusing namespace std;\n\nvector<int> twoSum(vector<int>& nums, int target) {\n    unordered_map<int, int> seen;\n    for (int i = 0; i < static_cast<int>(nums.size()); ++i) {\n        int complement = target - nums[i];\n        if (auto it = seen.find(complement); it != seen.end()) {\n            return {it->second, i};\n        }\n        seen[nums[i]] = i;\n    }\n    throw invalid_argument("No solution found");\n}`,
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  efficiency: '효율성',
  readability: '가독성',
  correctness: '정확성',
  style: '코드 스타일',
  maintainability: '유지보수성',
};

function barColor(score: number): string {
  if (score >= 80) return 'var(--success)';
  if (score >= 60) return 'var(--warning)';
  return 'var(--error)';
}

// ─── HELPERS ──────────────────────────────

function toTier(diff: Problem['difficulty']): DiffTier {
  return diff.toLowerCase() as DiffTier;
}

function getSagaStatus(
  step: Submission['sagaStep'],
): { label: string; variant: 'success' | 'warning' | 'error' | 'muted' } {
  switch (step) {
    case 'DONE':
      return { label: '분석 완료', variant: 'success' };
    case 'AI_QUEUED':
      return { label: '분석 중', variant: 'warning' };
    case 'GITHUB_QUEUED':
      return { label: 'GitHub 동기화 중', variant: 'warning' };
    case 'FAILED':
      return { label: '실패', variant: 'error' };
    default:
      return { label: '대기', variant: 'muted' };
  }
}

// ─── COMPONENT ────────────────────────────

export default function StudyRoomPage(): ReactElement {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { currentStudyId, setCurrentStudy } = useStudy();

  // ─── STATE ──────────────────────────────
  const [problems, setProblems] = useState<Problem[]>([]);
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingProblems, setLoadingProblems] = useState(true);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notSubmitted, setNotSubmitted] = useState(false);
  const [selectedMockProblem, setSelectedMockProblem] = useState<MockRoomProblem | null>(null);
  const [selectedMockSubmission, setSelectedMockSubmission] = useState<MockMemberSubmission | null>(null);
  const [nicknameMap, setNicknameMap] = useState<Record<string, string>>({});
  const [avatarMap, setAvatarMap] = useState<Record<string, string | null>>({});

  // mount animation
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  // progress bar animation
  const [barsAnimated, setBarsAnimated] = useState(false);

  const fade = (delay = 0): CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(16px)',
    transition: `opacity .5s cubic-bezier(.16,1,.3,1) ${delay}s, transform .5s cubic-bezier(.16,1,.3,1) ${delay}s`,
  });

  const studyId = params.id;
  const isMock = process.env.NEXT_PUBLIC_DEV_MOCK === 'true';

  // 스터디 ID 동기화
  useEffect(() => {
    if (studyId && studyId !== currentStudyId) {
      setCurrentStudy(studyId);
    }
  }, [studyId, currentStudyId, setCurrentStudy]);

  // ─── EFFECTS ────────────────────────────

  useEffect(() => {
    if (isMock) {
      setLoadingProblems(false);
      setTimeout(() => setBarsAnimated(true), 400);
      return;
    }
    if (!isAuthenticated || authLoading || !currentStudyId) return;
    let cancelled = false;
    setLoadingProblems(true);
    setError(null);

    problemApi.findAll()
      .then((data) => {
        if (cancelled) return;
        setProblems(data);
        setTimeout(() => setBarsAnimated(true), 400);
        const qsProblemId = searchParams.get('problemId');
        if (qsProblemId) {
          const target = data.find((p) => p.id === qsProblemId);
          if (target) {
            setSelectedProblem(target);
            void loadSubmissions(target);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setError('문제 목록을 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!cancelled) setLoadingProblems(false);
      });

    if (currentStudyId) {
      studyApi.getMembers(currentStudyId).then((members) => {
        if (cancelled) return;
        const nMap: Record<string, string> = {};
        const aMap: Record<string, string | null> = {};
        for (const m of members) {
          if (m.nickname) nMap[m.user_id] = m.nickname;
          else if (m.username) nMap[m.user_id] = m.username;
          aMap[m.user_id] = m.avatar_url ?? null;
        }
        setNicknameMap(nMap);
        setAvatarMap(aMap);
      }).catch(() => {});
    }

    return () => { cancelled = true; };
  }, [isAuthenticated, authLoading, currentStudyId, isMock]);

  const loadSubmissions = useCallback(async (problem: Problem): Promise<void> => {
    setLoadingSubmissions(true);
    setNotSubmitted(false);
    try {
      const data = await submissionApi.listByProblemForStudy(problem.id);
      const latestByUser = data.filter((sub, idx, arr) =>
        arr.findIndex((s) => s.userId === sub.userId) === idx,
      );
      setSubmissions(latestByUser);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setNotSubmitted(true);
        setSubmissions([]);
      } else {
        setError('제출 목록을 불러오지 못했습니다.');
        setSubmissions([]);
      }
    } finally {
      setLoadingSubmissions(false);
    }
  }, []);

  // ─── HANDLERS ───────────────────────────

  const handleSelectMockProblem = (p: MockRoomProblem): void => {
    setSelectedMockProblem(p);
  };

  const handleMockBack = (): void => {
    setSelectedMockProblem(null);
    setSelectedMockSubmission(null);
    setMounted(false);
    setTimeout(() => setMounted(true), 50);
  };

  const handleSelectMockSubmission = (sub: MockMemberSubmission): void => {
    setSelectedMockSubmission(sub);
  };

  const handleMockSubmissionBack = (): void => {
    setSelectedMockSubmission(null);
  };

  const handleSelectProblem = (problem: Problem): void => {
    setSelectedProblem(problem);
    void loadSubmissions(problem);
  };

  const handleBack = (): void => {
    setSelectedProblem(null);
    setSubmissions([]);
    setNotSubmitted(false);
  };

  const handleGoToReview = (submissionId: string): void => {
    router.push(`/reviews/${submissionId}`);
  };

  // ─── RENDER ─────────────────────────────

  if (authLoading && !isMock) {
    return (
      <AppLayout>
        <div className="space-y-4 py-8">
          <Skeleton height={32} width="40%" />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </AppLayout>
    );
  }

  // Mock 분석 결과 뷰 (멤버 카드 클릭 시)
  if (selectedMockProblem && selectedMockSubmission) {
    return (
      <AppLayout>
        <MockAnalysisView
          problem={selectedMockProblem}
          submission={selectedMockSubmission}
          onBack={handleMockSubmissionBack}
          fade={fade}
        />
      </AppLayout>
    );
  }

  // Mock 제출 현황 뷰
  if (selectedMockProblem) {
    const mockSubs = MOCK_MEMBER_SUBMISSIONS[selectedMockProblem.id] ?? [];
    return (
      <AppLayout>
        <MockSubmissionView
          problem={selectedMockProblem}
          submissions={mockSubs}
          onBack={handleMockBack}
          onSelectSubmission={handleSelectMockSubmission}
        />
      </AppLayout>
    );
  }

  // 제출 목록 뷰 (문제 선택 시) — 기존 로직 유지
  if (selectedProblem) {
    return (
      <AppLayout>
        <SubmissionListView
          problem={selectedProblem}
          submissions={submissions}
          loading={loadingSubmissions}
          notSubmitted={notSubmitted}
          nicknameMap={nicknameMap}
          avatarMap={avatarMap}
          error={error}
          onBack={handleBack}
          onGoToReview={handleGoToReview}
        />
      </AppLayout>
    );
  }

  // ─── 메인 뷰: 스터디룸 ─────────────────

  const stats = isMock ? MOCK_STATS : {
    totalProblems: problems.length,
    totalSubmissions: 0,
    totalAnalyzed: 0,
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* ── 헤더 ── */}
        <div style={fade(0)}>
          <h1 className="text-[22px] font-bold tracking-tight text-text">
            스터디룸
          </h1>
          <p className="mt-0.5 text-sm text-text-2">
            문제를 선택해 멤버별 제출 코드를 확인하세요.
          </p>
        </div>

        {/* ── 통계 카드 ── */}
        <div className="grid grid-cols-3 gap-3" style={fade(0.06)}>
          <StatCard
            icon={<BookOpen className="h-5 w-5" />}
            iconBg="var(--primary-soft)"
            iconColor="var(--primary)"
            value={stats.totalProblems}
            label="전체 문제"
          />
          <StatCard
            icon={<Users className="h-5 w-5" />}
            iconBg="var(--info-soft, rgba(59,130,206,0.12))"
            iconColor="var(--info, #3B82CE)"
            value={stats.totalSubmissions}
            label="총 제출"
          />
          <StatCard
            icon={<Sparkles className="h-5 w-5" />}
            iconBg="var(--success-soft)"
            iconColor="var(--success)"
            value={stats.totalAnalyzed}
            label="분석 완료"
          />
        </div>

        {/* ── 에러 ── */}
        {error && (
          <div className="flex items-center gap-2 rounded-card border border-error bg-error-soft px-4 py-3">
            <AlertCircle className="h-4 w-4 text-error" />
            <span className="text-xs text-error">{error}</span>
          </div>
        )}

        {/* ── 주차별 타임라인 ── */}
        <div style={fade(0.12)}>
          {loadingProblems ? (
            <div className="space-y-3">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : isMock ? (
            <div className="space-y-6">
              {MOCK_WEEKS.map((week) => (
                <WeekSection
                  key={week.label}
                  week={week}
                  barsAnimated={barsAnimated}
                  onSelect={handleSelectMockProblem}
                />
              ))}
            </div>
          ) : problems.length === 0 ? (
            <div className="rounded-card border border-border bg-bg-card py-16 text-center shadow-card">
              <Code2 className="mx-auto mb-3 h-8 w-8 text-text-3 opacity-40" />
              <p className="text-sm text-text-3">등록된 문제가 없습니다</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {problems.map((p) => (
                <div
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectProblem(p)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSelectProblem(p);
                  }}
                  className="flex items-center justify-between rounded-card border border-border bg-bg-card px-5 py-4 shadow-card transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-hover"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-badge bg-primary-soft text-primary">
                      <Code2 className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-text">{p.title}</div>
                      <div className="mt-1 flex gap-1.5">
                        <DiffBadge tier={toTier(p.difficulty)} level={p.level} />
                        <StatusBadge label={p.weekNumber} variant="info" />
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-text-3" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

// ─── STAT CARD ───────────────────────────

function StatCard({
  icon,
  iconBg,
  iconColor,
  value,
  label,
}: {
  readonly icon: ReactNode;
  readonly iconBg: string;
  readonly iconColor: string;
  readonly value: number;
  readonly label: string;
}): ReactNode {
  return (
    <Card className="flex items-center gap-3 px-4 py-4">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: iconBg, color: iconColor }}
      >
        {icon}
      </div>
      <div>
        <p className="text-xl font-bold text-text">{value}</p>
        <p className="text-[11px] text-text-3">{label}</p>
      </div>
    </Card>
  );
}

// ─── WEEK SECTION ────────────────────────

function WeekSection({
  week,
  barsAnimated,
  onSelect,
}: {
  readonly week: WeekGroup;
  readonly barsAnimated: boolean;
  readonly onSelect: (p: MockRoomProblem) => void;
}): ReactNode {
  const totalProblems = week.problems.length;

  return (
    <div>
      {/* 주차 헤더 */}
      <div className="mb-3 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold"
            style={{
              backgroundColor: week.active ? 'var(--primary-soft)' : 'var(--bg-alt)',
              color: week.active ? 'var(--primary)' : 'var(--text-3)',
            }}
          >
            {week.label}
            {week.active && (
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: 'var(--success)' }}
              />
            )}
          </span>
        </div>
        <div
          className="h-px flex-1"
          style={{ backgroundColor: 'var(--border)' }}
        />
        <span className="text-[11px] text-text-3">{totalProblems}문제</span>
      </div>

      {/* 문제 카드 */}
      <div className="space-y-3">
        {week.problems.map((p) => (
          <ProblemTimelineCard
            key={p.id}
            problem={p}
            barsAnimated={barsAnimated}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

// ─── PROBLEM TIMELINE CARD ───────────────

function ProblemTimelineCard({
  problem,
  barsAnimated,
  onSelect,
}: {
  readonly problem: MockRoomProblem;
  readonly barsAnimated: boolean;
  readonly onSelect: (p: MockRoomProblem) => void;
}): ReactNode {
  const pct = problem.total > 0 ? (problem.submitted / problem.total) * 100 : 0;

  return (
    <Card
      className="overflow-hidden p-0 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-hover"
      onClick={() => onSelect(problem)}
    >
      <div className="flex">
        {/* 좌측 컬러 보더 */}
        <div
          className="w-1 shrink-0"
          style={{ backgroundColor: `var(--diff-${problem.tier}-color)` }}
        />

        <div className="flex-1 px-5 py-4">
          {/* 뱃지 행 */}
          <div className="flex items-center gap-2 mb-2">
            <span
              className="inline-flex items-center gap-1 rounded-badge px-2 py-0.5 text-[11px] font-medium"
              style={{
                color: `var(--diff-${problem.tier}-color)`,
                backgroundColor: `var(--diff-${problem.tier}-bg)`,
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: `var(--diff-${problem.tier}-color)` }}
              />
              {problem.difficulty}
            </span>
            {problem.status === 'active' ? (
              <span
                className="inline-flex items-center gap-1 rounded-badge px-2 py-0.5 text-[11px] font-medium"
                style={{ color: 'var(--success)', backgroundColor: 'var(--success-soft)' }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'var(--success)' }} />
                진행 중
              </span>
            ) : (
              <span
                className="inline-flex items-center rounded-badge px-2 py-0.5 text-[11px] font-medium"
                style={{ color: 'var(--text-3)', backgroundColor: 'var(--bg-alt)' }}
              >
                종료
              </span>
            )}
          </div>

          {/* 제목 */}
          <h3 className="text-[15px] font-bold text-text mb-1.5">
            {problem.title}
          </h3>

          {/* 태그 */}
          <div className="flex items-center gap-1.5 mb-3">
            {problem.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-badge px-2 py-0.5 text-[11px]"
                style={{ backgroundColor: 'var(--bg-alt)', color: 'var(--text-3)' }}
              >
                {tag}
              </span>
            ))}
          </div>

          {/* 진행 바 */}
          <div
            className="h-2 w-full overflow-hidden rounded-full"
            style={{ backgroundColor: 'var(--bg-alt)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: barsAnimated ? `${pct}%` : '0%',
                backgroundColor: `var(--diff-${problem.tier}-color)`,
              }}
            />
          </div>

          {/* 제출 / 분석 정보 */}
          <div className="mt-2 flex items-center justify-end gap-3 text-[11px] text-text-3">
            <span>{problem.submitted} / {problem.total}명</span>
            {problem.analyzed > 0 && (
              <span className="flex items-center gap-0.5" style={{ color: 'var(--success)' }}>
                <CheckCircle2 className="h-3 w-3" />
                {problem.analyzed}분석
              </span>
            )}
          </div>
        </div>

        {/* 우측 화살표 */}
        <div className="flex items-center pr-4">
          <ChevronRight className="h-4 w-4 text-text-3" />
        </div>
      </div>
    </Card>
  );
}

// ─── SUBMISSION LIST VIEW ────────────────

function SubmissionListView({
  problem,
  submissions,
  loading,
  notSubmitted,
  nicknameMap,
  avatarMap,
  error,
  onBack,
  onGoToReview,
}: {
  readonly problem: Problem;
  readonly submissions: Submission[];
  readonly loading: boolean;
  readonly notSubmitted: boolean;
  readonly nicknameMap: Record<string, string>;
  readonly avatarMap: Record<string, string | null>;
  readonly error: string | null;
  readonly onBack: () => void;
  readonly onGoToReview: (id: string) => void;
}): ReactNode {
  return (
    <div className="mx-auto max-w-3xl py-4 animate-fade-in">
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-card border border-error bg-error-soft px-4 py-3">
          <AlertCircle className="h-4 w-4 text-error" />
          <span className="text-xs text-error">{error}</span>
        </div>
      )}

      <button
        type="button"
        onClick={onBack}
        className="mb-3 flex items-center gap-1 text-xs text-text-3 transition-colors hover:text-text"
      >
        <ChevronRight className="h-3.5 w-3.5 rotate-180" />
        문제 목록
      </button>

      <div className="mb-6 text-center">
        <h1 className="text-[22px] font-bold tracking-tight text-text">
          {problem.title}
        </h1>
        <div className="mt-2 flex items-center justify-center gap-2">
          <DiffBadge tier={toTier(problem.difficulty)} level={problem.level} />
          <StatusBadge label={problem.weekNumber} variant="info" />
        </div>
      </div>

      <div className="mb-5 overflow-hidden rounded-card border border-border bg-bg-card shadow-card">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <Users className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-text">제출 목록</span>
          <span className="rounded-badge bg-primary-soft px-2 py-0.5 text-[10px] font-medium text-primary">
            {submissions.length}건
          </span>
        </div>

        {loading ? (
          <div className="space-y-3 p-5">
            <Skeleton height={48} />
            <Skeleton height={48} />
            <Skeleton height={48} />
          </div>
        ) : notSubmitted ? (
          <div className="py-10 text-center">
            <Code2 className="mx-auto mb-2 h-6 w-6 text-primary opacity-60" />
            <p className="text-sm font-medium text-text">문제를 먼저 제출해주세요</p>
            <p className="mt-1 text-xs text-text-3">제출 후 다른 스터디원의 풀이를 볼 수 있습니다</p>
          </div>
        ) : submissions.length === 0 ? (
          <div className="py-10 text-center">
            <Code2 className="mx-auto mb-2 h-6 w-6 text-text-3 opacity-40" />
            <p className="text-xs text-text-3">아직 제출이 없습니다</p>
          </div>
        ) : (
          submissions.map((sub, idx) => {
            const saga = getSagaStatus(sub.sagaStep);
            return (
              <div
                key={sub.id}
                role="button"
                tabIndex={0}
                onClick={() => onGoToReview(sub.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onGoToReview(sub.id);
                }}
                className={cn(
                  'flex cursor-pointer items-center justify-between px-5 py-3.5 transition-colors hover:bg-primary-soft',
                  idx < submissions.length - 1 && 'border-b border-border',
                )}
              >
                <div className="flex items-center gap-3">
                  <img
                    src={sub.userId && avatarMap[sub.userId]
                      ? getAvatarSrc(getAvatarPresetKey(avatarMap[sub.userId]))
                      : getAvatarSrc('default')}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover"
                  />
                  <div>
                    <div className="text-[13px] font-medium text-text">
                      {(sub.userId && nicknameMap[sub.userId]) ? nicknameMap[sub.userId] : '익명'}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-text-3">
                      <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-medium uppercase"
                    style={{ backgroundColor: 'var(--bg-alt)', color: 'var(--text-2)' }}
                  >
                    {sub.language}
                  </span>
                      <span className="opacity-30">|</span>
                      {new Date(sub.createdAt).toLocaleDateString('ko-KR', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge label={saga.label} variant={saga.variant} />
                  <ChevronRight className="h-3.5 w-3.5 text-text-3" />
                </div>
              </div>
            );
          })
        )}
      </div>

      <StudyNoteEditor problemId={problem.id} />
    </div>
  );
}

// ─── MOCK SUBMISSION VIEW ────────────────

function MockSubmissionView({
  problem,
  submissions,
  onBack,
  onSelectSubmission,
}: {
  readonly problem: MockRoomProblem;
  readonly submissions: MockMemberSubmission[];
  readonly onBack: () => void;
  readonly onSelectSubmission: (sub: MockMemberSubmission) => void;
}): ReactNode {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const fade = (delay = 0): CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(16px)',
    transition: `opacity .5s cubic-bezier(.16,1,.3,1) ${delay}s, transform .5s cubic-bezier(.16,1,.3,1) ${delay}s`,
  });

  const pct = problem.total > 0 ? (problem.submitted / problem.total) * 100 : 0;
  const weekLabel = MOCK_WEEKS.find((w) => w.problems.some((p) => p.id === problem.id))?.label ?? '';

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-center gap-3" style={fade(0)}>
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center shrink-0 h-9 w-9 rounded-full transition-colors hover:bg-bg-alt"
        >
          <ArrowLeft className="h-5 w-5" style={{ color: 'var(--text)' }} />
        </button>
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-text">
            {problem.title}
          </h1>
          <p className="mt-0.5 text-sm text-text-3">
            {weekLabel} · 멤버별 제출 현황
          </p>
        </div>
      </div>

      {/* 진행 바 */}
      <div
        className="h-2 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: 'var(--bg-alt)' }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            backgroundColor: `var(--diff-${problem.tier}-color)`,
          }}
        />
      </div>

      {/* 정보 카드 */}
      <Card className="p-0 overflow-hidden" style={fade(0.06)}>
        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1 rounded-badge px-2 py-0.5 text-[11px] font-medium"
                style={{
                  color: `var(--diff-${problem.tier}-color)`,
                  backgroundColor: `var(--diff-${problem.tier}-bg)`,
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: `var(--diff-${problem.tier}-color)` }}
                />
                {problem.difficulty}
              </span>
              {problem.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-badge px-2 py-0.5 text-[11px]"
                  style={{ backgroundColor: 'var(--bg-alt)', color: 'var(--text-3)' }}
                >
                  {tag}
                </span>
              ))}
            </div>
            <button
              type="button"
              className="flex items-center gap-1 text-[12px] font-medium text-primary transition-colors hover:underline"
            >
              문제 보기
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>

          {/* 통계 3열 */}
          <div className="grid grid-cols-3 text-center">
            <div>
              <div className="flex items-center justify-center gap-1.5">
                <Users className="h-4 w-4 text-text-3" />
                <span className="text-lg font-bold text-text">{problem.total}</span>
              </div>
              <p className="text-[11px] text-text-3">전체 멤버</p>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-text-3" />
                <span className="text-lg font-bold text-text">{problem.submitted}</span>
              </div>
              <p className="text-[11px] text-text-3">제출 완료</p>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1.5">
                <Sparkles className="h-4 w-4" style={{ color: 'var(--success)' }} />
                <span className="text-lg font-bold" style={{ color: 'var(--success)' }}>
                  {problem.analyzed}
                </span>
              </div>
              <p className="text-[11px] text-text-3">분석 완료</p>
            </div>
          </div>
        </div>
      </Card>

      {/* 제출 완료 헤더 */}
      <p className="text-sm font-medium text-text-2" style={fade(0.1)}>
        제출 완료 · {submissions.length}명
      </p>

      {/* 2열 멤버 제출 카드 그리드 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" style={fade(0.14)}>
        {submissions.map((sub) => (
          <Card
            key={sub.id}
            className="p-4 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-hover"
            onClick={() => onSelectSubmission(sub)}
          >
            {/* 상단: 아바타 + 이름 + 언어 + 날짜 + 화살표 */}
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: sub.color }}
              >
                {sub.initial}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-text">{sub.name}</span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-medium uppercase"
                    style={{ backgroundColor: 'var(--bg-alt)', color: 'var(--text-2)' }}
                  >
                    {sub.language}
                  </span>
                </div>
                <p className="text-[11px] text-text-3">{sub.date}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-text-3" />
            </div>

            {/* 하단: 상태 */}
            <div className="mt-3">
              <span
                className="flex items-center gap-1 text-[12px] font-medium"
                style={{
                  color: sub.status === 'done' ? 'var(--success)'
                    : sub.status === 'analyzing' ? 'var(--warning)'
                    : 'var(--text-3)',
                }}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {sub.status === 'done' ? '분석 완료'
                  : sub.status === 'analyzing' ? '분석 중'
                  : '대기 중'}
              </span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── MOCK ANALYSIS VIEW ─────────────────

function MockAnalysisView({
  problem,
  submission,
  onBack,
}: {
  readonly problem: MockRoomProblem;
  readonly submission: MockMemberSubmission;
  readonly onBack: () => void;
  readonly fade: (delay?: number) => CSSProperties;
}): ReactNode {
  const analysis = MOCK_ANALYSIS[submission.id];
  const [copied, setCopied] = useState(false);
  const [showOptimized, setShowOptimized] = useState(false);
  const [barsAnimated, setBarsAnimated] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!analysis) return;
    const t = setTimeout(() => setBarsAnimated(true), 400);
    return () => clearTimeout(t);
  }, [analysis]);

  const localFade = (delay = 0): CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(16px)',
    transition: `opacity .5s cubic-bezier(.16,1,.3,1) ${delay}s, transform .5s cubic-bezier(.16,1,.3,1) ${delay}s`,
  });

  const handleCopy = async (text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const langMap: Record<string, string> = {
    PYTHON: 'python',
    JAVA: 'java',
    CPP: 'cpp',
    JAVASCRIPT: 'javascript',
  };
  const langKey = langMap[submission.language] ?? 'text';

  // 분석 미완료 상태
  if (!analysis || submission.status !== 'done') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3" style={localFade(0)}>
          <button
            type="button"
            onClick={onBack}
            className="flex items-center justify-center shrink-0 h-9 w-9 rounded-full transition-colors hover:bg-bg-alt"
          >
            <ArrowLeft className="h-5 w-5" style={{ color: 'var(--text)' }} />
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-text">
              {submission.name}의 제출
            </h1>
            <p className="text-sm text-text-3">{problem.title}</p>
          </div>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <Sparkles className="h-8 w-8 text-warning" />
            <div className="text-center">
              <p className="text-sm font-medium text-text">
                {submission.status === 'analyzing' ? 'AI 분석 중...' : '제출 대기 중'}
              </p>
              <p className="mt-1 text-[11px] text-text-3">
                {submission.status === 'analyzing'
                  ? '분석이 완료되면 결과가 표시됩니다.'
                  : '아직 코드가 제출되지 않았습니다.'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ─── HEADER ─────────────────────────── */}
      <div className="space-y-3" style={localFade(0)}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center justify-center shrink-0 h-9 w-9 rounded-full transition-colors hover:bg-bg-alt"
          >
            <ArrowLeft className="h-5 w-5" style={{ color: 'var(--text)' }} />
          </button>
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ backgroundColor: submission.color }}
          >
            {submission.initial}
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-text">
              {submission.name}
            </h1>
            <p className="text-sm text-text-3">{problem.title}</p>
          </div>
        </div>

        {/* 뱃지 행 */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
            style={{
              color: `var(--diff-${problem.tier}-color)`,
              backgroundColor: `var(--diff-${problem.tier}-bg)`,
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: `var(--diff-${problem.tier}-color)` }}
              aria-hidden
            />
            {problem.difficulty}
          </span>
          <span
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase"
            style={{ backgroundColor: 'var(--bg-alt)', color: 'var(--text-2)' }}
          >
            {submission.language}
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
            style={{ backgroundColor: 'var(--success-soft)', color: 'var(--success)' }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'var(--success)' }} aria-hidden />
            분석 완료
          </span>
          <span
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold"
            style={{ backgroundColor: 'var(--success-soft)', color: 'var(--success)' }}
          >
            {analysis.totalScore}점
          </span>
          {problem.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium"
              style={{ backgroundColor: 'var(--bg-alt)', color: 'var(--text-3)' }}
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[12px] text-text-3">{submission.date}</span>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
          >
            문제 보기
            <ExternalLink className="h-3 w-3" aria-hidden />
          </button>
        </div>
      </div>

      {/* ─── 2-Column Layout ────── */}
      <div className="flex flex-col lg:flex-row gap-4 items-stretch" style={localFade(0.1)}>
        {/* ── LEFT: Code Viewer ── */}
        <div className="w-full lg:w-1/2 min-w-0 flex flex-col">
          <Card className="p-0 overflow-hidden flex-1 flex flex-col">
            <div
              className="flex items-center justify-between px-5 h-12 shrink-0 border-b"
              style={{ borderColor: 'var(--border)' }}
            >
              <span className="text-[13px] font-semibold text-text flex items-center gap-1.5">
                <span style={{ color: 'var(--primary)' }}>&lt;/&gt;</span>
                {submission.language}
              </span>
              <button
                onClick={() => void handleCopy(analysis.code)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-badge text-[11px] font-medium transition-colors hover:bg-bg-alt"
                style={{ color: 'var(--text-3)' }}
              >
                {copied ? <Check className="h-3 w-3" style={{ color: 'var(--success)' }} /> : <Copy className="h-3 w-3" />}
                {copied ? '복사됨' : '복사'}
              </button>
            </div>
            <div className="overflow-auto">
              <CodeBlock code={analysis.code} language={langKey} />
            </div>
          </Card>
        </div>

        {/* ── RIGHT: AI 분석 결과 ── */}
        <div className="w-full lg:w-1/2 flex flex-col">
          <Card className="p-0 overflow-hidden flex-1 flex flex-col">
            <div
              className="flex items-center justify-between px-5 h-12 shrink-0 border-b"
              style={{ borderColor: 'var(--border)' }}
            >
              <span className="flex items-center gap-2 text-[13px] font-semibold text-text">
                <Brain className="h-4 w-4" style={{ color: 'var(--primary)' }} aria-hidden />
                AI 분석 결과
              </span>
            </div>

            <div className="px-5 py-5 space-y-5">
              <div className="flex justify-center">
                <ScoreGauge score={analysis.totalScore} size={160} label="/ 100" />
              </div>

              <div className="flex items-center justify-center gap-3">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium"
                  style={{ backgroundColor: 'var(--info-soft)', color: 'var(--info)' }}
                >
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                  시간 {analysis.timeComplexity}
                </span>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium"
                  style={{ backgroundColor: 'var(--primary-soft)', color: 'var(--primary)' }}
                >
                  <Zap className="h-3.5 w-3.5" aria-hidden />
                  공간 {analysis.spaceComplexity}
                </span>
              </div>

              <div
                className="rounded-card px-4 py-3 text-[12px] leading-relaxed"
                style={{
                  backgroundColor: 'var(--primary-soft)',
                  borderLeft: '3px solid var(--primary)',
                  color: 'var(--text-2)',
                }}
              >
                {analysis.summary}
              </div>

              <div className="space-y-1">
                <p
                  className="flex items-center gap-1.5 text-[13px] font-medium text-text pb-1"
                  style={{ borderBottom: '1px solid var(--border)' }}
                >
                  <BarChart3 className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} aria-hidden />
                  항목별 평가
                </p>
                {analysis.categories.map((cat) => {
                  const color = barColor(cat.score);
                  const label = CATEGORY_LABELS[cat.name] ?? cat.name;
                  return (
                    <div key={cat.name} className="py-2.5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[13px] font-semibold text-text">{label}</span>
                        <span className="text-[13px] font-bold" style={{ color }}>{cat.score}</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-700 ease-out"
                          style={{ width: barsAnimated ? `${cat.score}%` : '0%', backgroundColor: color }}
                        />
                      </div>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-text-3">{cat.comment}</p>
                    </div>
                  );
                })}
              </div>

              <div style={{ borderTop: '1px solid var(--border)' }}>
                <button
                  type="button"
                  onClick={() => setShowOptimized(!showOptimized)}
                  className="flex items-center justify-between w-full px-0 py-2.5 text-[13px] font-medium text-text transition-colors hover:text-primary"
                >
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} aria-hidden />
                    AI 개선 코드
                  </span>
                  <ChevronDown
                    className="h-4 w-4 text-text-3 transition-transform"
                    style={{ transform: showOptimized ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    aria-hidden
                  />
                </button>
                {showOptimized && (
                  <div className="rounded-card overflow-hidden mb-1" style={{ border: '1px solid var(--border)' }}>
                    <CodeBlock code={analysis.optimizedCode} language={langKey} />
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
