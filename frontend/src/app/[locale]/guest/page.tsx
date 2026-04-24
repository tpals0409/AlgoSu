/**
 * @file 게스트 모드 인덱스 — 샘플 분석 결과 미리보기 목록 (i18n 적용)
 * @domain guest
 * @layer page
 * @related GuestSample, GuestNav, DifficultyBadge, Card, messages/common.json
 *
 * 비인증 사용자가 AI 코드 분석 결과를 사전 체험하는 정적 페이지.
 * 인증/JWT 없음. PUBLIC_PATHS에 '/guest' 등록으로 접근 허용.
 */

import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { GuestNav } from '@/components/guest/GuestNav';
import { Card, CardContent } from '@/components/ui/Card';
import { DifficultyBadge } from '@/components/ui/DifficultyBadge';
import { GUEST_SAMPLES, type GuestSample } from '@/data/guest-samples';

// ─── SUB COMPONENTS ──────────────────────────

/** 언어 뱃지 (uppercase, bg-bg-alt 토큰) */
function LanguageBadge({ language }: { readonly language: string }): ReactNode {
  return (
    <span className="rounded-full bg-bg-alt px-2 py-0.5 text-[10px] font-medium uppercase text-text-3">
      {language}
    </span>
  );
}

/** 태그 목록 (작은 rounded 뱃지) */
function TagList({ tags }: { readonly tags: string[] }): ReactNode {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span key={tag} className="rounded bg-bg-alt px-1.5 py-0.5 text-[10px] text-text-3">
          {tag}
        </span>
      ))}
    </div>
  );
}

/** 샘플 카드 — 클릭 시 /guest/preview/[slug] 이동 */
function SampleCard({ sample }: { readonly sample: GuestSample }): ReactNode {
  return (
    <Link href={`/guest/preview/${sample.slug}`} className="block group">
      <Card className="h-full transition-all group-hover:border-primary/30">
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-text transition-colors group-hover:text-primary">
              {sample.problem.title}
            </h3>
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-text-3 transition-colors group-hover:text-primary" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DifficultyBadge difficulty={sample.problem.difficulty} />
            <LanguageBadge language={sample.submission.language} />
          </div>
          <p className="line-clamp-2 text-xs leading-relaxed text-text-2">
            {sample.problem.description}
          </p>
          <TagList tags={sample.problem.tags} />
        </CardContent>
      </Card>
    </Link>
  );
}

// ─── PAGE SECTIONS ───────────────────────────

/** 히어로 섹션 — 서비스 설명 */
function HeroSection(): ReactNode {
  const t = useTranslations('common');

  return (
    <section className="px-6 py-12 text-center">
      <div className="mx-auto max-w-container">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
          {t('guest.previewLabel')}
        </p>
        <h1 className="mb-3 text-2xl font-bold tracking-tight text-text sm:text-3xl">
          {t('guest.heading')}
        </h1>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-text-2">
          {t('guest.description')}
          <br />
          {t('guest.descriptionSub')}
        </p>
      </div>
    </section>
  );
}

/** 샘플 카드 그리드 */
function SampleGrid(): ReactNode {
  return (
    <section className="px-6 pb-16">
      <div className="mx-auto max-w-container">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GUEST_SAMPLES.map((sample) => (
            <SampleCard key={sample.id} sample={sample} />
          ))}
        </div>
      </div>
    </section>
  );
}

/** 하단 로그인 유도 푸터 */
function GuestFooter(): ReactNode {
  const t = useTranslations('common');

  return (
    <footer className="border-t border-border bg-bg-card py-8 text-center">
      <p className="text-sm text-text-2">
        {t('guest.footerCta')}{' '}
        <Link href="/login" className="font-semibold text-primary transition-all hover:underline">
          {t('guest.footerLogin')}
        </Link>
      </p>
    </footer>
  );
}

// ─── PAGE ────────────────────────────────────

/** 게스트 모드 인덱스 페이지 (서버 컴포넌트, 인증 불필요) */
export default function GuestPage(): ReactNode {
  return (
    <div className="min-h-screen bg-bg text-text">
      <GuestNav />
      <main id="main-content" className="pt-16">
        <HeroSection />
        <SampleGrid />
      </main>
      <GuestFooter />
    </div>
  );
}
