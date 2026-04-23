'use client';

import type { ReactNode } from 'react';
import { LocalizedErrorPage } from '@/components/error/LocalizedErrorPage';

interface ErrorPageProps {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

export default function ReviewsErrorPage({ reset }: ErrorPageProps): ReactNode {
  return <LocalizedErrorPage titleKey="reviews" reset={reset} includeHomeLink />;
}
