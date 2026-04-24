/**
 * @file 온보딩 진행률 스테퍼 — register 흐름(가입 → 프로필 → GitHub) 공통 UI
 * @domain identity
 * @layer component
 * @related app/[locale]/(auth)/register/page.tsx, register/profile/page.tsx, register/github/page.tsx
 *
 * Sprint 126 Wave B7: register 3 페이지에 인라인 정의된 동일 컴포넌트를 공통으로 추출.
 * useTranslations('auth')의 register.stepper.step1~3 키를 참조한다.
 */

'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';

interface OnboardingStepperProps {
  /** 현재 진행 단계 (1=가입, 2=프로필, 3=GitHub) */
  readonly current: 1 | 2 | 3;
}

/**
 * 3단계 온보딩 진행률 스테퍼.
 *
 * 각 단계는 active(현재) / done(완료) / pending(대기) 시각 상태를 가진다.
 * - active: 보라색 채움 + 배경 강조
 * - done: 보라색 체크 아이콘 + 연결선 강조
 * - pending: 회색 텍스트
 */
export function OnboardingStepper({ current }: OnboardingStepperProps): ReactNode {
  const tAuth = useTranslations('auth');
  const steps = [
    tAuth('register.stepper.step1'),
    tAuth('register.stepper.step2'),
    tAuth('register.stepper.step3'),
  ];

  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((label, i) => {
        const step = i + 1;
        const isActive = step === current;
        const isDone = step < current;
        return (
          <div key={label} className="flex items-center gap-2">
            {i > 0 && (
              <div className={`h-px w-6 ${isDone ? 'bg-primary' : 'bg-border'}`} />
            )}
            <div
              className={`flex items-center gap-1.5 text-xs font-medium ${
                isActive ? 'text-primary' : isDone ? 'text-primary/60' : 'text-text-3'
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                  isActive
                    ? 'bg-primary text-white'
                    : isDone
                      ? 'bg-primary/20 text-primary'
                      : 'bg-bg-alt text-text-3'
                }`}
              >
                {isDone ? '✓' : step}
              </span>
              {label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
