---
sprint: 73
title: "보안 핫픽스 + 블로그 시각 이월 클로저 (Sprint 70~72 이월 7건 병렬 처리)"
date: "2026-04-10"
status: completed
agents: [Oracle, Herald, Librarian, Palette, Gatekeeper, Scout, Scribe]
related_adrs: [sprint-72.md, sprint-71.md]
---

# Sprint 73: 보안 핫픽스 + 블로그 시각 이월 클로저

## Context

Sprint 70부터 72까지 세 스프린트에 걸쳐 각각의 주 목표(시각자료 풍부화, 세션 수명 버그 수정, 블로그 디자인 폴리싱)를 달성했으나, 매 스프린트마다 범위 외 관측 사항이 MEMORY.md의 "후속 처리 필요 (비차단)" 섹션으로 누적되어 항목 수가 비대해진 상태였다. 특히 **Sprint 70 작업 중 발견된 `/root/aether-gitops/.git/config`의 GitHub PAT(`ghp_*`) 평문 노출**은 긴급도가 명확함에도 불구하고 30일 가까이 방치되어, 보안 블로커로 승격되어야 할 시점이었다.

Oracle이 착수 전 MEMORY.md 재조사를 수행한 결과, "후속 처리 필요" 섹션에 **4건이 이미 해결된 stale 항목**으로 남아 있음이 드러났다:

1. `nginx try_files 패턴 보강` — Sprint 70 G3 이후 실제 `blog/nginx.conf`에 이미 반영됨
2. `Sealed Secret JWT_EXPIRES_IN 레거시 값(7d) 정리` — Sprint 71 D1에서 Deployment env override로 덮어써 해결됨
3. `기존 사용자 GitHub 토큰 재연동` 런북 — 구현 완료분인데 "필요" 항목으로 잔존
4. Swagger/OpenAPI 문서화 — 이미 전 서비스 적용됨에도 보류 항목으로 잔존

이에 PM은 "하이브리드 — 보안 핫픽스 + 블로그 이월 마무리" 승인으로 방향을 확정. Oracle은 7개 작업이 파일 수준에서 서로 독립적임을 근거로 **병렬 위임 전략**을 채택했다: Phase A는 Herald(73-1~3 보안·인프라) + Librarian(73-4 MEMORY 정리)을 동시 위임, Phase B는 Palette(73-5~7 블로그 시각 이월)를 단일 세션으로 위임. 각 Phase 종료 직후 구현 세션과 **분리된** 검증 세션(Gatekeeper for Phase A, Scout for Phase B)을 다시 병렬로 돌려, 자기 보고 검증의 한계를 상쇄했다.

결과적으로 본 스프린트는 Sprint 72에서 검증된 "Oracle → Palette + Scout 합동 평가" 패턴을 보안 영역으로 확장한 사례이자, **구현과 검증을 세션 수준에서 분리**한 첫 사례다.

## Decisions

### D1: 병렬 위임 전략 — 구현 에이전트와 검증 에이전트 분리

- **Context**: Sprint 72에서는 단일 Palette 세션으로 순차 진행했는데 72-3 시점에 사전 조사 누락이 드러나 재작업이 발생했다. 또한 구현 세션 자체가 "자체 검증"까지 겸하다 보니 확증 편향 위험이 상존. 본 스프린트는 7건이 파일 수준에서 독립적이라 병렬화 가능한 조건을 갖춤.
- **Choice**: Herald(73-1~3), Librarian(73-4), Palette(73-5~7) **3개 구현 세션을 동시 위임**. 각 세션이 커밋·간단 grep 수준의 자체 점검을 끝내면, Phase 종료 직후 Gatekeeper(Phase A 보안 검증)와 Scout(Phase B 사용자 관점 검증) **2개 검증 세션을 병렬 위임**. 검증 세션은 구현 세션과 **독립적으로** 동일 작업을 재grep/재빌드/재secret-scan/재ArgoCD 조회하여 보고 신뢰성을 교차 검증. Oracle은 오케스트레이션만 담당.
- **Alternatives**: (A) 단일 세션 순차 처리 — 느림 + 동일 컨텍스트 내 자기 검증 한계 / (B) 구현 에이전트에게 "셀프 검증 강화" 지시 — 확증 편향 근본 해결 아님
- **Code Paths**: N/A (오케스트레이션 패턴)
- **Note**: `memory/feedback_design_workflow.md` D1의 "Palette + Scout 합동 평가"를 보안 영역으로 확장한 형태. P2에 일반화된 패턴으로 기록.

