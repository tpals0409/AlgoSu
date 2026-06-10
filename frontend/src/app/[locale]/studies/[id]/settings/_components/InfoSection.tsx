/**
 * @file 스터디 설정 — 기본 정보 섹션 컴포넌트
 * @domain study
 * @layer component
 * @related settings/page.tsx, studyApi
 */

'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { studyApi, type Study } from '@/lib/api';

// ─── TYPES ───────────────────────────────

export interface InfoSectionProps {
  readonly studyId: string;
  readonly study: Study;
  readonly onStudyUpdate: (s: Study) => void;
  readonly onSuccess: (msg: string) => void;
  readonly onError: (msg: string) => void;
}

// ─── COMPONENT ───────────────────────────

/**
 * 스터디 기본 정보 (이름/소개) 편집 섹션
 * @domain study
 */
export function InfoSection({
  studyId,
  study,
  onStudyUpdate,
  onSuccess,
  onError,
}: InfoSectionProps) {
  const t = useTranslations('studies');

  const [studyName, setStudyName] = useState(study.name);
  const [studyDesc, setStudyDesc] = useState(study.description ?? '');
  const [isSavingInfo, setIsSavingInfo] = useState(false);
  const [showSaveInfoConfirm, setShowSaveInfoConfirm] = useState(false);

  // ESC 키로 모달 닫기
  useEffect(() => {
    if (!showSaveInfoConfirm) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSaveInfoConfirm(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showSaveInfoConfirm]);

  /** 기본 정보 저장 */
  const handleSaveInfo = async (): Promise<void> => {
    if (!studyName.trim()) {
      onError(t('settings.error.nameRequired'));
      return;
    }
    setIsSavingInfo(true);
    try {
      const updated = await studyApi.update(studyId, {
        name: studyName.trim(),
        description: studyDesc.trim(),
      });
      onStudyUpdate(updated);
      onSuccess(t('settings.success.infoSaved'));
    } catch (err: unknown) {
      onError((err as Error).message ?? t('settings.error.saveInfoFailed'));
    } finally {
      setIsSavingInfo(false);
    }
  };

  return (
    <>
      <section className="space-y-3">
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

      {/* 스터디 정보 저장 확인 모달 */}
      {showSaveInfoConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" role="presentation" onClick={() => setShowSaveInfoConfirm(false)} />
          <div className="relative rounded-xl border border-border bg-bg-card p-5 shadow-lg w-[340px] space-y-4">
            <p className="text-[14px] font-semibold text-text">{t('settings.modal.saveInfo.title')}</p>
            <p className="text-[13px] text-[var(--text-2)]">
              {t('settings.modal.saveInfo.description')}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSaveInfoConfirm(false)}
                className="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors hover:bg-bg-alt text-[var(--text-2)]"
              >
                {t('settings.modal.saveInfo.cancel')}
              </button>
              <button
                type="button"
                onClick={() => { void handleSaveInfo(); setShowSaveInfoConfirm(false); }}
                className="px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-opacity bg-[var(--primary)]"
              >
                {t('settings.modal.saveInfo.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
