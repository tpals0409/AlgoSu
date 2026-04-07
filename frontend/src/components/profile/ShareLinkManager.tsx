/**
 * @file 공유 링크 관리 컴포넌트 — 생성/복사/비활성화
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
import { Link2, Copy, Trash2, Plus, Check } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { useStudy } from '@/contexts/StudyContext';
import { shareLinkApi, ApiError, type ShareLinkData } from '@/lib/api';

/** 에러 타입별 사용자 메시지 분류 */
function getErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401 || err.status === 403) return '권한이 없습니다.';
    return '오류가 발생했습니다. 다시 시도해주세요.';
  }
  if (err instanceof TypeError) return '네트워크 연결을 확인해주세요.';
  return '오류가 발생했습니다. 다시 시도해주세요.';
}

export function ShareLinkManager(): ReactNode {
  const { currentStudyId, studies } = useStudy();
  const [links, setLinks] = useState<ShareLinkData[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedStudyId, setSelectedStudyId] = useState(currentStudyId ?? '');
  const [expiresOption, setExpiresOption] = useState<string>('never');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* 링크 목록 로드 */
  const loadLinks = useCallback(async () => {
    if (!selectedStudyId) { setLinks([]); setLoading(false); setError(null); return; }
    try {
      setError(null);
      const data = await shareLinkApi.list(selectedStudyId);
      setLinks(data);
    } catch (err) {
      setLinks([]);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [selectedStudyId]);

  useEffect(() => {
    setLoading(true);
    void loadLinks();
  }, [loadLinks]);

  /* 링크 생성 */
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
      setMessage('링크가 생성되어 클립보드에 복사되었습니다.');
    } catch (err) {
      setMessage(null);
      setError(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  }, [selectedStudyId, expiresOption]);

  /* 링크 복사 */
  const handleCopy = useCallback(async (token: string, linkId: string) => {
    const url = `${window.location.origin}/shared/${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(linkId);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  /* 링크 비활성화 */
  const handleDeactivate = useCallback(async (linkId: string) => {
    if (!selectedStudyId) return;
    if (!window.confirm('이 공유 링크를 비활성화하시겠습니까?')) return;
    setError(null);
    try {
      await shareLinkApi.deactivate(selectedStudyId, linkId);
      setLinks((prev) => prev.filter((l) => l.id !== linkId));
      setMessage('링크가 비활성화되었습니다.');
    } catch (err) {
      setMessage(null);
      setError(getErrorMessage(err));
    }
  }, [selectedStudyId]);

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center gap-2">
        <Link2 size={16} style={{ color: 'var(--primary)' }} />
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>내 공유 링크</h3>
      </div>

      {/* 스터디 선택 + 만료 기간 + 생성 */}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="share-study" className="mb-1 block text-xs" style={{ color: 'var(--text-3)' }}>스터디</label>
          <select
            id="share-study"
            value={selectedStudyId}
            onChange={(e) => setSelectedStudyId(e.target.value)}
            className="rounded-btn border px-2 py-1.5 text-xs"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--text)' }}
          >
            <option value="">선택</option>
            {studies.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="share-expires" className="mb-1 block text-xs" style={{ color: 'var(--text-3)' }}>만료</label>
          <select
            id="share-expires"
            value={expiresOption}
            onChange={(e) => setExpiresOption(e.target.value)}
            className="rounded-btn border px-2 py-1.5 text-xs"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--text)' }}
          >
            <option value="never">무기한</option>
            <option value="7">7일</option>
            <option value="30">30일</option>
            <option value="90">90일</option>
          </select>
        </div>
        <button
          type="button"
          onClick={() => void handleCreate()}
          disabled={creating || !selectedStudyId}
          className="flex items-center gap-1 rounded-btn px-3 py-1.5 text-xs font-medium text-white transition-opacity disabled:opacity-50"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          <Plus size={14} />{creating ? '생성 중...' : '링크 생성'}
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

      {/* 링크 목록 */}
      {loading ? (
        <div className="py-4 text-center text-xs" style={{ color: 'var(--text-3)' }}>로딩 중...</div>
      ) : links.length === 0 ? (
        <div className="py-4 text-center text-xs" style={{ color: 'var(--text-3)' }}>
          {selectedStudyId ? '공유 링크가 없습니다.' : '스터디를 선택해주세요.'}
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
                    {expired ? '만료됨' : link.expires_at ? `만료: ${new Date(link.expires_at).toLocaleDateString('ko-KR')}` : '무기한'}
                    {' · '}{new Date(link.created_at).toLocaleDateString('ko-KR')}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void handleCopy(link.token, link.id)}
                    className="rounded-btn p-1.5 transition-colors"
                    style={{ color: copiedId === link.id ? 'var(--success)' : 'var(--text-3)' }}
                    aria-label="링크 복사"
                  >
                    {copiedId === link.id ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                  {!expired && (
                    <button
                      type="button"
                      onClick={() => void handleDeactivate(link.id)}
                      className="rounded-btn p-1.5 transition-colors"
                      style={{ color: 'var(--error)' }}
                      aria-label="링크 비활성화"
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
