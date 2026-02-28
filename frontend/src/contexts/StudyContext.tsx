'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { setCurrentStudyIdForApi } from '@/lib/api';

// ── 타입 ──

export interface Study {
  id: string;
  name: string;
  description?: string;
  githubRepo?: string;
  role: 'OWNER' | 'MEMBER';
  memberCount?: number;
}

interface StudyContextValue {
  currentStudyId: string | null;
  currentStudyRole: 'OWNER' | 'MEMBER' | null;
  studies: Study[];
  setCurrentStudy: (studyId: string) => void;
  setStudies: (studies: Study[]) => void;
  clearCurrentStudy: () => void;
}

// ── 스토리지 키 ──

const STUDY_STORAGE_KEY = 'algosu:current-study-id';

// ── 컨텍스트 ──

const StudyContext = createContext<StudyContextValue | null>(null);

// ── Provider ──

interface StudyProviderProps {
  readonly children: ReactNode;
}

export function StudyProvider({ children }: StudyProviderProps): ReactNode {
  const [studies, setStudiesState] = useState<Study[]>([]);
  const [currentStudyId, setCurrentStudyId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STUDY_STORAGE_KEY);
  });

  // currentStudyId가 변경될 때 localStorage + api 모듈 동기화
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (currentStudyId) {
      localStorage.setItem(STUDY_STORAGE_KEY, currentStudyId);
    } else {
      localStorage.removeItem(STUDY_STORAGE_KEY);
    }
    setCurrentStudyIdForApi(currentStudyId);
  }, [currentStudyId]);

  const currentStudyRole: 'OWNER' | 'MEMBER' | null = currentStudyId
    ? (studies.find((s) => s.id === currentStudyId)?.role ?? null)
    : null;

  const setCurrentStudy = useCallback((studyId: string) => {
    setCurrentStudyId(studyId);
  }, []);

  const setStudies = useCallback((newStudies: Study[]) => {
    setStudiesState(newStudies);
    // 현재 선택된 스터디가 목록에 없으면 초기화
    setCurrentStudyId((prev) => {
      if (prev && !newStudies.find((s) => s.id === prev)) return null;
      return prev;
    });
  }, []);

  const clearCurrentStudy = useCallback(() => {
    setCurrentStudyId(null);
  }, []);

  const value: StudyContextValue = {
    currentStudyId,
    currentStudyRole,
    studies,
    setCurrentStudy,
    setStudies,
    clearCurrentStudy,
  };

  return <StudyContext.Provider value={value}>{children}</StudyContext.Provider>;
}

// ── Hook ──

export function useStudy(): StudyContextValue {
  const ctx = useContext(StudyContext);
  if (!ctx) {
    throw new Error('useStudy는 StudyProvider 내부에서만 사용할 수 있습니다.');
  }
  return ctx;
}
