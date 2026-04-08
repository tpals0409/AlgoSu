/**
 * @file 스터디룸 AI 분석 결과 뷰 (3단계)
 * @domain study
 * @layer component
 * @related page.tsx, utils.ts
 */

'use client';

import { useState, useEffect, type ReactNode, type CSSProperties } from 'react';
import {
  Sparkles,
  ChevronDown,
  ArrowLeft,
  Copy,
  Check,
  Brain,
  BarChart3,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { ScoreGauge } from '@/components/ui/ScoreGauge';
import { CodeBlock } from '@/components/ui/CodeBlock';
import { DifficultyBadge } from '@/components/ui/DifficultyBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Skeleton } from '@/components/ui/Skeleton';
import { getAvatarPresetKey, getAvatarSrc } from '@/lib/avatars';
import type { Problem, Submission, AnalysisResult } from '@/lib/api';
import { getSagaStatus, CATEGORY_LABELS, barColor, parseFeedbackCategories } from './utils';

export interface AnalysisViewProps {
  readonly problem: Problem;
  readonly submission: Submission;
  readonly analysis: AnalysisResult | null;
  readonly loading: boolean;
  readonly nicknameMap: Record<string, string>;
  readonly avatarMap: Record<string, string | null>;
  readonly onBack: () => void;
}

export function AnalysisView({ problem, submission, analysis, loading, nicknameMap, avatarMap, onBack }: AnalysisViewProps): ReactNode {
  const [copied, setCopied] = useState(false);
  const [showOptimized, setShowOptimized] = useState(false);
  const [analysisBarsAnimated, setAnalysisBarsAnimated] = useState(false);
  const [viewMounted, setViewMounted] = useState(false);

  useEffect(() => { const t = setTimeout(() => setViewMounted(true), 50); return () => clearTimeout(t); }, []);
  useEffect(() => { if (!analysis) return; const t = setTimeout(() => setAnalysisBarsAnimated(true), 400); return () => clearTimeout(t); }, [analysis]);

  const vfade = (delay = 0): CSSProperties => ({
    opacity: viewMounted ? 1 : 0, transform: viewMounted ? 'translateY(0)' : 'translateY(16px)',
    transition: `opacity .5s cubic-bezier(.16,1,.3,1) ${delay}s, transform .5s cubic-bezier(.16,1,.3,1) ${delay}s`,
  });

  const handleCopy = async (text: string): Promise<void> => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  };

  const name = (submission.userId && nicknameMap[submission.userId]) ? nicknameMap[submission.userId] : '익명';
  const avatarUrl = submission.userId ? avatarMap[submission.userId] : null;
  const saga = getSagaStatus(submission.sagaStep);
  const langMap: Record<string, string> = { python: 'python', java: 'java', cpp: 'cpp', javascript: 'javascript', c: 'c' };
  const langKey = langMap[submission.language.toLowerCase()] ?? 'text';

  const categories = parseFeedbackCategories(analysis?.feedback ?? null);
  const totalScore = analysis?.score ?? submission.aiScore ?? 0;

  // 로딩 또는 분석 미완료
  if (loading || !analysis || analysis.analysisStatus !== 'completed') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3" style={vfade(0)}>
          <button type="button" onClick={onBack} className="flex items-center justify-center shrink-0 h-9 w-9 rounded-full transition-colors hover:bg-bg-alt">
            <ArrowLeft className="h-5 w-5" style={{ color: 'var(--text)' }} />
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-text">{name}의 제출</h1>
            <p className="text-sm text-text-3">{problem.title}</p>
          </div>
        </div>
        <Card><CardContent className="flex flex-col items-center justify-center py-16 gap-4">
          {loading ? <Skeleton height={48} width="60%" /> : (
            <>
              <Sparkles className="h-8 w-8 text-warning" />
              <div className="text-center">
                <p className="text-sm font-medium text-text">
                  {saga.variant === 'warning' ? 'AI 분석 중...' : analysis?.analysisStatus === 'failed' ? '분석 실패' : '분석 대기 중'}
                </p>
                <p className="mt-1 text-[11px] text-text-3">
                  {saga.variant === 'warning' ? '분석이 완료되면 결과가 표시됩니다.' : '아직 분석이 완료되지 않았습니다.'}
                </p>
              </div>
            </>
          )}
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="space-y-3" style={vfade(0)}>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="flex items-center justify-center shrink-0 h-9 w-9 rounded-full transition-colors hover:bg-bg-alt">
            <ArrowLeft className="h-5 w-5" style={{ color: 'var(--text)' }} />
          </button>
          <img src={avatarUrl ? getAvatarSrc(getAvatarPresetKey(avatarUrl)) : getAvatarSrc('default')} alt={`${name} 아바타`} className="h-10 w-10 shrink-0 rounded-full object-cover" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-text">{name}</h1>
            <p className="text-sm text-text-3">{problem.title}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <DifficultyBadge difficulty={problem.difficulty} level={problem.level} />
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase" style={{ backgroundColor: 'var(--bg-alt)', color: 'var(--text-2)' }}>{submission.language}</span>
          <StatusBadge label={saga.label} variant={saga.variant} />
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ backgroundColor: 'var(--success-soft)', color: 'var(--success)' }}>{totalScore}점</span>
          {(problem.tags ?? []).map((tag) => (
            <span key={tag} className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium" style={{ backgroundColor: 'var(--bg-alt)', color: 'var(--text-3)' }}>{tag}</span>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[12px] text-text-3">{new Date(submission.createdAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          {problem.sourceUrl && (
            <a href={problem.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline">
              문제 보기<ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>

      {/* 2-Column Layout */}
      <div className="flex flex-col lg:flex-row gap-4 items-stretch" style={vfade(0.1)}>
        {/* 코드 뷰어 */}
        <div className="w-full lg:w-1/2 min-w-0 flex flex-col">
          <Card className="p-0 overflow-hidden flex-1 flex flex-col">
            <div className="flex items-center justify-between px-5 h-12 shrink-0 border-b" style={{ borderColor: 'var(--border)' }}>
              <span className="text-[13px] font-semibold text-text flex items-center gap-1.5">
                <span style={{ color: 'var(--primary)' }}>&lt;/&gt;</span>{submission.language}
              </span>
              <button onClick={() => void handleCopy(submission.code ?? '')} className="flex items-center gap-1.5 px-2.5 py-1 rounded-badge text-[11px] font-medium transition-colors hover:bg-bg-alt" style={{ color: 'var(--text-3)' }}>
                {copied ? <Check className="h-3 w-3" style={{ color: 'var(--success)' }} /> : <Copy className="h-3 w-3" />}
                {copied ? '복사됨' : '복사'}
              </button>
            </div>
            <div className="overflow-auto">
              <CodeBlock code={submission.code ?? '// 코드를 불러올 수 없습니다'} language={langKey} />
            </div>
          </Card>
        </div>

        {/* AI 분석 결과 */}
        <div className="w-full lg:w-1/2 flex flex-col">
          <Card className="p-0 overflow-hidden flex-1 flex flex-col">
            <div className="flex items-center justify-between px-5 h-12 shrink-0 border-b" style={{ borderColor: 'var(--border)' }}>
              <span className="flex items-center gap-2 text-[13px] font-semibold text-text">
                <Brain className="h-4 w-4" style={{ color: 'var(--primary)' }} />AI 분석 결과
              </span>
            </div>
            <div className="px-3 py-4 sm:px-5 sm:py-5 space-y-5">
              <div className="flex justify-center">
                <ScoreGauge score={totalScore} size={160} label="/ 100" />
              </div>

              {categories.length > 0 && (
                <div className="space-y-1">
                  <p className="flex items-center gap-1.5 text-[13px] font-medium text-text pb-1" style={{ borderBottom: '1px solid var(--border)' }}>
                    <BarChart3 className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} />항목별 평가
                  </p>
                  {categories.map((cat) => {
                    const color = barColor(cat.score);
                    const label = CATEGORY_LABELS[cat.name] ?? cat.name;
                    return (
                      <div key={cat.name} className="py-2.5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[13px] font-semibold text-text">{label}</span>
                          <span className="text-[13px] font-bold" style={{ color }}>{cat.score}</span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
                          <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: analysisBarsAnimated ? `${cat.score}%` : '0%', backgroundColor: color }} />
                        </div>
                        <p className="mt-1.5 text-[11px] leading-relaxed text-text-3">{cat.comment}</p>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* AI 개선 코드 */}
              {analysis.optimizedCode && (
                <div style={{ borderTop: '1px solid var(--border)' }}>
                  <button type="button" onClick={() => setShowOptimized(!showOptimized)} className="flex items-center justify-between w-full px-0 py-2.5 text-[13px] font-medium text-text transition-colors hover:text-primary">
                    <span className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} />AI 개선 코드</span>
                    <ChevronDown className="h-4 w-4 text-text-3 transition-transform" style={{ transform: showOptimized ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                  </button>
                  {showOptimized && (
                    <div className="rounded-card overflow-hidden mb-1" style={{ border: '1px solid var(--border)' }}>
                      <CodeBlock code={analysis.optimizedCode} language={langKey} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
