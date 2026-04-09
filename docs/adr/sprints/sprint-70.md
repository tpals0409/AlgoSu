---
sprint: 70
title: "블로그 시각자료 풍부화 + Sprint 69 이월 작업"
date: "2026-04-09"
status: completed
agents: [Oracle, Architect, Palette]
related_adrs: []
---

# Sprint 70: 블로그 시각자료 풍부화 + Sprint 69 이월 작업

## Decisions

### D1: cloudflared SSoT를 aether-gitops로 일원화 (Sprint 69 이월)
- **Context**: cloudflared가 `AlgoSu/infra/k3s/cloudflared.yaml`을 직접 `kubectl apply`로 관리되어 ArgoCD tracking 대상이 아니었음(Sprint 69 G3). 동시에 aether-gitops에 `algosu/base/monitoring/cloudflared.yaml` 고아 매니페스트가 존재했지만 핫픽스/probe/securityContext가 누락되고 secret 이름도 달라 사용 불가 상태.
- **Choice**: AlgoSu 소스 매니페스트(견고한 SSoT)를 aether-gitops `algosu/base/cloudflared.yaml`로 복제, `kustomization.yaml resources`에 추가, 고아 매니페스트 삭제, AlgoSu 소스 매니페스트는 삭제. ArgoCD가 in-place adopt하여 다운타임 0초로 GitOps 관리화 완료.
- **Alternatives**: (a) 고아 매니페스트를 정본화 — 핫픽스/probe/secret 모두 보강 필요로 위험 ↑, 기각. (b) 두 매니페스트 병존 — 드리프트 영구화로 기각.
- **Code Paths**: `aether-gitops/algosu/base/cloudflared.yaml`, `aether-gitops/algosu/base/kustomization.yaml`

### D2: cloudflared 이미지 고정 태그 — `2026.3.0`
- **Context**: `cloudflare/cloudflared:latest` 사용은 CLAUDE.md Architect 규칙 위반. 운영 클러스터에서 실제 fetch된 버전이 `2026.3.0`이고 28h+ 무재시작 검증됨.
- **Choice**: aether-gitops base에서 `cloudflare/cloudflared:2026.3.0` 고정 태그로 핀. 동일 binary라 RollingUpdate 무중단(<3초).
- **Alternatives**: 최신 stable(`2026.3.0` 외)로 갈 수도 있었으나 운영에서 검증된 버전이 1순위.
- **Code Paths**: `aether-gitops/algosu/base/cloudflared.yaml`

### D3: 블로그 시각화 디자인 옵션 — Option C (혼합형)
- **Context**: Sprint 70-5 Phase 3에서 Mermaid로 변환한 system-architecture-overview에 대해 PM 피드백 "아키텍쳐 구조 등 시각화 자료는 좀더 시각화해야지 무슨말인지". Mermaid의 단순 박스+화살표가 의미·위계·정보 밀도를 전달하지 못함.
- **Choice**: **Option C 혼합형** — 반복 패턴(3-Tier 매트릭스, 위계 트리, Phase 카드)은 재사용 React 컴포넌트로, 단순 흐름은 기존 Pipeline/ServiceGrid, 시퀀스/복잡 분기(OAuth, Saga 상태)는 Mermaid 유지. 디자인 통제·작업량·번들의 균형점.
- **Alternatives**: (B) 전면 손수 SVG — 작업량 ↑↑, OAuth 시퀀스 표현 어려움. (A) Mermaid 고급 — 토큰 통합 어려움, PM 만족 가능성 낮음. (D/E) 외부 도구·React Flow — 정적 export 친화성 ↓, 비추천.
- **Code Paths**: `blog/src/components/blog/{architecture-map,tier-matrix,hierarchy-tree,phase-timeline,icons,pipeline}.tsx`

### D4: MDX 아이콘 참조 — string-based registry 패턴
- **Context**: MDX에서 `icon={Crown}` 형태로 lucide 식별자를 직접 참조 시 빌드 실패(`Crown is not defined`). MDX의 JSX expression은 모듈 스코프 import가 필요한데, compileMDX는 `components` 옵션의 React 컴포넌트만 자동 주입함.
- **Choice**: `src/components/blog/icons.ts`에 lucide 아이콘 30개 string-keyed registry를 정의하고, 각 컴포넌트가 `getIcon(name)`으로 lookup. MDX에서는 `icon="Crown"`으로 사용. 6편 mdx 모두 import 불필요.
- **Alternatives**: (a) mdx 파일별로 lucide import statement 추가 — 6편에 일일이 추가 필요, 유지보수 ↓. (b) compileMDX `scope` 옵션 — 5.0에서 명확하지 않고 type 안전성 ↓.
- **Code Paths**: `blog/src/components/blog/icons.ts`, `blog/src/components/mdx-components.tsx`

