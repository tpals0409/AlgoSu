/**
 * @file 스터디 상세 페이지 — 3탭 (그라운드룰 / 문제 / 멤버)
 * @domain study
 * @layer page
 * @related StudyContext, studyApi, AppLayout
 */

'use client';

import {
  useState,
  useEffect,
  useCallback,
  use,
  type ReactNode,
  type CSSProperties,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Shield,
  BookOpen,
  Users,
  Settings,
  Crown,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useAuth } from '@/contexts/AuthContext';
import {
  studyApi,
  type Study,
  type StudyMember,
} from '@/lib/api';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { cn } from '@/lib/utils';

// ─── TYPES ───────────────────────────────

type TabKey = 'rules' | 'problems' | 'members';

interface PageProps {
  readonly params: Promise<{ id: string }>;
}

// ─── CONSTANTS ───────────────────────────

const TABS: { key: TabKey; label: string; icon: typeof Users }[] = [
  { key: 'rules', label: '그라운드룰', icon: Shield },
  { key: 'problems', label: '문제', icon: BookOpen },
  { key: 'members', label: '멤버', icon: Users },
];

// ─── MOCK DATA ──────────────────────────

const MOCK_GROUND_RULES = `## 참여 규칙
- 매주 **최소 1문제** 이상 제출해야 합니다.
- 마감 기한 내에 제출하지 못한 경우, 사유를 채널에 공유해주세요.
- 스터디 모임에는 **사전 고지 없이 결석하지 않습니다.**

## 문제 풀이 방식
- 풀이 코드는 반드시 **본인이 직접 작성**해야 합니다.
- 외부 코드를 참고한 경우 출처를 주석으로 명시하세요.
- AI 도구(ChatGPT 등)는 **최후의 수단**으로만 활용합니다.

## 코드 리뷰
- 다른 멤버의 코드에 **건설적인 피드백**을 남겨주세요.
- 비난이나 비하 발언은 **금지**합니다.
- 리뷰는 제출 후 **2일 이내**에 완료해주세요.

## 커뮤니케이션
- 스터디 채널에서 질문은 언제든 환영합니다.
- 모르는 것을 모른다고 말하는 문화를 만들어갑시다.
- 서로를 존중하고 격려하는 분위기를 유지합니다.`;

interface MockProblem {
  id: string;
  number: number;
  title: string;
  difficulty: string;
  tier: string;
  tags: string[];
  dDay?: string;
  ended?: boolean;
}

const MOCK_PROBLEMS_ACTIVE: MockProblem[] = [
  { id: 'p1', number: 1, title: '두 수의 합', difficulty: 'Silver 2', tier: 'silver', tags: ['해시', '배열'], dDay: 'D-2 마감' },
  { id: 'p2', number: 2, title: '최단 경로', difficulty: 'Gold 4', tier: 'gold', tags: ['다익스트라', '그래프'], dDay: 'D-3 마감' },
];

const MOCK_PROBLEMS_ENDED: MockProblem[] = [
  { id: 'p3', number: 3, title: '이분 탐색', difficulty: 'Silver 4', tier: 'silver', tags: ['이분탐색'], ended: true },
  { id: 'p4', number: 4, title: 'DP 입문', difficulty: 'Bronze 1', tier: 'bronze', tags: ['DP'], ended: true },
  { id: 'p5', number: 5, title: '트리의 지름', difficulty: 'Gold 2', tier: 'gold', tags: ['트리', 'BFS'], ended: true },
  { id: 'p6', number: 6, title: '플로이드 워셜', difficulty: 'Gold 5', tier: 'gold', tags: ['플로이드', '그래프'], ended: true },
];

interface MockMember {
  id: string;
  name: string;
  role: 'ADMIN' | 'MEMBER';
  isMe: boolean;
  email: string;
  color: string;
  submissions: number;
  done: number;
  total: number;
}

