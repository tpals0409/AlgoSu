'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { CodeEditor } from '@/components/submission/CodeEditor';
import { SubmissionStatus, StepStatus } from '@/components/submission/SubmissionStatus';
import { useAutoSave } from '@/hooks/useAutoSave';
import { submissionApi, draftApi } from '@/lib/api';
import { useStudy } from '@/contexts/StudyContext';
import { useAuth } from '@/contexts/AuthContext';

/**
 * 코드 제출 페이지 — /submit/[problemId]
 *
 * 기능:
 * 1. Auto-save: localStorage(1초) + 서버 Draft(30초)
 * 2. 복원: 서버 Draft vs localStorage 중 최신 것 우선
 * 3. 제출 후: SSE로 실시간 상태 추적
 * 4. 가드: 스터디 미선택 또는 github_connected=FALSE 시 리다이렉트
 */
export default function SubmitPage(): ReactNode {
  const params = useParams();
  const router = useRouter();
  const problemId = params?.problemId as string;

  const { currentStudyId } = useStudy();
  const { user } = useAuth();

  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('python');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [_submissionId, setSubmissionId] = useState<string | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saving' | 'saved' | 'idle'>('idle');

  // 가드: 스터디 미선택
  useEffect(() => {
    if (!currentStudyId) {
      router.replace('/studies');
    }
  }, [currentStudyId, router]);

  // 가드: github_connected 미연동 (AuthContext에 github_connected 추가되기 전까지 JWT payload 확인)
  useEffect(() => {
    if (user && 'github_connected' in user) {
      const connected = (user as { github_connected?: boolean }).github_connected;
      if (connected === false) {
        router.replace('/github-link');
      }
    }
  }, [user, router]);

  // SSE 상태 (Day 7 완성)
  const [steps, setSteps] = useState<Array<{ label: string; status: StepStatus; detail?: string }>>([
    { label: '제출 완료', status: 'pending' },
    { label: 'GitHub 동기화', status: 'pending' },
    { label: 'AI 분석', status: 'pending' },
  ]);

  // 서버 Draft 저장 콜백
  const handleServerSave = useCallback(
    async (data: { code: string; language: string }) => {
      if (!problemId) return;
      setAutoSaveStatus('saving');
      try {
        await draftApi.upsert(problemId, {
          code: data.code,
          language: data.language,
        });
        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus('idle'), 2000);
      } catch {
        setAutoSaveStatus('idle');
      }
    },
    [problemId],
  );

  const { loadFromLocal, clearLocal } = useAutoSave({
    problemId,
    studyId: currentStudyId,
    code,
    language,
    onServerSave: handleServerSave,
    enabled: !submitted,
  });

  // 초기 로딩: Draft 복원
  useEffect(() => {
    if (!problemId) return;

    const restore = async () => {
      const localData = loadFromLocal();
      let serverData: { code?: string; language?: string; savedAt?: string } | null = null;

      try {
        const draft = await draftApi.find(problemId);
        if (draft) {
          serverData = { code: draft.code, language: draft.language, savedAt: draft.savedAt };
        }
      } catch {
        // 서버 Draft 없음
      }

      // 복원 우선순위: saved_at이 더 최근인 것
      if (localData && serverData?.savedAt) {
        const localTime = new Date(localData.savedAt).getTime();
        const serverTime = new Date(serverData.savedAt).getTime();

        if (localTime > serverTime) {
          setCode(localData.code);
          setLanguage(localData.language);
        } else {
          setCode(serverData.code ?? '');
          setLanguage(serverData.language ?? 'python');
        }
      } else if (localData) {
        setCode(localData.code);
        setLanguage(localData.language);
      } else if (serverData) {
        setCode(serverData.code ?? '');
        setLanguage(serverData.language ?? 'python');
      }
    };

    void restore();
  }, [problemId, loadFromLocal]);

  // 제출 핸들러
  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const submission = await submissionApi.create({
        problemId,
        language,
        code,
      });

      setSubmissionId(submission.id);
      setSubmitted(true);
      clearLocal();

      // 제출 완료 상태 업데이트
      setSteps([
        { label: '제출 완료', status: 'done' },
        { label: 'GitHub 동기화', status: 'in_progress' },
        { label: 'AI 분석', status: 'pending' },
      ]);

      // TODO: SSE 연결 시작
    } catch (error: unknown) {
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  // 스터디 미선택 시 렌더 스킵
  if (!currentStudyId) return null;

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-6 text-2xl font-bold">코드 제출</h1>

      {!submitted ? (
        <CodeEditor
          code={code}
          language={language}
          onCodeChange={setCode}
          onLanguageChange={setLanguage}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          autoSaveStatus={autoSaveStatus}
        />
      ) : (
        <div className="space-y-4">
          <div className="rounded-card bg-success/10 p-4 text-success">
            코드가 성공적으로 제출되었습니다!
          </div>

          <SubmissionStatus steps={steps} />

          <div className="flex gap-4">
            <button
              onClick={() => {
                setSubmitted(false);
                setCode('');
                setSubmissionId(null);
              }}
              className="rounded-btn border border-border px-4 py-2 text-sm text-text2 hover:bg-bg2"
            >
              새 제출
            </button>
            <button
              onClick={() => router.push('/submissions')}
              className="rounded-btn bg-primary-500 px-4 py-2 text-sm text-white hover:bg-primary-400"
            >
              제출 목록
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