### D5: 6편 동률 date 정렬 보강 — `order` 보조 필드
- **Context**: 6편 시리즈가 모두 `date: "2026-04-09"`로 동일해 `Array.sort` stable + `fs.readdirSync` 알파벳 순 결합으로 비결정 정렬. 사용자 의도(시리즈 순서)와 어긋남.
- **Choice**: `PostMeta`에 `order?: number` 추가, 정렬을 `(date desc, order desc)` 복합으로 보강. 6편 frontmatter에 `order 1~6` 부여(intro=1, sprint-journey=6). 화면 표시(date)는 변경 없음.
- **Alternatives**: (a) ISO datetime로 시간 분리 — gray-matter Date 객체화 위험. (b) 새 글 추가 시마다 시간 인위 부여 — 유지보수 ↓.
- **Code Paths**: `blog/src/lib/posts.ts`, `blog/content/adr/*.mdx`

## Patterns

### P1: ArgoCD in-place adopt — 직접 apply된 리소스의 GitOps 편입
- **Where**: aether-gitops `algosu/base/{kind}.yaml` + `kustomization.yaml resources`
- **When to Reuse**: `kubectl apply`로만 관리되던 리소스를 ArgoCD 추적으로 이관할 때. 동일 namespace/name/spec을 그대로 GitOps에 복제하면 ArgoCD가 RollingUpdate 없이 in-place로 adopt(annotation·label만 추가). 다운타임 0초. 단, spec이 한 글자라도 다르면 재생성됨 → 사전에 `kubectl get -o yaml` 백업 필수.

### P2: MDX 컴포넌트 매핑 + string-based icon registry
- **Where**: `blog/src/components/blog/icons.ts`, `blog/src/components/mdx-components.tsx`, `blog/src/lib/mdx.ts`
- **When to Reuse**: next-mdx-remote `compileMDX`에서 mdx 본문이 React 컴포넌트의 prop으로 식별자(아이콘/타입 등)를 받아야 할 때. mdx에 import statement를 강요하지 말고 string key로 받아 컴포넌트 내부에서 registry lookup. 새 아이콘 추가 시 registry 한 곳만 수정.

### P3: Plain ASCII 다이어그램 시각화 — 패턴 분류 → 컴포넌트 매핑
- **Where**: `blog/src/components/blog/{architecture-map,tier-matrix,hierarchy-tree,phase-timeline,pipeline}.tsx`
- **When to Reuse**: 블로그/문서에 다수의 ASCII 다이어그램이 있을 때 패턴별로 분류 (시스템 토폴로지/계층-트리/순차 파이프라인/Phase 마일스톤/시퀀스/상태 머신). 시퀀스·상태 머신은 Mermaid가 적합, 나머지는 손수 React 컴포넌트가 디자인 통제·다크모드·접근성 측면에서 우월. 동일 패턴이 3편 이상 반복되면 컴포넌트화 가치 충분.

### P4: Phase 분할 + sample 검토 게이트 (Sprint 70-5/70-6 공통 워크플로우)
- **Where**: 디자인/UX 변경 작업 전반
- **When to Reuse**: 결과물의 시각적 만족도가 핵심인 작업(블로그 디자인, UI 컴포넌트). Phase 1에 인프라+sample 1~2편을 우선 진행 → PM 운영 환경 검토 → 만족 시 잔여 일괄 진행. Phase 2까지의 작업 일괄 commit이 아니라 sample 게이트를 둠으로써 디자인 가설을 빠르게 검증하고 toolchain 폐기 비용을 최소화.

## Gotchas

