/**
 * @file       page.tsx
 * @domain     blog / adr
 * @layer      app
 * @related    src/app/(adr)/adr/sprints/[num]/page.tsx, src/components/adr/adr-detail-view.tsx
 *
 * Sprint ADR 상세 페이지 (영문) — /en/adr/sprints/:num 경로. locale='en' 으로 view 렌더.
 */
import { notFound } from 'next/navigation';
import { getAllAdrs } from '@/lib/adr/loader';
import { AdrDetailView } from '@/components/adr/adr-detail-view';

interface Props {
  params: Promise<{ num: string }>;
}

export const dynamicParams = false;

/** 빌드 시 sprint ADR slug 목록을 생성한다. */
export async function generateStaticParams() {
  return getAllAdrs('en')
    .filter((d) => d.meta.kind === 'sprint')
    .map((d) => ({ num: d.meta.slug }));
}

/** 인접 sprint 번호를 계산한다. */
function findAdjacentSprints(
  currentSprint: number,
  allSprints: number[],
): { prev?: number; next?: number } {
  const sorted = [...allSprints].sort((a, b) => a - b);
  const idx = sorted.indexOf(currentSprint);

  return {
    prev: idx > 0 ? sorted[idx - 1] : undefined,
    next: idx < sorted.length - 1 ? sorted[idx + 1] : undefined,
  };
}

/** 영문 Sprint ADR 상세 페이지를 렌더링한다. */
export default async function EnSprintDetailPage({ params }: Props) {
  const { num } = await params;
  const docs = getAllAdrs('en');
  const doc = docs.find(
    (d) => d.meta.kind === 'sprint' && d.meta.slug === num,
  );

  if (!doc) notFound();

  const allSprintNums = docs
    .filter((d) => d.meta.kind === 'sprint' && d.meta.sprint != null)
    .map((d) => d.meta.sprint as number);

  const { prev, next } = findAdjacentSprints(
    doc.meta.sprint ?? 0,
    allSprintNums,
  );

  return (
    <AdrDetailView
      doc={doc}
      prevSprint={prev}
      nextSprint={next}
      locale="en"
    />
  );
}
