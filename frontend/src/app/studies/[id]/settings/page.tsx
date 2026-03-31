/**
 * @file 스터디 설정 페이지 — 기본 정보 / 그라운드룰 / 멤버 / 초대코드 / 삭제
 * @domain study
 * @layer page
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
  Crown,
  ShieldCheck,
  Trash2,
  Copy,
  RefreshCw,
  Eye,
  Pencil,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import {
  studyApi,
  type Study,
  type StudyMember,
} from '@/lib/api';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useAuth } from '@/contexts/AuthContext';
import { MarkdownViewer } from '@/components/ui/MarkdownViewer';
import { getAvatarPresetKey, getAvatarSrc, toAvatarUrl, STUDY_AVATAR_PRESETS } from '@/lib/avatars';
import Image from 'next/image';
import { cn } from '@/lib/utils';

// ─── TYPES ───────────────────────────────

interface PageProps {
  readonly params: Promise<{ id: string }>;
}

interface SettingsMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MEMBER';
  color: string;
  avatarUrl: string | null;
}

// ─── RENDER ──────────────────────────────

export default function StudySettingsPage({ params }: PageProps): ReactNode {
  const { id: studyId } = use(params);
  const router = useRouter();
  const { isAuthenticated } = useRequireAuth();
  const { user } = useAuth();

  // ─── STATE ─────────────────────────────
  const [study, setStudy] = useState<Study | null>(null);
  const [members, setMembers] = useState<StudyMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // 기본 정보 폼
  const [studyName, setStudyName] = useState('');
  const [studyDesc, setStudyDesc] = useState('');
  const [isSavingInfo, setIsSavingInfo] = useState(false);

  // 그라운드룰
  const [rulesText, setRulesText] = useState('');
  const [rulesMode, setRulesMode] = useState<'edit' | 'preview'>('edit');
  const [isSavingRules, setIsSavingRules] = useState(false);

  // 아바타
  const [selectedStudyAvatarKey, setSelectedStudyAvatarKey] = useState('study-default');
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);

  // 초대 코드
  const [inviteCode, setInviteCode] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);
  const [codeExpiry, setCodeExpiry] = useState(0);
  const [codeActive, setCodeActive] = useState(false);
  const [isRefreshingCode, setIsRefreshingCode] = useState(false);

  // 멤버 강퇴 확인 모달
  const [removeMember, setRemoveMember] = useState<SettingsMember | null>(null);

  // 멤버 등급 변경 확인 모달
  const [pendingRoleChange, setPendingRoleChange] = useState<{ member: SettingsMember; newRole: 'ADMIN' | 'MEMBER' } | null>(null);

  // 스터디 정보 저장 확인 모달
  const [showSaveInfoConfirm, setShowSaveInfoConfirm] = useState(false);

  // 그라운드 룰 저장 확인 모달
  const [showSaveRulesConfirm, setShowSaveRulesConfirm] = useState(false);

  // 삭제
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // mount animation — 로딩 완료 후 트리거
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (isLoading) return;
    setMounted(false);
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, [isLoading]);

  // 초대코드 타이머
  useEffect(() => {
    if (!codeActive) return;
    if (codeExpiry <= 0) {
      setCodeActive(false);
      return;
    }
    const timer = setInterval(() => {
      setCodeExpiry((prev) => {
        if (prev <= 1) {
          setCodeActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [codeActive, codeExpiry]);

  /** 성공 메시지 자동 제거 */
  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(null), 3000);
    return () => clearTimeout(t);
  }, [successMsg]);

  const fade = (delay = 0): CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(16px)',
    transition: `opacity .5s cubic-bezier(.16,1,.3,1) ${delay}s, transform .5s cubic-bezier(.16,1,.3,1) ${delay}s`,
  });

  // ─── EFFECTS ───────────────────────────

  const loadStudyData = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const [studyData, memberData] = await Promise.all([
        studyApi.getById(studyId),
        studyApi.getMembers(studyId),
      ]);
      setStudy(studyData);
      setStudyName(studyData.name);
      setStudyDesc(studyData.description ?? '');
      setRulesText(studyData.groundRules ?? '');
      setSelectedStudyAvatarKey(getAvatarPresetKey(studyData.avatar_url));
      setMembers(memberData);
      document.title = `${studyData.name} 설정 | AlgoSu`;
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

  /** 기본 정보 저장 (스터디 이름 + 소개) */
  const handleSaveInfo = async (): Promise<void> => {
    if (!studyName.trim()) {
      setError('스터디 이름을 입력해주세요.');
      return;
    }
    setIsSavingInfo(true);
    setError(null);
    try {
      const updated = await studyApi.update(studyId, {
        name: studyName.trim(),
        description: studyDesc.trim(),
      });
      setStudy(updated);
      setSuccessMsg('기본 정보가 저장되었습니다.');
    } catch (err: unknown) {
      setError((err as Error).message ?? '기본 정보 저장에 실패했습니다.');
    } finally {
      setIsSavingInfo(false);
    }
  };

  /** 그라운드룰 저장 */
  const handleSaveRules = async (): Promise<void> => {
    setIsSavingRules(true);
    setError(null);
    try {
      await studyApi.updateGroundRules(studyId, rulesText);
      setSuccessMsg('그라운드룰이 저장되었습니다.');
    } catch (err: unknown) {
      setError((err as Error).message ?? '그라운드룰 저장에 실패했습니다.');
    } finally {
      setIsSavingRules(false);
    }
  };

  /** 멤버 내보내기 (확인 모달 후 실행) */
  const handleRemoveMemberConfirm = async (): Promise<void> => {
    if (!removeMember) return;
    const member = removeMember;
    setRemoveMember(null);
    setError(null);
    try {
      await studyApi.removeMember(studyId, member.userId);
      const updatedMembers = await studyApi.getMembers(studyId);
      setMembers(updatedMembers);
      setSuccessMsg(`${member.name} 님이 스터디에서 내보내졌습니다.`);
    } catch (err: unknown) {
      setError((err as Error).message ?? '멤버 내보내기에 실패했습니다.');
    }
  };

  /** 멤버 역할 변경 */
  const handleChangeRole = async (member: SettingsMember, newRole: 'ADMIN' | 'MEMBER'): Promise<void> => {
    setError(null);
    try {
      await studyApi.changeRole(studyId, member.userId, newRole);
      const updatedMembers = await studyApi.getMembers(studyId);
      setMembers(updatedMembers);
      const roleLabel = newRole === 'ADMIN' ? '관리자' : '멤버';
      setSuccessMsg(`${member.name} 님의 역할이 ${roleLabel}(으)로 변경되었습니다.`);
    } catch (err: unknown) {
      setError((err as Error).message ?? '역할 변경에 실패했습니다.');
    }
  };

  /** 초대 코드 복사 */
  const handleCopyCode = async (): Promise<void> => {
    await navigator.clipboard.writeText(inviteCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  /** 초대 코드 재생성 — API 호출 */
  const handleRefreshCode = async (): Promise<void> => {
    setIsRefreshingCode(true);
    setError(null);
    try {
      const result = await studyApi.invite(studyId);
      setInviteCode(result.code);
      // 만료 시각으로부터 남은 초 계산
      const expiresAt = new Date(result.expires_at).getTime();
      const remainingSec = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setCodeExpiry(remainingSec);
      setCodeActive(remainingSec > 0);
    } catch (err: unknown) {
      setError((err as Error).message ?? '초대 코드 생성에 실패했습니다.');
    } finally {
      setIsRefreshingCode(false);
    }
  };

  /** 스터디 삭제 */
  const handleDeleteStudy = async (): Promise<void> => {
    setIsDeleting(true);
    setError(null);
    try {
      await studyApi.delete(studyId);
      router.push('/studies');
    } catch (err: unknown) {
      setError((err as Error).message ?? '스터디 삭제에 실패했습니다.');
      setIsDeleting(false);
    }
  };

  // ─── LOADING / ERROR ───────────────────

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingSpinner size="lg" label="설정을 불러오는 중..." />
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
            onClick={() => router.push(`/studies/${studyId}`)}
            className="flex items-center justify-center shrink-0 h-9 w-9 rounded-full transition-colors hover:bg-bg-alt"
          >
            <ArrowLeft className="h-5 w-5" style={{ color: 'var(--text)' }} />
          </button>
          <span className="text-sm text-text-2">돌아가기</span>
        </div>
      </AppLayout>
    );
  }

  const displayMembers: SettingsMember[] = members.map((m) => ({
    id: m.id,
    userId: m.user_id,
    name: m.nickname ?? m.username ?? m.email ?? '',
    email: m.email ?? '',
    role: m.role,
    color: 'var(--primary)',
    avatarUrl: m.avatar_url ?? null,
  }));

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* ── HEADER ── */}
        <div style={fade(0)}>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push(`/studies/${studyId}`)}
              className="flex items-center justify-center shrink-0 h-9 w-9 rounded-full transition-colors hover:bg-bg-alt"
            >
              <ArrowLeft className="h-5 w-5" style={{ color: 'var(--text)' }} />
            </button>
            <div>
              <h1 className="text-[22px] font-bold tracking-tight text-text">
                스터디 설정
              </h1>
              <p className="text-xs text-text-3">{study?.name ?? ''}</p>
            </div>
          </div>
        </div>

        {error && (
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {successMsg && (
          <Alert variant="success" onClose={() => setSuccessMsg(null)}>
            {successMsg}
          </Alert>
        )}

        {/* ── 스터디 아바타 ── */}
        <section className="space-y-3" style={fade(0.04)}>
          <h2 className="text-sm font-semibold text-text-3">스터디 아바타</h2>
          <Card>
            <CardContent className="py-5 space-y-4">
              <div className="flex items-center gap-4">
                <Image
                  src={getAvatarSrc(selectedStudyAvatarKey)}
                  alt="스터디 아바타"
                  width={64}
                  height={64}
                  className="h-16 w-16 rounded-xl"
                />
                <div className="space-y-1">
                  <p className="text-[13px] text-text-2">
                    스터디를 대표하는 아바타를 선택하세요.
                  </p>
                  <p className="text-[11px] text-text-3">
                    {STUDY_AVATAR_PRESETS.find((p) => p.key === selectedStudyAvatarKey)?.label ?? '기본'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-6 gap-2">
                {STUDY_AVATAR_PRESETS.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => setSelectedStudyAvatarKey(preset.key)}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-lg border-2 p-2 transition-colors',
                      selectedStudyAvatarKey === preset.key
                        ? 'border-primary bg-primary-soft'
                        : 'border-transparent hover:border-border',
                    )}
                  >
                    <Image
                      src={getAvatarSrc(preset.key)}
                      alt={preset.label}
                      width={36}
                      height={36}
                      className="h-9 w-9 rounded-md"
                    />
                    <span className="text-[10px] text-text-3">{preset.label}</span>
                  </button>
                ))}
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  disabled={isSavingAvatar}
                  onClick={async () => {
                    setIsSavingAvatar(true);
                    setError(null);
                    try {
                      const updated = await studyApi.update(studyId, {
                        avatarUrl: toAvatarUrl(selectedStudyAvatarKey),
                      });
                      setStudy(updated);
                      setSuccessMsg('스터디 아바타가 저장되었습니다.');
                    } catch (err: unknown) {
                      setError((err as Error).message ?? '아바타 저장에 실패했습니다.');
                    } finally {
                      setIsSavingAvatar(false);
                    }
                  }}
                >
                  {isSavingAvatar ? '저장 중...' : '아바타 저장'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ── 기본 정보 ── */}
        <section className="space-y-3" style={fade(0.08)}>
          <h2 className="text-sm font-semibold text-text-3">기본 정보</h2>
          <Card>
            <CardContent className="space-y-4 py-5">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-text">
                  스터디 이름
                </label>
                <Input
                  value={studyName}
                  onChange={(e) => setStudyName(e.target.value)}
                  placeholder="스터디 이름"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-text">
                  소개
                </label>
                <textarea
                  className="flex w-full rounded-btn border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  rows={3}
                  value={studyDesc}
                  onChange={(e) => setStudyDesc(e.target.value)}
                  placeholder="스터디를 소개해주세요"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => setShowSaveInfoConfirm(true)}
                  disabled={isSavingInfo}
                >
                  {isSavingInfo ? '저장 중...' : '저장'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ── 그라운드룰 ── */}
        <section className="space-y-3" style={fade(0.12)}>
          <h2 className="text-sm font-semibold text-text-3">그라운드룰</h2>
          <Card>
            <CardContent className="space-y-3 py-5">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-text-2">마크다운으로 작성</span>
                <div className="flex overflow-hidden rounded-btn border border-border">
                  <button
                    type="button"
                    className={`flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium transition-colors ${
                      rulesMode === 'edit'
                        ? 'bg-primary text-white'
                        : 'text-text-3 hover:text-text'
                    }`}
                    onClick={() => setRulesMode('edit')}
                  >
                    <Pencil className="h-3 w-3" aria-hidden />
                    편집
                  </button>
                  <button
                    type="button"
                    className={`flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium transition-colors ${
                      rulesMode === 'preview'
                        ? 'bg-primary text-white'
                        : 'text-text-3 hover:text-text'
                    }`}
                    onClick={() => setRulesMode('preview')}
                  >
                    <Eye className="h-3 w-3" aria-hidden />
                    미리보기
                  </button>
                </div>
              </div>

              {rulesMode === 'edit' ? (
                <textarea
                  className="flex w-full rounded-btn border border-border bg-bg px-3 py-2 text-[13px] font-mono text-text placeholder:text-text-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  rows={12}
                  value={rulesText}
                  onChange={(e) => setRulesText(e.target.value)}
                  placeholder="그라운드룰을 마크다운으로 작성하세요"
                />
              ) : (
                <div
                  className="min-h-[200px] rounded-btn border border-border bg-bg p-4"
                  style={{ lineHeight: '1.7' }}
                >
                  <MarkdownViewer content={rulesText} />
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-[11px] text-text-3">
                  Markdown 지원: **굵게**, *기울임*, ## 제목, - 목록
                </span>
                <Button
                  size="sm"
                  onClick={() => setShowSaveRulesConfirm(true)}
                  disabled={isSavingRules}
                >
                  {isSavingRules ? '저장 중...' : '저장'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ── 멤버 ── */}
        <section className="space-y-3" style={fade(0.16)}>
          <h2 className="text-sm font-semibold text-text-3">
            멤버 · {displayMembers.length}명
          </h2>
          <Card className="p-0 overflow-hidden">
            {displayMembers.map((member, idx) => (
              <div
                key={member.id}
                className={`flex items-center justify-between px-4 py-3 ${
                  idx < displayMembers.length - 1 ? 'border-b border-border' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {member.avatarUrl ? (
                    <Image
                      src={getAvatarSrc(getAvatarPresetKey(member.avatarUrl))}
                      alt={member.name}
                      width={36}
                      height={36}
                      className="h-9 w-9 shrink-0 rounded-full"
                    />
                  ) : (
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: member.color }}
                    >
                      {member.name.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-text truncate block">
                      {member.name}
                    </span>
                    <span className="text-[11px] text-text-3 truncate block">
                      {member.email}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {member.role === 'ADMIN' ? (
                    <>
                      <div className="flex h-7 w-7 items-center justify-center">
                        <Crown
                          className="h-4 w-4"
                          style={{ color: 'var(--primary)' }}
                          aria-label="관리자"
                        />
                      </div>
                      {member.userId !== user?.id && (
                        <button
                          type="button"
                          className="flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-medium text-text-3 transition-colors hover:bg-bg-alt hover:text-text-2"
                          aria-label={`${member.name} 멤버로 변경`}
                          onClick={() => setPendingRoleChange({ member, newRole: 'MEMBER' })}
                        >
                          멤버로 변경
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-medium text-text-3 transition-colors hover:bg-primary/10 hover:text-primary"
                        aria-label={`${member.name} 관리자로 변경`}
                        onClick={() => setPendingRoleChange({ member, newRole: 'ADMIN' })}
                      >
                        <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                        관리자
                      </button>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-text-3 transition-colors hover:bg-error-soft hover:text-error"
                        aria-label={`${member.name} 내보내기`}
                        onClick={() => setRemoveMember(member)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </Card>
        </section>

        {/* ── 초대 코드 ── */}
        <section className="space-y-3" style={fade(0.2)}>
          <h2 className="text-sm font-semibold text-text-3">초대 코드</h2>
          <Card>
            <CardContent className="space-y-3 py-4">
              <div className="flex items-center gap-2">
                <Input
                  value={codeActive ? inviteCode : (inviteCode ? '만료됨' : '코드를 생성해주세요')}
                  readOnly
                  className={`min-w-0 font-mono text-sm ${!codeActive ? 'text-text-3' : ''} ${inviteCode && !codeActive ? 'line-through' : ''}`}
                />
                <button
                  type="button"
                  className="shrink-0 rounded-lg border border-border p-2.5 text-text-3 transition-colors hover:bg-bg-alt hover:text-text disabled:opacity-40"
                  onClick={() => void handleCopyCode()}
                  disabled={!codeActive}
                  aria-label="초대 코드 복사"
                >
                  <Copy className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  className="shrink-0 rounded-lg border border-border p-2.5 text-text-3 transition-colors hover:bg-bg-alt hover:text-text disabled:opacity-40"
                  onClick={() => void handleRefreshCode()}
                  disabled={isRefreshingCode}
                  aria-label="초대 코드 재생성"
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshingCode ? 'animate-spin' : ''}`} aria-hidden />
                </button>
              </div>
              <div className="flex items-center justify-between">
                {codeActive ? (
                  <p className="text-xs text-text-3">
                    <span
                      className="font-medium"
                      style={{ color: codeExpiry <= 60 ? 'var(--error)' : 'var(--primary)' }}
                    >
                      {String(Math.floor(codeExpiry / 60)).padStart(2, '0')}:{String(codeExpiry % 60).padStart(2, '0')}
                    </span>
                    {' '}후 만료
                  </p>
                ) : (
                  <p className="text-xs" style={{ color: inviteCode ? 'var(--error)' : 'var(--text-3)' }}>
                    {inviteCode ? '코드가 만료되었습니다. 새로 생성해주세요.' : '초대 코드를 생성하세요.'}
                  </p>
                )}
                {codeCopied && (
                  <p className="text-xs text-success">복사되었습니다!</p>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ── 위험 구역 ── */}
        <section className="space-y-3" style={fade(0.24)}>
          <h2 className="text-sm font-semibold text-text-3">위험 구역</h2>
          <Card
            className="border-error/30"
            style={{ backgroundColor: 'var(--error-soft)' }}
          >
            <CardContent className="space-y-3 py-5">
              <div className="space-y-1.5 text-[13px] text-text-2">
                <p className="font-medium">스터디 삭제 정책</p>
                <ul className="list-inside list-disc space-y-0.5 text-[12px]">
                  <li>관리자가 1명일 때만 삭제할 수 있습니다.</li>
                  <li>삭제 시 모든 문제·제출 기록·분석 결과가 영구 삭제됩니다.</li>
                  <li>삭제된 스터디는 복구할 수 없습니다.</li>
                </ul>
              </div>
              {members.filter((m) => m.role === 'ADMIN').length > 1 ? (
                <p className="text-[12px] font-medium" style={{ color: 'var(--error)' }}>
                  관리자가 2명 이상이므로 삭제할 수 없습니다. 다른 관리자의 권한을 해제한 후 다시 시도하세요.
                </p>
              ) : (
                <Button
                  className="bg-error text-white hover:bg-error/90"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  스터디 삭제
                </Button>
              )}
            </CardContent>
          </Card>
        </section>
      </div>

      {/* ── 1. 멤버 등급 변경 확인 모달 ── */}
      {pendingRoleChange && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPendingRoleChange(null)} />
          <div className="relative rounded-xl border border-border bg-bg-card p-5 shadow-lg w-[340px] space-y-4">
            <p className="text-[14px] font-semibold text-text">역할을 변경하시겠습니까?</p>
            <p className="text-[13px]" style={{ color: 'var(--text-2)' }}>
              {pendingRoleChange.member.name} 님의 역할을 {pendingRoleChange.newRole === 'ADMIN' ? '관리자' : '멤버'}(으)로 변경합니다.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={() => setPendingRoleChange(null)}
                className="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors hover:bg-bg-alt"
                style={{ color: 'var(--text-2)' }}>취소</button>
              <button type="button" onClick={() => { void handleChangeRole(pendingRoleChange.member, pendingRoleChange.newRole); setPendingRoleChange(null); }}
                className="px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-opacity"
                style={{ backgroundColor: 'var(--primary)' }}>변경</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. 스터디 삭제 확인 모달 ── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative rounded-xl border border-border bg-bg-card p-5 shadow-lg w-[340px] space-y-4">
            <p className="text-[14px] font-semibold text-text">스터디를 삭제하시겠습니까?</p>
            <p className="text-[13px]" style={{ color: 'var(--text-2)' }}>
              이 작업은 되돌릴 수 없습니다. 모든 스터디 데이터가 삭제됩니다.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors hover:bg-bg-alt"
                style={{ color: 'var(--text-2)' }}>취소</button>
              <button type="button" onClick={() => { void handleDeleteStudy(); }}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-opacity disabled:opacity-50"
                style={{ backgroundColor: 'var(--error)' }}>{isDeleting ? '삭제 중...' : '삭제'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. 스터디 정보 저장 확인 모달 ── */}
      {showSaveInfoConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowSaveInfoConfirm(false)} />
          <div className="relative rounded-xl border border-border bg-bg-card p-5 shadow-lg w-[340px] space-y-4">
            <p className="text-[14px] font-semibold text-text">스터디 정보를 저장하시겠습니까?</p>
            <p className="text-[13px]" style={{ color: 'var(--text-2)' }}>
              변경된 스터디 이름과 소개가 저장됩니다.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={() => setShowSaveInfoConfirm(false)}
                className="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors hover:bg-bg-alt"
                style={{ color: 'var(--text-2)' }}>취소</button>
              <button type="button" onClick={() => { void handleSaveInfo(); setShowSaveInfoConfirm(false); }}
                className="px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-opacity"
                style={{ backgroundColor: 'var(--primary)' }}>저장</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 4. 그라운드 룰 저장 확인 모달 ── */}
      {showSaveRulesConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowSaveRulesConfirm(false)} />
          <div className="relative rounded-xl border border-border bg-bg-card p-5 shadow-lg w-[340px] space-y-4">
            <p className="text-[14px] font-semibold text-text">그라운드 룰을 저장하시겠습니까?</p>
            <p className="text-[13px]" style={{ color: 'var(--text-2)' }}>
              변경된 그라운드 룰이 모든 멤버에게 적용됩니다.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={() => setShowSaveRulesConfirm(false)}
                className="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors hover:bg-bg-alt"
                style={{ color: 'var(--text-2)' }}>취소</button>
              <button type="button" onClick={() => { void handleSaveRules(); setShowSaveRulesConfirm(false); }}
                className="px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-opacity"
                style={{ backgroundColor: 'var(--primary)' }}>저장</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 5. 멤버 추방 확인 모달 ── */}
      {removeMember && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setRemoveMember(null)} />
          <div className="relative rounded-xl border border-border bg-bg-card p-5 shadow-lg w-[340px] space-y-4">
            <p className="text-[14px] font-semibold text-text">멤버를 내보내시겠습니까?</p>
            <p className="text-[13px]" style={{ color: 'var(--text-2)' }}>
              {removeMember.name} 님을 스터디에서 내보냅니다. 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={() => setRemoveMember(null)}
                className="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors hover:bg-bg-alt"
                style={{ color: 'var(--text-2)' }}>취소</button>
              <button type="button" onClick={() => void handleRemoveMemberConfirm()}
                className="px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-opacity"
                style={{ backgroundColor: 'var(--error)' }}>내보내기</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
