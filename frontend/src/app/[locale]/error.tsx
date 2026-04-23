'use client';

import type { ReactNode } from 'react';
import { LocalizedErrorPage } from '@/components/error/LocalizedErrorPage';

interface ErrorPageProps {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

export default function ErrorPage({ reset }: ErrorPageProps): ReactNode {
  return <LocalizedErrorPage titleKey="generic" reset={reset} />;
}
