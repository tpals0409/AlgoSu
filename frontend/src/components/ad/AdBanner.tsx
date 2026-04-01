/**
 * @file Google AdSense 반응형 배너 컴포넌트
 * @domain common
 * @layer component
 * @related layout.tsx (AdSense 스크립트 로드)
 */

'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface AdBannerProps {
  /** AdSense 광고 슬롯 ID */
  readonly slot: string;
  /** 광고 포맷 (기본: auto) */
  readonly format?: 'auto' | 'fluid' | 'horizontal';
  /** 추가 CSS 클래스 */
  readonly className?: string;
}

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
  }
}

/**
 * Google AdSense 배너. 광고 로드 실패 시 영역을 완전히 숨긴다.
 * NEXT_PUBLIC_ADSENSE_ENABLED !== 'true'이면 null 반환.
 */
export function AdBanner({
  slot,
  format = 'auto',
  className,
}: AdBannerProps): ReactNode {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInitialized = useRef(false);
  const [isHidden, setIsHidden] = useState(false);

  const isEnabled = process.env.NEXT_PUBLIC_ADSENSE_ENABLED === 'true';
  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID ?? '';

  useEffect(() => {
    if (!isEnabled || !clientId || isInitialized.current) return;
    if (!containerRef.current) return;

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      isInitialized.current = true;
    } catch {
      setIsHidden(true);
      return;
    }

    // 광고 로�� 실패 감지: 2초 후 ins 내부가 비어있으면 숨김
    const timer = setTimeout(() => {
      const ins = containerRef.current?.querySelector('ins.adsbygoogle');
      if (!ins || ins.childElementCount === 0) {
        setIsHidden(true);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [isEnabled, clientId]);

  // 비활성 또는 개발 모드: 개발에서만 플레이스홀더, 프로덕션에서는 null
  if (!isEnabled || !clientId) {
    if (process.env.NODE_ENV !== 'production') {
      return (
        <div
          className={cn(
            'flex items-center justify-center rounded-card border border-dashed border-border bg-bg-alt py-4 text-xs text-text-3',
            className,
          )}
        >
          광고 영역 (개발 모드)
        </div>
      );
    }
    return null;
  }

  if (isHidden) return null;

  return (
    <div ref={containerRef} className={cn('ad-container', className)}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={clientId}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
