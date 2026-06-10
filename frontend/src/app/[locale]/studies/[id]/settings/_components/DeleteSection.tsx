/**
 * @file 스터디 설정 — 위험 구역 (스터디 삭제) 섹션 컴포넌트
 * @domain study
 * @layer component
 * @related settings/page.tsx, studyApi
 */

'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { studyApi, type StudyMember } from '@/lib/api';

// ─── TYPES ───────────────────────────────

export interface DeleteSectionProps {
  readonly studyId: string;
  readonly members: StudyMember[];
  readonly onDelete: () => void;
  readonly onError: (msg: string) => void;
}

// ─── COMPONENT ───────────────────────────

/**
 * 스터디 삭제 위험 구역 섹션
 * @domain study
 */
export function DeleteSection({
  studyId,
  members,
  onDelete,
  onError,
}: DeleteSectionProps) {
  const t = useTranslations('studies');

  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ESC 키로 모달 닫기
  useEffect(() => {
    if (!showDeleteConfirm) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowDeleteConfirm(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showDeleteConfirm]);

  /** 스터디 삭제 */
  const handleDeleteStudy = async (): Promise<void> => {
    setIsDeleting(true);
    try {
      await studyApi.delete(studyId);
      onDelete();
    } catch (err: unknown) {
      onError((err as Error).message ?? t('settings.error.deleteFailed'));
      setIsDeleting(false);
    }
  };

  return (
    <>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-text-3">{t('settings.danger.heading')}</h2>
        <Card className="border-error/30 bg-[var(--error-soft)]">
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

      {/* 스터디 삭제 확인 모달 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" role="presentation" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative rounded-xl border border-border bg-bg-card p-5 shadow-lg w-[340px] space-y-4">
            <p className="text-[14px] font-semibold text-text">{t('settings.modal.delete.title')}</p>
            <p className="text-[13px] text-[var(--text-2)]">
              {t('settings.modal.delete.description')}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors hover:bg-bg-alt text-[var(--text-2)]"
              >
                {t('settings.modal.delete.cancel')}
              </button>
              <button
                type="button"
                onClick={() => { void handleDeleteStudy(); }}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-opacity disabled:opacity-50 bg-[var(--error)]"
              >
                {isDeleting ? t('settings.modal.delete.deleting') : t('settings.modal.delete.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