### D2: git credential helper = gh CLI 통합 (73-1)

- **Context**: `/root/aether-gitops/.git/config`에 GitHub PAT(`ghp_*`)가 `https://<token>@github.com/...` 형태로 평문 박힘. Sprint 70 작업 중 발견되었으나 30일 방치. 서버 백업·쉘 히스토리·로그에 동일 토큰이 잔존할 가능성도 있음.
- **Choice**: `git config --global credential.helper '!gh auth git-credential'` — 이미 서버에 설정된 gh CLI 인증(scope: repo, workflow, admin:org)을 재사용하여 **파일 시스템 평문에 토큰을 남기지 않음**. 이후 `git remote set-url origin https://github.com/tpals0409/aether-gitops.git`로 기존 URL에서 토큰 세그먼트를 제거. fetch/push/pull 모두 gh CLI credential helper를 경유.
- **Alternatives**:
  - (A) `git config credential.helper store` + `~/.git-credentials` — 여전히 평문 파일 생성, 근본 치료 아님
  - (B) git-credential-manager 별도 설치 — 추가 의존성, 유지보수 비용
  - (C) SSH 전환 — 기존 HTTPS clone 경로 재구성 비용 + gh CLI와의 일관성 상실
- **Code Paths**: `/root/aether-gitops/.git/config`, server-level `~/.gitconfig`
- **Note**: `--global` 범위라 서버 내 **모든 git 레포**가 동일 helper 공유. 기존 local override 없어 충돌 없음 (Gatekeeper 확인). AlgoSu 소스 레포도 동일 helper 사용. G2 참조.

### D3: sealed-gateway-secrets SSoT = `sealed-secrets/` 서브디렉토리 (73-3)

- **Context**: aether-gitops 레포에 `algosu/base/sealed-gateway-secrets.yaml`(33키, **orphan**)과 `algosu/base/sealed-secrets/sealed-gateway-secrets.yaml`(35키, kustomization에서 참조)이 공존. Sprint 71 Herald 71-3에서 발견되어 보류 항목으로 등록됨.
- **Choice**: 참조되는 쪽이 orphan의 상위집합임을 diff로 확인 (35키 ⊇ 33키, 추가 2키는 `GITHUB_TOKEN_ENCRYPTION_KEY`, `INTERNAL_API_KEY`). 내용 손실 없음을 검증한 후 orphan 파일을 `git rm`. **`sealed-secrets/` 서브디렉토리**가 AlgoSu sealed secret의 단일 SSoT로 확정.
- **Alternatives**:
  - (A) 두 파일 모두 유지하고 kustomization에서 양쪽 참조 — 관리 혼동 + kubeseal 재봉인 시 이중 작업 필요
  - (B) 상위 디렉토리(`algosu/base/`)로 통일 — 기존 참조가 `sealed-secrets/` 하위라 역방향 이동이 더 위험
- **Code Paths**: `aether-gitops/algosu/base/kustomization.yaml` (L49 참조 유지), `aether-gitops/algosu/base/sealed-secrets/sealed-gateway-secrets.yaml` (SSoT)
- **Note**: 향후 Sealed Secret 추가 시 모두 `sealed-secrets/` 하위에 배치. Herald/Librarian 가이드라인으로 진입.

### D4: cloudflared 관리 경계 = aether-gitops 단독 (73-2)

