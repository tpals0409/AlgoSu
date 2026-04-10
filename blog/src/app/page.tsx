import { getAllPosts } from '@/lib/posts';
import { PostCard } from '@/components/post-card';
import { MetricGrid, MetricCard } from '@/components/blog/metric-grid';

export default function HomePage() {
  const posts = getAllPosts();

  return (
    <div>
      <h1 className="mb-2 text-3xl font-bold">AlgoSu Tech Blog</h1>
      <p className="mb-6 text-text-muted">
        AI 에이전트 12명과 함께 만드는 알고리즘 스터디 플랫폼의 아키텍처 결정과 기술 여정
      </p>
      <MetricGrid cols={3}>
        <MetricCard label="Sprints" value="75" hint="지속적 개선 사이클" accent={1} />
        <MetricCard label="Tests" value="2,453" hint="자동화된 품질 검증" accent={3} />
        <MetricCard label="AI Agents" value="12" hint="전문 역할 분담" accent={5} />
        <MetricCard label="Microservices" value="6" hint="Database per Service" accent={2} />
        <MetricCard label="CI Jobs" value="15" hint="보안 + 빌드 + 배포" accent={4} />
        <MetricCard label="ADR 문서" value={String(posts.length)} hint="아키텍처 결정 기록" accent={6} />
      </MetricGrid>
      {posts.length === 0 ? (
        <p className="text-text-subtle">아직 게시물이 없습니다.</p>
      ) : (
        <ul className="space-y-6">
          {posts.map((post) => (
            <li key={post.slug}>
              <PostCard {...post} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
