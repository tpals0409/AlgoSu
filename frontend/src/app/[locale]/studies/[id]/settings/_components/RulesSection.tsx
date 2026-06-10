/**
 * @file 스터디 설정 — 그라운드룰 섹션 컴포넌트
 * @domain study
 * @layer component
 * @related settings/page.tsx, studyApi, MarkdownViewer
 */

'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Eye, Pencil } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { MarkdownViewer } from '@/components/ui/MarkdownViewer';
import { studyApi } from '@/lib/api';

// ─── TYPES ───────────────────────────────

export interface RulesSectionProps {
  readonly studyId: string;
  readonly initialRulesText: string;
  readonly onSuccess: (msg: string) => void;
  readonly onError: (msg: string) => void;
}

// ─── COMPONENT ───────────────────────────

/**
 * 스터디 그라운드룰 편집 섹션 (마크다운 지원)
 * @domain study
 */
export function RulesSection({
  studyId,
  initialRulesText,
  onSuccess,
  onError,
}: RulesSectionProps) {
  const t = useTranslations('studies');

  const [rulesText, setRulesText] = useState(initialRulesText);
  const [rulesMode, setRulesMode] = useState<'edit' | 'preview'>('edit');
  const [isSavingRules, setIsSavingRules] = useState(false);
  const [showSaveRulesConfirm, setShowSaveRulesConfirm] = useState(false);

  // ESC 키로 모달 닫기
  useEffect(() => {
    if (!showSaveRulesConfirm) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSaveRulesConfirm(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showSaveRulesConfirm]);

  /** 그라운드룰 저장 */
  const handleSaveRules = async (): Promise<void> => {
    setIsSavingRules(true);
    try {
      await studyApi.updateGroundRules(studyId, rulesText);
      onSuccess(t('settings.success.rulesSaved'));
    } catch (err: unknown) {
      onError((err as Error).message ?? t('settings.error.saveRulesFailed'));
    } finally {
      setIsSavingRules(false);
    }
  };

  return (
    <>
      <section className="space-y-3">
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
              <div className="min-h-[200px] rounded-btn border border-border bg-bg p-4 leading-[1.7]">
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

      {/* 그라운드 룰 저장 확인 모달 */}
      {showSaveRulesConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" role="presentation" onClick={() => setShowSaveRulesConfirm(false)} />
          <div className="relative rounded-xl border border-border bg-bg-card p-5 shadow-lg w-[340px] space-y-4">
            <p className="text-[14px] font-semibold text-text">{t('settings.modal.saveRules.title')}</p>
            <p className="text-[13px] text-[var(--text-2)]">
              {t('settings.modal.saveRules.description')}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSaveRulesConfirm(false)}
                className="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors hover:bg-bg-alt text-[var(--text-2)]"
              >
                {t('settings.modal.saveRules.cancel')}
              </button>
              <button
                type="button"
                onClick={() => { void handleSaveRules(); setShowSaveRulesConfirm(false); }}
                className="px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-opacity bg-[var(--primary)]"
              >
                {t('settings.modal.saveRules.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