- **Context**: `/root/AlgoSu/infra/k3s/kustomization.yaml`이 존재하지 않는 `cloudflared.yaml`을 참조하여 `kubectl kustomize` 경고 발생. 실제 런타임 cloudflared Pod는 `aether-gitops/algosu/base/cloudflared.yaml`이 관리 중(ArgoCD tracking-id 라벨로 확인). 동시에 어디서도 참조되지 않는 `cloudflare-tunnel-token` Secret이 클러스터에 잔존(실제 사용 Secret은 `cloudflared-token`).
- **Choice**: AlgoSu 소스 레포의 kustomization에서 `cloudflared.yaml` 참조 라인을 주석 처리하고 **"cloudflared는 aether-gitops에서만 관리"**라는 경계를 주석으로 명시. 더불어 고아 Secret `cloudflare-tunnel-token`을 `kubectl delete secret -n algosu cloudflare-tunnel-token`으로 정리.
- **Alternatives**: 소스 레포에 cloudflared 매니페스트 복원 — GitOps 이중 소스 혼동 위험. 원칙: "인프라 런타임 = aether-gitops, 소스 = AlgoSu"
- **Code Paths**: `infra/k3s/kustomization.yaml` L32 (주석 처리), `aether-gitops/algosu/base/cloudflared.yaml` (SSoT)
- **Note**: Sprint 70에서 cloudflared를 aether-gitops로 GitOps 편입할 때 소스 레포 kustomization의 참조를 동시에 정리하지 않아 4주간 고아 참조 잔존. G4 교훈 참조.

### D5: 블로그 다크모드 진입점 — next-themes + hydration 가드 (73-6)

- **Context**: Sprint 72에서 `:root`/`.dark` CSS variable 완전 대응을 마쳤으나 **토글 진입점이 부재**하여 사용자가 다크모드를 활성화할 수 없음. Sprint 72 자산이 사용자에게 도달하지 못하는 상태.
- **Choice**: `next-themes@0.4.6` 도입. `theme-provider.tsx` Client Wrapper 신설(`attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`). `theme-toggle.tsx` 신설 — `useEffect` mounted 가드 + 동일 크기 placeholder로 SSR hydration CLS 0. `<html lang="ko" suppressHydrationWarning>` 속성 추가하여 서버/클라이언트 `class` 불일치 경고 제거. 토글 버튼은 Sprint 72 G4(전역 `button:focus-visible` ring) 자동 계승.
- **Alternatives**: 커스텀 토글 — `localStorage` + `matchMedia` 직접 구현 시 flash/hydration 이슈 해결 비용이 next-themes 의존 비용을 초과
- **Code Paths**: `blog/src/components/theme-provider.tsx`, `blog/src/components/theme-toggle.tsx`, `blog/src/app/layout.tsx`, `blog/package.json`
- **Note**: **Scout Suggestion** — 현재 light↔dark 2-way만 지원. "system 복귀" 경로 부재 → 사용자가 OS를 dark로 쓰는데 블로그를 light로 고정 후 "시스템 추적"으로 돌아가려면 localStorage 수동 삭제 필요. 3-way 토글(system→light→dark)을 차기 이월로 등록.

### D6: 포스트 네비게이션 시간축 의미론 — older/newer (73-7)

- **Context**: 포스트 상세 하단에 "이전/다음 글" 네비게이션을 도입할 때, 레이블과 배열 인덱스를 어떤 시간축 의미론에 매핑할지 결정 필요.
- **Choice**: `getAllPosts()`가 date desc로 반환하므로 배열 인덱스 기준 `posts[i-1]`이 **더 최신**(newer), `posts[i+1]`이 **더 과거**(older). Palette는 "← 이전 글 = older, 다음 글 → = newer"로 구현. 레이아웃은 `sm:grid-cols-2` 반응형. 첫/마지막 포스트는 `aria-hidden` placeholder로 그리드 유지. 카드 토큰은 PostCard와 동일(`bg-surface`, `border-border`, `shadow-sm`, `hover:-translate-y-0.5`, `hover:border-brand`)하여 Sprint 72 P3(다축 호버) 계승.
- **Alternatives**: 목록(date desc) 시각 위치 기준(위쪽=최신=이전) — 독자 스크롤 관성과 일치하나 시간축 순서와 반대 → 용어 혼란
- **Code Paths**: `blog/src/app/posts/[slug]/page.tsx` L57-106
- **Note**: **Scout Suggestion** — 레이블을 "새 글 → / ← 지난 글" 어휘로 전환하거나 좌우 스왑하여 "목록 위치"와 "시간축"을 일치시키는 대안은 UX 기획 결정 사항이므로 PM 판단 대기(차기 이월).

## Patterns

### P1: shadow 일관성 완성 — Sprint 72 D7 연속 (73-5)