const MOCK_MEMBERS: MockMember[] = [
  { id: 'm1', name: '김민준', role: 'ADMIN', isMe: true, email: 'minjun@example.com', color: '#E8A830', submissions: 12, done: 10, total: 12 },
  { id: 'm2', name: '이지현', role: 'MEMBER', isMe: false, email: 'jhyun@example.com', color: '#3DAA6D', submissions: 9, done: 8, total: 9 },
  { id: 'm3', name: '박서준', role: 'MEMBER', isMe: false, email: 'seojun@example.com', color: '#3B82CE', submissions: 7, done: 6, total: 7 },
  { id: 'm4', name: '최하은', role: 'MEMBER', isMe: false, email: 'haeun@example.com', color: '#7C6AAE', submissions: 8, done: 7, total: 8 },
  { id: 'm5', name: '정우진', role: 'MEMBER', isMe: false, email: 'woojin@example.com', color: '#E05448', submissions: 6, done: 5, total: 6 },
];

// ─── MARKDOWN RENDERER ─────────────────

/**
 * 간단한 마크다운 → HTML 변환 (##, **, -)
 * @domain common
 */
function renderMarkdown(md: string): string {
  return md
    .split('\n')
    .map((line) => {
      if (line.startsWith('## ')) {
        return `<h3 style="font-size:15px;font-weight:700;margin:20px 0 8px;padding-left:4px;color:var(--text)">${line.slice(3)}</h3>`;
      }
      if (line.startsWith('- ')) {
        const content = line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        return `<li style="font-size:13px;color:var(--text-2);margin:4px 0;margin-left:20px;padding-left:8px;list-style:disc">${content}</li>`;
      }
      if (line.trim() === '') return '<br/>';
      return `<p style="font-size:13px;color:var(--text-2)">${line}</p>`;
    })
    .join('');
}

// ─── RENDER ──────────────────────────────

/**
 * 스터디 상세 페이지 (3탭 구조)
 * @domain study
 */