### G1: lucide-react 1.8.0의 export 누락 (`Github` 아이콘)
- **Symptom**: `npm install lucide-react` 후 `import { Github } from 'lucide-react'` → `Module '"lucide-react"' has no exported member 'Github'` 빌드 실패.
- **Root Cause**: 현재 npm registry의 `lucide-react@1.8.0`은 5822 export가 있지만 `Github` 자체는 deprecated. `GitBranch`, `GitFork` 등 git 관련 아이콘은 존재하지만 `Github` brand mark는 빠짐. `LucideIcon` type export도 없음.
- **Fix**: `Github` import 제거(GitHub Worker는 `GitBranch`로 대체). `LucideIcon` 타입은 자체 정의(`ComponentType<{className?, size?, strokeWidth?}>`). 신규 lucide 아이콘 사용 전 `node -e "console.log('Foo' in require('lucide-react'))"` 로 사전 검증 권장.

### G2: MDX JSX expression의 식별자 스코프 한계
- **Symptom**: `<HierarchyNode icon={Crown}/>` 형태 mdx 작성 후 빌드 시 `ReferenceError: Crown is not defined at stringify`. compileMDX의 `components` 옵션은 컴포넌트 직접 사용(`<Crown/>`)만 주입할 뿐, JSX expression 안의 식별자 참조는 처리하지 않음.
- **Root Cause**: MDX는 본질적으로 JS 모듈이고 식별자는 module scope import가 필요. compileMDX `components`는 JSX 태그 매핑 슈가일 뿐.
- **Fix**: prop을 React 식별자가 아닌 string key로 받고, 컴포넌트 내부에서 registry lookup(`getIcon(name)`). 본 스프린트의 D4 패턴 채택. 6편 mdx 어디에도 import statement 불필요.

### G3: nginx try_files 패턴 — trailing slash로 404
- **Symptom**: `curl https://blog.algo-su.com/posts/system-architecture-overview/` → 404. trailing slash 없으면 200.
- **Root Cause**: `blog/nginx.conf`의 `try_files $uri $uri.html $uri/ =404`는 trailing slash가 있으면 폴더 매칭 로직으로 갔다가 fallback 실패. Next.js export는 `out/posts/{slug}.html`(파일)과 `out/posts/{slug}/index.html`(폴더) 둘 다 생성하지만, nginx 패턴이 파일 우선이라 `.html` 확장 매칭이 동작하는 trailing slash 없는 형태가 정답.
- **Fix**: PM 검토 URL 안내 시 trailing slash 없는 형태 사용. 또는 향후 nginx try_files 패턴을 `$uri $uri.html $uri/index.html =404`로 보강 가능(별도 작업).

### G4: PM 검토 워크플로우 — sample 1편이 PM 만족 보장 안 함
- **Symptom**: Sprint 70-5 Phase 3에서 system-architecture-overview를 Mermaid로 마이그레이션 후 sample push → 운영 검토 → "더 시각화해야지 무슨말인지" 피드백 → Sprint 70-6에서 컴포넌트 4종 신규 작성으로 재작업.
- **Root Cause**: Phase 1 인프라 design 단계에서 디자인 가설(Mermaid 단순 flowchart)이 PM의 "풍부한 시각화" 기대와 어긋남. sample 검토 전에 디자인 가설의 강도를 시각적으로 PM에게 미리 알 수 없음.
- **Fix**: 디자인 가설 강도가 약하면 sample 1편을 빠르게 push해서 운영 환경에서 검증(rollback 비용 < 추측 비용). Sprint 70-6에서는 Plan agent가 옵션 5가지를 제시 → PM이 옵션 C 선택 → 그 후 sample 진행 → 만족 → Phase 2. 옵션 단계에서 PM 의도를 명확히 한 게 핵심.

## Metrics
- AlgoSu Commits: 11건 (49b719a..bcd85ff 사이)
- aether-gitops Commits: 3건 (552c39e cloudflared 편입, bb0f182 태그 고정, 자동 배포 갱신 다수)
- Files changed: blog 영역 ~25 파일 (신규 컴포넌트 8 + mdx 6 + 인프라 4 + lock 등)
- 블로그 plain ASCII fenced block: 36 → **0** (6편 전체)
- 신규 React 컴포넌트: 11개 (Sprint 70-5 7개 + Sprint 70-6 4개)
- 신규 의존성: 2개 (mermaid 11.14.0, lucide-react 1.8.0 — dynamic + tree-shaken)
- CI 통과: 70-5 sample, 70-6 P1, 70-6 P2 총 3 push 모두 all jobs success
- 운영 영향: blog.algo-su.com 무다운타임 (RollingUpdate 무중단), cloudflared in-place adopt 다운타임 0초