- **Where**: `blog/src/components/blog/{pipeline,tier-stack,tier-matrix,mermaid,kv}.tsx`
- **When to Reuse**: Sprint 72에서 4종(Callout/MetricCard/ServiceCard/ArchService)에 `shadow-sm` 적용 + 2종(PhaseTimeline/HierarchyTree) 기존 보유로 6종 커버리지에 머물렀다. Sprint 73에서 나머지 5종(Pipeline/TierStack/TierMatrix/Mermaid/KV)에 `shadow-sm`을 추가하여 **시각 컴포넌트 11종 100% 커버리지 완성**. 실측 `blog/src/` 내 `shadow-sm` 총 **15건**(컴포넌트 12 + post-card 1 + 73-7 포스트 네비 카드 2), `shadow-md` 5건(hover 전환 3 + phase-timeline/architecture-map 정적 아이콘 2), `shadow-lg`+ 0건. 패턴 적용 시에는 (a) 라이트 모드 전용 깊이감으로 받아들이고 다크모드는 border 명도 차로 분리감 확보(Sprint 72 G2), (b) 기존 `border-border` 토큰과 조합, (c) hover 시 shadow-md 전환은 인터랙티브 카드에만 국한하고 정적 시각 자료는 `shadow-sm` 고정.
- **Note**: Palette 자체 보고는 shadow-sm 13건/shadow-md 3건으로 기재되었으나 73-7 네비 카드 2건 신규 추가분이 73-5 시점 집계에 반영되지 않은 단순 오차였다. Scout 검증(V2-1)에서 정정되어 실측 15/5로 확정 — D1 독립 검증의 가치 입증.

### P2: 구현 에이전트 + 독립 검증 에이전트 2단계 패턴

- **Where**: 본 스프린트 전체 오케스트레이션
- **When to Reuse**: 다건 병렬 작업(3건 이상) + 작업 간 파일 독립성이 확보된 경우. 구현 세션은 "자체 점검" 수준(커밋 + 간단 grep + 빌드 1회)까지만 수행하고, 검증 세션은 동일 파일을 **독립적으로** 재조사(grep 수치 재검증, 빌드 재실행, secret 재grep, ArgoCD 상태 재조회). 자기 보고 검증의 한계를 상쇄. 본 스프린트에서 Scout가 Palette 집계 오차 발견(P1 Note), Gatekeeper가 Sprint 71 잔재 커밋 동반 푸시 보안 판정(G1) — 두 사례 모두 검증 분리가 없었다면 놓쳤을 지점. 디자인 영역(Sprint 72 D1)에서 시작된 2-track 평가 패턴을 보안/인프라 영역으로 확장한 일반화.

## Gotchas

### G1: rebase 시 로컬 미푸시 커밋 동반 푸시

- **Symptom**: 73-3 작업 중 aether-gitops push가 `non-fast-forward`로 거절됨 (원격이 ArgoCD auto-deploy 커밋 3건 앞섬). `git pull --rebase` 후 `git push`로 처리했는데, 이 과정에서 로컬에 대기 중이던 **Sprint 71 커밋 2건**이 의도치 않게 동반 푸시됨:
  - `0ed90ec` — `JWT_EXPIRES_IN` 7d → 2h (Sprint 71 D1)
  - `41ed986` — SessionPolicy env 4개 추가 (Sprint 71 D6)
- **Root Cause**: Sprint 71 종료 시점에 해당 2건이 aether-gitops에 푸시되지 않은 채 로컬에만 존재했고, 4주간 아무도 감지하지 못함. Sprint 71 release hygiene 절차에 "원격 동기화 확인" 단계 부재.
- **Fix**: Gatekeeper가 동반 푸시 직후 보안 판정 수행 → **ACCEPT**. 근거:
  - (a) 두 커밋 모두 평문 토큰·시크릿 노출 0건
  - (b) JWT 수명 단축(7d → 2h)은 보안 강화 방향이며 기획값과 일치
  - (c) SessionPolicy env 추가는 Sprint 71 D6 설계에 부합하는 의도된 정책 값
  - (d) gateway Pod rolling update 발생 후 `2/2 Running` 안정화 확인
- **Lesson**: Sprint 종료 체크리스트에 `git -C /root/aether-gitops log @{upstream}..HEAD` 확인 단계 필수. 로컬 미푸시 커밋이 있으면 그 자리에서 처리하거나 명시적으로 다음 Sprint 범위에 포함시켜야 함. `/stop` 커맨드 체크리스트 보강 검토.

