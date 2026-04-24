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
    .min(1, 'validation.problem.titleRequired'),
  description: z.string().optional(),
  difficulty: z.string().optional(),
  weekNumber: z
    .string()
    .trim()
    .min(1, 'validation.problem.weekNumberRequired'),
  deadline: z
    .string()
    .min(1, 'validation.problem.deadlineRequired'),
  allowedLanguages: z.array(z.string()),
  sourceUrl: z.string().optional(),
  sourcePlatform: z.string().optional(),
});

export type ProblemCreateFormData = z.infer<typeof problemCreateSchema>;
