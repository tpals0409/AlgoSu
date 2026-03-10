/**
 * @file GuestContext — 공유 링크 토큰 기반 게스트 데이터 관리
 * @domain share
 * @layer context
 * @related anonymize.ts, publicApi
 */
'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { publicApi, type SharedStudyData } from '@/lib/api';

interface GuestContextValue {
  /** 게스트 모드 여부 */
  isGuest: boolean;
  /** 공유 링크 토큰 */
  token: string;
  /** 스터디 메타 정보 */
  studyData: SharedStudyData | null;
  /** 공유 링크 생성자 ID */
  createdByUserId: string | null;
  /** 로딩 상태 */
  loading: boolean;
  /** 에러 메시지 */
  error: string | null;
}

const GuestContext = createContext<GuestContextValue>({
  isGuest: false,
  token: '',
  studyData: null,
  createdByUserId: null,
  loading: true,
  error: null,
});

export function useGuest(): GuestContextValue {
  return useContext(GuestContext);
}

interface GuestProviderProps {
  readonly token: string;
  readonly children: ReactNode;
}

export function GuestProvider({ token, children }: GuestProviderProps): ReactNode {
  const [studyData, setStudyData] = useState<SharedStudyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      try {
        const data = await publicApi.getSharedStudy(token);
        if (!cancelled) {
          setStudyData(data);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setError('공유 링크가 유효하지 않거나 만료되었습니다.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [token]);

  const value = useMemo<GuestContextValue>(
    () => ({
      isGuest: true,
      token,
      studyData,
      createdByUserId: studyData?.createdBy.id ?? null,
      loading,
      error,
    }),
    [token, studyData, loading, error],
  );

  return <GuestContext.Provider value={value}>{children}</GuestContext.Provider>;
}
