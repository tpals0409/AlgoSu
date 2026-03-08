/**
 * @file 스터디 설정 페이지 — 기본 정보 / 그라운드룰 / 멤버 / 초대코드 / 삭제
 * @domain study
 * @layer page
 */

'use client';

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  use,
  type ReactNode,
  type CSSProperties,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Camera,
  Crown,
  Trash2,
  Copy,
  RefreshCw,
  Eye,
  Pencil,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useAuth } from '@/contexts/AuthContext';
import {
  studyApi,
  type Study,
  type StudyMember,
} from '@/lib/api';
import { useRequireAuth } from '@/hooks/useRequireAuth';

// ─── TYPES ───────────────────────────────

interface PageProps {
  readonly params: Promise<{ id: string }>;
}

// ─── MOCK DATA ──────────────────────────

interface SettingsMember {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MEMBER';
  color: string;
}

const MOCK_MEMBERS: SettingsMember[] = [
  { id: 'm1', name: '김민준', email: 'minjun@example.com', role: 'ADMIN', color: '#E8A830' },
  { id: 'm2', name: '이지현', email: 'jhyun@example.com', role: 'MEMBER', color: '#3DAA6D' },
  { id: 'm3', name: '박서준', email: 'seojun@example.com', role: 'MEMBER', color: '#3B82CE' },
  { id: 'm4', name: '최하은', email: 'haeun@example.com', role: 'MEMBER', color: '#7C6AAE' },
  { id: 'm5', name: '정우진', email: 'woojin@example.com', role: 'MEMBER', color: '#E05448' },
];

const MOCK_GROUND_RULES = `## 참여 규칙
- 매주 **최소 1문제** 이상 제출해야 합니다.
- 마감 기한 내에 제출하지 못한 경우, 사유를 채널에 공유해주세요.
- 스터디 모임에는 **사전 고지 없이 결석하지 않습니다.**

## 문제 풀이 방식
- 풀이 코드는 반드시 **본인이 직접 작성**해야 합니다.
- 외부 코드를 참고한 경우 출처를 주석으로 명시하세요.
- AI 도구(ChatGPT 등)는 **최후의 수단**으로만 활용합니다.

## 코드 리뷰
- 다른 멤버의 코드에 **건설적인 피드백**을 남겨주세요.
- 비난이나 비하 발언은 **금지**합니다.
- 리뷰는 제출 후 **2일 이내**에 완료해주세요.

## 커뮤니케이션
- 스터디 채널에서 질문은 언제든 환영합니다.
- 모르는 것을 모른다고 말하는 문화를 만들어갑시다.
- 서로를 존중하고 격려하는 분위기를 유지합니다.`;

// ─── MARKDOWN RENDERER ─────────────────

function renderMarkdown(md: string): string {
  return md
    .split('\n')
    .map((line) => {
      if (line.startsWith('## ')) {
        return `<h3 style="font-size:15px;font-weight:700;margin:20px 0 8px;padding-left:4px;color:var(--text)">${line.slice(3)}</h3>`;
      }
      if (line.startsWith('- ')) {
        const content = line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        return `<li style="font-size:13px;color:var(--text-2);margin:4px 0;margin-left:20px;padding-left:8px;list-style:disc">${content}</li>`;
      }
      if (line.trim() === '') return '<br/>';
      return `<p style="font-size:13px;color:var(--text-2)">${line}</p>`;
    })
    .join('');
}

// ─── RENDER ──────────────────────────────

