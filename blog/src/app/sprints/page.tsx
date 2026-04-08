import { getAllSprints } from '@/lib/posts';

export default function SprintsPage() {
  const sprints = getAllSprints();

  return (
    <div>
      <h1 className="mb-2 text-3xl font-bold">Sprint Records</h1>
      <p className="mb-10 text-gray-500">스프린트별 의사결정과 교훈 기록</p>
      {sprints.length === 0 ? (
        <p className="text-gray-400">아직 스프린트 기록이 없습니다.</p>
      ) : (
        <ul className="space-y-4">
          {sprints.map((s) => (
            <li key={s.number}>
              <a
                href={`/sprint/${s.number}`}
                className="block rounded-lg border border-gray-200 p-4 transition hover:border-brand-500 dark:border-gray-800"
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">
                    Sprint {s.number}: {s.title}
                  </h2>
                  <time className="text-sm text-gray-500">{s.date}</time>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
