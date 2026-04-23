'use client';

import type { ReactNode } from 'react';
import { LocalizedErrorPage } from '@/components/error/LocalizedErrorPage';

interface ErrorPageProps {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

export default function StudyRoomErrorPage({ reset }: ErrorPageProps): ReactNode {
  return <LocalizedErrorPage titleKey="studyRoom" reset={reset} includeHomeLink />;
}
