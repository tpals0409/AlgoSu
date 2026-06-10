/**
 * @file 스터디 설정 — 멤버 관리 섹션 컴포넌트
 * @domain study
 * @layer component
 * @related settings/page.tsx, studyApi
 */

'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Crown, ShieldCheck, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { studyApi, type StudyMember } from '@/lib/api';
import { getAvatarPresetKey, getAvatarSrc } from '@/lib/avatars';
import Image from 'next/image';

// ─── TYPES ───────────────────────────────

export interface SettingsMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MEMBER';
  color: string;
  avatarUrl: string | null;
}

export interface MembersSectionProps {
  readonly studyId: string;
  readonly members: StudyMember[];
  readonly currentUserId: string | undefined;
  readonly onMembersUpdate: (members: StudyMember[]) => void;
  readonly onSuccess: (msg: string) => void;
  readonly onError: (msg: string) => void;
}

// ─── COMPONENT ───────────────────────────

/**
 * 스터디 멤버 목록 + 역할 변경/강퇴 섹션
 * @domain study
 */
export function MembersSection({
  studyId,
  members,
  currentUserId,
  onMembersUpdate,
  onSuccess,
  onError,
}: MembersSectionProps) {
  const t = useTranslations('studies');

  const [removeMember, setRemoveMember] = useState<SettingsMember | null>(null);
  const [pendingRoleChange, setPendingRoleChange] = useState<{
    member: SettingsMember;
    newRole: 'ADMIN' | 'MEMBER';
  } | null>(null);

  // ESC 키로 모달 닫기
  useEffect(() => {
    const anyModalOpen = !!pendingRoleChange || !!removeMember;
    if (!anyModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPendingRoleChange(null);
        setRemoveMember(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [pendingRoleChange, removeMember]);

  const displayMembers: SettingsMember[] = members.map((m) => ({
    id: m.id,
    userId: m.user_id,
    name: m.nickname ?? m.username ?? m.email ?? '',
    email: m.email ?? '',
    role: m.role,
    color: 'var(--primary)',
    avatarUrl: m.avatar_url ?? null,
  }));

  /** 멤버 역할 변경 */
  const handleChangeRole = async (
    member: SettingsMember,
    newRole: 'ADMIN' | 'MEMBER',
  ): Promise<void> => {
    try {
      await studyApi.changeRole(studyId, member.userId, newRole);
      const updatedMembers = await studyApi.getMembers(studyId);
      onMembersUpdate(updatedMembers);
      const roleLabel =
        newRole === 'ADMIN' ? t('settings.roles.admin') : t('settings.roles.member');
      onSuccess(t('settings.success.roleChanged', { name: member.name, role: roleLabel }));
    } catch (err: unknown) {
      onError((err as Error).message ?? t('settings.error.changeRoleFailed'));
    }
  };

  /** 멤버 내보내기 */
  const handleRemoveMemberConfirm = async (): Promise<void> => {
    if (!removeMember) return;
    const member = removeMember;
    setRemoveMember(null);
    try {
      await studyApi.removeMember(studyId, member.userId);
      const updatedMembers = await studyApi.getMembers(studyId);
      onMembersUpdate(updatedMembers);
      onSuccess(t('settings.success.memberRemoved', { name: member.name }));
    } catch (err: unknown) {
      onError((err as Error).message ?? t('settings.error.removeMemberFailed'));
    }
  };

  return (
    <>
      <section className="space-y-3">
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
                    style={{ backgroundColor: member.color }} // eslint-disable-line react/forbid-dom-props
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
                    {member.userId !== currentUserId && (
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

      {/* 멤버 등급 변경 확인 모달 */}
      {pendingRoleChange && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" role="presentation" onClick={() => setPendingRoleChange(null)} />
          <div className="relative rounded-xl border border-border bg-bg-card p-5 shadow-lg w-[340px] space-y-4">
            <p className="text-[14px] font-semibold text-text">{t('settings.modal.roleChange.title')}</p>
            <p className="text-[13px] text-[var(--text-2)]">
              {t('settings.modal.roleChange.description', {
                name: pendingRoleChange.member.name,
                role:
                  pendingRoleChange.newRole === 'ADMIN'
                    ? t('settings.roles.admin')
                    : t('settings.roles.member'),
              })}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingRoleChange(null)}
                className="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors hover:bg-bg-alt text-[var(--text-2)]"
              >
                {t('settings.modal.roleChange.cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleChangeRole(pendingRoleChange.member, pendingRoleChange.newRole);
                  setPendingRoleChange(null);
                }}
                className="px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-opacity bg-[var(--primary)]"
              >
                {t('settings.modal.roleChange.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 멤버 추방 확인 모달 */}
      {removeMember && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" role="presentation" onClick={() => setRemoveMember(null)} />
          <div className="relative rounded-xl border border-border bg-bg-card p-5 shadow-lg w-[340px] space-y-4">
            <p className="text-[14px] font-semibold text-text">{t('settings.modal.removeMember.title')}</p>
            <p className="text-[13px] text-[var(--text-2)]">
              {t('settings.modal.removeMember.description', { name: removeMember.name })}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRemoveMember(null)}
                className="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors hover:bg-bg-alt text-[var(--text-2)]"
              >
                {t('settings.modal.removeMember.cancel')}
              </button>
              <button
                type="button"
                onClick={() => void handleRemoveMemberConfirm()}
                className="px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-opacity bg-[var(--error)]"
              >
                {t('settings.modal.removeMember.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
