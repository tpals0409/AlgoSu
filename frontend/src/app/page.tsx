/**
 * @file Landing 페이지 (v2 전면 교체)
 * @domain common
 * @layer page
 * @related HomeRedirect, HeroButtons, FeatureCards, DiffBadge, Logo, useInView, useAnimVal
 */

'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';
import { DiffBadge } from '@/components/ui/DiffBadge';
import { HomeRedirect } from '@/components/landing/HomeRedirect';
import { HeroButtons } from '@/components/landing/HeroButtons';
import { FeatureCards } from '@/components/landing/FeatureCards';
import { useInView } from '@/hooks/useInView';
import { useAnimVal } from '@/hooks/useAnimVal';

// ─── TYPES ────────────────────────────────

type DiffTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

// ─── CONSTANTS ────────────────────────────

const DIFF_TIERS: DiffTier[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];

const MOCK_STUDIES = [
  { name: '알고리즘 마스터', members: 8, activity: '방금 전 활동' },
  { name: 'PS 스터디', members: 5, activity: '2시간 전 활동' },
  { name: '코딩테스트 준비반', members: 12, activity: '5시간 전 활동' },
];

// ─── HELPERS ─────────────────────────────

/** 뷰포트 진입 시 fade-in 스타일 생성 */
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
  const [codeRef, codeVisible] = useInView(0.1);
  const [ctaRef, ctaVisible] = useInView(0.1);

  const [counterRef1, studyCount] = useAnimVal(150);
  const [counterRef2, solveCount] = useAnimVal(2400);
  const [counterRef3, satisfactionVal] = useAnimVal(98);

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
          {/* 난이도 뱃지 */}
          <div
            className="mb-7 flex flex-wrap justify-center gap-2"
            style={fadeStyle(heroVisible, 0)}
          >
            {DIFF_TIERS.map((tier) => (
              <DiffBadge key={tier} tier={tier} />
            ))}
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
            팀과 함께 성장하세요.
          </p>

          {/* CTA 버튼 */}
          <div style={fadeStyle(heroVisible, 0.3)}>
            <HeroButtons />
          </div>

          {/* 카운터 통계 */}
          <div
            className="mt-12 flex justify-center gap-10"
            style={fadeStyle(heroVisible, 0.4)}
          >
            <div className="text-center" ref={counterRef2}>
              <div className="font-mono text-[22px] font-bold text-primary">
                {Math.round(solveCount).toLocaleString()}+
              </div>
              <div className="mt-0.5 text-xs text-text-3">풀이 제출</div>
            </div>
            <div className="text-center" ref={counterRef1}>
              <div className="font-mono text-[22px] font-bold text-primary">
                {Math.round(studyCount)}+
              </div>
              <div className="mt-0.5 text-xs text-text-3">활성 스터디</div>
            </div>
            <div className="text-center" ref={counterRef3}>
              <div className="font-mono text-[22px] font-bold text-primary">
                {Math.round(satisfactionVal)}%
              </div>
              <div className="mt-0.5 text-xs text-text-3">만족도</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <FeatureCards />

      {/* ── CODE PREVIEW (AI 분석) ── */}
      <section ref={codeRef} className="mx-auto max-w-container px-6 pb-20">
        <div className="grid items-center gap-8 md:grid-cols-2">
          {/* 왼쪽: 설명 */}
          <div style={fadeStyle(codeVisible, 0)}>
            <span className="mb-4 inline-flex rounded-full bg-success-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-success">
              AI 분석
            </span>
            <h2 className="mb-3 text-[26px] font-bold tracking-tight">
              코드를 제출하면
              <br />
              AI가 분석합니다
            </h2>
            <p className="mb-6 text-sm leading-relaxed text-text-2">
              시간 복잡도, 코드 품질, 개선 방향까지.
              <br />
              AI가 상세한 피드백과 최적화 코드를 제공합니다.
            </p>

            {/* 점수 미리보기 */}
            <div className="flex gap-5">
              {[
                { score: 92, label: '우수', colorClass: 'text-success' },
                { score: 65, label: '보통', colorClass: 'text-warning' },
                { score: 30, label: '개선 필요', colorClass: 'text-error' },
              ].map((g) => (
                <div key={g.label} className="text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-border bg-bg">
                    <span className={`font-mono text-[15px] font-bold ${g.colorClass}`}>
                      {g.score}
                    </span>
                  </div>
                  <div className="mt-1.5 text-[10px] text-text-3">{g.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 오른쪽: 코드 에디터 미리보기 */}
          <div
            className="overflow-hidden rounded-lg border border-border bg-code-bg shadow"
            style={fadeStyle(codeVisible, 0.15)}
          >
            {/* 에디터 헤더 */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#FF5F56' }} />
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#FFBD2E' }} />
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#27C93F' }} />
              </div>
              <span className="text-[11px] text-text-3">solution.py</span>
            </div>

            {/* 코드 */}
            <pre className="p-5 font-mono text-[12.5px] leading-relaxed text-text-2">
{`def two_sum(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    raise ValueError("No solution")`}
            </pre>

            {/* AI 분석 결과 바 */}
            <div className="flex items-center justify-between border-t border-border bg-primary-soft px-4 py-3">
              <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
                <Zap />
                AI 분석 완료 — 92점
              </span>
              <span className="cursor-pointer text-[11px] font-semibold text-primary">
                피드백 보기 →
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="border-y border-border bg-bg-alt py-[72px]">
        <div className="mx-auto max-w-[800px] px-6 text-center">
          <span className="mb-4 inline-flex rounded-full bg-primary-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
            사용 방법
          </span>
          <h2 className="mb-12 text-[26px] font-bold tracking-tight">
            3단계로 시작하세요
          </h2>
          <div className="grid grid-cols-3 gap-6">
            {[
              { step: '01', title: '스터디 생성', desc: '스터디를 만들고 초대 코드로 팀원을 모으세요.' },
              { step: '02', title: '문제 풀이 & 제출', desc: '배정된 문제를 풀고 코드를 제출하세요. GitHub에 자동 동기화.' },
              { step: '03', title: 'AI 리뷰 & 성장', desc: 'AI 분석 피드백을 통해 실력을 키우세요.' },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="mb-3 font-mono text-[32px] font-bold text-primary opacity-30">
                  {s.step}
                </div>
                <h3 className="mb-1.5 text-[15px] font-semibold">{s.title}</h3>
                <p className="text-[13px] leading-relaxed text-text-2">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── OPEN STUDIES ── */}
      <section className="mx-auto max-w-container px-6 py-20">
        <div className="mb-8 text-center">
          <span className="mb-4 inline-flex rounded-full bg-primary-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
            오픈 스터디
          </span>
          <h2 className="text-[26px] font-bold tracking-tight">
            함께 공부하는 스터디에 참여하세요
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {MOCK_STUDIES.map((study) => (
            <div
              key={study.name}
              className="rounded-card border border-border bg-bg-card p-6 shadow transition-all duration-300 hover:-translate-y-1 hover:shadow-hover"
            >
              <h3 className="mb-2 text-base font-semibold">{study.name}</h3>
              <div className="mb-3 flex items-center gap-3 text-xs text-text-3">
                <span>{study.members}명 참여</span>
                <span className="opacity-30">|</span>
                <span>{study.activity}</span>
              </div>
              <div className="flex h-1 overflow-hidden rounded-full bg-bg-alt">
                <div
                  className="rounded-full gradient-brand"
                  style={{ width: `${Math.min(study.members * 12, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/login"
            className="inline-flex h-10 items-center rounded-btn bg-primary px-5 text-[13px] font-semibold text-white transition-all hover:brightness-110"
          >
            스터디 만들기
          </Link>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section ref={ctaRef} className="px-6 py-20 text-center">
        <div
          className="mx-auto max-w-[560px]"
          style={fadeStyle(ctaVisible, 0)}
        >
          <h2 className="mb-3 text-[30px] font-bold tracking-tight">
            지금 바로 시작하세요
          </h2>
          <p className="mb-8 text-sm leading-relaxed text-text-2">
            무료로 스터디를 만들고, 팀과 함께 알고리즘 실력을 키워보세요.
          </p>
          <Link
            href="/login"
            className="inline-flex h-[52px] items-center rounded-lg px-9 text-base font-semibold text-white shadow-[0_4px_24px_rgba(124,106,174,0.35)] gradient-brand transition-all hover:brightness-110"
          >
            무료로 시작하기
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-border py-8 text-center">
        <div className="mb-2 flex items-center justify-center gap-2">
          <Logo size={20} />
          <span className="text-[13px] font-semibold text-text-2">AlgoSu</span>
        </div>
        <p className="text-[11px] text-text-3">
          &copy; {new Date().getFullYear()} AlgoSu. All rights reserved.
        </p>
      </footer>
    </div>
  );
}

// ─── INTERNAL COMPONENT ──────────────────

/** AI 분석 아이콘 (Zap) */
function Zap(): ReactNode {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v4m0 14v4M4.22 4.22l2.83 2.83m9.9 9.9l2.83 2.83M1 12h4m14 0h4M4.22 19.78l2.83-2.83m9.9-9.9l2.83-2.83" />
    </svg>
  );
}
