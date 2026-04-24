/**
 * @file 스터디 설정 페이지 — 기본 정보 / 그라운드룰 / 멤버 / 초대코드 / 삭제 (i18n 적용)
 * @domain study
 * @layer page
 * @related messages/studies.json
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
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('studies');
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
    const tm = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(tm);
  }, [isLoading]);

  // ESC 키로 모달 닫기
  useEffect(() => {
    const anyModalOpen = !!pendingRoleChange || showDeleteConfirm || showSaveInfoConfirm || showSaveRulesConfirm || !!removeMember;
    if (!anyModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPendingRoleChange(null);
        setShowDeleteConfirm(false);
        setShowSaveInfoConfirm(false);
        setShowSaveRulesConfirm(false);
        setRemoveMember(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [pendingRoleChange, showDeleteConfirm, showSaveInfoConfirm, showSaveRulesConfirm, removeMember]);

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
    const tm = setTimeout(() => setSuccessMsg(null), 3000);
    return () => clearTimeout(tm);
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
      document.title = `${studyData.name} ${t('settings.heading')} | AlgoSu`;
    } catch (err: unknown) {
      setError(
        (err as Error).message ??
          t('settings.error.loadFailed'),
      );
    } finally {
      setIsLoading(false);
    }
  }, [studyId, t]);

  useEffect(() => {
    if (isAuthenticated) {
      void loadStudyData();
    }
  }, [isAuthenticated, loadStudyData]);

  // ─── HANDLERS ──────────────────────────

  /** 기본 정보 저장 (스터디 이름 + 소개) */
  const handleSaveInfo = async (): Promise<void> => {
    if (!studyName.trim()) {
      setError(t('settings.error.nameRequired'));
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
      setSuccessMsg(t('settings.success.infoSaved'));
    } catch (err: unknown) {
      setError((err as Error).message ?? t('settings.error.saveInfoFailed'));
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
      setSuccessMsg(t('settings.success.rulesSaved'));
    } catch (err: unknown) {
      setError((err as Error).message ?? t('settings.error.saveRulesFailed'));
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
      setSuccessMsg(t('settings.success.memberRemoved', { name: member.name }));
    } catch (err: unknown) {
      setError((err as Error).message ?? t('settings.error.removeMemberFailed'));
    }
  };

  /** 멤버 역할 변경 */
  const handleChangeRole = async (member: SettingsMember, newRole: 'ADMIN' | 'MEMBER'): Promise<void> => {
    setError(null);
    try {
      await studyApi.changeRole(studyId, member.userId, newRole);
      const updatedMembers = await studyApi.getMembers(studyId);
      setMembers(updatedMembers);
      const roleLabel = newRole === 'ADMIN' ? t('settings.roles.admin') : t('settings.roles.member');
      setSuccessMsg(t('settings.success.roleChanged', { name: member.name, role: roleLabel }));
    } catch (err: unknown) {
      setError((err as Error).message ?? t('settings.error.changeRoleFailed'));
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
      setError((err as Error).message ?? t('settings.error.inviteCodeFailed'));
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
      setError((err as Error).message ?? t('settings.error.deleteFailed'));
      setIsDeleting(false);
    }
  };

  // ─── LOADING / ERROR ───────────────────

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingSpinner size="lg" label={t('settings.loading')} />
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
            <ArrowLeft className="h-5 w-5 text-[var(--text)]" />
          </button>
          <span className="text-sm text-text-2">{t('settings.goBack')}</span>
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
              <ArrowLeft className="h-5 w-5 text-[var(--text)]" />
            </button>
            <div>
              <h1 className="text-[22px] font-bold tracking-tight text-text">
                {t('settings.heading')}
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
          <h2 className="text-sm font-semibold text-text-3">{t('settings.avatar.heading')}</h2>
          <Card>
            <CardContent className="py-5 space-y-4">
              <div className="flex items-center gap-4">
                <Image
                  src={getAvatarSrc(selectedStudyAvatarKey)}
                  alt={t('settings.avatar.alt')}
                  width={64}
                  height={64}
                  className="h-16 w-16 rounded-xl"
                />
                <div className="space-y-1">
                  <p className="text-[13px] text-text-2">
                    {t('settings.avatar.description')}
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
                      setSuccessMsg(t('settings.success.avatarSaved'));
                    } catch (err: unknown) {
                      setError((err as Error).message ?? t('settings.error.saveAvatarFailed'));
                    } finally {
                      setIsSavingAvatar(false);
                    }
                  }}
                >
                  {isSavingAvatar ? t('settings.avatar.saving') : t('settings.avatar.save')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ── 기본 정보 ── */}
        <section className="space-y-3" style={fade(0.08)}>
          <h2 className="text-sm font-semibold text-text-3">{t('settings.info.heading')}</h2>
          <Card>
            <CardContent className="space-y-4 py-5">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-text">
                  {t('settings.info.nameLabel')}
                </label>
                <Input
                  value={studyName}
                  onChange={(e) => setStudyName(e.target.value)}
                  placeholder={t('settings.info.namePlaceholder')}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-text">
                  {t('settings.info.descriptionLabel')}
                </label>
                <textarea
                  className="flex w-full rounded-btn border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  rows={3}
                  value={studyDesc}
                  onChange={(e) => setStudyDesc(e.target.value)}
                  placeholder={t('settings.info.descriptionPlaceholder')}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => setShowSaveInfoConfirm(true)}
                  disabled={isSavingInfo}
                >
                  {isSavingInfo ? t('settings.info.saving') : t('settings.info.save')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ── 그라운드룰 ── */}
        <section className="space-y-3" style={fade(0.12)}>
          <h2 className="text-sm font-semibold text-text-3">{t('settings.rules.heading')}</h2>
          <Card>
            <CardContent className="space-y-3 py-5">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-text-2">{t('settings.rules.markdownHint')}</span>
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
                    {t('settings.rules.edit')}
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
                    {t('settings.rules.preview')}
                  </button>
                </div>
              </div>

              {rulesMode === 'edit' ? (
                <textarea
                  className="flex w-full rounded-btn border border-border bg-bg px-3 py-2 text-[13px] font-mono text-text placeholder:text-text-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  rows={12}
                  value={rulesText}
                  onChange={(e) => setRulesText(e.target.value)}
                  placeholder={t('settings.rules.placeholder')}
                />
              ) : (
                <div
                  className="min-h-[200px] rounded-btn border border-border bg-bg p-4 leading-[1.7]"
                >
                  <MarkdownViewer content={rulesText} />
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-[11px] text-text-3">
                  {t('settings.rules.mdSupport')}
                </span>
                <Button
                  size="sm"
                  onClick={() => setShowSaveRulesConfirm(true)}
                  disabled={isSavingRules}
                >
                  {isSavingRules ? t('settings.rules.saving') : t('settings.rules.save')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ── 멤버 ── */}
        <section className="space-y-3" style={fade(0.16)}>
          <h2 className="text-sm font-semibold text-text-3">
            {t('settings.members.heading', { count: displayMembers.length })}
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
                          className="h-4 w-4 text-[var(--primary)]"
                          aria-label={t('settings.members.admin')}
                        />
                      </div>
                      {member.userId !== user?.id && (
                        <button
                          type="button"
                          className="flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-medium text-text-3 transition-colors hover:bg-bg-alt hover:text-text-2"
                          aria-label={`${member.name} ${t('settings.members.changeToMember')}`}
                          onClick={() => setPendingRoleChange({ member, newRole: 'MEMBER' })}
                        >
                          {t('settings.members.changeToMember')}
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-medium text-text-3 transition-colors hover:bg-primary/10 hover:text-primary"
                        aria-label={`${member.name} ${t('settings.members.changeToAdmin')}`}
                        onClick={() => setPendingRoleChange({ member, newRole: 'ADMIN' })}
                      >
                        <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                        {t('settings.members.changeToAdmin')}
                      </button>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-text-3 transition-colors hover:bg-error-soft hover:text-error"
                        aria-label={`${member.name} ${t('settings.members.removeMember')}`}
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
          <h2 className="text-sm font-semibold text-text-3">{t('settings.invite.heading')}</h2>
          <Card>
            <CardContent className="space-y-3 py-4">
              <div className="flex items-center gap-2">
                <Input
                  value={codeActive ? inviteCode : (inviteCode ? t('settings.invite.expired') : t('settings.invite.generate'))}
                  readOnly
                  className={`min-w-0 font-mono text-sm ${!codeActive ? 'text-text-3' : ''} ${inviteCode && !codeActive ? 'line-through' : ''}`}
                />
                <button
                  type="button"
                  className="shrink-0 rounded-lg border border-border p-2.5 text-text-3 transition-colors hover:bg-bg-alt hover:text-text disabled:opacity-40"
                  onClick={() => void handleCopyCode()}
                  disabled={!codeActive}
                  aria-label={t('settings.invite.copy')}
                >
                  <Copy className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  className="shrink-0 rounded-lg border border-border p-2.5 text-text-3 transition-colors hover:bg-bg-alt hover:text-text disabled:opacity-40"
                  onClick={() => void handleRefreshCode()}
                  disabled={isRefreshingCode}
                  aria-label={t('settings.invite.refresh')}
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
                    {' '}{t('settings.invite.expiresIn')}
                  </p>
                ) : (
                  <p className={`text-xs ${inviteCode ? 'text-[var(--error)]' : 'text-[var(--text-3)]'}`}>
                    {inviteCode ? t('settings.invite.expiredMessage') : t('settings.invite.generateMessage')}
                  </p>
                )}
                {codeCopied && (
                  <p className="text-xs text-success">{t('settings.invite.copied')}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ── 위험 구역 ── */}
        <section className="space-y-3" style={fade(0.24)}>
          <h2 className="text-sm font-semibold text-text-3">{t('settings.danger.heading')}</h2>
          <Card
            className="border-error/30 bg-[var(--error-soft)]"
          >
            <CardContent className="space-y-3 py-5">
              <div className="space-y-1.5 text-[13px] text-text-2">
                <p className="font-medium">{t('settings.danger.policyTitle')}</p>
                <ul className="list-inside list-disc space-y-0.5 text-[12px]">
                  <li>{t('settings.danger.policyRule1')}</li>
                  <li>{t('settings.danger.policyRule2')}</li>
                  <li>{t('settings.danger.policyRule3')}</li>
                </ul>
              </div>
              {members.filter((m) => m.role === 'ADMIN').length > 1 ? (
                <p className="text-[12px] font-medium text-[var(--error)]">
                  {t('settings.danger.multiAdminWarning')}
                </p>
              ) : (
                <Button
                  className="bg-error text-white hover:bg-error/90"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  {t('settings.danger.deleteButton')}
                </Button>
              )}
            </CardContent>
          </Card>
        </section>
      </div>

      {/* ── 1. 멤버 등급 변경 확인 모달 ── */}
      {pendingRoleChange && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" role="presentation" onClick={() => setPendingRoleChange(null)} />
          <div className="relative rounded-xl border border-border bg-bg-card p-5 shadow-lg w-[340px] space-y-4">
            <p className="text-[14px] font-semibold text-text">{t('settings.modal.roleChange.title')}</p>
            <p className="text-[13px] text-[var(--text-2)]">
              {t('settings.modal.roleChange.description', {
                name: pendingRoleChange.member.name,
                role: pendingRoleChange.newRole === 'ADMIN' ? t('settings.roles.admin') : t('settings.roles.member'),
              })}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={() => setPendingRoleChange(null)}
                className="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors hover:bg-bg-alt text-[var(--text-2)]">{t('settings.modal.roleChange.cancel')}</button>
              <button type="button" onClick={() => { void handleChangeRole(pendingRoleChange.member, pendingRoleChange.newRole); setPendingRoleChange(null); }}
                className="px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-opacity bg-[var(--primary)]">{t('settings.modal.roleChange.confirm')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. 스터디 삭제 확인 모달 ── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" role="presentation" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative rounded-xl border border-border bg-bg-card p-5 shadow-lg w-[340px] space-y-4">
            <p className="text-[14px] font-semibold text-text">{t('settings.modal.delete.title')}</p>
            <p className="text-[13px] text-[var(--text-2)]">
              {t('settings.modal.delete.description')}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors hover:bg-bg-alt text-[var(--text-2)]">{t('settings.modal.delete.cancel')}</button>
              <button type="button" onClick={() => { void handleDeleteStudy(); }}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-opacity disabled:opacity-50 bg-[var(--error)]">{isDeleting ? t('settings.modal.delete.deleting') : t('settings.modal.delete.confirm')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. 스터디 정보 저장 확인 모달 ── */}
      {showSaveInfoConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" role="presentation" onClick={() => setShowSaveInfoConfirm(false)} />
          <div className="relative rounded-xl border border-border bg-bg-card p-5 shadow-lg w-[340px] space-y-4">
            <p className="text-[14px] font-semibold text-text">{t('settings.modal.saveInfo.title')}</p>
            <p className="text-[13px] text-[var(--text-2)]">
              {t('settings.modal.saveInfo.description')}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={() => setShowSaveInfoConfirm(false)}
                className="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors hover:bg-bg-alt text-[var(--text-2)]">{t('settings.modal.saveInfo.cancel')}</button>
              <button type="button" onClick={() => { void handleSaveInfo(); setShowSaveInfoConfirm(false); }}
                className="px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-opacity bg-[var(--primary)]">{t('settings.modal.saveInfo.confirm')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 4. 그라운드 룰 저장 확인 모달 ── */}
      {showSaveRulesConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" role="presentation" onClick={() => setShowSaveRulesConfirm(false)} />
          <div className="relative rounded-xl border border-border bg-bg-card p-5 shadow-lg w-[340px] space-y-4">
            <p className="text-[14px] font-semibold text-text">{t('settings.modal.saveRules.title')}</p>
            <p className="text-[13px] text-[var(--text-2)]">
              {t('settings.modal.saveRules.description')}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={() => setShowSaveRulesConfirm(false)}
                className="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors hover:bg-bg-alt text-[var(--text-2)]">{t('settings.modal.saveRules.cancel')}</button>
              <button type="button" onClick={() => { void handleSaveRules(); setShowSaveRulesConfirm(false); }}
                className="px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-opacity bg-[var(--primary)]">{t('settings.modal.saveRules.confirm')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 5. 멤버 추방 확인 모달 ── */}
      {removeMember && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" role="presentation" onClick={() => setRemoveMember(null)} />
          <div className="relative rounded-xl border border-border bg-bg-card p-5 shadow-lg w-[340px] space-y-4">
            <p className="text-[14px] font-semibold text-text">{t('settings.modal.removeMember.title')}</p>
            <p className="text-[13px] text-[var(--text-2)]">
              {t('settings.modal.removeMember.description', { name: removeMember.name })}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={() => setRemoveMember(null)}
                className="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors hover:bg-bg-alt text-[var(--text-2)]">{t('settings.modal.removeMember.cancel')}</button>
              <button type="button" onClick={() => void handleRemoveMemberConfirm()}
                className="px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-opacity bg-[var(--error)]">{t('settings.modal.removeMember.confirm')}</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
