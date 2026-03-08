/**
 * @file Landing 페이지 (Figma pixel-perfect v3)
 * @domain common
 * @layer page
 * @related HomeRedirect, HeroButtons, FeatureCards, Logo
 */

'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { Moon, Sun, ArrowRight } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { HomeRedirect } from '@/components/landing/HomeRedirect';
import { HeroButtons } from '@/components/landing/HeroButtons';
import { FeatureCards } from '@/components/landing/FeatureCards';
import { useInView } from '@/hooks/useInView';

// ─── CONSTANTS ────────────────────────────

const TESTIMONIALS = [
  {
    quote: '"AI 분석 덕분에 코드 품질이 확실히 올랐어요. 혼자서는 발견 못했을 패턴들을 잡아주네요."',
    name: '이서연',
    role: '백엔드 개발자',
    initial: '이',
  },
  {
    quote: '"GitHub 자동 커밋이 정말 편리해요. 스터디하면서 자연스럽게 1일 1커밋 달성 중입니다!"',
    name: '박준서',
    role: '대학원생',
    initial: '박',
  },
  {
    quote: '"통계 대시보드로 어떤 알고리즘이 약한지 파악하고 집중 공략할 수 있었어요."',
    name: '최예린',
    role: '취준생',
    initial: '최',
  },
];

// ─── HELPERS ─────────────────────────────

function fadeStyle(visible: boolean, delay = 0): React.CSSProperties {
  return {
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(28px)',
    transition: `opacity .7s cubic-bezier(.16,1,.3,1) ${delay}s, transform .7s cubic-bezier(.16,1,.3,1) ${delay}s`,
  };
}

// ─── RENDER ──────────────────────────────

export default function LandingPage(): ReactNode {
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
              aria-label="테마 전환"
            >
              {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
            <Link
              href="/login"
              className="inline-flex h-9 items-center rounded-btn px-[18px] text-[13px] font-semibold text-text-2 border border-border hover:bg-bg-alt transition-colors"
            >
              로그인
            </Link>
            <Link
              href="/login"
              className="inline-flex h-9 items-center rounded-btn bg-primary px-[18px] text-[13px] font-semibold text-white transition-all hover:brightness-110"
            >
              시작하기
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
          {/* AI 분석 베타 배지 */}
          <div
            className="mb-7 flex justify-center"
            style={fadeStyle(heroVisible, 0)}
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-card px-4 py-1.5 text-[12px] font-medium text-text-2 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              AI 코드 분석 β 오픈
            </span>
          </div>

          {/* 타이틀 */}
          <h1
            className="mb-4 text-[clamp(32px,5vw,52px)] font-bold leading-tight tracking-tighter"
            style={fadeStyle(heroVisible, 0.1)}
          >
            <span>알고리즘 스터디의</span>
            <br />
            <span className="gradient-brand-text">새로운 기준</span>
          </h1>

          {/* 서브타이틀 */}
          <p
            className="mx-auto mb-9 max-w-[460px] text-[clamp(14px,2vw,17px)] leading-relaxed text-text-2"
            style={fadeStyle(heroVisible, 0.2)}
          >
            문제 풀이부터 GitHub 동기화, AI 코드 분석까지.
            <br />
            팀과 함께 체계적으로 성장하세요.
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
              TESTIMONIAL
            </span>
            <h2 className="text-[26px] font-bold tracking-tight">
              사용자 후기
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <div
                key={t.name}
                className="rounded-card border border-border bg-bg-card p-6 shadow"
                style={fadeStyle(testimonialVisible, 0.1 + i * 0.1)}
              >
                <p className="mb-5 text-[13px] leading-relaxed text-text-2">{t.quote}</p>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-white">
                    {t.initial}
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold">{t.name}</div>
                    <div className="text-[11px] text-text-3">{t.role}</div>
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
          className="mx-auto max-w-[760px] rounded-card border border-border bg-bg-card p-16 text-center shadow"
          style={fadeStyle(ctaVisible, 0)}
        >
          <h2 className="mb-3 text-[30px] font-bold tracking-tight">
            지금 바로 시작하세요
          </h2>
          <p className="mb-8 text-sm leading-relaxed text-text-2">
            스터디 개설부터 AI 분석까지, 5분이면 충분합니다.
          </p>
          <Link
            href="/login"
            className="inline-flex h-[52px] items-center gap-2 rounded-btn px-9 text-base font-semibold text-white shadow-glow gradient-brand transition-all hover:brightness-110"
          >
            무료로 시작하기 <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-border py-8 text-center">
        <p className="text-[11px] text-text-3">
          &copy; {new Date().getFullYear()} AlgoSu. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
