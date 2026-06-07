/**
 * @file 단일 문항 표시 + 단답 입력 폼
 * @domain quiz
 * @layer component
 * @related QuizPlay, src/data/quiz/types.ts
 */

'use client';

import { useState, type FormEvent, type ReactElement } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import type { QuizQuestion as QuizQuestionType } from '@/data/quiz';

interface QuizQuestionProps {
  /** 현재 출제 중인 문항 */
  readonly question: QuizQuestionType;
  /** 사용자가 답안을 제출할 때 호출 */
  readonly onSubmit: (answer: string) => void;
}

/**
 * 문항 프롬프트(현재 로케일)와 단답 입력 폼을 렌더한다.
 * Enter 키 또는 제출 버튼으로 답안을 전송한다 (빈 입력은 무시).
 */
export function QuizQuestion({ question, onSubmit }: QuizQuestionProps): ReactElement {
  const t = useTranslations('quiz');
  const locale = useLocale();
  const [value, setValue] = useState('');

  const prompt = locale === 'en' ? question.prompt.en : question.prompt.ko;

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (value.trim() === '') return;
    onSubmit(value);
  };

  return (
    <form onSubmit={handleSubmit} className="animate-fade-in-up space-y-4">
      <div className="rounded-card border border-border bg-bg-alt p-4">
        <p className="text-base font-semibold leading-relaxed text-text">{prompt}</p>
      </div>
      <Input
        label={t('play.answerLabel')}
        placeholder={t('play.answerPlaceholder')}
        value={value}
        autoFocus
        onChange={(event) => setValue(event.target.value)}
      />
      <Button type="submit" variant="primary" size="md" className="w-full">
        {t('play.submit')}
      </Button>
    </form>
  );
}
