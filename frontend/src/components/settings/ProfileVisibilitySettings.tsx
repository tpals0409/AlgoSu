/**
 * @file ProfileVisibilitySettings — 퍼블릭 프로필 공개/slug 설정 카드
 * @domain share
 * @layer component
 * @related settingsApi, SettingsPage
 */
'use client';

import { useState, useCallback, type ReactNode } from 'react';
import { Globe, Link as LinkIcon, Check, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { settingsApi, type ProfileSettings } from '@/lib/api';

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,18}[a-z0-9]$/;
const RESERVED_SLUGS = [
  'admin', 'api', 'public', 'shared', 'login', 'logout',
  'settings', 'profile', 'studies', 'submissions', 'analysis',
  'auth', 'oauth', 'callback', 'refresh', 'join', 'invite',
  'health', 'metrics', 'sse', 'internal', 'dashboard',
];

export interface ProfileVisibilitySettingsProps {
  readonly initialSettings: ProfileSettings;
}

export function ProfileVisibilitySettings({ initialSettings }: ProfileVisibilitySettingsProps): ReactNode {
  const [settings, setSettings] = useState<ProfileSettings>(initialSettings);
  const [slug, setSlug] = useState(initialSettings.profileSlug ?? '');
  const [isPublic, setIsPublic] = useState(initialSettings.isProfilePublic);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  /* slug 검증 */
  const validateSlug = useCallback((value: string): string | null => {
    if (!value) return null;
    if (!SLUG_REGEX.test(value)) {
      return '영문소문자, 숫자, 하이픈만 (3~20자, 시작/끝 하이픈 불가)';
    }
    if (RESERVED_SLUGS.includes(value.toLowerCase())) {
      return '사용할 수 없는 예약어입니다.';
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
      setSlugError('프로필 공개를 위해 slug를 먼저 설정해주세요.');
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
      setSettings(updated);
      setSaveMessage('설정이 저장되었습니다.');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '저장 실패';
      setSaveMessage(msg);
    } finally {
      setSaving(false);
    }
  }, [slug, isPublic, validateSlug]);

  return (
    <Card className="space-y-5 p-5">
      <div className="flex items-center gap-2">
        <Globe size={16} style={{ color: 'var(--primary)' }} />
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>퍼블릭 프로필</h2>
      </div>

      {/* 공개 토글 */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>프로필 공개</p>
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>
            활성화하면 누구나 프로필을 볼 수 있습니다
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isPublic}
          className="relative h-6 w-11 rounded-full transition-colors"
          style={{ backgroundColor: isPublic ? 'var(--primary)' : 'var(--bg-alt)' }}
          onClick={() => { setIsPublic(!isPublic); setSaveMessage(null); }}
        >
          <span
            className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
            style={{ transform: isPublic ? 'translateX(20px)' : 'translateX(0)' }}
          />
        </button>
      </div>

      {/* slug 입력 */}
      <div>
        <label htmlFor="profile-slug" className="mb-1 block text-sm font-medium" style={{ color: 'var(--text)' }}>
          <LinkIcon size={14} className="mr-1 inline" />
          프로필 URL
        </label>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--text-3)' }}>algosu.com/profile/</span>
          <input
            id="profile-slug"
            type="text"
            value={slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            placeholder="my-profile"
            maxLength={20}
            className="flex-1 rounded-btn border px-3 py-1.5 text-sm outline-none transition-colors"
            style={{
              borderColor: slugError ? 'var(--danger)' : 'var(--border)',
              backgroundColor: 'var(--bg)',
              color: 'var(--text)',
            }}
          />
        </div>
        {slugError && (
          <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>
            <AlertCircle size={12} className="mr-0.5 inline" />{slugError}
          </p>
        )}
        {slug && !slugError && (
          <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
            미리보기: algosu.com/profile/{slug}
          </p>
        )}
      </div>

      {/* 저장 버튼 */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || !!slugError}
          className="rounded-btn px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          {saving ? '저장 중...' : '저장'}
        </button>
        {saveMessage && (
          <span className="flex items-center gap-1 text-xs" style={{ color: saveMessage.includes('저장') ? 'var(--success)' : 'var(--danger)' }}>
            {saveMessage.includes('저장') && <Check size={14} />}
            {saveMessage}
          </span>
        )}
      </div>

      {/* 프로필 링크 */}
      {settings.profileSlug && settings.isProfilePublic && (
        <div className="rounded-card border p-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-alt)' }}>
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>내 프로필 링크:</p>
          <a
            href={`/profile/${settings.profileSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium underline"
            style={{ color: 'var(--primary)' }}
          >
            algosu.com/profile/{settings.profileSlug}
          </a>
        </div>
      )}
    </Card>
  );
}
