/**
 * @file Settings 페이지 — 프로필 공개 + slug 설정
 * @domain share
 * @layer page
 * @related useProfileSettings, settingsApi, ProfileVisibilitySettings
 */
'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { Settings, Globe, Link as LinkIcon, Check, AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { settingsApi } from '@/lib/api';
import { useProfileSettings } from '@/hooks/use-profile-settings';

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,18}[a-z0-9]$/;
const RESERVED_SLUGS = [
  'admin', 'api', 'public', 'shared', 'login', 'logout',
  'settings', 'profile', 'studies', 'submissions', 'analysis',
  'auth', 'oauth', 'callback', 'refresh', 'join', 'invite',
  'health', 'metrics', 'sse', 'internal', 'dashboard',
];

export default function SettingsPage(): ReactNode {
  useRequireAuth();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const t = useTranslations('account');

  // ─── SWR DATA ───────────────────────────

  const { settings, isLoading: settingsLoading, mutate } = useProfileSettings(
    isAuthenticated && !authLoading,
  );

  const loading = settingsLoading;

  // ─── LOCAL STATE (form) ─────────────────

  const [slug, setSlug] = useState(() => settings?.profileSlug ?? '');
  const [isPublic, setIsPublic] = useState(() => settings?.isProfilePublic ?? false);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  /* settings SWR 데이터 수신 시 폼 초기화 (최초 1회) */
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (settings && !initialized) {
      setSlug(settings.profileSlug ?? '');
      setIsPublic(settings.isProfilePublic);
      setInitialized(true);
    }
  }, [settings, initialized]);

  /* slug 검증 */
  const validateSlug = useCallback((value: string): string | null => {
    if (!value) return null;
    if (!SLUG_REGEX.test(value)) {
      return t('settings.validation.slug.pattern');
    }
    if (RESERVED_SLUGS.includes(value.toLowerCase())) {
      return t('settings.validation.slug.reserved');
    }
    return null;
  }, []);

  const handleSlugChange = useCallback((value: string) => {
    const lower = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSlug(lower);
    setSlugError(validateSlug(lower));
    setSaveMessage(null);
  }, [validateSlug]);

  /* 저장 */
  const handleSave = useCallback(async () => {
    if (isPublic && !slug) {
      setSlugError(t('settings.validation.slug.requiredForPublic'));
      return;
    }
    const err = validateSlug(slug);
    if (err) { setSlugError(err); return; }

    setSaving(true);
    setSaveMessage(null);
    try {
      const updated = await settingsApi.updateProfile({
        profileSlug: slug || undefined,
        isProfilePublic: isPublic,
      });
      await mutate(updated, { revalidate: false });
      setSaveMessage(t('settings.validation.save.success'));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('settings.validation.save.failed');
      setSaveMessage(msg);
    } finally {
      setSaving(false);
    }
  }, [slug, isPublic, validateSlug, mutate]);

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-xl space-y-6">
        <div className="flex items-center gap-2">
          <Settings size={20} className="text-text" />
          <h1 className="text-lg font-semibold text-text">{t('settings.heading')}</h1>
        </div>

        {/* 퍼블릭 프로필 설정 */}
        <Card className="space-y-5 p-5">
          <div className="flex items-center gap-2">
            <Globe size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-text">{t('settings.form.publicProfile.title')}</h2>
          </div>

          {/* 공개 토글 */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text">{t('settings.form.publicProfile.toggle')}</p>
              <p className="text-xs text-text-3">
                {t('settings.form.publicProfile.toggleDescription')}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isPublic}
              className={`relative h-6 w-11 rounded-full transition-colors ${isPublic ? 'bg-primary' : 'bg-bg-alt'}`}
              onClick={() => { setIsPublic(!isPublic); setSaveMessage(null); }}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${isPublic ? 'translate-x-5' : 'translate-x-0'}`}
              />
            </button>
          </div>

          {/* slug 입력 */}
          <div>
            <label htmlFor="profile-slug" className="mb-1 block text-sm font-medium text-text">
              <LinkIcon size={14} className="mr-1 inline" />
              {t('settings.form.slug.label')}
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-3">{t('settings.form.slug.prefix')}</span>
              <input
                id="profile-slug"
                type="text"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder={t('settings.form.slug.placeholder')}
                maxLength={20}
                className={`flex-1 rounded-btn border px-3 py-1.5 text-sm outline-none transition-colors bg-bg text-text ${slugError ? 'border-error' : 'border-border'}`}
              />
            </div>
            {slugError && (
              <p className="mt-1 text-xs text-error">
                <AlertCircle size={12} className="mr-0.5 inline" />{slugError}
              </p>
            )}
            {slug && !slugError && (
              <p className="mt-1 text-xs text-text-3">
                {t('settings.form.slug.preview', { slug })}
              </p>
            )}
          </div>

          {/* 저장 버튼 */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || !!slugError}
              className="rounded-btn px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50 bg-primary"
            >
              {saving ? t('settings.form.saving') : t('settings.form.save')}
            </button>
            {saveMessage && (
              <span className={`flex items-center gap-1 text-xs ${saveMessage === t('settings.validation.save.success') ? 'text-success' : 'text-error'}`}>
                {saveMessage === t('settings.validation.save.success') && <Check size={14} />}
                {saveMessage}
              </span>
            )}
          </div>

          {/* 프로필 링크 */}
          {settings?.profileSlug && settings.isProfilePublic && (
            <div className="rounded-card border border-border bg-bg-alt p-3">
              <p className="text-xs text-text-3">{t('settings.form.profileLink')}</p>
              <a
                href={`/profile/${settings.profileSlug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium underline text-primary"
              >
                algosu.com/profile/{settings.profileSlug}
              </a>
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
