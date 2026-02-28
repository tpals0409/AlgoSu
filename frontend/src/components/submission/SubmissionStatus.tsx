'use client';

/**
 * 제출 상태 표시 컴포넌트 — SSE 연동용 (Day 7 완성)
 *
 * 3단계 상태:
 * 1. ✅ 제출 완료 | ⏳ GitHub 동기화 중... | ⏳ AI 분석 대기 중...
 * 2. ✅ 제출 완료 | ✅ GitHub 동기화 완료 | ⏳ AI 분석 중...
 * 3. ✅ 제출 완료 | ✅ GitHub 동기화 완료 | ✅ AI 분석 완료
 */

export type StepStatus = 'pending' | 'in_progress' | 'done' | 'failed';

interface StatusStep {
  label: string;
  status: StepStatus;
  detail?: string;
}

interface SubmissionStatusProps {
  steps: StatusStep[];
}

const statusIcons: Record<StepStatus, string> = {
  pending: '⏳',
  in_progress: '🔄',
  done: '✅',
  failed: '❌',
};

const statusColors: Record<StepStatus, string> = {
  pending: 'text-gray-500',
  in_progress: 'text-blue-600',
  done: 'text-green-600',
  failed: 'text-red-600',
};

export function SubmissionStatus({ steps }: SubmissionStatusProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-700">제출 진행 상태</h3>
      <div className="flex items-center gap-2">
        {steps.map((step, idx) => (
          <div key={step.label} className="flex items-center gap-2">
            {idx > 0 && (
              <div className="h-px w-8 bg-gray-300" />
            )}
            <div className={`flex items-center gap-1 ${statusColors[step.status]}`}>
              <span>{statusIcons[step.status]}</span>
              <span className="text-sm">{step.label}</span>
            </div>
          </div>
        ))}
      </div>
      {/* 실패 상세 */}
      {steps.some((s) => s.status === 'failed') && (
        <div className="mt-2 text-sm text-red-600">
          {steps
            .filter((s) => s.status === 'failed')
            .map((s) => s.detail ?? `${s.label} 실패`)
            .join(', ')}
        </div>
      )}
    </div>
  );
}
