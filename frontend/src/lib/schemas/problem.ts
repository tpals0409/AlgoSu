/**
 * @file 문제 생성 폼 Zod 스키마
 * @domain problem
 * @layer lib
 */

import { z } from 'zod';

export const problemCreateSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, '문제 제목을 입력해주세요.'),
  description: z.string().optional(),
  difficulty: z.string().optional(),
  weekNumber: z
    .string()
    .trim()
    .min(1, '주차를 선택해주세요.'),
  deadline: z
    .string()
    .min(1, '마감일을 선택해주세요.'),
  allowedLanguages: z.array(z.string()),
  sourceUrl: z.string().optional(),
  sourcePlatform: z.string().optional(),
});

export type ProblemCreateFormData = z.infer<typeof problemCreateSchema>;