### G2: `git config --global` credential helper 변경의 범위

- **Symptom**: 73-1에서 `credential.helper`를 global 범위로 변경한 결과, 서버 내 모든 git 레포(`/root/AlgoSu`, `/root/aether-gitops` 등)가 동일 helper를 공유하게 됨. 작업 시점에 local override가 없어 무중단이었으나, 향후 서비스별로 별도 credential을 요구하는 레포가 추가되면 충돌 가능.
- **Root Cause**: "이 서버의 PAT 위생 작업"이 실제로는 "이 서버의 모든 git 레포 인증 경로 변경"으로 확장되는 범위 오해 가능성.
- **Fix**: 작업 전 Gatekeeper가 `git config --get-all credential.helper`로 기존 설정 부재를 확인했고, 실제 변경 후 AlgoSu 소스 레포의 fetch/push가 무중단임을 검증. gh CLI 인증이 유지되는 한 모든 레포가 자동 동작.
- **Lesson**: `--global` credential helper 변경은 "서버 단위 보안 정책"으로 선언하고 문서화할 것. 향후 별도 helper가 필요한 레포가 생기면 `git config --local credential.helper` override로 대응. 본 변경은 의도된 보안 강화이므로 되돌리지 않음.

### G3: `next-mdx-remote` high-severity 취약점의 실질 exploitable 부재

- **Symptom**: 73-6 작업 중 `npm audit` 실행 결과 `next-mdx-remote@4.x-5.x` CWE-94 **arbitrary code execution** (CVSS 8.8) high-severity 경보. 빌드 게이트를 걸면 즉시 차단해야 하는 수준의 점수.
- **Root Cause**: `next-mdx-remote`의 runtime MDX 컴파일 경로가 악의적 MDX 입력에 대해 arbitrary code execution을 허용한다는 CVE.
- **Fix**: Scout 분석 — AlgoSu 블로그는 **빌드 타임 정적 export**(`next build` → `out/`) + `getAllPosts()`가 레포 내부 `content/adr/*.mdx`만 읽음. **사용자 입력 MDX 경로 없음** → 실질 exploitable 시나리오 부재. 공격 표면 = "악의적 MDX 파일을 레포에 커밋할 수 있는 사람"으로 한정 → 이미 write 권한 == 코드 실행 가능자와 동치이므로 CVE가 새로운 권한을 부여하지 않음. 본 스프린트에서는 이월 처리.
- **Lesson**: CVSS 점수만 보고 판단하지 말 것. 애플리케이션의 **실제 공격 표면**(사용자 입력 경로, 런타임 vs 빌드 타임)을 기준으로 실질 exploitability를 평가해야 한다. 단, 의존성 위생 차원에서 `next-mdx-remote@6.0.0` major 업그레이드는 별도 스프린트로 이월(import API 변경 가능성 + `renderMdx` 래퍼 마이그레이션 검증 필요).

### G4: 인프라 경계 정리는 양쪽 레포를 동시에 다뤄야 함

- **Symptom**: 73-2에서 `/root/AlgoSu/infra/k3s/kustomization.yaml`이 존재하지 않는 `cloudflared.yaml`을 참조하여 `kubectl kustomize`가 경고를 내뿜는 상태를 정리. 원인은 Sprint 70 cloudflared GitOps 편입 작업 시 aether-gitops에는 매니페스트를 추가했으나 **AlgoSu 소스 레포 kustomization의 기존 참조를 제거하지 않음** → 4주간 고아 참조 잔존.
- **Root Cause**: 인프라 매니페스트 이관 작업이 "어디로 가는가"(aether-gitops 추가)만 의식하고 "어디서 떠나는가"(AlgoSu 소스 레포 정리)를 체크리스트에 포함하지 않음. 두 레포를 동시에 조작하지 않으면 한쪽이 stale 참조로 남기 쉬움.
- **Fix**: 73-2에서 비로소 소스 레포 kustomization 주석 처리 + 고아 Secret `cloudflare-tunnel-token` 삭제.
- **Lesson**: 인프라 매니페스트를 aether-gitops로 이관할 때 소스 레포 kustomization 정리를 **동일 PR/커밋 단위로 처리**. Herald/Scout의 GitOps 편입 런북에 "양쪽 레포 동기 정리 체크리스트" 반영 요망. MEMORY.md 후속 처리에 런북 보강 항목 등록.

