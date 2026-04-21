/**
 * @file 게스트 모드 샘플 상세 — 문제 + 코드 + AI 분석 결과 미리보기
 * @domain guest
 * @layer page
 * @related GuestSample, GuestNav, ScoreGauge, CodeBlock, parseFeedback
 *
 * slug → 정적 픽스처 매칭. 없으면 notFound().
 * 금지: AiSatisfactionButton, AI 재분석, 광고, API 호출 (정적 데이터만).
 */

'use client';

import type { ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { GuestNav } from '@/components/guest/GuestNav';
import { Card, CardContent } from '@/components/ui/Card';
import { DifficultyBadge } from '@/components/ui/DifficultyBadge';
import { ScoreGauge } from '@/components/ui/ScoreGauge';
import { CodeBlock } from '@/components/ui/CodeBlock';
import { GUEST_SAMPLES, type GuestProblem, type GuestAnalysis } from '@/data/guest-samples';
import { parseFeedback, type ParsedFeedback, type FeedbackCategory } from '@/lib/feedback';

// ─── HELPERS ─────────────────────────────────

/** 점수에 따른 Tailwind 텍스트 색상 토큰 반환 */
function scoreColorClass(score: number): string {
  if (score >= 80) return 'text-success';
  if (score >= 60) return 'text-warning';
  return 'text-error';
}

// ─── SUB COMPONENTS ──────────────────────────

/** 카테고리별 점수 + 코멘트 행 */
function CategoryItem({ category }: { readonly category: FeedbackCategory }): ReactNode {
  return (
    <div className="border-b border-border py-3 last:border-0">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-medium capitalize text-text">{category.name}</span>
        <span className={`text-sm font-bold ${scoreColorClass(category.score)}`}>
          {category.score}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-text-2">{category.comment}</p>
    </div>
  );
}

/** 시간/공간 복잡도 행 */
function ComplexityRow({
  time,
  space,
}: {
  readonly time: string | null;
  readonly space: string | null;
}): ReactNode {
  if (!time && !space) return null;
  return (
    <div className="flex gap-4 text-xs">
      {time && (
        <span className="text-text-2">
          시간: <code className="font-mono text-text">{time}</code>
        </span>
      )}
      {space && (
        <span className="text-text-2">
          공간: <code className="font-mono text-text">{space}</code>
        </span>
      )}
    </div>
  );
}

/** 점수 게이지 + 설명 */
function ScoreSection({ score }: { readonly score: number }): ReactNode {
  return (
    <div className="flex items-center gap-6">
      <ScoreGauge score={score} size={120} />
      <div>
        <p className="mb-1 text-xs text-text-3">AI 분석 점수</p>
        <p className="text-xs leading-relaxed text-text-2">
          AlgoSu AI가 생성한 실제 분석 샘플입니다.
        </p>
      </div>
    </div>
  );
}

/** 코드 카드 — 제출 코드 또는 개선 코드 공통 래퍼 */
function CodeCard({
  title,
  code,
  language,
}: {
  readonly title: string;
  readonly code: string;
  readonly language: string;
}): ReactNode {
  return (
    <Card>
      <CardContent className="overflow-hidden rounded-card p-0">
        <div className="border-b border-border px-4 py-2">
          <h2 className="text-sm font-medium text-text">{title}</h2>
        </div>
        <CodeBlock code={code} language={language} />
      </CardContent>
    </Card>
  );
}

/** 문제 정보 카드 (좌측 컬럼) */
function ProblemCard({ problem }: { readonly problem: GuestProblem }): ReactNode {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-xl font-bold text-text">{problem.title}</h1>
          <a
            href={problem.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center gap-1 text-xs text-text-3 transition-colors hover:text-primary"
            aria-label={`${problem.source} 문제 보기 (새 탭)`}
          >
            {problem.source}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DifficultyBadge difficulty={problem.difficulty} />
          {problem.tags.map((tag) => (
            <span key={tag} className="rounded bg-bg-alt px-1.5 py-0.5 text-[10px] text-text-3">
              {tag}
            </span>
          ))}
        </div>
        <p className="text-sm leading-relaxed text-text-2">{problem.description}</p>
      </CardContent>
    </Card>
  );
}

/** AI 분석 요약 카드 */
function ScoreCard({
  analysis,
  parsed,
}: {
  readonly analysis: GuestAnalysis;
  readonly parsed: ParsedFeedback | null;
}): ReactNode {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-text">AI 분석 결과</h2>
        {analysis.score != null && <ScoreSection score={analysis.score} />}
        {parsed?.summary && (
          <p className="text-sm leading-relaxed text-text-2">{parsed.summary}</p>
        )}
        <ComplexityRow
          time={parsed?.timeComplexity ?? null}
          space={parsed?.spaceComplexity ?? null}
        />
      </CardContent>
    </Card>
  );
}

/** 카테고리별 점수 카드 */
function CategoriesCard({
  categories,
}: {
  readonly categories: FeedbackCategory[];
}): ReactNode {
  if (categories.length === 0) return null;
  return (
    <Card>
      <CardContent>
        <h2 className="mb-2 text-base font-semibold text-text">카테고리별 점수</h2>
        {categories.map((cat) => (
          <CategoryItem key={cat.name} category={cat} />
        ))}
      </CardContent>
    </Card>
  );
}

/** 분석 결과 패널 (우측 컬럼) */
function AnalysisPanel({
  analysis,
  language,
  code,
}: {
  readonly analysis: GuestAnalysis;
  readonly language: string;
  readonly code: string;
}): ReactNode {
  const parsed = parseFeedback(analysis.feedback, analysis.score, analysis.optimizedCode);

  return (
    <div className="flex flex-col gap-6">
      <ScoreCard analysis={analysis} parsed={parsed} />
      {parsed && <CategoriesCard categories={parsed.categories} />}
      <CodeCard title="제출 코드" code={code} language={language} />
      {parsed?.optimizedCode && (
        <CodeCard title="개선된 코드 예시" code={parsed.optimizedCode} language={language} />
      )}
    </div>
  );
}

/** 하단 고정 CTA 배너 */
function GuestCtaBanner(): ReactNode {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border glass-nav px-4 py-3">
      <div className="mx-auto flex max-w-container items-center justify-between gap-4">
        <p className="text-xs text-text-2">
          이 분석은 샘플입니다. 내 코드도 AI로 분석받으세요.
        </p>
        <Link
          href="/login"
          className="shrink-0 rounded-btn bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          회원가입 →
        </Link>
      </div>
    </div>
  );
}

// ─── PAGE ────────────────────────────────────

/** 게스트 샘플 상세 페이지 */
export default function GuestPreviewPage(): ReactNode {
  const params = useParams();
  const slug = (params?.slug as string) ?? '';
  const sample = GUEST_SAMPLES.find((s) => s.slug === slug);

  if (!sample) notFound();

  return (
    <div className="min-h-screen bg-bg text-text">
      <GuestNav />
      <main id="main-content" className="px-4 pb-24 pt-16 sm:px-6">
        <div className="mx-auto max-w-container py-6">
          <Link
            href="/guest"
            className="mb-6 inline-flex items-center gap-1 text-sm text-text-3 transition-colors hover:text-text"
          >
            <ArrowLeft className="h-4 w-4" />
            목록으로
          </Link>
          <div className="mt-4 grid gap-6 lg:grid-cols-[2fr_3fr]">
            <ProblemCard problem={sample.problem} />
            <AnalysisPanel
              analysis={sample.analysis}
              language={sample.submission.language}
              code={sample.submission.code}
            />
          </div>
        </div>
      </main>
      <GuestCtaBanner />
    </div>
  );
}
