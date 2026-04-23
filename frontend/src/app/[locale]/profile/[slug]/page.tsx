/**
 * @file 퍼블릭 프로필 페이지 — slug 기반 공개 프로필
 * @domain share
 * @layer page
 * @related publicApi, PublicProfileCard, StudyStatsCard
 */
'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { User as UserIcon, BookOpen, Code2, Brain, ExternalLink, AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { publicApi, type PublicProfile } from '@/lib/api';
import { getAvatarSrc, getAvatarPresetKey } from '@/lib/avatars';
import { Card } from '@/components/ui/Card';

export default function PublicProfilePage(): ReactNode {
  const params = useParams();
  const slug = params?.slug as string;
  const t = useTranslations('account');
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    publicApi.getPublicProfile(slug)
      .then((data) => { setProfile(data); setNotFound(false); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" style={{ color: 'var(--primary)' }} />
        </div>
      </Shell>
    );
  }

  if (notFound || !profile) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-16">
          <AlertCircle size={32} style={{ color: 'var(--text-3)' }} />
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>{t('profile.public.notFound')}</p>
        </div>
      </Shell>
    );
  }

  const avatarKey = getAvatarPresetKey(profile.avatarUrl);

  return (
    <Shell>
      <div className="space-y-6">
        {/* 프로필 헤더 */}
        <Card className="flex flex-col items-center p-6 sm:flex-row sm:gap-6">
          <Image
            src={getAvatarSrc(avatarKey)}
            alt={profile.name ?? 'User'}
            width={80}
            height={80}
            className="rounded-full"
          />
          <div className="mt-3 text-center sm:mt-0 sm:text-left">
            <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
              {profile.name ?? t('profile.public.noName')}
            </h1>
            <div className="mt-2 flex flex-wrap justify-center gap-4 sm:justify-start">
              <StatBadge icon={<Code2 size={14} />} value={profile.totalSubmissions} label={t('profile.public.totalSubmissions')} />
              {profile.averageAiScore != null && (
                <StatBadge icon={<Brain size={14} />} value={profile.averageAiScore} label={t('profile.public.aiAverage')} />
              )}
            </div>
          </div>
        </Card>

        {/* 참여 스터디 */}
        <div>
          <h2 className="mb-3 text-sm font-medium" style={{ color: 'var(--text-2)' }}>
            <BookOpen size={14} className="mr-1 inline" />
            {t('profile.public.studies.title')}
          </h2>
          {profile.studies.length === 0 ? (
            <Card className="p-6 text-center text-sm" style={{ color: 'var(--text-3)' }}>
              {t('profile.public.studies.empty')}
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {profile.studies.map((study, i) => (
                <Card key={i} className="p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium" style={{ color: 'var(--text)' }}>{study.studyName}</h3>
                    <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                      <UserIcon size={12} className="mr-0.5 inline" />{t('profile.public.studies.memberCount', { count: study.memberCount })}
                    </span>
                  </div>
                  <div className="mt-2 flex gap-4 text-xs" style={{ color: 'var(--text-3)' }}>
                    <span>{t('profile.public.studies.submissionCount', { count: study.totalSubmissions })}</span>
                    {study.averageAiScore != null && <span>{t('profile.public.studies.aiScore', { score: study.averageAiScore })}</span>}
                  </div>
                  {study.shareLink && (
                    <Link
                      href={study.shareLink}
                      className="mt-3 inline-flex items-center gap-1 rounded-btn px-3 py-1.5 text-xs font-medium transition-colors"
                      style={{ backgroundColor: 'var(--primary-soft)', color: 'var(--primary)' }}
                    >
                      {t('profile.public.studies.viewStudyRoom')} <ExternalLink size={12} />
                    </Link>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <header className="border-b px-4 py-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <Image src="/avatars/default.svg" alt="AlgoSu" width={28} height={28} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>AlgoSu</span>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6">{children}</main>
    </div>
  );
}

function StatBadge({ icon, value, label }: { readonly icon: ReactNode; readonly value: number; readonly label: string }): ReactNode {
  return (
    <div className="flex items-center gap-1 text-sm" style={{ color: 'var(--text-2)' }}>
      {icon}
      <span className="font-semibold">{value}</span>
      <span className="text-xs" style={{ color: 'var(--text-3)' }}>{label}</span>
    </div>
  );
}
