/**
 * @file 기능 소개 6-Card 섹션 (번역 적용)
 * @domain common
 * @layer component
 * @related Card, LandingContent
 */

'use client';

import type { ReactNode } from 'react';
import { Code2, Github, Users, BarChart2, MessageSquareCode, CheckSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useInView } from '@/hooks/useInView';

// ─── CONSTANTS ────────────────────────────

/** 기능 카드 키-아이콘 매핑 (번역 키는 landing.features.{key}) */
const FEATURE_ITEMS = [
  { key: 'aiAnalysis', icon: Code2 },
  { key: 'githubSync', icon: Github },
  { key: 'studyCollab', icon: Users },
  { key: 'dashboard', icon: BarChart2 },
  { key: 'codeReview', icon: MessageSquareCode },
  { key: 'progressMgmt', icon: CheckSquare },
] as const;

// ─── RENDER ──────────────────────────────

/**
 * 핵심 기능 6-Card 그리드
 * @domain common
 */
export function FeatureCards(): ReactNode {
  const t = useTranslations('landing');
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
          {t('features.badge')}
        </span>
        <h2 className="text-[26px] font-bold tracking-tight">
          {t('features.heading')}
        </h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {FEATURE_ITEMS.map((f, i) => {
          const Icon = f.icon;
          return (
            <div
              key={f.key}
              className="group rounded-card border border-border bg-bg-card p-7 shadow transition-all duration-300 ease-bounce hover:-translate-y-1 hover:shadow-hover"
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(28px)',
                transitionDelay: `${0.1 + i * 0.08}s`,
              }}
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md bg-primary-soft text-primary">
                <Icon className="h-[22px] w-[22px]" />
              </div>
              <h3 className="mb-2 text-base font-semibold">
                {t(`features.${f.key}.title`)}
              </h3>
              <p className="text-[13px] leading-relaxed text-text-2">
                {t(`features.${f.key}.description`)}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
