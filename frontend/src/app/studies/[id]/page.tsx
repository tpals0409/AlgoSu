'use client';

import { useState, useEffect, useCallback, useRef, use, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Copy, Check, UserMinus, Settings, Trash2, ClipboardCheck } from 'lucide-react';
import { createPortal } from 'react-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { LoadingSpinner, InlineSpinner } from '@/components/ui/LoadingSpinner';
import { useStudy } from '@/contexts/StudyContext';
import { studyApi, type Study, type StudyMember } from '@/lib/api';
import { getCurrentUserId } from '@/lib/auth';

interface PageProps {
  readonly params: Promise<{ id: string }>;
}

export default function StudyDetailPage({ params }: PageProps): ReactNode {
  const { id: studyId } = use(params);
  const router = useRouter();
  const myUserId = getCurrentUserId();

  const [study, setStudy] = useState<Study | null>(null);
  const [members, setMembers] = useState<StudyMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 초대 코드
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteRemaining, setInviteRemaining] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showCopyToast, setShowCopyToast] = useState(false);
  const inviteTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 확인 모달 (추방)
  const [kickTarget, setKickTarget] = useState<StudyMember | null>(null);
  const [isKicking, setIsKicking] = useState(false);

  // 설정 수정
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // 역할 변경
  const [roleChanging, setRoleChanging] = useState<string | null>(null);

  // 스터디 삭제
  const [isDeleting, setIsDeleting] = useState(false);

  // 멤버 데이터 기반 ADMIN 판단 (context 의존 X → API 로드 후 정확한 role)
  const isAdmin = members.some(
    (m) => m.user_id === myUserId && m.role === 'ADMIN',
  );

  // 초대 타이머 정리
  useEffect(() => {
    return () => {
      if (inviteTimerRef.current) clearInterval(inviteTimerRef.current);
    };
  }, []);

  const loadStudyData = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const [studyData, memberData] = await Promise.all([
        studyApi.getById(studyId),
        studyApi.getMembers(studyId),
      ]);
      setStudy(studyData);
      setMembers(memberData);
      setEditName(studyData.name);
      setEditDescription(studyData.description ?? '');
    } catch (err: unknown) {
      setError((err as Error).message ?? '스터디 정보를 불러오는 데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [studyId]);

  useEffect(() => {
    void loadStudyData();
  }, [loadStudyData]);

  // 초대 코드 생성
  const handleInvite = useCallback(async (): Promise<void> => {
    setIsInviting(true);
    try {
      const result = await studyApi.invite(studyId);
      setInviteCode(result.code);

      // 카운트다운 시작
      const expiresAt = new Date(result.expires_at).getTime();
      if (inviteTimerRef.current) clearInterval(inviteTimerRef.current);
      const tick = () => {
        const diff = expiresAt - Date.now();
        if (diff <= 0) {
          setInviteCode(null);
          setInviteRemaining(null);
          if (inviteTimerRef.current) clearInterval(inviteTimerRef.current);
          return;
        }
        const m = Math.floor(diff / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setInviteRemaining(`${m}:${String(s).padStart(2, '0')}`);
      };
      tick();
      inviteTimerRef.current = setInterval(tick, 1000);

      // 자동 클립보드 복사
      await navigator.clipboard.writeText(result.code);
      setCopied(true);
      setShowCopyToast(true);
      setTimeout(() => setCopied(false), 2000);
      setTimeout(() => setShowCopyToast(false), 2000);
    } catch {
      setError('초대 코드 생성에 실패했습니다.');
    } finally {
      setIsInviting(false);
    }
  }, [studyId]);

  // 클립보드 복사
  const handleCopy = useCallback(async (): Promise<void> => {
    if (!inviteCode) return;
    await navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setShowCopyToast(true);
    setTimeout(() => setCopied(false), 2000);
    setTimeout(() => setShowCopyToast(false), 2000);
  }, [inviteCode]);

  // 멤버 추방
  const handleKick = useCallback(async (): Promise<void> => {
    if (!kickTarget) return;
    setIsKicking(true);
    try {
      await studyApi.removeMember(studyId, kickTarget.user_id);
      setMembers((prev) => prev.filter((m) => m.id !== kickTarget.id));
      setKickTarget(null);
    } catch {
      setError('멤버 추방에 실패했습니다.');
    } finally {
      setIsKicking(false);
    }
  }, [studyId, kickTarget]);

  // 역할 변경
  const handleRoleChange = useCallback(
    async (member: StudyMember, newRole: 'ADMIN' | 'MEMBER'): Promise<void> => {
      const roleLabel = newRole === 'ADMIN' ? '관리자' : '멤버';
      const confirmed = window.confirm(
        `${member.email ?? member.user_id}님의 역할을 "${roleLabel}"(으)로 변경하시겠습니까?`,
      );
      if (!confirmed) return;

      setRoleChanging(member.id);
      try {
        await studyApi.changeRole(studyId, member.user_id, newRole);
        setMembers((prev) =>
          prev.map((m) =>
            m.id === member.id ? { ...m, role: newRole } : m,
          ),
        );
      } catch {
        setError('역할 변경에 실패했습니다.');
      } finally {
        setRoleChanging(null);
      }
    },
    [studyId],
  );

  // 스터디 설정 수정
  const handleSaveEdit = useCallback(async (): Promise<void> => {
    setIsSavingEdit(true);
    try {
      const updated = await studyApi.update(studyId, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
      });
      setStudy(updated);
      setIsEditing(false);
    } catch {
      setError('스터디 설정 수정에 실패했습니다.');
    } finally {
      setIsSavingEdit(false);
    }
  }, [studyId, editName, editDescription]);

  // 스터디 삭제
  const { removeStudy } = useStudy();
  const handleDeleteStudy = useCallback(async (): Promise<void> => {
    const confirmed = window.confirm(
      '정말 이 스터디를 삭제하시겠습니까? 모든 데이터가 영구 삭제되며 되돌릴 수 없습니다.',
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await studyApi.delete(studyId);
      removeStudy(studyId);
      router.replace('/studies');
    } catch {
      setError('스터디 삭제에 실패했습니다.');
      setIsDeleting(false);
    }
  }, [studyId, removeStudy, router]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingSpinner size="lg" label="스터디 정보를 불러오는 중..." />
        </div>
      </AppLayout>
    );
  }

  if (error && !study) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <Alert variant="error">{error}</Alert>
          <Button variant="ghost" size="sm" onClick={() => router.push('/studies')}>
            <ChevronLeft />
            스터디 목록
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl space-y-6">
        {/* 뒤로가기 */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/studies')}
          className="-ml-1"
        >
          <ChevronLeft />
          스터디 목록
        </Button>

        {error && (
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* 스터디 정보 카드 */}
        {study && (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{study.name}</CardTitle>
                  {study.description && (
                    <CardDescription className="mt-1">{study.description}</CardDescription>
                  )}
                </div>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditing(!isEditing)}
                  >
                    <Settings />
                    {isEditing ? '설정 닫기' : '스터디 설정'}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {study.githubRepo && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-text2">GitHub:</span>
                  <span className="font-mono text-xs text-foreground">{study.githubRepo}</span>
                </div>
              )}
              <div className="mt-2 flex items-center gap-2 text-sm">
                <span className="text-text2">멤버:</span>
                <span className="text-foreground">{members.length}명</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 스터디 설정 수정 */}
        {isEditing && isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>스터디 설정 수정</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="스터디 이름"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                disabled={isSavingEdit}
              />
              <div className="flex flex-col">
                <label
                  htmlFor="edit-description"
                  className="text-[11px] font-medium text-text2 mb-[5px]"
                >
                  설명 (선택)
                </label>
                <textarea
                  id="edit-description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  disabled={isSavingEdit}
                  rows={3}
                  className="w-full px-3 py-2 rounded-btn border border-border bg-bg2 text-text1 text-xs outline-none transition-[border-color] duration-150 placeholder:text-text3 focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                  style={{ padding: '8px 12px', fontSize: '12px' }}
                />
              </div>
            </CardContent>
            <CardFooter className="flex items-center justify-between">
              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsEditing(false);
                    setEditName(study?.name ?? '');
                    setEditDescription(study?.description ?? '');
                  }}
                  disabled={isSavingEdit || isDeleting}
                >
                  취소
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void handleSaveEdit()}
                  disabled={isSavingEdit || isDeleting || !editName.trim()}
                >
                  {isSavingEdit ? (
                    <>
                      <InlineSpinner />
                      저장 중...
                    </>
                  ) : (
                    '저장'
                  )}
                </Button>
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={() => void handleDeleteStudy()}
                disabled={isSavingEdit || isDeleting}
              >
                {isDeleting ? (
                  <>
                    <InlineSpinner />
                    삭제 중...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    스터디 삭제
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* 초대 코드 (ADMIN) */}
        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>초대 코드</CardTitle>
              <CardDescription>새 멤버를 초대하기 위한 코드를 생성합니다.</CardDescription>
            </CardHeader>
            <CardContent>
              {inviteCode ? (
                <div className="flex items-center gap-3">
                  <code className="flex-1 flex items-center justify-between rounded-btn border border-border bg-bg2 px-3 py-2 font-mono text-sm text-foreground">
                    <span>{inviteCode}</span>
                    {inviteRemaining && (
                      <span className="text-[11px] text-muted-foreground">{inviteRemaining}</span>
                    )}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleCopy()}
                    className={copied ? 'text-green-600 dark:text-green-400' : ''}
                  >
                    {copied ? <Check /> : <Copy />}
                    {copied ? '복사됨' : '복사'}
                  </Button>
                </div>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void handleInvite()}
                  disabled={isInviting}
                >
                  {isInviting ? (
                    <>
                      <InlineSpinner />
                      생성 중...
                    </>
                  ) : (
                    '초대 코드 생성'
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* 멤버 목록 */}
        <Card className="p-0">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">
              멤버 ({members.length})
            </h3>
          </div>

          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between px-4 py-3 border-b border-border last:border-b-0"
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* 아바타 */}
                <div
                  className="flex shrink-0 items-center justify-center rounded-full text-white"
                  style={{
                    width: '32px',
                    height: '32px',
                    background: 'linear-gradient(135deg, var(--color-main), var(--color-sub))',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  {(member.username ?? member.email ?? member.user_id)
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {member.username ?? member.email ?? member.user_id.slice(0, 8)}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    {member.joined_at
                      ? new Date(member.joined_at).toLocaleDateString('ko-KR')
                      : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* 역할 Badge / 드롭다운 (본인 제외) */}
                {isAdmin && member.user_id !== myUserId ? (
                  <select
                    value={member.role}
                    onChange={(e) =>
                      void handleRoleChange(member, e.target.value as 'ADMIN' | 'MEMBER')
                    }
                    disabled={roleChanging === member.id}
                    className="px-2 py-1 rounded-btn border border-border bg-bg2 text-text1 text-[11px] outline-none focus:border-primary-500 disabled:opacity-50"
                  >
                    <option value="ADMIN">관리자</option>
                    <option value="MEMBER">멤버</option>
                  </select>
                ) : (
                  <Badge variant={member.role === 'ADMIN' ? 'info' : 'muted'}>
                    {member.role === 'ADMIN' ? '관리자' : '멤버'}
                  </Badge>
                )}

                {/* 추방 버튼 (ADMIN만, 자기 자신 제외) */}
                {isAdmin && member.user_id !== myUserId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setKickTarget(member)}
                    className="text-destructive hover:text-destructive"
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </Card>

        {/* 추방 확인 모달 */}
        {kickTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <Card className="w-full max-w-sm mx-4">
              <CardHeader>
                <CardTitle>멤버 추방</CardTitle>
                <CardDescription>
                  정말 <strong>{kickTarget.username ?? kickTarget.user_id.slice(0, 8)}</strong>님을
                  추방하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                </CardDescription>
              </CardHeader>
              <CardFooter className="flex gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1"
                  onClick={() => setKickTarget(null)}
                  disabled={isKicking}
                >
                  취소
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  className="flex-1"
                  onClick={() => void handleKick()}
                  disabled={isKicking}
                >
                  {isKicking ? (
                    <>
                      <InlineSpinner />
                      추방 중...
                    </>
                  ) : (
                    '추방'
                  )}
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}
      </div>

      {/* 복사 토스트 */}
      {showCopyToast &&
        createPortal(
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-4 duration-200">
            <div className="flex items-center gap-2 rounded-card border border-border bg-surface px-4 py-2.5 shadow-modal">
              <ClipboardCheck className="h-4 w-4 text-green-500" />
              <span className="text-[12px] font-medium text-foreground">
                초대 코드가 복사되었습니다
              </span>
            </div>
          </div>,
          document.body,
        )}
    </AppLayout>
  );
}
