/**
 * @file 스터디 설정 — 아바타 섹션 컴포넌트
 * @domain study
 * @layer component
 * @related settings/page.tsx, lib/avatars
 */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { studyApi, type Study } from '@/lib/api';
import {
  getAvatarPresetKey,
  getAvatarSrc,
  toAvatarUrl,
  STUDY_AVATAR_PRESETS,
} from '@/lib/avatars';
import Image from 'next/image';
import { cn } from '@/lib/utils';

// ─── TYPES ───────────────────────────────

export interface AvatarSectionProps {
  readonly studyId: string;
  readonly study: Study;
  readonly onStudyUpdate: (s: Study) => void;
  readonly onSuccess: (msg: string) => void;
  readonly onError: (msg: string) => void;
}

// ─── COMPONENT ───────────────────────────

/**
 * 스터디 아바타 프리셋 선택 및 저장 섹션
 * @domain study
 */
export function AvatarSection({
  studyId,
  study,
  onStudyUpdate,
  onSuccess,
  onError,
}: AvatarSectionProps) {
  const t = useTranslations('studies');

  const [selectedStudyAvatarKey, setSelectedStudyAvatarKey] = useState(
    () => getAvatarPresetKey(study.avatar_url),
  );
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);

  /** 아바타 저장 핸들러 */
  const handleSaveAvatar = async (): Promise<void> => {
    setIsSavingAvatar(true);
    try {
      const updated = await studyApi.update(studyId, {
        avatarUrl: toAvatarUrl(selectedStudyAvatarKey),
      });
      onStudyUpdate(updated);
      onSuccess(t('settings.success.avatarSaved'));
    } catch (err: unknown) {
      onError((err as Error).message ?? t('settings.error.saveAvatarFailed'));
    } finally {
      setIsSavingAvatar(false);
    }
  };

  return (
    <section className="space-y-3">
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
              onClick={() => void handleSaveAvatar()}
            >
              {isSavingAvatar ? t('settings.avatar.saving') : t('settings.avatar.save')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
