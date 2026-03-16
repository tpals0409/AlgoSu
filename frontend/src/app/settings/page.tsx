/**
 * @file Settings 페이지 — 프로필 공개 + slug 설정
 * @domain share
 * @layer page
 * @related settingsApi, ProfileVisibilitySettings
 */
'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { Settings } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProfileVisibilitySettings } from '@/components/settings/ProfileVisibilitySettings';
import { useAuth } from '@/contexts/AuthContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { settingsApi, type ProfileSettings } from '@/lib/api';

export default function SettingsPage(): ReactNode {
  useRequireAuth();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [settings, setSettings] = useState<ProfileSettings | null>(null);
  const [loading, setLoading] = useState(true);

  /* 설정 로드 */
  useEffect(() => {
    if (!isAuthenticated || authLoading) return;
    settingsApi.getProfile()
      .then((data) => { setSettings(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAuthenticated, authLoading]);

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" style={{ color: 'var(--primary)' }} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-xl space-y-6">
        <div className="flex items-center gap-2">
          <Settings size={20} style={{ color: 'var(--text)' }} />
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>설정</h1>
        </div>

        {settings && (
          <ProfileVisibilitySettings initialSettings={settings} />
        )}
      </div>
    </AppLayout>
  );
}
