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
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Alert } from '@/components/ui/Alert';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import {
  studyApi,
  type Study,
  type StudyMember,
} from '@/lib/api';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useAuth } from '@/contexts/AuthContext';
import { AvatarSection } from './_components/AvatarSection';
import { InfoSection } from './_components/InfoSection';
import { RulesSection } from './_components/RulesSection';
import { MembersSection } from './_components/MembersSection';
import { InviteCodeSection } from './_components/InviteCodeSection';
import { DeleteSection } from './_components/DeleteSection';

// ─── TYPES ───────────────────────────────

interface PageProps {
  readonly params: Promise<{ id: string }>;
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

  // mount animation — 로딩 완료 후 트리거
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (isLoading) return;
    setMounted(false);
    const tm = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(tm);
  }, [isLoading]);

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

  /**
   * 섹션 성공 핸들러 — 성공 시 잔존 에러를 먼저 지워 Alert 중복 노출 방지 (M-1)
   */
  const handleSuccess = useCallback((msg: string): void => {
    setError(null);
    setSuccessMsg(msg);
  }, []);

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

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* ── HEADER ── */}
        {/* eslint-disable-next-line react/forbid-dom-props */}
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

        {/* eslint-disable react/forbid-dom-props */}
        {study && (
          <div style={fade(0.04)}>
            <AvatarSection
              studyId={studyId}
              study={study}
              onStudyUpdate={setStudy}
              onSuccess={handleSuccess}
              onError={setError}
            />
          </div>
        )}

        {study && (
          <div style={fade(0.08)}>
            <InfoSection
              studyId={studyId}
              study={study}
              onStudyUpdate={setStudy}
              onSuccess={handleSuccess}
              onError={setError}
            />
          </div>
        )}

        {study && (
          <div style={fade(0.12)}>
            <RulesSection
              studyId={studyId}
              initialRulesText={study.groundRules ?? ''}
              onSuccess={handleSuccess}
              onError={setError}
            />
          </div>
        )}

        <div style={fade(0.16)}>
          <MembersSection
            studyId={studyId}
            members={members}
            currentUserId={user?.id}
            onMembersUpdate={setMembers}
            onSuccess={handleSuccess}
            onError={setError}
          />
        </div>

        <div style={fade(0.2)}>
          <InviteCodeSection
            studyId={studyId}
            onError={setError}
          />
        </div>

        <div style={fade(0.24)}>
          <DeleteSection
            studyId={studyId}
            members={members}
            onDelete={() => router.push('/studies')}
            onError={setError}
          />
        </div>
        {/* eslint-enable react/forbid-dom-props */}
      </div>
    </AppLayout>
  );
}
