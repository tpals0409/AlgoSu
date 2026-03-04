/**
 * @file 스터디 상세 페이지 — 3탭 (Overview / Members / Settings)
 * @domain study
 * @layer page
 * @related StudyContext, studyApi, AppLayout
 */

'use client';

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  use,
  type ReactNode,
} from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Copy,
  Check,
  UserMinus,
  Trash2,
  BarChart3,
  Settings,
  Users,
  Plus,
  Shield,
  LogOut,
  Pencil,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { LoadingSpinner, InlineSpinner } from '@/components/ui/LoadingSpinner';
import { Skeleton } from '@/components/ui/Skeleton';
import { useStudy } from '@/contexts/StudyContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  studyApi,
  type Study,
  type StudyMember,
  type StudyStats,
} from '@/lib/api';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { getAvatarPresetKey, getAvatarSrc } from '@/lib/avatars';
import { cn } from '@/lib/utils';

// ─── TYPES ───────────────────────────────

type TabKey = 'overview' | 'members' | 'settings';

interface PageProps {
  readonly params: Promise<{ id: string }>;
}

// ─── CONSTANTS ───────────────────────────

const TABS: { key: TabKey; label: string; icon: typeof Users; adminOnly?: boolean }[] = [
  { key: 'overview', label: '개요', icon: BarChart3 },
  { key: 'members', label: '멤버', icon: Users },
  { key: 'settings', label: '설정', icon: Settings, adminOnly: true },
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
  const [tab, setTab] = useState<TabKey>('overview');
  const [study, setStudy] = useState<Study | null>(null);
  const [members, setMembers] = useState<StudyMember[]>([]);
  const [stats, setStats] = useState<StudyStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // email 매칭으로 현재 사용자 ID 도출 (httpOnly Cookie → localStorage 토큰 없음)
  const myUserId = members.find((m) => m.email === user?.email)?.user_id ?? null;

  // 초대 코드
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteRemaining, setInviteRemaining] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showCopyToast, setShowCopyToast] = useState(false);
  const inviteTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 확인 모달 (추방 / 탈퇴)
  const [kickTarget, setKickTarget] = useState<StudyMember | null>(null);
  const [isKicking, setIsKicking] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  // 설정 수정
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // 역할 변경
  const [roleChanging, setRoleChanging] = useState<string | null>(null);

  // 스터디 삭제
  const [isDeleting, setIsDeleting] = useState(false);

  // Ground Rules
  const [groundRules, setGroundRules] = useState('');

  // ─── HELPERS ───────────────────────────

  const isAdmin = members.some(
    (m) => m.user_id === myUserId && m.role === 'ADMIN',
  );

  const isLastAdmin =
    isAdmin && members.filter((m) => m.role === 'ADMIN').length === 1;

  // ─── EFFECTS ───────────────────────────

  useEffect(() => {
    return () => {
      if (inviteTimerRef.current) clearInterval(inviteTimerRef.current);
    };
  }, []);

  /**
   * 스터디 데이터 로드
   * @domain study
   */
  const loadStudyData = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const [studyData, memberData] = await Promise.all([
        studyApi.getById(studyId),
        studyApi.getMembers(studyId),
      ]);
      setStudy(studyData);
      setMembers(memberData);
      setEditName(studyData.name);
      setEditDescription(studyData.description ?? '');

      // 통계는 비차단 로드
      studyApi.getStats(studyId).then(setStats).catch(() => {});
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

  // ─── HANDLERS ──────────────────────────

  /**
   * 초대 코드 생성
   * @domain study
   * @guard study-admin
   */
  const handleInvite = useCallback(async (): Promise<void> => {
    setIsInviting(true);
    try {
      const result = await studyApi.invite(studyId);
      setInviteCode(result.code);

      const expiresAt = new Date(result.expires_at).getTime();
      if (inviteTimerRef.current) clearInterval(inviteTimerRef.current);
      const tick = () => {
        const diff = expiresAt - Date.now();
        if (diff <= 0) {
          setInviteCode(null);
          setInviteRemaining(null);
          if (inviteTimerRef.current) clearInterval(inviteTimerRef.current);
          return;
        }
        const m = Math.floor(diff / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setInviteRemaining(`${m}:${String(s).padStart(2, '0')}`);
      };
      tick();
      inviteTimerRef.current = setInterval(tick, 1000);

      await navigator.clipboard.writeText(result.code);
      setCopied(true);
      setShowCopyToast(true);
      setTimeout(() => setCopied(false), 2000);
      setTimeout(() => setShowCopyToast(false), 2000);
    } catch {
      setError('초대 코드 생성에 실패했습니다.');
    } finally {
      setIsInviting(false);
    }
  }, [studyId]);

  /**
   * 클립보드 복사
   * @domain study
   */
  const handleCopy = useCallback(async (): Promise<void> => {
    if (!inviteCode) return;
    await navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setShowCopyToast(true);
    setTimeout(() => setCopied(false), 2000);
    setTimeout(() => setShowCopyToast(false), 2000);
  }, [inviteCode]);

  /**
   * 멤버 추방
   * @domain study
   * @guard study-admin
   */
  const handleKick = useCallback(async (): Promise<void> => {
    if (!kickTarget) return;
    setIsKicking(true);
    try {
      await studyApi.removeMember(studyId, kickTarget.user_id);
      setMembers((prev) => prev.filter((m) => m.id !== kickTarget.id));
      setKickTarget(null);
    } catch {
      setError('멤버 추방에 실패했습니다.');
    } finally {
      setIsKicking(false);
    }
  }, [studyId, kickTarget]);

  /**
   * 스터디 탈퇴 (자기 자신)
   * @domain study
   * @guard study-member
   */
  const handleLeave = useCallback(async (): Promise<void> => {
    if (!myUserId) return;
    setIsLeaving(true);
    try {
      await studyApi.removeMember(studyId, myUserId);
      setShowLeaveConfirm(false);
      router.replace('/studies');
    } catch {
      setError('스터디 탈퇴에 실패했습니다.');
    } finally {
      setIsLeaving(false);
    }
  }, [studyId, myUserId, router]);

  /**
   * 역할 변경
   * @domain study
   * @guard study-admin
   */
  const handleRoleChange = useCallback(
    async (
      member: StudyMember,
      newRole: 'ADMIN' | 'MEMBER',
    ): Promise<void> => {
      const roleLabel = newRole === 'ADMIN' ? '관리자' : '멤버';
      const confirmed = window.confirm(
        `${member.nickname ?? member.username ?? member.user_id.slice(0, 8)}님의 역할을 "${roleLabel}"(으)로 변경하시겠습니까?`,
      );
      if (!confirmed) return;

      setRoleChanging(member.id);
      try {
        await studyApi.changeRole(studyId, member.user_id, newRole);
        setMembers((prev) =>
          prev.map((m) =>
            m.id === member.id ? { ...m, role: newRole } : m,
          ),
        );
      } catch {
        setError('역할 변경에 실패했습니다.');
      } finally {
        setRoleChanging(null);
      }
    },
    [studyId],
  );

  /**
   * 본인 닉네임 변경
   * @domain study
   * @guard study-member
   */
  const handleNicknameUpdate = useCallback(async (nickname: string): Promise<void> => {
    try {
      await studyApi.updateNickname(studyId, nickname);
      setMembers((prev) =>
        prev.map((m) =>
          m.user_id === myUserId ? { ...m, nickname } : m,
        ),
      );
    } catch {
      setError('닉네임 변경에 실패했습니다.');
    }
  }, [studyId, myUserId]);

  /**
   * 스터디 설정 저장
   * @domain study
   * @guard study-admin
   */
  const handleSaveEdit = useCallback(async (): Promise<void> => {
    setIsSavingEdit(true);
    try {
      const updated = await studyApi.update(studyId, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
      });
      setStudy(updated);
    } catch {
      setError('스터디 설정 수정에 실패했습니다.');
    } finally {
      setIsSavingEdit(false);
    }
  }, [studyId, editName, editDescription]);

  /**
   * Ground Rules 저장
   * @domain study
   * @guard study-admin
   * @note API 미구현 — 추후 studyApi.updateGroundRules 연동 시 교체
   */
  const handleSaveGroundRules = useCallback((): void => {
    if (!groundRules.trim()) return;
    alert('Ground Rules가 임시 저장되었습니다. (API 연동 후 서버에 저장됩니다)');
  }, [groundRules]);

  /**
   * 스터디 삭제
   * @domain study
   * @guard study-admin
   */
  const { removeStudy } = useStudy();
  const handleDeleteStudy = useCallback(async (): Promise<void> => {
    const confirmed = window.confirm(
      '정말 이 스터디를 삭제하시겠습니까? 모든 데이터가 영구 삭제되며 되돌릴 수 없습니다.',
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await studyApi.delete(studyId);
      removeStudy(studyId);
      router.replace('/studies');
    } catch {
      setError('스터디 삭제에 실패했습니다.');
      setIsDeleting(false);
    }
  }, [studyId, removeStudy, router]);

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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/studies')}
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
            스터디 목록
          </Button>
        </div>
      </AppLayout>
    );
  }

  // ADMIN이 아니면 settings 탭 숨김
  const visibleTabs = TABS.filter((t) => !t.adminOnly || isAdmin);

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-5">
        {/* 뒤로가기 + 스터디명 */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/studies')}
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          </Button>
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-text">
              {study?.name ?? ''}
            </h1>
            {study?.description && (
              <p className="text-sm text-text-2">{study.description}</p>
            )}
          </div>
        </div>

        {error && (
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* 탭 바 */}
        <div className="flex gap-1 rounded-card border border-border bg-bg-card p-1 shadow">
          {visibleTabs.map((t) => {
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

        {/* 탭 내용 */}
        {tab === 'overview' && (
          <OverviewTab
            study={study}
            stats={stats}
            members={members}
          />
        )}

        {tab === 'members' && (
          <MembersTab
            studyId={studyId}
            members={members}
            myUserId={myUserId}
            isAdmin={isAdmin}
            isLastAdmin={isLastAdmin}
            inviteCode={inviteCode}
            inviteRemaining={inviteRemaining}
            isInviting={isInviting}
            copied={copied}
            roleChanging={roleChanging}
            onInvite={() => void handleInvite()}
            onCopy={() => void handleCopy()}
            onRoleChange={handleRoleChange}
            onKick={setKickTarget}
            onLeave={() => setShowLeaveConfirm(true)}
            onNicknameUpdate={handleNicknameUpdate}
          />
        )}

        {tab === 'settings' && isAdmin && (
          <SettingsTab
            editName={editName}
            editDescription={editDescription}
            isSavingEdit={isSavingEdit}
            isDeleting={isDeleting}
            groundRules={groundRules}
            onNameChange={setEditName}
            onDescriptionChange={setEditDescription}
            onGroundRulesChange={setGroundRules}
            onSaveGroundRules={handleSaveGroundRules}
            onSave={() => void handleSaveEdit()}
            onDelete={() => void handleDeleteStudy()}
          />
        )}
      </div>

      {/* 추방 확인 모달 */}
      {kickTarget && (
        <ConfirmModal
          title="멤버 추방"
          description={`정말 ${kickTarget.nickname ?? kickTarget.username ?? kickTarget.user_id.slice(0, 8)}님을 추방하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
          confirmLabel="추방"
          isLoading={isKicking}
          onConfirm={() => void handleKick()}
          onCancel={() => setKickTarget(null)}
        />
      )}

      {/* 탈퇴 확인 모달 */}
      {showLeaveConfirm && (
        <ConfirmModal
          title="스터디 탈퇴"
          description="정말 이 스터디에서 탈퇴하시겠습니까?"
          confirmLabel="탈퇴"
          isLoading={isLeaving}
          onConfirm={() => void handleLeave()}
          onCancel={() => setShowLeaveConfirm(false)}
        />
      )}

      {/* 복사 토스트 */}
      {showCopyToast &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 animate-fade-in">
            <div className="flex items-center gap-2 rounded-card border border-border bg-bg-card px-4 py-2.5 shadow-modal">
              <Check className="h-4 w-4 text-success" aria-hidden />
              <span className="text-[12px] font-medium text-text">
                초대 코드가 복사되었습니다
              </span>
            </div>
          </div>,
          document.body,
        )}
    </AppLayout>
  );
}

// ─── OVERVIEW TAB ────────────────────────

interface OverviewTabProps {
  readonly study: Study | null;
  readonly stats: StudyStats | null;
  readonly members: StudyMember[];
}

/**
 * Overview 탭 — 스터디 정보 + 통계 요약
 * @domain study
 */
function OverviewTab({ study, stats, members }: OverviewTabProps): ReactNode {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* 스터디 정보 */}
      <Card>
        <CardContent className="space-y-3 py-4">
          <div className="grid grid-cols-2 gap-4">
            <InfoItem label="스터디명" value={study?.name ?? '-'} />
            <InfoItem
              label="멤버"
              value={`${members.length}명`}
            />
            <InfoItem
              label="GitHub 연동"
              value={study?.githubRepo ?? '미연동'}
            />
            <InfoItem
              label="내 역할"
              value={study?.role === 'ADMIN' ? '관리자' : '멤버'}
            />
          </div>
        </CardContent>
      </Card>

      {/* 통계 요약 */}
      {stats ? (
        <>
          {/* 숫자 카드 */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              label="총 제출"
              value={stats.totalSubmissions}
              color="text-primary"
            />
            <StatCard
              label="풀이 문제"
              value={stats.solvedProblemIds.length}
              color="text-success"
            />
            <StatCard
              label="활성 멤버"
              value={members.length}
              color="text-text"
            />
          </div>

          {/* 주차별 제출 */}
          {stats.byWeek.length > 0 && (
            <Card>
              <CardContent className="py-4">
                <p className="mb-3 text-sm font-semibold text-text">
                  주차별 제출 추이
                </p>
                <div className="space-y-2">
                  {stats.byWeek.slice(0, 6).map((w) => {
                    const maxCount = Math.max(
                      ...stats.byWeek.map((wk) => wk.count),
                      1,
                    );
                    const pct = (w.count / maxCount) * 100;
                    return (
                      <div
                        key={w.week}
                        className="flex items-center gap-3"
                      >
                        <span className="min-w-[56px] text-right font-mono text-xs text-text-2">
                          {w.week}
                        </span>
                        <div className="h-5 flex-1 overflow-hidden rounded-badge bg-bg-alt">
                          <div
                            className="h-full rounded-badge transition-all duration-700 ease-bounce"
                            style={{
                              width: `${pct}%`,
                              background: 'var(--bar-fill)',
                            }}
                          />
                        </div>
                        <span className="min-w-[28px] font-mono text-xs font-semibold text-text">
                          {w.count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 멤버별 풀이 */}
          {stats.byMember.length > 0 && (
            <Card>
              <CardContent className="py-4">
                <p className="mb-3 text-sm font-semibold text-text">
                  멤버별 풀이
                </p>
                <div className="space-y-2">
                  {stats.byMember.map((m) => {
                    const maxCount = Math.max(
                      ...stats.byMember.map((mb) => mb.count),
                      1,
                    );
                    const pct = (m.count / maxCount) * 100;
                    return (
                      <div
                        key={m.userId}
                        className="flex items-center gap-3"
                      >
                        <span className="min-w-[56px] truncate text-right text-xs text-text-2">
                          {m.userId.slice(0, 8)}
                        </span>
                        <div className="h-5 flex-1 overflow-hidden rounded-badge bg-bg-alt">
                          <div
                            className="h-full rounded-badge transition-all duration-700 ease-bounce"
                            style={{
                              width: `${pct}%`,
                              background: 'var(--bar-fill)',
                            }}
                          />
                        </div>
                        <span className="min-w-[28px] font-mono text-xs font-semibold text-text">
                          {m.count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 난이도 분포 */}
          <Card>
            <CardHeader className="px-4 py-3">
              <CardTitle className="text-[13px]">난이도 분포</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-2">
                {(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'] as const).map((tier) => (
                  <div key={tier} className="flex items-center gap-2">
                    <span className="w-16 text-[10px] font-mono text-text-3">{tier}</span>
                    <div className="flex-1 h-2 rounded-full bg-bg-alt">
                      <div
                        className="h-2 rounded-full"
                        style={{ width: '0%', backgroundColor: `var(--diff-${tier.toLowerCase()}-color)` }}
                      />
                    </div>
                    <span className="w-6 text-[10px] font-mono text-text-3 text-right">0</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-center text-[11px] text-text-3">
                문제 데이터 연동 후 표시됩니다.
              </p>
            </CardContent>
          </Card>

          {/* 언어 분포 */}
          <Card>
            <CardHeader className="px-4 py-3">
              <CardTitle className="text-[13px]">언어 분포</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="rounded-btn border border-border bg-bg-alt px-4 py-6 text-center">
                <p className="text-[11px] text-text-3">
                  제출 데이터 연동 후 언어별 분포가 표시됩니다.
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Skeleton height={80} />
            <Skeleton height={80} />
            <Skeleton height={80} />
          </div>
          <Skeleton height={160} />
        </div>
      )}
    </div>
  );
}

// ─── MEMBERS TAB ─────────────────────────

interface MembersTabProps {
  readonly studyId: string;
  readonly members: StudyMember[];
  readonly myUserId: string | null;
  readonly isAdmin: boolean;
  readonly isLastAdmin: boolean;
  readonly inviteCode: string | null;
  readonly inviteRemaining: string | null;
  readonly isInviting: boolean;
  readonly copied: boolean;
  readonly roleChanging: string | null;
  readonly onInvite: () => void;
  readonly onCopy: () => void;
  readonly onRoleChange: (member: StudyMember, role: 'ADMIN' | 'MEMBER') => Promise<void>;
  readonly onKick: (member: StudyMember) => void;
  readonly onLeave: () => void;
  readonly onNicknameUpdate: (nickname: string) => Promise<void>;
}

/**
 * Members 탭 — 멤버 목록, 초대, 역할 변경, 추방, 탈퇴
 * @domain study
 */
function MembersTab({
  members,
  myUserId,
  isAdmin,
  isLastAdmin,
  inviteCode,
  inviteRemaining,
  isInviting,
  copied,
  roleChanging,
  onInvite,
  onCopy,
  onRoleChange,
  onKick,
  onLeave,
  onNicknameUpdate,
}: MembersTabProps): ReactNode {
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  const [isSavingNickname, setIsSavingNickname] = useState(false);

  const startEditNickname = useCallback((currentNickname: string) => {
    setNicknameInput(currentNickname);
    setEditingNickname(true);
  }, []);

  const saveNickname = useCallback(async () => {
    const trimmed = nicknameInput.trim();
    if (!trimmed) return;
    setIsSavingNickname(true);
    try {
      await onNicknameUpdate(trimmed);
      setEditingNickname(false);
    } finally {
      setIsSavingNickname(false);
    }
  }, [nicknameInput, onNicknameUpdate]);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* 초대 코드 (ADMIN) */}
      {isAdmin && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                </div>
                <span className="text-sm font-semibold text-text">
                  멤버 초대
                </span>
              </div>
              {!inviteCode && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onInvite}
                  disabled={isInviting}
                >
                  {isInviting ? (
                    <>
                      <InlineSpinner />
                      생성 중...
                    </>
                  ) : (
                    '초대 코드 생성'
                  )}
                </Button>
              )}
            </div>
            {inviteCode && (
              <div className="mt-3 flex items-center gap-2">
                <code className="flex flex-1 items-center justify-between rounded-btn border border-border bg-bg-alt px-3 py-2 font-mono text-sm text-primary">
                  <span>{inviteCode}</span>
                  {inviteRemaining && (
                    <span className="text-[11px] text-text-3">
                      {inviteRemaining}
                    </span>
                  )}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onCopy}
                  className={copied ? 'text-success' : ''}
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <Copy className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {copied ? '복사됨' : '복사'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 멤버 목록 */}
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text">멤버</span>
            <Badge variant="default">{members.length}명</Badge>
          </div>
        </div>

        {members.map((member, idx) => {
          const isMe = member.user_id === myUserId;
          return (
            <div
              key={member.id}
              className={cn(
                'flex items-center justify-between px-4 py-3 transition-colors hover:bg-primary-soft',
                idx < members.length - 1 && 'border-b border-border',
              )}
            >
              <div className="flex min-w-0 items-center gap-3">
                <Image
                  src={getAvatarSrc(
                    getAvatarPresetKey(member.avatar_url),
                  )}
                  alt={member.nickname ?? member.username ?? '멤버'}
                  width={32}
                  height={32}
                  className="shrink-0 rounded-full"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    {isMe && editingNickname ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          value={nicknameInput}
                          onChange={(e) => setNicknameInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void saveNickname();
                            if (e.key === 'Escape') setEditingNickname(false);
                          }}
                          disabled={isSavingNickname}
                          maxLength={50}
                          className="w-28 rounded-btn border border-primary bg-bg-alt px-2 py-0.5 text-xs text-text outline-none"
                          autoFocus
                        />
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => void saveNickname()}
                          disabled={isSavingNickname || !nicknameInput.trim()}
                          className="h-6 px-2 text-[10px]"
                        >
                          {isSavingNickname ? <InlineSpinner /> : '저장'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingNickname(false)}
                          disabled={isSavingNickname}
                          className="h-6 px-2 text-[10px]"
                        >
                          취소
                        </Button>
                      </div>
                    ) : (
                      <>
                        <p className={`truncate text-xs font-medium ${member.deleted_at ? 'text-text-3 italic' : 'text-text'}`}>
                          {member.deleted_at
                            ? '탈퇴한 사용자'
                            : (member.nickname ??
                              member.username ??
                              member.email ??
                              member.user_id.slice(0, 8))}
                        </p>
                        {isMe && !member.deleted_at && (
                          <button
                            type="button"
                            onClick={() => startEditNickname(member.nickname ?? '')}
                            className="text-text-3 hover:text-primary transition-colors"
                            title="닉네임 변경"
                          >
                            <Pencil className="h-3 w-3" aria-hidden />
                          </button>
                        )}
                      </>
                    )}
                    {member.role === 'ADMIN' && (
                      <Badge variant="info">
                        <Shield className="mr-0.5 h-2.5 w-2.5" aria-hidden />
                        관리자
                      </Badge>
                    )}
                    {isMe && !editingNickname && (
                      <span className="text-[10px] text-text-3">(나)</span>
                    )}
                  </div>
                  <p className="font-mono text-[10px] text-text-3">
                    {member.joined_at
                      ? new Date(member.joined_at).toLocaleDateString('ko-KR')
                      : ''}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {/* ADMIN이고 본인이 아닌 멤버: 역할 변경 + 추방 */}
                {isAdmin && !isMe && (
                  <>
                    <select
                      value={member.role}
                      onChange={(e) =>
                        void onRoleChange(
                          member,
                          e.target.value as 'ADMIN' | 'MEMBER',
                        )
                      }
                      disabled={roleChanging === member.id}
                      className="rounded-btn border border-border bg-bg-alt px-2 py-1 text-[11px] text-text outline-none transition-colors focus:border-primary disabled:opacity-50"
                    >
                      <option value="ADMIN">관리자</option>
                      <option value="MEMBER">멤버</option>
                    </select>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onKick(member)}
                      className="text-error transition-colors hover:text-error"
                    >
                      <UserMinus className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </>
                )}

                {/* 본인: 탈퇴 버튼 (마지막 ADMIN이면 비활성) */}
                {isMe && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onLeave}
                    disabled={isLastAdmin}
                    title={
                      isLastAdmin
                        ? '마지막 관리자는 탈퇴할 수 없습니다. 다른 멤버에게 관리자를 위임하세요.'
                        : '스터디 탈퇴'
                    }
                    className="text-text-3 transition-colors hover:text-error"
                  >
                    <LogOut className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                )}

                {/* ADMIN이 아니고 본인이 아닌 멤버: 역할 뱃지만 표시 */}
                {!isAdmin && !isMe && (
                  <Badge
                    variant={member.role === 'ADMIN' ? 'info' : 'muted'}
                  >
                    {member.role === 'ADMIN' ? '관리자' : '멤버'}
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

// ─── SETTINGS TAB ────────────────────────

interface SettingsTabProps {
  readonly editName: string;
  readonly editDescription: string;
  readonly isSavingEdit: boolean;
  readonly isDeleting: boolean;
  readonly groundRules: string;
  readonly onNameChange: (v: string) => void;
  readonly onDescriptionChange: (v: string) => void;
  readonly onGroundRulesChange: (v: string) => void;
  readonly onSaveGroundRules: () => void;
  readonly onSave: () => void;
  readonly onDelete: () => void;
}

/**
 * Settings 탭 — 스터디 이름/설명 수정 + 삭제
 * @domain study
 * @guard study-admin
 */
function SettingsTab({
  editName,
  editDescription,
  isSavingEdit,
  isDeleting,
  groundRules,
  onNameChange,
  onDescriptionChange,
  onGroundRulesChange,
  onSaveGroundRules,
  onSave,
  onDelete,
}: SettingsTabProps): ReactNode {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* 스터디 정보 수정 */}
      <Card>
        <CardHeader>
          <CardTitle>스터디 설정</CardTitle>
          <CardDescription>스터디 이름과 설명을 수정합니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="스터디 이름"
            value={editName}
            onChange={(e) => onNameChange(e.target.value)}
            disabled={isSavingEdit}
          />
          <div className="flex flex-col">
            <label
              htmlFor="edit-description"
              className="mb-[5px] text-[11px] font-medium text-text-2"
            >
              설명 (선택)
            </label>
            <textarea
              id="edit-description"
              value={editDescription}
              onChange={(e) => onDescriptionChange(e.target.value)}
              disabled={isSavingEdit}
              rows={3}
              className="w-full resize-y rounded-badge border border-border bg-bg-alt px-3 py-2 text-xs text-text outline-none transition-colors placeholder:text-text-3 focus:border-primary disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-3">
          <Button
            variant="primary"
            size="sm"
            onClick={onSave}
            disabled={isSavingEdit || !editName.trim()}
          >
            {isSavingEdit ? (
              <>
                <InlineSpinner />
                저장 중...
              </>
            ) : (
              '저장'
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* Ground Rules (B5) — API 미구현, alert 대체 */}
      <Card>
        <CardHeader>
          <CardTitle>Ground Rules</CardTitle>
          <CardDescription>
            스터디 운영 규칙을 설정합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-medium text-text">그라운드 룰</h3>
              <span className="text-[10px] font-mono text-text-3">{groundRules.length}/500</span>
            </div>
            <textarea
              value={groundRules}
              onChange={(e) => onGroundRulesChange(e.target.value.slice(0, 500))}
              placeholder="스터디 규칙을 작성하세요..."
              rows={4}
              className="w-full rounded-badge border border-border bg-input-bg px-3 py-2 text-xs text-text placeholder:text-text-3 focus:border-primary outline-none resize-none"
            />
            <Button variant="primary" size="sm" onClick={onSaveGroundRules}>
              저장
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 위험 영역: 스터디 삭제 */}
      <Card className="border-error/30">
        <CardHeader>
          <CardTitle className="text-error">위험 영역</CardTitle>
          <CardDescription>
            스터디를 삭제하면 모든 데이터가 영구 삭제됩니다.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button
            variant="danger"
            size="sm"
            onClick={onDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <InlineSpinner />
                삭제 중...
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                스터디 삭제
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

// ─── SHARED COMPONENTS ───────────────────

/**
 * 정보 항목 (label + value)
 * @domain common
 */
function InfoItem({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): ReactNode {
  return (
    <div>
      <p className="text-[11px] text-text-3">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-text">{value}</p>
    </div>
  );
}

/**
 * 통계 숫자 카드
 * @domain study
 */
function StatCard({
  label,
  value,
  color,
}: {
  readonly label: string;
  readonly value: number;
  readonly color: string;
}): ReactNode {
  return (
    <Card>
      <CardContent className="py-4 text-center">
        <p className="text-[11px] text-text-3">{label}</p>
        <p className={cn('mt-1 font-mono text-2xl font-bold', color)}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * 확인 모달 (추방 / 탈퇴 공용)
 * @domain common
 */
function ConfirmModal({
  title,
  description,
  confirmLabel,
  isLoading,
  onConfirm,
  onCancel,
}: {
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly isLoading: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}): ReactNode {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm">
      <Card className="mx-4 w-full max-w-sm">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardFooter className="flex gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1"
            onClick={onCancel}
            disabled={isLoading}
          >
            취소
          </Button>
          <Button
            variant="danger"
            size="sm"
            className="flex-1"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <InlineSpinner />
                처리 중...
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
