/**
 * @file 스터디 생성 폼 Zod 스키마
 * @domain study
 * @layer lib
 */

import { z } from 'zod';

export const studyCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'validation.study.nameRequired')
    .min(2, 'validation.study.nameTooShort'),
  nickname: z
    .string()
    .trim()
    .min(1, 'validation.study.nicknameRequired'),
  description: z.string().optional(),
});

export type StudyCreateFormData = z.infer<typeof studyCreateSchema>;
