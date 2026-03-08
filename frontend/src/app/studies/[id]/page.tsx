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
import { DifficultyBadge } from '@/components/ui/DifficultyBadge';
import { useAuth } from '@/contexts/AuthContext';
import {
  studyApi,
  problemApi,
  type Study,
  type StudyMember,
  type Problem,
  type StudyStats,
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
  const [problems, setProblems] = useState<Problem[]>([]);
  const [stats, setStats] = useState<StudyStats | null>(null);
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

    try {
      const [studyData, memberData, problemData, statsData] = await Promise.all([
        studyApi.getById(studyId),
        studyApi.getMembers(studyId),
        problemApi.findAllIncludingClosed().catch(() => [] as Problem[]),
        studyApi.getStats(studyId).catch(() => null),
      ]);
      setStudy(studyData);
      setMembers(memberData);
      setProblems(problemData);
      setStats(statsData);
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

  const memberCount = members.length;

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
                <h1 className="text-lg sm:text-[22px] font-bold tracking-tight text-text truncate">
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
            <RulesTab isAdmin={isAdmin} groundRules={study?.groundRules ?? null} />
          )}

          {tab === 'problems' && (
            <ProblemsTab problems={problems} />
          )}

          {tab === 'members' && (
            <MembersTab
              members={members}
              myUserId={myUserId}
              studyId={studyId}
              stats={stats}
              totalProblems={problems.length}
              onNicknameUpdated={loadStudyData}
            />
          )}
        </div>
      </div>
    </AppLayout>
  );
}

// ─── RULES TAB ──────────────────────────

/**
 * 그라운드룰 탭 — 텍스트 렌더링 (groundRules 필드 from Study)
 * @domain study
 */
function RulesTab({
  isAdmin: _isAdmin,
  groundRules,
}: {
  readonly isAdmin: boolean;
  readonly groundRules: string | null;
}): ReactNode {
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

          {/* 그라운드룰 콘텐츠 */}
          {groundRules ? (
            <div className="prose prose-sm max-w-none text-text whitespace-pre-wrap text-sm leading-relaxed">
              {groundRules}
            </div>
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
 * 난이도를 티어 문자열로 변환 (CSS 변수 매핑용)
 */
function difficultyToTier(difficulty: string): string {
  return difficulty.toLowerCase();
}

/**
 * D-day 계산 — deadline까지 남은 일수
 */
function calcDDay(deadline: string): string {
  const now = new Date();
  const dl = new Date(deadline);
  const diff = Math.ceil((dl.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return '마감';
  if (diff === 0) return 'D-Day';
  return `D-${diff}`;
}

/**
 * 문제 탭 — 진행 중 / 종료된 문제
 * @domain study
 */
function ProblemsTab({
  problems,
}: {
  readonly problems: Problem[];
}): ReactNode {
  // deadline이 지난 ACTIVE 문제는 종료로 간주
  const isExpired = (p: Problem) =>
    p.status === 'ACTIVE' && new Date(p.deadline) < new Date();

  const activeProblems = problems
    .filter((p) => p.status === 'ACTIVE' && !isExpired(p))
    .map((p, idx) => ({
      id: p.id,
      number: idx + 1,
      title: p.title,
      difficulty: p.difficulty,
      level: p.level,
      tier: difficultyToTier(p.difficulty),
      tags: p.tags ?? [],
      dDay: calcDDay(p.deadline),
    }));

  const endedProblems = problems
    .filter((p) => p.status === 'CLOSED' || isExpired(p))
    .map((p, idx) => ({
      id: p.id,
      number: idx + 1,
      title: p.title,
      difficulty: p.difficulty,
      level: p.level,
      tier: difficultyToTier(p.difficulty),
      tags: p.tags ?? [],
      ended: true as const,
    }));

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
function ProblemCard({ problem }: { readonly problem: { id: string; number: number; title: string; difficulty: string; level?: number | null; tier: string; tags: string[]; dDay?: string; ended?: boolean } }): ReactNode {
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
              {problem.difficulty && (
                <DifficultyBadge difficulty={problem.difficulty as import('@/lib/constants').Difficulty} level={problem.level} />
              )}
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
  studyId,
  stats,
  totalProblems,
  onNicknameUpdated,
}: {
  readonly members: StudyMember[];
  readonly myUserId: string | null;
  readonly studyId: string;
  readonly stats: StudyStats | null;
  readonly totalProblems: number;
  readonly onNicknameUpdated: () => Promise<void>;
}): ReactNode {
  // 닉네임 수정 상태
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameValue, setNicknameValue] = useState('');
  const [nicknameSaving, setNicknameSaving] = useState(false);

  /** 닉네임 저장 — studyApi.updateNickname 호출 */
  const saveNickname = useCallback(async () => {
    if (!nicknameValue.trim()) {
      setEditingNickname(false);
      return;
    }
    setNicknameSaving(true);
    try {
      await studyApi.updateNickname(studyId, nicknameValue.trim());
      setEditingNickname(false);
      // 멤버 목록 갱신
      await onNicknameUpdated();
    } catch {
      // 저장 실패 시 편집 상태 유지
    } finally {
      setNicknameSaving(false);
    }
  }, [studyId, nicknameValue, onNicknameUpdated]);

  /** 멤버별 고유 문제 제출 수 — recentSubmissions에서 도출 */
  const memberUniqueProblemMap = new Map<string, number>();
  const perUserProblems = new Map<string, Set<string>>();
  for (const s of stats?.recentSubmissions ?? []) {
    if (s.sagaStep !== 'DONE') continue;
    if (!perUserProblems.has(s.userId ?? '')) perUserProblems.set(s.userId ?? '', new Set());
    perUserProblems.get(s.userId ?? '')!.add(s.problemId);
  }
  for (const [uid, pids] of perUserProblems) {
    memberUniqueProblemMap.set(uid, pids.size);
  }

  // 본인을 맨 위로 정렬
  const sorted = [...members].sort((a, b) => {
    const aIsMe = a.user_id === myUserId;
    const bIsMe = b.user_id === myUserId;
    if (aIsMe && !bIsMe) return -1;
    if (!aIsMe && bIsMe) return 1;
    return 0;
  });

  // 본인 / 나머지 분리
  const me = sorted.find((m) => m.user_id === myUserId);
  const others = sorted.filter((m) => m.user_id !== myUserId);

  const renderRow = (member: StudyMember, isMe: boolean) => {
    const name = member.nickname ?? member.username ?? member.email ?? '';
    const role = member.role;
    const email = member.email ?? '';
    const color = 'var(--primary)';
    const submissions = memberUniqueProblemMap.get(member.user_id) ?? 0;
    const done = submissions;
    const total = totalProblems;
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
              <div className="flex flex-wrap items-center gap-1.5">
                {isMe && editingNickname ? (
                  <div className="flex items-center gap-1">
                    <input
                      className="w-24 sm:w-28 rounded-md border border-primary bg-bg px-2 py-0.5 text-sm font-medium text-text outline-none"
                      value={nicknameValue}
                      onChange={(e) => setNicknameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void saveNickname();
                        if (e.key === 'Escape') setEditingNickname(false);
                      }}
                      disabled={nicknameSaving}
                      autoFocus
                    />
                    <button
                      type="button"
                      className="rounded p-0.5 text-success hover:bg-success/10 disabled:opacity-50"
                      onClick={() => void saveNickname()}
                      disabled={nicknameSaving}
                      aria-label="저장"
                    >
                      <Check className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="rounded p-0.5 text-text-3 hover:bg-bg-alt"
                      onClick={() => setEditingNickname(false)}
                      disabled={nicknameSaving}
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
