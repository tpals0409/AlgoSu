/**
 * @file 숫자 애니메이션 Hook
 * @domain common
 * @layer hook
 *
 * IntersectionObserver 기반. 요소가 뷰포트에 진입하면 0에서 target까지 easeOutCubic 애니메이션.
 */

'use client';

import { useEffect, useRef, useState } from 'react';

/** 뷰포트 진입 시 0 -> target 애니메이션 */
export function useAnimVal(
  target: number,
  duration = 1000,
): [React.RefObject<HTMLDivElement | null>, number] {
  const [value, setValue] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setStarted(true);
      },
      { threshold: 0.2 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;

    let startTime: number | null = null;
    let rafId: number;

    const step = (timestamp: number): void => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(eased * target);
      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [started, target, duration]);

  return [ref, value];
}
