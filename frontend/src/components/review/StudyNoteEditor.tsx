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
  const [note, setNote] = useState<StudyNote | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

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
    try {
      const saved = await studyNoteApi.upsert({
        problemId,
        content: content.trim(),
      });
      setNote(saved);
      setEditing(false);
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
          <span className="text-sm font-semibold text-text">스터디 노트</span>
        </div>
        <span className="rounded-badge bg-muted-soft px-2 py-0.5 text-[10px] font-medium text-muted">
          전체 공개
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
              placeholder="스터디 노트를 작성해주세요..."
              aria-label="스터디 노트 편집"
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(false);
                  setContent(note?.content ?? '');
                }}
              >
                취소
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSave}
                disabled={saving || !content.trim()}
              >
                <Save className="h-3 w-3" />
                {saving ? '저장 중...' : '저장'}
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
                아직 작성된 노트가 없습니다.
              </p>
            )}
            <div className="mt-3 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditing(true)}
              >
                <FileText className="h-3 w-3" />
                {note?.content ? '수정' : '작성'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
