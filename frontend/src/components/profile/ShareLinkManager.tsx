/**
 * @file Share link management component — create/copy/deactivate
 * @domain share
 * @layer component
 * @related shareLinkApi, profile/page.tsx
 */
'use client';

import {
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link2, Copy, Trash2, Plus, Check } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { useStudy } from '@/contexts/StudyContext';
import { shareLinkApi, ApiError, type ShareLinkData } from '@/lib/api';

/** Map error to translation key */
function getErrorKey(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401 || err.status === 403) return 'shareLink.errors.noPermission';
    return 'shareLink.errors.generic';
  }
  if (err instanceof TypeError) return 'shareLink.errors.network';
  return 'shareLink.errors.generic';
}

export function ShareLinkManager(): ReactNode {
  const t = useTranslations('account');
  const locale = useLocale();
  const { currentStudyId, studies } = useStudy();
  const [links, setLinks] = useState<ShareLinkData[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedStudyId, setSelectedStudyId] = useState(currentStudyId ?? '');
  const [expiresOption, setExpiresOption] = useState<string>('never');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* Load link list */
  const loadLinks = useCallback(async () => {
    if (!selectedStudyId) { setLinks([]); setLoading(false); setError(null); return; }
    try {
      setError(null);
      const data = await shareLinkApi.list(selectedStudyId);
      setLinks(data);
    } catch (err) {
      setLinks([]);
      setError(t(getErrorKey(err)));
    } finally {
      setLoading(false);
    }
  }, [selectedStudyId, t]);

  useEffect(() => {
    setLoading(true);
    void loadLinks();
  }, [loadLinks]);

  /* Create link */
  const handleCreate = useCallback(async () => {
    if (!selectedStudyId) return;
    setCreating(true);
    setMessage(null);
    setError(null);

    let expiresAt: string | undefined;
    if (expiresOption !== 'never') {
      const days = parseInt(expiresOption, 10);
      const date = new Date();
      date.setDate(date.getDate() + days);
      expiresAt = date.toISOString();
    }

    try {
      const link = await shareLinkApi.create(selectedStudyId, { expiresAt });
      setLinks((prev) => [link, ...prev]);
      const url = `${window.location.origin}/shared/${link.token}`;
      await navigator.clipboard.writeText(url);
      setMessage(t('shareLink.createdCopied'));
    } catch (err) {
      setMessage(null);
      setError(t(getErrorKey(err)));
    } finally {
      setCreating(false);
    }
  }, [selectedStudyId, expiresOption, t]);

  /* Copy link */
  const handleCopy = useCallback(async (token: string, linkId: string) => {
    const url = `${window.location.origin}/shared/${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(linkId);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  /* Deactivate link */
  const handleDeactivate = useCallback(async (linkId: string) => {
    if (!selectedStudyId) return;
    if (!window.confirm(t('shareLink.confirmDeactivate'))) return;
    setError(null);
    try {
      await shareLinkApi.deactivate(selectedStudyId, linkId);
      setLinks((prev) => prev.filter((l) => l.id !== linkId));
      setMessage(t('shareLink.deactivated'));
    } catch (err) {
      setMessage(null);
      setError(t(getErrorKey(err)));
    }
  }, [selectedStudyId, t]);

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center gap-2">
        <Link2 size={16} style={{ color: 'var(--primary)' }} />
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{t('shareLink.title')}</h3>
      </div>

      {/* Study select + expiry + create */}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="share-study" className="mb-1 block text-xs" style={{ color: 'var(--text-3)' }}>{t('shareLink.studyLabel')}</label>
          <select
            id="share-study"
            value={selectedStudyId}
            onChange={(e) => setSelectedStudyId(e.target.value)}
            className="rounded-btn border px-2 py-1.5 text-xs"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--text)' }}
          >
            <option value="">{t('shareLink.studyPlaceholder')}</option>
            {studies.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="share-expires" className="mb-1 block text-xs" style={{ color: 'var(--text-3)' }}>{t('shareLink.expiresLabel')}</label>
          <select
            id="share-expires"
            value={expiresOption}
            onChange={(e) => setExpiresOption(e.target.value)}
            className="rounded-btn border px-2 py-1.5 text-xs"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--text)' }}
          >
            <option value="never">{t('shareLink.expiresNever')}</option>
            <option value="7">{t('shareLink.expires7d')}</option>
            <option value="30">{t('shareLink.expires30d')}</option>
            <option value="90">{t('shareLink.expires90d')}</option>
          </select>
        </div>
        <button
          type="button"
          onClick={() => void handleCreate()}
          disabled={creating || !selectedStudyId}
          className="flex items-center gap-1 rounded-btn px-3 py-1.5 text-xs font-medium text-white transition-opacity disabled:opacity-50"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          <Plus size={14} />{creating ? t('shareLink.creating') : t('shareLink.create')}
        </button>
      </div>

      {message && (
        <p className="text-xs" style={{ color: 'var(--success)' }}>
          {message}
        </p>
      )}

      {error && (
        <p className="text-xs" role="alert" style={{ color: 'var(--error)' }}>
          {error}
        </p>
      )}

      {/* Link list */}
      {loading ? (
        <div className="py-4 text-center text-xs" style={{ color: 'var(--text-3)' }}>{t('shareLink.loading')}</div>
      ) : links.length === 0 ? (
        <div className="py-4 text-center text-xs" style={{ color: 'var(--text-3)' }}>
          {selectedStudyId ? t('shareLink.empty') : t('shareLink.selectStudy')}
        </div>
      ) : (
        <div className="space-y-2">
          {links.map((link) => {
            const expired = link.expires_at && new Date(link.expires_at) < new Date();
            return (
              <div
                key={link.id}
                className="flex items-center justify-between rounded-card border px-3 py-2"
                style={{ borderColor: 'var(--border)', opacity: expired ? 0.5 : 1 }}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-mono" style={{ color: 'var(--text)' }}>
                    /shared/{link.token.slice(0, 12)}...
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>
                    {expired
                      ? t('shareLink.expired')
                      : link.expires_at
                        ? t('shareLink.expiresAt', { date: new Date(link.expires_at).toLocaleDateString(locale) })
                        : t('shareLink.expiresNever')}
                    {' · '}{new Date(link.created_at).toLocaleDateString(locale)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void handleCopy(link.token, link.id)}
                    className="rounded-btn p-1.5 transition-colors"
                    style={{ color: copiedId === link.id ? 'var(--success)' : 'var(--text-3)' }}
                    aria-label={t('shareLink.copyAria')}
                  >
                    {copiedId === link.id ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                  {!expired && (
                    <button
                      type="button"
                      onClick={() => void handleDeactivate(link.id)}
                      className="rounded-btn p-1.5 transition-colors"
                      style={{ color: 'var(--error)' }}
                      aria-label={t('shareLink.deactivateAria')}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