## Metrics

- **작업 수**: 7건 구현 + 2건 검증 + 1건 ADR = 10건
- **Commits (AlgoSu)**: 4건
  - `0194d79` chore(infra): kustomization cloudflared 참조 주석 처리 + 고아 Secret 정리 (73-2)
  - `6657034` style(blog): 시각 컴포넌트 5종 shadow-sm 적용 — 11종 커버리지 완성 (73-5)
  - `0c250bf` feat(blog): next-themes 기반 다크모드 토글 도입 (73-6)
  - `84ec85b` feat(blog): 포스트 상세 하단 이전/다음 글 네비게이션 (73-7)
  - (+ 본 ADR 커밋 1건 예정)
- **Commits (aether-gitops)**: 1건 (`c041fe7` — 73-3 sealed-gateway-secrets orphan 삭제) + Sprint 71 잔재 동반 2건(`0ed90ec`, `41ed986` — G1)
- **Files changed (AlgoSu)**: 블로그 10여 개 + `infra/k3s/kustomization.yaml` 1개
  - 블로그 컴포넌트 (5): `blog/src/components/blog/{pipeline,tier-stack,tier-matrix,mermaid,kv}.tsx`
  - 블로그 신규 (2): `blog/src/components/theme-provider.tsx`, `blog/src/components/theme-toggle.tsx`
  - 블로그 변경 (3): `blog/src/app/layout.tsx`, `blog/src/app/posts/[slug]/page.tsx`, `blog/package.json` (+`package-lock.json`)
  - 인프라 (1): `infra/k3s/kustomization.yaml`
- **Files changed (aether-gitops)**: 1 삭제 (`algosu/base/sealed-gateway-secrets.yaml`)
- **MEMORY.md**: 81행 → 77행 (stale 4건 삭제 + 후속 5건 추가 + PAT bullet 교체)
- **shadow 커버리지**: 블로그 시각 컴포넌트 **11/11 (100%)** — Sprint 72 4/11 → Sprint 73 완결
- **shadow-sm 실측**: 15건 (컴포넌트 12 + post-card 1 + 포스트 네비 카드 2)
- **shadow-md 실측**: 5건 (hover 전환 3 + 정적 아이콘 2), **shadow-lg+ 0건**
- **기준선 유지 (grep 0건)**: `text-gray-` / `border-gray-` / `bg-[#` / `text-[#` / `border-[#` / `style={{`
- **빌드**: `cd blog && npm run build` 성공 (10 static pages, First Load JS 103KB 유지)
- **ArgoCD**: algosu app `Synced` + `Healthy`, revision `c041fe7...`
- **병렬 실행**: 구현 3 세션 + 검증 2 세션 동시 (Phase A: Herald+Librarian+Gatekeeper, Phase B: Palette+Scout)
- **신규 외부 의존**: 1건 (`next-themes@0.4.6`)
- **신규 토큰 정의**: 0건 (기존 토큰 재사용 100%)

## Related

- **Sprint 72 ADR** — D1(Palette+Scout 합동 평가), D6(prose 커스터마이즈), D7(shadow 일관성 4/11), G1(inline style 우회), G2(다크 shadow 약화), G4(내용 vs 디자인 경계)의 연속. 본 스프린트의 D1(P2)은 Sprint 72 D1을 보안/인프라로 확장, 73-5는 Sprint 72 D7을 11/11로 완결.
- **Sprint 71 ADR** — G1의 잔재 커밋 2건(`0ed90ec` JWT_EXPIRES_IN, `41ed986` SessionPolicy env)이 71-3/71-3R에서 유래. Sprint 71 종료 시 release hygiene에서 놓친 aether-gitops 미푸시 사항이 73-3 rebase 과정에서 귀속.
- **Sprint 70 ADR** — G4의 cloudflared GitOps 편입 시점(73-2의 고아 참조 원인), 73-1의 PAT 평문 노출 최초 발견 지점.
- `memory/feedback_design_workflow.md` — D1 패턴 확장 근거. 본 스프린트 P2는 동일 패턴의 보안/인프라 일반화.
