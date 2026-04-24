/**
 * @file 피드백 폼 Zod 스키마
 * @domain feedback
 * @layer schema
 * @related FeedbackWidget, FeedbackForm, BugReportForm
 */

import { z } from 'zod';

export const FEEDBACK_CATEGORIES = ['GENERAL', 'BUG', 'FEATURE', 'UX'] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const feedbackSchema = z.object({
  category: z.enum(FEEDBACK_CATEGORIES),
  content: z.string().min(5, 'validation.feedback.contentTooShort').max(2000, 'validation.feedback.contentTooLong'),
  pageUrl: z.string().optional(),
  browserInfo: z.string().optional(),
  screenshot: z.string().max(700_000, 'validation.feedback.screenshotTooLarge').optional(),
});

export type FeedbackFormData = z.infer<typeof feedbackSchema>;
