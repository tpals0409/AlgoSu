/**
 * @file 기능 소개 6-Card 섹션
 * @domain common
 * @layer component
 * @related Card
 */

'use client';

import type { ReactNode } from 'react';
import { Code2, Github, Users, BarChart2, MonitorPlay, CheckSquare } from 'lucide-react';
import { useInView } from '@/hooks/useInView';

// ─── CONSTANTS ────────────────────────────

interface Feature {
  icon: typeof Code2;
  title: string;
  desc: string;
}

const FEATURES: Feature[] = [
  {
    icon: Code2,
    title: 'AI 코드 분석',
    desc: '제출 코드를 AI가 자동으로 분석. 효율성, 가독성, 정확성 점수와 상세 피드백 제공.',
  },
  {
    icon: Github,
    title: 'GitHub 자동 동기화',
    desc: '제출한 코드를 GitHub 저장소에 자동 커밋. 포트폴리오를 자연스럽게 쌓아가세요.',
  },
  {
    icon: Users,
    title: '스터디 협업',
    desc: '팀원과 함께 문제를 풀고 서로의 코드를 비교·리뷰하는 공동 성장 공간.',
  },
  {
    icon: BarChart2,
    title: '통계 대시보드',
    desc: '주차별 제출 현황, 난이도 분포, 언어별 통계로 성장 곡선을 한눈에 확인.',
  },
  {
    icon: MonitorPlay,
    title: '실시간 스터디룸',
    desc: '화상 · 채팅 · 공유 에디터로 팀원과 함께 실시간으로 문제를 풀어보세요.',
  },
  {
    icon: CheckSquare,
    title: '진도 관리',
    desc: '마감일, 제출 여부, 미제출 알림까지. 스터디 진행 상황을 체계적으로 관리.',
  },
];

// ─── RENDER ──────────────────────────────

/**
 * 핵심 기능 6-Card 그리드
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
          FEATURES
        </span>
        <h2 className="text-[26px] font-bold tracking-tight">
          스터디에 필요한 모든 것
        </h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {FEATURES.map((f, i) => {
          const Icon = f.icon;
          return (
            <div
              key={f.title}
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
