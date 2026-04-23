/**
 * @file 스터디 노트 에디터 (조회 + 수정)
 * @domain study
 * @layer component
 * @related studyNoteApi
 *
 * 선택된 문제의 공유 노트를 표시하고 수정할 수 있는 에디터.
 */

'use client';

import { useState, useEffect, type ReactElement } from 'react';
import { FileText, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { studyNoteApi, type StudyNote } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';

// ─── TYPES ────────────────────────────────

interface StudyNoteEditorProps {
  readonly problemId: string;
}

// ─── RENDER ───────────────────────────────

/**
 * 스터디 노트 에디터 -- 조회 + 인라인 수정 + 저장
 * @domain study
 */
export function StudyNoteEditor({ problemId }: StudyNoteEditorProps): ReactElement {
  const t = useTranslations('reviews');
  const [note, setNote] = useState<StudyNote | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // 노트 로드
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    studyNoteApi.get(problemId).then((data) => {
      if (cancelled) return;
      setNote(data);
      setContent(data?.content ?? '');
    }).catch(() => {
      if (!cancelled) setContent('');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [problemId]);

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await studyNoteApi.upsert({
        problemId,
        content: content.trim(),
      });
      setNote(saved);
      setEditing(false);
    } catch {
      setSaveError(t('studyNote.saveError'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-card border border-border bg-bg-card p-5 shadow-card">
        <Skeleton variant="text" lines={3} />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-card border border-border bg-bg-card shadow-card">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-text">{t('studyNote.title')}</span>
        </div>
        <span className="rounded-badge bg-muted-soft px-2 py-0.5 text-[10px] font-medium text-muted">
          {t('studyNote.public')}
        </span>
      </div>

      {/* 내용 */}
      <div className="p-5">
        {editing ? (
          <div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full resize-y rounded-badge border border-border bg-input-bg px-3 py-2 text-xs leading-relaxed text-text outline-none transition-colors placeholder:text-text-3 focus:border-primary"
              rows={6}
              placeholder={t('studyNote.editPlaceholder')}
              aria-label={t('studyNote.editAriaLabel')}
            />
            {saveError && (
              <p className="mt-2 text-xs text-error">{saveError}</p>
            )}
            <div className="mt-3 flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(false);
                  setSaveError(null);
                  setContent(note?.content ?? '');
                }}
              >
                {t('studyNote.cancel')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSave}
                disabled={saving || !content.trim()}
              >
                <Save className="h-3 w-3" />
                {saving ? t('studyNote.saving') : t('studyNote.save')}
              </Button>
            </div>
          </div>
        ) : (
          <div>
            {note?.content ? (
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-text-2">
                {note.content}
              </p>
            ) : (
              <p className="text-xs text-text-3">
                {t('studyNote.empty')}
              </p>
            )}
            <div className="mt-3 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditing(true)}
              >
                <FileText className="h-3 w-3" />
                {note?.content ? t('studyNote.editButton') : t('studyNote.createButton')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
