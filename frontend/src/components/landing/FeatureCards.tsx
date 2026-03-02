/**
 * @file 기능 소개 3-Card 섹션
 * @domain common
 * @layer component
 * @related Card
 */

'use client';

import type { ReactNode } from 'react';
import { BookOpen, GitBranch, Zap } from 'lucide-react';
import { useInView } from '@/hooks/useInView';

// ─── CONSTANTS ────────────────────────────

interface Feature {
  icon: typeof BookOpen;
  title: string;
  desc: string;
}

const FEATURES: Feature[] = [
  {
    icon: BookOpen,
    title: '체계적인 문제 관리',
    desc: '난이도별 분류, 주차별 관리, 마감 타이머까지. 백준 문제 번호로 자동 연동됩니다.',
  },
  {
    icon: GitBranch,
    title: 'GitHub 자동 동기화',
    desc: '코드를 제출하면 스터디 레포에 자동 커밋. 잔디도 심고, 포트폴리오도 쌓으세요.',
  },
  {
    icon: Zap,
    title: 'AI 코드 리뷰',
    desc: '제출 코드를 AI가 분석해 점수, 피드백, 최적화 코드를 제공합니다.',
  },
];

// ─── RENDER ──────────────────────────────

/**
 * 핵심 기능 3-Card 그리드
 * @domain common
 */
export function FeatureCards(): ReactNode {
  const [ref, visible] = useInView(0.1);

  return (
    <section
      id="features"
      ref={ref}
      className="mx-auto max-w-container px-6 pb-20 pt-10"
    >
      <div
        className="mb-12 text-center transition-all duration-700 ease-bounce"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(28px)',
        }}
      >
        <span className="mb-4 inline-flex rounded-full bg-primary-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
          핵심 기능
        </span>
        <h2 className="text-[28px] font-bold tracking-tight">
          스터디에 필요한 모든 것
        </h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {FEATURES.map((f, i) => {
          const Icon = f.icon;
          return (
            <div
              key={f.title}
              className="group rounded-lg border border-border bg-bg-card p-7 shadow transition-all duration-300 ease-bounce hover:-translate-y-1 hover:shadow-hover"
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(28px)',
                transitionDelay: `${0.1 + i * 0.1}s`,
              }}
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md bg-primary-soft text-primary">
                <Icon className="h-[22px] w-[22px]" />
              </div>
              <h3 className="mb-2 text-base font-semibold">{f.title}</h3>
              <p className="text-[13px] leading-relaxed text-text-2">
                {f.desc}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
