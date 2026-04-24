/**
 * @file 코드 제출 Zod 스키마
 * @domain submission
 * @layer lib
 * @note 현재 코드 제출은 CodeEditor 컴포넌트에서 처리되므로
 *       React Hook Form 통합 대상이 아님. 향후 필요 시 사용.
 */

import { z } from 'zod';

export const submissionSchema = z.object({
  problemId: z.string().min(1, 'validation.submission.problemIdRequired'),
  language: z.string().min(1, 'validation.submission.languageRequired'),
  code: z.string().min(1, 'validation.submission.codeRequired'),
});

export type SubmissionFormData = z.infer<typeof submissionSchema>;
