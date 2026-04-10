import { getAllPosts } from '@/lib/posts';
import { PostCard } from '@/components/post-card';

export default function HomePage() {
  const posts = getAllPosts();

  return (
    <div>
      <h1 className="mb-2 text-3xl font-bold">AlgoSu Tech Blog</h1>
      <p className="mb-8 text-text-muted">
        알고리즘 스터디 플랫폼의 아키텍처 결정과 기술 여정
      </p>
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