export default function StudySettingsPage({ params }: PageProps): ReactNode {
  const { id: studyId } = use(params);
  const router = useRouter();
  const { isAuthenticated } = useRequireAuth();
  const { user } = useAuth();

  // ─── STATE ─────────────────────────────
  const [study, setStudy] = useState<Study | null>(null);
  const [members, setMembers] = useState<StudyMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 기본 정보 폼
  const [studyName, setStudyName] = useState('');
  const [studyDesc, setStudyDesc] = useState('');

  // 그라운드룰
  const [rulesText, setRulesText] = useState('');
  const [rulesMode, setRulesMode] = useState<'edit' | 'preview'>('edit');

  // 아바타
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // 초대 코드
  const [inviteCode, setInviteCode] = useState('ALGO-7X3K');
  const [codeCopied, setCodeCopied] = useState(false);
  const [codeExpiry, setCodeExpiry] = useState(300); // 5분 = 300초
  const [codeActive, setCodeActive] = useState(true);

  // mount animation
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  // 초대코드 5분 타이머
  useEffect(() => {
    if (!codeActive) return;
    if (codeExpiry <= 0) {
      setCodeActive(false);
      return;
    }
    const timer = setInterval(() => {
      setCodeExpiry((prev) => {
        if (prev <= 1) {
          setCodeActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [codeActive, codeExpiry]);

  const fade = (delay = 0): CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(16px)',
    transition: `opacity .5s cubic-bezier(.16,1,.3,1) ${delay}s, transform .5s cubic-bezier(.16,1,.3,1) ${delay}s`,
  });

  // ─── EFFECTS ───────────────────────────

  const loadStudyData = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    if (process.env.NEXT_PUBLIC_DEV_MOCK === 'true') {
      setStudy({
        id: studyId,
        name: '알고리즘 마스터',
        description: 'LeetCode & BOJ 기반 스터디',
        role: 'ADMIN',
        memberCount: 5,
      });
      setStudyName('알고리즘 마스터');
      setStudyDesc('LeetCode & BOJ 기반 스터디');
      setRulesText(MOCK_GROUND_RULES);
      setMembers([
        { id: 'm1', study_id: studyId, user_id: 'dev-user-001', role: 'ADMIN', joined_at: '2025-01-01T00:00:00Z', nickname: '김민준', username: 'kimmin', email: 'dev@algosu.kr', avatar_url: '' },
        { id: 'm2', study_id: studyId, user_id: 'dev-user-002', role: 'MEMBER', joined_at: '2025-01-02T00:00:00Z', nickname: '이지현', username: 'jhyun', email: 'jhyun@example.com', avatar_url: '' },
        { id: 'm3', study_id: studyId, user_id: 'dev-user-003', role: 'MEMBER', joined_at: '2025-01-03T00:00:00Z', nickname: '박서준', username: 'seojun', email: 'seojun@example.com', avatar_url: '' },
        { id: 'm4', study_id: studyId, user_id: 'dev-user-004', role: 'MEMBER', joined_at: '2025-01-04T00:00:00Z', nickname: '최하은', username: 'haeun', email: 'haeun@example.com', avatar_url: '' },
        { id: 'm5', study_id: studyId, user_id: 'dev-user-005', role: 'MEMBER', joined_at: '2025-01-05T00:00:00Z', nickname: '정우진', username: 'woojin', email: 'woojin@example.com', avatar_url: '' },
      ]);
      setIsLoading(false);
      return;
    }

    try {
      const [studyData, memberData] = await Promise.all([
        studyApi.getById(studyId),
        studyApi.getMembers(studyId),
      ]);
      setStudy(studyData);
      setStudyName(studyData.name);
      setStudyDesc(studyData.description ?? '');
      setMembers(memberData);
    } catch (err: unknown) {
      setError(
        (err as Error).message ??
          '스터디 정보를 불러오는 데 실패했습니다.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [studyId]);

  useEffect(() => {
    if (isAuthenticated) {
      void loadStudyData();
    }
  }, [isAuthenticated, loadStudyData]);

  // ─── HANDLERS ──────────────────────────

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setAvatarPreview(url);
  };

  const handleAvatarRemove = (): void => {
    setAvatarPreview(null);
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  };

  const handleCopyCode = async (): Promise<void> => {
    await navigator.clipboard.writeText(inviteCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleRefreshCode = (): void => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const code = `ALGO-${Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')}`;
    setInviteCode(code);
    setCodeExpiry(300);
    setCodeActive(true);
  };

  // ─── LOADING / ERROR ───────────────────

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingSpinner size="lg" label="설정을 불러오는 중..." />
        </div>
      </AppLayout>
    );
  }

  if (error && !study) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <Alert variant="error">{error}</Alert>
          <button
            type="button"
            onClick={() => router.push(`/studies/${studyId}`)}
            className="flex items-center justify-center shrink-0 h-9 w-9 rounded-full transition-colors hover:bg-bg-alt"
          >
            <ArrowLeft className="h-5 w-5" style={{ color: 'var(--text)' }} />
          </button>
          <span className="text-sm text-text-2">돌아가기</span>
        </div>
      </AppLayout>
    );
  }

  const isMock = process.env.NEXT_PUBLIC_DEV_MOCK === 'true';
  const displayMembers: SettingsMember[] = isMock
    ? MOCK_MEMBERS
    : members.map((m) => ({
        id: m.id,
        name: m.nickname ?? m.username ?? m.email ?? '',
        email: m.email ?? '',
        role: m.role,
        color: 'var(--primary)',
      }));

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* ── HEADER ── */}
        <div style={fade(0)}>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push(`/studies/${studyId}`)}
              className="flex items-center justify-center shrink-0 h-9 w-9 rounded-full transition-colors hover:bg-bg-alt"
            >
              <ArrowLeft className="h-5 w-5" style={{ color: 'var(--text)' }} />
            </button>
            <div>
              <h1 className="text-[22px] font-bold tracking-tight text-text">
                스터디 설정
              </h1>
              <p className="text-xs text-text-3">{study?.name ?? ''}</p>
            </div>
          </div>
        </div>

        {error && (
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* ── 스터디 이미지 ── */}
        <section className="space-y-3" style={fade(0.04)}>
          <h2 className="text-sm font-semibold text-text-3">스터디 이미지</h2>
          <Card>
            <CardContent className="py-5">
              <div className="flex items-center gap-5">
                {/* 아바타 미리보기 */}
                <div className="relative shrink-0">
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="스터디 이미지"
                      className="h-20 w-20 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold text-white"
                      style={{ backgroundColor: 'var(--primary)' }}
                    >
                      {study?.name?.charAt(0) ?? ''}
                    </div>
                  )}
                  <button
                    type="button"
                    className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-bg-card text-white transition-colors hover:opacity-90"
                    style={{ backgroundColor: 'var(--primary)' }}
                    onClick={() => avatarInputRef.current?.click()}
                    aria-label="아바타 변경"
                  >
                    <Camera className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>

                {/* 설명 + 버튼 */}
                <div className="space-y-2">
                  <p className="text-[13px] text-text-2">
                    스터디를 대표하는 이미지를 설정하세요.
                  </p>
                  <p className="text-[11px] text-text-3">
                    JPG, PNG 형식 · 최대 2MB · 정사각형 권장
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => avatarInputRef.current?.click()}
                    >
                      이미지 변경
                    </Button>
                    {avatarPreview && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleAvatarRemove}
                        className="text-error hover:text-error"
                      >
                        삭제
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </CardContent>
          </Card>
        </section>

        {/* ── 기본 정보 ── */}
        <section className="space-y-3" style={fade(0.08)}>
          <h2 className="text-sm font-semibold text-text-3">기본 정보</h2>
          <Card>
            <CardContent className="space-y-4 py-5">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-text">
                  스터디 이름
                </label>
                <Input
                  value={studyName}
                  onChange={(e) => setStudyName(e.target.value)}
                  placeholder="스터디 이름"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-text">
                  소개
                </label>
                <textarea
                  className="flex w-full rounded-btn border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  rows={3}
                  value={studyDesc}
                  onChange={(e) => setStudyDesc(e.target.value)}
                  placeholder="스터디를 소개해주세요"
                />
              </div>
              <div className="flex justify-end">
                <Button size="sm">저장</Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ── 그라운드룰 ── */}
        <section className="space-y-3" style={fade(0.12)}>
          <h2 className="text-sm font-semibold text-text-3">그라운드룰</h2>
          <Card>
            <CardContent className="space-y-3 py-5">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-text-2">마크다운으로 작성</span>
                <div className="flex overflow-hidden rounded-btn border border-border">
                  <button
                    type="button"
                    className={`flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium transition-colors ${
                      rulesMode === 'edit'
                        ? 'bg-primary text-white'
                        : 'text-text-3 hover:text-text'
                    }`}
                    onClick={() => setRulesMode('edit')}
                  >
                    <Pencil className="h-3 w-3" aria-hidden />
                    편집
                  </button>
                  <button
                    type="button"
                    className={`flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium transition-colors ${
                      rulesMode === 'preview'
                        ? 'bg-primary text-white'
                        : 'text-text-3 hover:text-text'
                    }`}
                    onClick={() => setRulesMode('preview')}
                  >
                    <Eye className="h-3 w-3" aria-hidden />
                    미리보기
                  </button>
                </div>
              </div>

              {rulesMode === 'edit' ? (
                <textarea
                  className="flex w-full rounded-btn border border-border bg-bg px-3 py-2 text-[13px] font-mono text-text placeholder:text-text-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  rows={12}
                  value={rulesText}
                  onChange={(e) => setRulesText(e.target.value)}
                  placeholder="그라운드룰을 마크다운으로 작성하세요"
                />
              ) : (
                <div
                  className="min-h-[200px] rounded-btn border border-border bg-bg p-4"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(rulesText) }}
                  style={{ lineHeight: '1.7' }}
                />
              )}

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-text-3">
                  Markdown 지원: **굵게**, *기울임*, ## 제목, - 목록
                </span>
                <Button size="sm">저장</Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ── 멤버 ── */}
        <section className="space-y-3" style={fade(0.16)}>
          <h2 className="text-sm font-semibold text-text-3">
            멤버 · {displayMembers.length}명
          </h2>
          <Card className="p-0 overflow-hidden">
            {displayMembers.map((member, idx) => (
              <div
                key={member.id}
                className={`flex items-center justify-between px-4 py-3 ${
                  idx < displayMembers.length - 1 ? 'border-b border-border' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: member.color }}
                  >
                    {member.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-text truncate block">
                      {member.name}
                    </span>
                    <span className="text-[11px] text-text-3 truncate block">
                      {member.email}
                    </span>
                  </div>
                </div>

                {member.role === 'ADMIN' ? (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center">
                    <Crown
                      className="h-4 w-4"
                      style={{ color: 'var(--primary)' }}
                      aria-label="관리자"
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-text-3 transition-colors hover:bg-error-soft hover:text-error"
                    aria-label={`${member.name} 내보내기`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </div>
            ))}
          </Card>
        </section>

        {/* ── 초대 코드 ── */}
        <section className="space-y-3" style={fade(0.2)}>
          <h2 className="text-sm font-semibold text-text-3">초대 코드</h2>
          <Card>
            <CardContent className="space-y-3 py-4">
              <div className="flex items-center gap-2">
                <Input
                  value={codeActive ? inviteCode : '만료됨'}
                  readOnly
                  className={`font-mono text-sm ${!codeActive ? 'text-text-3 line-through' : ''}`}
                />
                <button
                  type="button"
                  className="shrink-0 rounded-lg border border-border p-2.5 text-text-3 transition-colors hover:bg-bg-alt hover:text-text disabled:opacity-40"
                  onClick={handleCopyCode}
                  disabled={!codeActive}
                  aria-label="초대 코드 복사"
                >
                  <Copy className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  className="shrink-0 rounded-lg border border-border p-2.5 text-text-3 transition-colors hover:bg-bg-alt hover:text-text"
                  onClick={handleRefreshCode}
                  aria-label="초대 코드 재생성"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <div className="flex items-center justify-between">
                {codeActive ? (
                  <p className="text-xs text-text-3">
                    <span
                      className="font-medium"
                      style={{ color: codeExpiry <= 60 ? 'var(--error)' : 'var(--primary)' }}
                    >
                      {String(Math.floor(codeExpiry / 60)).padStart(2, '0')}:{String(codeExpiry % 60).padStart(2, '0')}
                    </span>
                    {' '}후 만료
                  </p>
                ) : (
                  <p className="text-xs" style={{ color: 'var(--error)' }}>
                    코드가 만료되었습니다. 새로 생성해주세요.
                  </p>
                )}
                {codeCopied && (
                  <p className="text-xs text-success">복사되었습니다!</p>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ── 위험 구역 ── */}
        <section className="space-y-3" style={fade(0.24)}>
          <h2 className="text-sm font-semibold text-text-3">위험 구역</h2>
          <Card
            className="border-error/30"
            style={{ backgroundColor: 'var(--error-soft)' }}
          >
            <CardContent className="space-y-3 py-5">
              <p className="text-[13px] text-text-2">
                스터디를 삭제하면 모든 문제·제출 기록·분석 결과가 영구 삭제됩니다.
              </p>
              <Button
                className="bg-error text-white hover:bg-error/90"
                size="sm"
              >
                스터디 삭제
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>
    </AppLayout>
  );
}
