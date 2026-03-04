/**
 * @file 코드 제출 Zod 스키마
 * @domain submission
 * @layer lib
 * @note 현재 코드 제출은 CodeEditor 컴포넌트에서 처리되므로
 *       React Hook Form 통합 대상이 아님. 향후 필요 시 사용.
 */

import { z } from 'zod';

export const submissionSchema = z.object({
  problemId: z.string().min(1, '문제 ID가 필요합니다.'),
  language: z.string().min(1, '언어를 선택해주세요.'),
  code: z.string().min(1, '코드를 입력해주세요.'),
});

export type SubmissionFormData = z.infer<typeof submissionSchema>;