export default function StudyDetailPage({ params }: PageProps): ReactNode {
  const { id: studyId } = use(params);
  const router = useRouter();
  const { isAuthenticated } = useRequireAuth();
  const { user } = useAuth();

  // ─── STATE ─────────────────────────────
  const [tab, setTab] = useState<TabKey>('rules');
  const [study, setStudy] = useState<Study | null>(null);
  const [members, setMembers] = useState<StudyMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // mount animation
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

  // email 매칭으로 현재 사용자 ID 도출
  const myUserId = members.find((m) => m.email === user?.email)?.user_id ?? null;

  const isAdmin = members.some(
    (m) => m.user_id === myUserId && m.role === 'ADMIN',
  );

  // ─── EFFECTS ───────────────────────────

  /**
   * 스터디 데이터 로드
   * @domain study
   */
  const loadStudyData = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    // DEV MOCK
    if (process.env.NEXT_PUBLIC_DEV_MOCK === 'true') {
      setStudy({
        id: studyId,
        name: '알고리즘 마스터',
        description: 'LeetCode & BOJ 기반 스터디',
        role: 'ADMIN',
        memberCount: 5,
      });
      setMembers([
        { id: 'm1', study_id: studyId, user_id: 'dev-user-001', role: 'ADMIN', joined_at: '2025-01-01T00:00:00Z', nickname: '김민준', username: 'kimmin', email: 'dev@algosu.kr', avatar_url: '' },
        { id: 'm2', study_id: studyId, user_id: 'dev-user-002', role: 'MEMBER', joined_at: '2025-01-02T00:00:00Z', nickname: '이지현', username: 'jhyun', email: 'jhyun@example.com', avatar_url: '' },
        { id: 'm3', study_id: studyId, user_id: 'dev-user-003', role: 'MEMBER', joined_at: '2025-01-03T00:00:00Z', nickname: '박서준', username: 'seojun', email: 'seojun@example.com', avatar_url: '' },
        { id: 'm4', study_id: studyId, user_id: 'dev-user-004', role: 'MEMBER', joined_at: '2025-01-04T00:00:00Z', nickname: '최하은', username: 'haeun', email: 'haeun@example.com', avatar_url: '' },
        { id: 'm5', study_id: studyId, user_id: 'dev-user-005', role: 'MEMBER', joined_at: '2025-01-05T00:00:00Z', nickname: '정우진', username: 'woojin', email: 'woojin@example.com', avatar_url: '' },
      ]);
      setIsLoading(false);
      return;
    }

    try {
      const [studyData, memberData] = await Promise.all([
        studyApi.getById(studyId),
        studyApi.getMembers(studyId),
      ]);
      setStudy(studyData);
      setMembers(memberData);
    } catch (err: unknown) {
      setError(
        (err as Error).message ??
          '스터디 정보를 불러오는 데 실패했습니다.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [studyId]);

  useEffect(() => {
    if (isAuthenticated) {
      void loadStudyData();
    }
  }, [isAuthenticated, loadStudyData]);

  // ─── LOADING / ERROR ───────────────────

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingSpinner size="lg" label="스터디 정보를 불러오는 중..." />
        </div>
      </AppLayout>
    );
  }

  if (error && !study) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <Alert variant="error">{error}</Alert>
          <button
            type="button"
            onClick={() => router.push('/studies')}
            className="flex items-center justify-center shrink-0 h-9 w-9 rounded-full transition-colors hover:bg-bg-alt"
          >
            <ArrowLeft className="h-5 w-5" style={{ color: 'var(--text)' }} />
          </button>
          <span className="text-sm text-text-2">스터디 목록</span>
        </div>
      </AppLayout>
    );
  }

  const isMock = process.env.NEXT_PUBLIC_DEV_MOCK === 'true';
  const memberCount = isMock ? MOCK_MEMBERS.length : members.length;

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* ── HEADER ── */}
        <div className="flex items-center justify-between" style={fade(0)}>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/studies')}
              className="flex items-center justify-center shrink-0 h-9 w-9 rounded-full transition-colors hover:bg-bg-alt"
            >
              <ArrowLeft className="h-5 w-5" style={{ color: 'var(--text)' }} />
            </button>
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              {study?.name?.charAt(0) ?? ''}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-[22px] font-bold tracking-tight text-text truncate">
                  {study?.name ?? ''}
                </h1>
                {isAdmin && (
                  <Badge className="bg-bg-alt text-text-2">
                    <Crown className="h-3 w-3" aria-hidden />
                    관리자
                  </Badge>
                )}
              </div>
              <span className="text-xs text-text-3">
                {study?.description ? `${study.description} · ` : ''}
                {memberCount}명 참여
              </span>
            </div>
          </div>

          {/* 설정 아이콘 (ADMIN만) */}
          {isAdmin && (
            <button
              type="button"
              className="shrink-0 rounded-lg p-1.5 text-text-3 transition-colors hover:bg-bg-alt hover:text-text"
              onClick={() => router.push(`/studies/${studyId}/settings`)}
              aria-label="스터디 설정"
            >
              <Settings className="h-4.5 w-4.5" aria-hidden />
            </button>
          )}
        </div>

        {error && (
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* ── TAB BAR ── */}
        <div
          className="flex gap-1 rounded-card border border-border bg-bg-card p-1 shadow"
          style={fade(0.06)}
        >
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-btn py-2 text-[13px] font-medium transition-all',
                  tab === t.key
                    ? 'bg-primary text-white'
                    : 'text-text-3 hover:text-text',
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ── TAB CONTENT ── */}
        <div style={fade(0.12)}>
          {tab === 'rules' && (
            <RulesTab isAdmin={isAdmin} isMock={isMock} />
          )}

          {tab === 'problems' && (
            <ProblemsTab isMock={isMock} />
          )}

          {tab === 'members' && (
            <MembersTab
              members={members}
              myUserId={myUserId}
              isMock={isMock}
            />
          )}
        </div>
      </div>
    </AppLayout>
  );
}

// ─── RULES TAB ──────────────────────────

/**
 * 그라운드룰 탭 — 마크다운 렌더링
 * @domain study
 */
