'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * Auto-save Hook — localStorage(1초 debounce) + 서버 Draft API(30초)
 *
 * 저장 전략:
 * 1. debounce 1초 → localStorage 즉시 저장
 * 2. 마지막 서버 저장으로부터 30초 경과 → Draft API 호출
 *
 * 복원 우선순위: saved_at이 더 최근인 것 우선
 *
 * localStorage 키: algosu:draft:{studyId}:{problemId}
 */
interface AutoSaveData {
  code: string;
  language: string;
  savedAt: string; // ISO 8601
}

interface UseAutoSaveOptions {
  problemId: string;
  studyId: string | null;
  code: string;
  language: string;
  onServerSave?: (data: AutoSaveData) => Promise<void>;
  enabled?: boolean;
}

const LOCAL_KEY_PREFIX = 'algosu:draft:';
const SERVER_SAVE_INTERVAL = 30_000; // 30초
const LOCAL_DEBOUNCE = 1_000; // 1초

function buildLocalKey(studyId: string | null, problemId: string): string {
  if (studyId) {
    return `${LOCAL_KEY_PREFIX}${studyId}:${problemId}`;
  }
  return `${LOCAL_KEY_PREFIX}${problemId}`;
}

export function useAutoSave({
  problemId,
  studyId,
  code,
  language,
  onServerSave,
  enabled = true,
}: UseAutoSaveOptions) {
  const localDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastServerSaveRef = useRef<number>(0);
  const serverIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestDataRef = useRef({ code, language });

  // 최신 값 추적
  useEffect(() => {
    latestDataRef.current = { code, language };
  }, [code, language]);

  // localStorage 저장
  const saveToLocal = useCallback(
    (data: { code: string; language: string }) => {
      const saveData: AutoSaveData = {
        code: data.code,
        language: data.language,
        savedAt: new Date().toISOString(),
      };
      try {
        localStorage.setItem(
          buildLocalKey(studyId, problemId),
          JSON.stringify(saveData),
        );
      } catch {
        // localStorage 용량 초과 등 — 무시
      }
    },
    [problemId, studyId],
  );

  // localStorage에서 복원
  const loadFromLocal = useCallback((): AutoSaveData | null => {
    try {
      const raw = localStorage.getItem(buildLocalKey(studyId, problemId));
      if (!raw) return null;
      return JSON.parse(raw) as AutoSaveData;
    } catch {
      return null;
    }
  }, [problemId, studyId]);

  // 제출 완료 시 localStorage 정리
  const clearLocal = useCallback(() => {
    try {
      localStorage.removeItem(buildLocalKey(studyId, problemId));
    } catch {
      // ignore
    }
  }, [problemId, studyId]);

  // 1초 debounce → localStorage 저장
  useEffect(() => {
    if (!enabled) return;

    if (localDebounceRef.current) {
      clearTimeout(localDebounceRef.current);
    }

    localDebounceRef.current = setTimeout(() => {
      saveToLocal({ code, language });
    }, LOCAL_DEBOUNCE);

    return () => {
      if (localDebounceRef.current) {
        clearTimeout(localDebounceRef.current);
      }
    };
  }, [code, language, enabled, saveToLocal]);

  // 30초 간격 → 서버 Draft API
  useEffect(() => {
    if (!enabled || !onServerSave) return;

    serverIntervalRef.current = setInterval(async () => {
      const now = Date.now();
      if (now - lastServerSaveRef.current < SERVER_SAVE_INTERVAL) return;

      const data = latestDataRef.current;
      if (!data.code) return;

      try {
        await onServerSave({
          code: data.code,
          language: data.language,
          savedAt: new Date().toISOString(),
        });
        lastServerSaveRef.current = now;
      } catch {
        // 서버 저장 실패 — localStorage에는 이미 있으므로 무시
      }
    }, SERVER_SAVE_INTERVAL);

    return () => {
      if (serverIntervalRef.current) {
        clearInterval(serverIntervalRef.current);
      }
    };
  }, [enabled, onServerSave]);

  return { loadFromLocal, clearLocal };
}
