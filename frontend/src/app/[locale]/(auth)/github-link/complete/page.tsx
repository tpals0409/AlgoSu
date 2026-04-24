'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function GitHubLinkCompletePage(): ReactNode {
  const router = useRouter();
  const { updateGitHubStatus } = useAuth();

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);

    const githubConnected = params.get('github_connected');
    const githubUsername = params.get('github_username');

    if (githubConnected === 'true') {
      updateGitHubStatus(true, githubUsername);
      router.replace('/studies');
    } else {
      router.replace('/github-link');
    }
  }, [router, updateGitHubStatus]);

  return (
    <div className="flex items-center justify-center p-8">
      <p className="text-text-2">GitHub 연동 처리 중...</p>
    </div>
  );
}
