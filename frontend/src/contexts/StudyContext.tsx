/**
 * @file 스터디 컨텍스트 (현재 스터디 선택/전환 관리)
 * @domain study
 * @layer context
 * @related AuthContext, api.ts, StudySidebar
 */
'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { setCurrentStudyIdForApi, studyApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

// ── 타입 ──

export interface Study {
  id: string;
  name: string;
  description?: string;
  githubRepo?: string;
  role: 'ADMIN' | 'MEMBER';
  memberCount?: number;
}

interface StudyContextValue {
  currentStudyId: string | null;
  currentStudyName: string | null;
  currentStudyRole: 'ADMIN' | 'MEMBER' | null;
  studies: Study[];
  studiesLoaded: boolean;
  setCurrentStudy: (studyId: string) => void;
  setStudies: (studies: Study[]) => void;
  removeStudy: (studyId: string) => void;
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
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [studies, setStudiesState] = useState<Study[]>([]);
  const [studiesLoaded, setStudiesLoaded] = useState(false);
  const [currentStudyId, setCurrentStudyId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(STUDY_STORAGE_KEY);
    // 자식 useEffect보다 먼저 API 모듈에 studyId를 동기 설정
    setCurrentStudyIdForApi(stored);
    return stored;
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

  // 인증 완료 시 스터디 목록 자동 로드
  useEffect(() => {
    if (authLoading || !isAuthenticated) {
      setStudiesLoaded(false);
      return;
    }

    // ── DEV MOCK ──────────────────────────────────────────────
    if (process.env.NEXT_PUBLIC_DEV_MOCK === 'true') {
      const mockStudy: Study = {
        id: 'dev-study-001',
        name: '알고리즘 마스터즈',
        description: '개발용 테스트 스터디',
        role: 'ADMIN',
        memberCount: 5,
      };
      setStudiesState([mockStudy]);
      setCurrentStudyId('dev-study-001');
      setCurrentStudyIdForApi('dev-study-001');
      setStudiesLoaded(true);
      return;
    }
    // ──────────────────────────────────────────────────────────

    let cancelled = false;
    const load = async () => {
      try {
        const data = await studyApi.list();
        if (!cancelled) {
          setStudiesState(data);
          setCurrentStudyId((prev) => {
            // 선택된 스터디가 없으면 첫 번째 자동 선택
            if (!prev && data.length > 0) {
              const autoId = data[0].id;
              setCurrentStudyIdForApi(autoId);
              return autoId;
            }
            // 선택된 스터디가 목록에 없으면 첫 번째로 폴백
            if (prev && !data.find((s) => s.id === prev)) {
              if (data.length > 0) {
                const fallbackId = data[0].id;
                setCurrentStudyIdForApi(fallbackId);
                return fallbackId;
              }
              setCurrentStudyIdForApi(null);
              return null;
            }
            return prev;
          });
        }
      } catch {
        // 실패 시 무시 — 개별 페이지에서 재시도
      } finally {
        if (!cancelled) setStudiesLoaded(true);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [authLoading, isAuthenticated]);


  const currentStudy = currentStudyId
    ? studies.find((s) => s.id === currentStudyId)
    : null;
  const currentStudyRole: 'ADMIN' | 'MEMBER' | null = currentStudy?.role ?? null;
  const currentStudyName: string | null = currentStudy?.name ?? null;

  const setCurrentStudy = useCallback((studyId: string) => {
    setCurrentStudyId(studyId);
    setCurrentStudyIdForApi(studyId);
  }, []);

  const setStudies = useCallback((newStudies: Study[]) => {
    setStudiesState(newStudies);
    // 현재 선택된 스터디가 목록에 없으면 초기화
    setCurrentStudyId((prev) => {
      if (prev && !newStudies.find((s) => s.id === prev)) {
        setCurrentStudyIdForApi(null);
        return null;
      }
      return prev;
    });
  }, []);

  const removeStudy = useCallback((studyId: string) => {
    setStudiesState((prev) => prev.filter((s) => s.id !== studyId));
    setCurrentStudyId((prev) => {
      if (prev === studyId) {
        setCurrentStudyIdForApi(null);
        return null;
      }
      return prev;
    });
  }, []);

  const clearCurrentStudy = useCallback(() => {
    setCurrentStudyId(null);
    setCurrentStudyIdForApi(null);
  }, []);

  const value: StudyContextValue = {
    currentStudyId,
    currentStudyName,
    currentStudyRole,
    studies,
    studiesLoaded,
    setCurrentStudy,
    setStudies,
    removeStudy,
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
