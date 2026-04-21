---
sprint: 100
title: "블로그 회고 포스트 — 백준이 사라졌다?"
date: "2026-04-20"
status: completed
---

# Sprint 100 — 블로그 회고 포스트: 백준이 사라졌다?

## 배경
BOJ(백준) 서비스 종료 공지에 대응해 Sprint 95~97에서 프로그래머스로 문제 제공처를 이식한 3-스프린트 로드맵이 완료되었고, Sprint 99에서는 그 후폭풍으로 PM QA 5라운드가 이어졌다. 이 일련의 경험을 **외부 플랫폼 의존 서비스의 태도**라는 프레임으로 재해석한 회고 블로그 포스트를 KR/EN으로 작성한다.

## 목표
- BOJ → 프로그래머스 이식 경험을 외부 의존 서비스의 설계 태도로 재해석한 블로그 글 1편 추가
- KR/EN 동등 번역
- 기존 블로그 공통 규칙(경험담 톤, 시리즈 footer 제거, MDX 컴포넌트 최소) 준수
- 빌드/CI 통과 후 main에 머지

## 작업 요약
| 커밋 | 담당 | 내용 |
|---|---|---|
| `e96f8d7` (PR #96) | Oracle + scribe 지침 | `blog/content/posts/baekjoon-gone.mdx` + `blog/content/posts-en/baekjoon-gone.mdx` 신규 작성 (+198 lines) |

## 수정 내용

### 블로그 포스트
- `blog/content/posts/baekjoon-gone.mdx` (KR) — 제목 "백준이 사라졌다?", category `challenge`, order 7, tags `["retrospective", "external-api", "platform-migration"]`
- `blog/content/posts-en/baekjoon-gone.mdx` (EN) — 제목 "Baekjoon Is Gone?", KR 동등 번역

### 글 구조
1. 도입 — "알고리즘 문제는 백준이죠"가 깨진 날
2. 의존은 알고 있었습니다 — `sourcePlatform` 컬럼, 외부 모듈 분리, enum/토큰 플랫폼 독립성
3. 영원한 건 없다 — 무의식의 가정 "설마 백준이?"가 깨진 순간
4. 이식의 3 스프린트 — Sprint 95(백엔드 인프라) → 96(프런트 UX) → 97(파이프라인 마감)
5. 성과 — 373건 이식, 2,445 tests PASS, WCAG AA 6/6, BOJ 공존
6. 성찰 (글의 1/3+) — "설마" 지우기 / 외부 API 생존 전제 / 추상화는 생존 조건
7. 마무리 — "백준은 사라집니다. AlgoSu는 남습니다"

## 검증 결과
| 항목 | 결과 |
|---|---|
| `npm run build` (blog/) | ✅ PASS — 19 페이지 정적 생성, `/posts/baekjoon-gone` + `/en/posts/baekjoon-gone` 포함 |
| 타입 체크 / 린트 | ✅ 빌드 내 포함, 에러 0 |
| CI (PR #96) | ✅ 26개 체크 전체 PASS (Audit/Build/Quality/Test/E2E/Secret Scan) |
| Squash merge | ✅ `e96f8d7` on main |

## 결정
- **category는 `challenge`로 분류**: `blog/src/lib/posts.ts:16`의 Category union type이 `'journey' | 'challenge'` 2분류로 고정. 사용자 요청 `retrospective`는 스키마에 없어 `tags`로 이동. 글 성격이 "외부 충격에 대한 기술적 대응"이므로 challenge가 의미상도 적절
- **order 7 배정**: 기존 포스트가 1~6을 점유 중 (agent-orchestration-solo-dev 1, system-architecture-overview 2, orchestration-structure 3, cicd-ai-guardrails 4, sprint-journey 5, session-policy-sync 6). 최신 포스트가 목록 상단에 오도록 7 배정
- **MDX 컴포넌트 0건, 코드 블록 0건**: 블로그 공통 규칙 "MDX 최소 사용" + 성찰 중심 글 성격을 따라 순수 텍스트로 작성. 인라인 코드(`sourcePlatform` 등)만 허용
- **기존 BOJ 데이터 공존 서사 유지**: 블로그 글에서 "이식"이 아닌 "공존"을 강조해, Sprint 95~97의 "기존 BOJ 레코드 보존, 마이그레이션 0" 설계 결정을 회고 맥락에 녹임
- **글 중심 메시지 = 태도**: 기술 스택/결정 나열이 아니라 "영원한 외부 플랫폼은 없다"는 태도를 무게중심으로 배치. 성찰 파트가 글의 1/3 이상 차지하도록 구성

## 교훈
- **블로그 콘텐츠 스키마는 작성 전 확인**: Category union이 `journey | challenge`로 하드코딩되어 있어, 사용자가 요청한 `retrospective` 카테고리를 그대로 쓸 수 없었다. 작성 착수 전 `blog/src/lib/posts.ts`를 먼저 읽어 스키마 제약을 확인해야 플랜 단계에서 오류를 방지할 수 있다
- **"설마"를 설계에서 지워야 한다**: Sprint 95~97에서 내린 설계 결정들(`sourcePlatform` 컬럼, 외부 모듈 분리)이 제대로 작동한 이유는 Oracle 초기 설계의 "다른 플랫폼 추가 가능성"을 상정했기 때문. 하지만 "BOJ가 사라질 수 있다"는 생존 시나리오는 상정하지 않았다. 확장성(있으면 좋음)과 생존(없으면 안 됨)은 설계 무게가 다르다
- **추상화는 생존 조건**: `sourcePlatform` 컬럼 한 줄이 DB 마이그레이션 0, 기존 데이터 공존을 가능케 했다. "과하다 싶은 경계"가 외부 충격 앞에서 생명줄이 되는 경험을 문서화
- **블로그 작업은 글 하나 단위 사이클**: 피드백 메모리(`feedback-blog-workflow.md`)대로 플랜 → 보완(뉘앙스 교정 "영원한 건 없다") → 작성 사이클이 효과적이었다. 사용자가 "심장이 외부에 있었다는 사실을 그제서야 깨달았다"는 틀린 전제를 수정할 수 있었던 건 작성 전 방향성 합의 덕분
- **Oracle이 단일 Agent 단일 작업을 직접 수행하는 기준**: 블로그 콘텐츠 MDX는 scribe 권한 영역이지만 독립 spawn 대신 Oracle 세션 내에서 scribe 가이드라인으로 직접 작성했다. 단일 파일/단일 에이전트/빠른 피드백이 필요할 때는 dispatch 오버헤드보다 인라인 처리가 효율적

## 이월 항목 (Sprint 101+)
Sprint 99에서 이월된 항목들이 이번 스프린트에서 해결되지 않고 그대로 이월:
- SWR/React Query 전면 도입 (데이터 페칭 아키텍처)
- Submission Service Redis 통계 캐시 (성능 최적화)
- 레벨 0 240건 tags 보강
- H5 키워드 검색 UX
- ESLint 경고 6건 정리
- Register/NotFound UI 이식
- `SolvedProblem` → `ExternalProblem` 리네이밍