function RulesTab({
  isAdmin,
  isMock,
}: {
  readonly isAdmin: boolean;
  readonly isMock: boolean;
}): ReactNode {
  const rulesHtml = isMock ? renderMarkdown(MOCK_GROUND_RULES) : '';

  return (
    <div className="space-y-4 animate-fade-in">
      <Card>
        <CardContent className="py-5">
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" aria-hidden />
              <span className="text-sm font-semibold text-text">그라운드룰</span>
            </div>
          </div>

          {/* 마크다운 콘텐츠 */}
          {rulesHtml ? (
            <div
              dangerouslySetInnerHTML={{ __html: rulesHtml }}
              style={{ lineHeight: '1.7' }}
            />
          ) : (
            <p className="text-sm text-text-3">
              아직 그라운드룰이 등록되지 않았습니다.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── PROBLEMS TAB ───────────────────────

/**
 * 문제 탭 — 진행 중 / 종료된 문제
 * @domain study
 */
function ProblemsTab({
  isMock,
}: {
  readonly isMock: boolean;
}): ReactNode {
  const activeProblems = isMock ? MOCK_PROBLEMS_ACTIVE : [];
  const endedProblems = isMock ? MOCK_PROBLEMS_ENDED : [];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* 진행 중 */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-text">진행 중</p>
        {activeProblems.length > 0 ? (
          <div className="space-y-2">
            {activeProblems.map((p) => (
              <ProblemCard key={p.id} problem={p} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-6 text-center">
              <p className="text-sm text-text-3">진행 중인 문제가 없습니다.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 종료된 문제 */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-text">종료된 문제</p>
        {endedProblems.length > 0 ? (
          <div className="space-y-2">
            {endedProblems.map((p) => (
              <ProblemCard key={p.id} problem={p} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-6 text-center">
              <p className="text-sm text-text-3">종료된 문제가 없습니다.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

/**
 * 문제 카드
 * @domain study
 */
function ProblemCard({ problem }: { readonly problem: MockProblem }): ReactNode {
  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* 원형 번호 */}
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            {problem.number}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-text truncate">
                {problem.title}
              </span>
              {/* 난이도 뱃지 */}
              <span
                className="inline-flex items-center rounded-badge px-2 py-0.5 text-[11px] font-medium"
                style={{
                  color: `var(--diff-${problem.tier}-color)`,
                  backgroundColor: `var(--diff-${problem.tier}-bg)`,
                }}
              >
                {problem.difficulty}
              </span>
            </div>
            {/* 태그 */}
            <div className="flex items-center gap-1.5 mt-0.5">
              {problem.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[11px] text-text-3"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* D-day or 종료 */}
        {problem.dDay && (
          <Badge variant="warning">{problem.dDay}</Badge>
        )}
        {problem.ended && (
          <Badge className="bg-bg-alt text-text-3">종료</Badge>
        )}
      </div>
    </Card>
  );
}

// ─── MEMBERS TAB ─────────────────────────

/**
 * 멤버 탭 — 본인 상단 고정 + 닉네임 수정 + 프로그레스 바
 * @domain study
 */
function MembersTab({
  members,
  myUserId,
  isMock,
}: {
  readonly members: StudyMember[];
  readonly myUserId: string | null;
  readonly isMock: boolean;
}): ReactNode {
  const mockMembers = isMock ? MOCK_MEMBERS : [];
  const rawMembers = isMock ? mockMembers : members;

  // 닉네임 수정 상태
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameValue, setNicknameValue] = useState('');

  // 본인을 맨 위로 정렬
  const sorted = [...rawMembers].sort((a, b) => {
    const aIsMe = 'submissions' in a ? (a as MockMember).isMe : (a as StudyMember).user_id === myUserId;
    const bIsMe = 'submissions' in b ? (b as MockMember).isMe : (b as StudyMember).user_id === myUserId;
    if (aIsMe && !bIsMe) return -1;
    if (!aIsMe && bIsMe) return 1;
    return 0;
  });

  // 본인 / 나머지 분리
  const me = sorted.find((m) => {
    return 'submissions' in m ? (m as MockMember).isMe : (m as StudyMember).user_id === myUserId;
  });
  const others = sorted.filter((m) => {
    return 'submissions' in m ? !(m as MockMember).isMe : (m as StudyMember).user_id !== myUserId;
  });

  const renderRow = (member: (typeof sorted)[number], isMe: boolean) => {
    const isMockMember = 'submissions' in member;
    const name = isMockMember
      ? (member as MockMember).name
      : ((member as StudyMember).nickname ?? (member as StudyMember).username ?? (member as StudyMember).email ?? '');
    const role = isMockMember ? (member as MockMember).role : (member as StudyMember).role;
    const email = isMockMember ? (member as MockMember).email : ((member as StudyMember).email ?? '');
    const color = isMockMember ? (member as MockMember).color : 'var(--primary)';
    const submissions = isMockMember ? (member as MockMember).submissions : 0;
    const done = isMockMember ? (member as MockMember).done : 0;
    const total = isMockMember ? (member as MockMember).total : 0;
    const pct = total > 0 ? (done / total) * 100 : 0;
    const initial = name.charAt(0);

    return (
      <div key={member.id} className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: isMe ? 'var(--primary)' : color }}
            >
              {initial}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                {isMe && editingNickname ? (
                  <div className="flex items-center gap-1">
                    <input
                      className="w-28 rounded-md border border-primary bg-bg px-2 py-0.5 text-sm font-medium text-text outline-none"
                      value={nicknameValue}
                      onChange={(e) => setNicknameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') setEditingNickname(false);
                        if (e.key === 'Escape') setEditingNickname(false);
                      }}
                      autoFocus
                    />
                    <button
                      type="button"
                      className="rounded p-0.5 text-success hover:bg-success/10"
                      onClick={() => setEditingNickname(false)}
                      aria-label="저장"
                    >
                      <Check className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="rounded p-0.5 text-text-3 hover:bg-bg-alt"
                      onClick={() => setEditingNickname(false)}
                      aria-label="취소"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm font-medium text-text truncate">{name}</span>
                    {isMe && (
                      <button
                        type="button"
                        className="rounded p-0.5 text-text-3 hover:text-primary"
                        onClick={() => {
                          setNicknameValue(name);
                          setEditingNickname(true);
                        }}
                        aria-label="닉네임 수정"
                      >
                        <Pencil className="h-3 w-3" aria-hidden />
                      </button>
                    )}
                  </>
                )}
                {role === 'ADMIN' ? (
                  <Badge className="bg-bg-alt text-text-2">
                    <Crown className="h-2.5 w-2.5" aria-hidden />
                    관리자
                  </Badge>
                ) : (
                  <Badge className="bg-bg-alt text-text-2">멤버</Badge>
                )}
                {isMe && !editingNickname && (
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                    style={{ backgroundColor: 'var(--primary-soft)', color: 'var(--primary)' }}
                  >
                    나
                  </span>
                )}
              </div>
              <p className="text-[11px] text-text-3 truncate">{email}</p>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold text-text">{submissions}제출</p>
            <p className="text-[11px] text-text-3">{done}/{total} 완료</p>
          </div>
        </div>

        <div
          className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full"
          style={{ backgroundColor: 'var(--bg-alt)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-700 ease-bounce"
            style={{
              width: `${pct}%`,
              backgroundColor: isMe ? 'var(--primary)' : color,
            }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="animate-fade-in">
      <Card className="p-0 overflow-hidden">
        {/* 본인 */}
        {me && renderRow(me, true)}

        {/* 구분선 */}
        {me && others.length > 0 && (
          <div className="border-t-2 border-dashed border-border" />
        )}

        {/* 나머지 멤버 */}
        {others.map((member, idx) => (
          <div key={member.id}>
            {idx > 0 && <div className="border-t border-border" />}
            {renderRow(member, false)}
          </div>
        ))}
      </Card>
    </div>
  );
}
