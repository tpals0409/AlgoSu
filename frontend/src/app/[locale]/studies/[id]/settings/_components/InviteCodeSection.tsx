/**
 * @file 스터디 설정 — 초대 코드 섹션 컴포넌트
 * @domain study
 * @layer component
 * @related settings/page.tsx, studyApi
 */

'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Copy, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { studyApi } from '@/lib/api';

// ─── TYPES ───────────────────────────────

export interface InviteCodeSectionProps {
  readonly studyId: string;
  readonly onError: (msg: string) => void;
  /** 재생성 성공 시 부모 에러 상태 초기화용 (msg = '' → setError(null) 효과, 성공 Alert 미표시) */
  readonly onSuccess?: (msg: string) => void;
}

// ─── COMPONENT ───────────────────────────

/**
 * 초대 코드 발급/갱신/복사 섹션
 * @domain study
 */
export function InviteCodeSection({
  studyId,
  onError,
  onSuccess,
}: InviteCodeSectionProps) {
  const t = useTranslations('studies');

  const [inviteCode, setInviteCode] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);
  const [codeExpiry, setCodeExpiry] = useState(0);
  const [codeActive, setCodeActive] = useState(false);
  const [isRefreshingCode, setIsRefreshingCode] = useState(false);

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

  /** 초대 코드 복사 */
  const handleCopyCode = async (): Promise<void> => {
    await navigator.clipboard.writeText(inviteCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  /** 초대 코드 재생성 */
  const handleRefreshCode = async (): Promise<void> => {
    setIsRefreshingCode(true);
    try {
      const result = await studyApi.invite(studyId);
      setInviteCode(result.code);
      const expiresAt = new Date(result.expires_at).getTime();
      const remainingSec = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setCodeExpiry(remainingSec);
      setCodeActive(remainingSec > 0);
      // 성공 시 부모 에러 상태 초기화 (msg = '' → setError(null) 효과, 성공 Alert 미표시)
      onSuccess?.('');
    } catch (err: unknown) {
      onError((err as Error).message ?? t('settings.error.inviteCodeFailed'));
    } finally {
      setIsRefreshingCode(false);
    }
  };

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-text-3">{t('settings.invite.heading')}</h2>
      <Card>
        <CardContent className="space-y-3 py-4">
          <div className="flex items-center gap-2">
            <Input
              value={
                codeActive
                  ? inviteCode
                  : inviteCode
                    ? t('settings.invite.expired')
                    : t('settings.invite.generate')
              }
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
              <RefreshCw
                className={`h-4 w-4 ${isRefreshingCode ? 'animate-spin' : ''}`}
                aria-hidden
              />
            </button>
          </div>
          <div className="flex items-center justify-between">
            {codeActive ? (
              <p className="text-xs text-text-3">
                <span
                  className="font-medium"
                  style={{ color: codeExpiry <= 60 ? 'var(--error)' : 'var(--primary)' }} // eslint-disable-line react/forbid-dom-props
                >
                  {String(Math.floor(codeExpiry / 60)).padStart(2, '0')}:
                  {String(codeExpiry % 60).padStart(2, '0')}
                </span>{' '}
                {t('settings.invite.expiresIn')}
              </p>
            ) : (
              <p
                className={`text-xs ${inviteCode ? 'text-[var(--error)]' : 'text-[var(--text-3)]'}`}
              >
                {inviteCode
                  ? t('settings.invite.expiredMessage')
                  : t('settings.invite.generateMessage')}
              </p>
            )}
            {codeCopied && (
              <p className="text-xs text-success">{t('settings.invite.copied')}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
