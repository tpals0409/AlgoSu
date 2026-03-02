/**
 * @file 뷰포트 진입 감지 Hook
 * @domain common
 * @layer hook
 *
 * IntersectionObserver 기반. 한 번 진입하면 true 고정 (fade-in 애니메이션용).
 */

'use client';

import { useEffect, useRef, useState } from 'react';

/** 요소가 뷰포트에 진입했는지 감지 */
export function useInView(threshold = 0.15): [React.RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, visible];
}
