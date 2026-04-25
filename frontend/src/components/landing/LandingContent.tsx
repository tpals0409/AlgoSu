/**
 * @file Landing 페이지 클라이언트 콘텐츠 (번역 적용)
 * @domain common
 * @layer component
 * @related app/[locale]/page.tsx, HeroButtons, FeatureCards, HomeRedirect
 *
 * page.tsx(Server Component)에서 generateMetadata를 내보내기 위해
 * 클라이언트 렌더링 로직을 이 컴포넌트로 분리한다.
 * useTranslations('landing') 훅으로 번역 문자열을 참조한다.
 */

'use client';

import { type ReactNode, Suspense } from 'react';
import { Link } from '@/i18n/navigation';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Logo } from '@/components/ui/Logo';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { HomeRedirect } from '@/components/landing/HomeRedirect';
import { HeroButtons } from '@/components/landing/HeroButtons';
import { FeatureCards } from '@/components/landing/FeatureCards';
import { AdBanner } from '@/components/ad/AdBanner';
import { AD_SLOTS } from '@/lib/constants/adSlots';
import { useInView } from '@/hooks/useInView';

// ─── CONSTANTS ────────────────────────────

/** 후기 항목 인덱스 (번역 키 매핑용) */
const TESTIMONIAL_INDICES = [0, 1, 2] as const;

// ─── HELPERS ─────────────────────────────

/**
 * 스크롤 인 애니메이션 스타일
 * @param visible - IntersectionObserver 가시 여부
 * @param delay - 트랜지션 딜레이(초)
 */
function fadeStyle(visible: boolean, delay = 0): React.CSSProperties {
  return {
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(28px)',
    transition: `opacity .7s cubic-bezier(.16,1,.3,1) ${delay}s, transform .7s cubic-bezier(.16,1,.3,1) ${delay}s`,
  };
}

// ─── RENDER ──────────────────────────────

/**
 * Landing 페이지 전체 UI (클라이언트 컴포넌트)
 * @domain common
 */
export function LandingContent(): ReactNode {
  const t = useTranslations('landing');
  const [heroRef, heroVisible] = useInView(0.1);
  const [testimonialRef, testimonialVisible] = useInView(0.1);
  const [ctaRef, ctaVisible] = useInView(0.1);
  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-screen bg-bg text-text">
      <HomeRedirect />

      {/* ── NAV ── */}
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-border glass-nav">
        <div className="mx-auto flex h-14 max-w-container items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 text-base font-bold tracking-tight">
            <Logo size={28} />
            AlgoSu
          </Link>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="flex h-9 w-9 items-center justify-center rounded-btn text-text-3 hover:text-text hover:bg-bg-alt transition-colors"
              aria-label={t('nav.themeToggle')}
            >
              {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
            <Suspense fallback={null}>
              <LanguageSwitcher />
            </Suspense>
            <Link
              href="/login"
              className="inline-flex h-9 items-center rounded-btn bg-primary px-[18px] text-[13px] font-semibold text-white transition-all hover:brightness-110"
            >
              {t('nav.getStarted')}
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section
        ref={heroRef}
        className="relative overflow-hidden pb-20 pt-[140px] text-center"
      >
        {/* 배경 glow */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'var(--hero-glow)' }}
        />

        <div className="relative mx-auto max-w-[720px] px-6">
          {/* 타이틀 */}
          <h1
            className="mb-4 text-[clamp(32px,5vw,52px)] font-bold leading-tight tracking-tighter"
            style={fadeStyle(heroVisible, 0.1)}
          >
            <span>{t('hero.titleLine1')}</span>
            <br />
            <span className="gradient-brand-text">{t('hero.titleLine2')}</span>
          </h1>

          {/* 서브타이틀 */}
          <p
            className="mx-auto mb-9 max-w-[460px] text-[clamp(14px,2vw,17px)] leading-relaxed text-text-2"
            style={fadeStyle(heroVisible, 0.2)}
          >
            {t('hero.subtitleLine1')}
            <br />
            {t('hero.subtitleLine2')}
          </p>

          {/* CTA 버튼 */}
          <div style={fadeStyle(heroVisible, 0.3)}>
            <HeroButtons />
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <FeatureCards />

      {/* ── TESTIMONIALS ── */}
      <section
        ref={testimonialRef}
        className="border-t border-border bg-bg-alt py-[72px]"
      >
        <div className="mx-auto max-w-container px-6">
          <div
            className="mb-12 text-center"
            style={fadeStyle(testimonialVisible, 0)}
          >
            <span className="mb-4 inline-flex rounded-full bg-primary-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
              {t('testimonials.badge')}
            </span>
            <h2 className="text-[26px] font-bold tracking-tight">
              {t('testimonials.heading')}
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {TESTIMONIAL_INDICES.map((idx) => (
              <div
                key={idx}
                className="rounded-card border border-border bg-bg-card p-6 shadow"
                style={fadeStyle(testimonialVisible, 0.1 + idx * 0.1)}
              >
                <p className="mb-5 text-[13px] leading-relaxed text-text-2">
                  &ldquo;{t(`testimonials.items.${idx}.quote`)}&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-white">
                    {t(`testimonials.items.${idx}.initial`)}
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold">
                      {t(`testimonials.items.${idx}.name`)}
                    </div>
                    <div className="text-[11px] text-text-3">
                      {t(`testimonials.items.${idx}.role`)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section ref={ctaRef} className="px-6 py-20">
        <div
          className="mx-auto max-w-[760px] text-center"
          style={fadeStyle(ctaVisible, 0)}
        >
          <h2 className="mb-3 text-[30px] font-bold tracking-tight">
            {t('finalCta.heading')}
          </h2>
          <p className="text-sm leading-relaxed text-text-2">
            {t('finalCta.description')}
          </p>
        </div>
      </section>

      {/* ── AD ── */}
      <div className="mx-auto max-w-container px-6">
        <AdBanner slot={AD_SLOTS.LANDING_BOTTOM} className="mb-6" />
      </div>

      {/* ── FOOTER ── */}
      <footer className="border-t border-border py-8 text-center">
        <div className="mb-3 flex items-center justify-center gap-4 text-[12px] font-medium text-text-3">
          <Link href="/privacy" className="transition-colors hover:text-text">
            {t('footer.privacy')}
          </Link>
          <span aria-hidden>·</span>
          <Link href="/terms" className="transition-colors hover:text-text">
            {t('footer.terms')}
          </Link>
        </div>
        <p className="text-[11px] text-text-3">
          &copy; {new Date().getFullYear()} AlgoSu. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
