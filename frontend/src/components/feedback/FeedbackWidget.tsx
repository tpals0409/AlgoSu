/**
 * @file 피드백 위젯 (우하단 플로팅 버튼 + Sheet 사이드패널)
 * @domain feedback
 * @layer component
 * @related FeedbackForm, BugReportForm, AppLayout
 *
 * 우하단 플로팅 버튼 클릭 시 Sheet(사이드패널)이 열리며,
 * 탭 2개(피드백 / 버그 리포트)를 전환할 수 있다.
 */

'use client';

import { useState, useMemo } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { FeedbackForm } from './FeedbackForm';
import { BugReportForm } from './BugReportForm';

type Tab = 'feedback' | 'bug';

export function FeedbackWidget() {
  const t = useTranslations('feedback');
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('feedback');

  const tabs: { key: Tab; label: string }[] = useMemo(
    () => [
      { key: 'feedback', label: t('widget.tabFeedback') },
      { key: 'bug', label: t('widget.tabBugReport') },
    ],
    [t],
  );

  const handleSuccess = () => {
    // Close the sheet after a short delay so the user sees the toast
    setTimeout(() => setOpen(false), 800);
  };

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('widget.openButton')}
        className="fixed bottom-36 right-4 z-40 rounded-full p-3 shadow-lg transition-transform hover:scale-105 md:bottom-20"
        style={{ background: 'var(--primary)', color: 'white' }}
      >
        <MessageSquarePlus className="h-5 w-5" aria-hidden />
      </button>

      {/* Sheet side panel */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex flex-col overflow-y-auto"
          style={{ background: 'var(--bg-card)' }}
        >
          <SheetHeader>
            <SheetTitle
              className="text-[16px] font-bold"
              style={{ color: 'var(--text)' }}
            >
              {t('widget.title')}
            </SheetTitle>
            <SheetDescription
              className="text-[12px]"
              style={{ color: 'var(--text-3)' }}
            >
              {t('widget.description')}
            </SheetDescription>
          </SheetHeader>

          {/* Tab switcher */}
          <div
            className="flex border-b"
            style={{ borderColor: 'var(--border)' }}
          >
            {tabs.map((tabItem) => (
              <button
                key={tabItem.key}
                type="button"
                onClick={() => setTab(tabItem.key)}
                className="relative flex-1 px-3 py-2 text-[13px] font-medium transition-colors"
                style={{
                  color: tab === tabItem.key ? 'var(--primary)' : 'var(--text-3)',
                }}
              >
                {tabItem.label}
                {tab === tabItem.key && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-[2px]"
                    style={{ background: 'var(--primary)' }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 px-4 py-4">
            {tab === 'feedback' ? (
              <FeedbackForm onSuccess={handleSuccess} />
            ) : (
              <BugReportForm onSuccess={handleSuccess} />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
