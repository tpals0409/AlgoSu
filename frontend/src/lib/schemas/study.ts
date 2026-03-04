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
    .min(1, '스터디 이름을 입력해주세요.')
    .min(2, '스터디 이름은 2자 이상이어야 합니다.'),
  nickname: z
    .string()
    .trim()
    .min(1, '닉네임을 입력해주세요.'),
  description: z.string().optional(),
});

export type StudyCreateFormData = z.infer<typeof studyCreateSchema>;
