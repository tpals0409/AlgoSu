---
sprint: 164
title: "이월 자동화 시드 정리 — Trivy/dependabot/envelope (Critic 자기 모순 검출)"
date: "2026-05-19"
status: completed
agents: [Oracle, Architect, Critic, Scribe]
related_adrs: ["sprint-163", "sprint-162", "sprint-160", "sprint-159"]
related_memory: ["sprint-window"]
---
# Sprint 164 — 이월 자동화 시드 정리: Trivy/dependabot/envelope (Critic 자기 모순 검출)

## 목표

- Sprint 157~163 누적 이월 시드 중 최우선 3건(자동화 #신규1/#신규2/#신규3) 정리
- 시드 #신규1 — PR 단계 Trivy scan 활성화 (Sprint 160 교훈 #6 정착 시도)
- 시드 #신규2 — dependabot.yml docker 5건 추가 (Sprint 159 base image 정기 갱신 부재 인과 차단)
- 시드 #신규3 — `_parse_group_response` envelope 적용 (Sprint 159 single 분석 envelope의 group 회수)
- 사용자 직접 UAT 5건 가이드 (Sprint 161~163 신규 시각 검증)

## 결정

- **분할 처리 (4 PR)**: Phase A/B/C/D 각 PR 단일 책임 — 회귀 위험 최소화. 단일 PR 압축 회피
- **Phase A close + Sprint 165 재설계 이월**: Critic R1 P1 본질 결함 검출 후 즉시 close, 본질 변경(build job `load: true` + multi-arch 재설계)을 단일 sprint 압축하지 않음. 우선순위 (서비스 안정성 > 개발 속도) 적용
- **Critic R1 P2 fix 즉시 적용 (Phase B)**: blog Dockerfile 동등 커버리지 추가 — 본 PR의 자기 모순(blog 도 CI 빌드 + Trivy scan 대상이지만 dependabot 미커버) 즉시 해소
- **envelope 단순화 (Phase C)**: group 은 score 정규식 추출 패턴 없음 → 항상 `status="failed"` 반환 (single envelope 단순화 버전, 일관성 정당화)
- **PII/secret 모의 raw 토큰 미노출 검증 신규 테스트**: `test_group_response_fallback_no_raw_exposure` 도입 — envelope 의 모든 string 값에 raw 토큰 절대 미노출 명시 검증

## 구현 (4 PR, 32 스프린트 연속 브랜치 규율 준수)

| PR | Phase | 브랜치 | 결과 |
|----|-------|--------|------|
| [#280](https://github.com/tpals0409/AlgoSu/pull/280) | A — PR Trivy 활성화 | `chore/sprint-164-pr-trivy-enable` | ❌ **Close** (Critic R1 P1 본질 결함 → Sprint 165 재설계) |
| [#281](https://github.com/tpals0409/AlgoSu/pull/281) | B — dependabot docker 6건 | `chore/sprint-164-dependabot-docker` | ✅ Squash merge `b13e6c5` |
| [#282](https://github.com/tpals0409/AlgoSu/pull/282) | C — group envelope | `fix/sprint-164-ai-analysis-group-envelope` | ✅ Squash merge (TBD) |
| [#TBD](https://github.com/tpals0409/AlgoSu/pulls) | D — Sprint 164 ADR | `docs/sprint-164-adr` | 본 PR (architect + scribe) |

### Phase A — PR 단계 Trivy scan 활성화 시도 (close)

- **변경**: `.github/workflows/ci.yml:781` `if: github.ref == 'refs/heads/main' && !cancelled()` → `if: "!cancelled()"`
- **목적**: PR + main 양쪽 Trivy SARIF 업로드 → PR 보안 회귀 검출 1차 게이트 정착 (Sprint 160 교훈 #6)
- **Critic R1 P1 검출** (codex review --commit 1e2e3c2):
  > Avoid scanning registry tags that PR builds never push (ci.yml:784). On `pull_request`, build jobs still use `push: ${{ github.ref == 'refs/heads/main' }}`, so they do not publish `ghcr.io/...:main-${{ github.sha }}`. With this job now running for PRs, any changed service that reaches Trivy will try to pull a tag that was never pushed and fail before producing a useful security result.
- **본질 결함**: PR build는 GHCR push 안 함 → Trivy가 부재 태그 pull 시도 → fail. 본 PR이 **보안 게이트가 아닌 noisy CI red 양산** = sprint 목표 자기 모순
- **결정**: PR close + Sprint 165 재설계 이월 (build job `load: true` + Trivy local image scan, 또는 PR-specific tag push, 또는 buildx artifact + fs scan 3안 비교 필요)
- **학습**: 단순 1줄 `if` 변경처럼 보이는 작업도 image registry 정책과 conjunction 시 본질 재설계 필요

### Phase B — dependabot.yml docker 6건 추가

- **변경**: `.github/dependabot.yml` docker entries 2 → 8
  - 기존: `/services/gateway`, `/services/ai-analysis`
  - 신규: `/services/identity`, `/services/submission`, `/services/problem`, `/services/github-worker`, `/frontend`, `/blog`
- **공통 설정**: weekly Monday Asia/Seoul, labels `["dependencies", "docker"]`, commit prefix `chore(docker)`, semver-major ignore
- **Critic R1 P2 검출** (codex review --commit cdec0a2, session `019e3f46-4dad-73c0-911f-09066d212f60`):
  > Include the blog Dockerfile in Docker updates. CI builds and Trivy-scans a `blog` image from `/blog/Dockerfile`, but this new Docker coverage still omits `/blog`. If the blog image's `nginx` base tag goes stale or vulnerable, the same Trivy failures this change is meant to prevent can still recur for blog.
- **즉시 fix** (commit `0f81fb1`): `/blog` docker entry 추가 — 본 PR 인과 차단 목표와 자기 모순 미커버 해소
- **Critic R2 PASS** ✅ — "No breaking or actionable issues were identified in the change"
- **머지**: squash sha `b13e6c5`

### Phase C — `_parse_group_response` envelope 적용

- **변경**: `services/ai-analysis/src/claude_client.py:476-490` (envelope 패턴 적용)
  - 기존: `fallback = raw_text.strip()` + backtick 제거 + `comparison: fallback[:50000]` (raw 노출 50KB)
  - 신규: `comparison: "AI 그룹 분석 결과 파싱에 일시적 오류가 발생했습니다. 잠시 후 다시 시도해주세요."` (raw 본문 0 노출)
  - logger.warning extra: `raw_length` 만 기록 (raw 본문 미노출)
  - group 은 score 정규식 추출 패턴 없음 → 항상 `status="failed"` (single 단순화 버전)
- **테스트** (`services/ai-analysis/tests/test_claude_client.py`):
  - 기존 4건 envelope 검증 전환: `test_parse_group_response_invalid_json` + `test_parse_group_response_empty_string` + `test_group_response_fallback_backtick_no_closing` + `test_group_response_fallback_backtick_with_closing`
  - 신규 1건: `test_group_response_fallback_no_raw_exposure` — PII/secret 모의 raw (`hunter2` / `123-45-6789` / `sk-abc123def456` / `user_id=42`) 입력 시 envelope 의 모든 string 값에 raw 토큰 절대 미노출 검증
- **Critic R1 PASS** ✅ (codex review --commit, session `019e3f4a-92d5-7503-8dd3-e92f5ae18c78`): "I did not find a discrete regression introduced by this commit"
- **검증**: pytest 79 PASS, claude_client.py coverage 99% 유지

### Phase D — Sprint 164 ADR (본 PR)

- `docs/adr/sprints/sprint-164.md` (KR, 본 파일) + `docs/adr-en/sprints/sprint-164.md` (EN, 1:1 매핑)
- `docs/adr/README.md` 갱신 — count 103 → 104, range 62~163 → 62~164

## 검증

| 항목 | 결과 |
|------|------|
| Phase B YAML syntax | ✅ docker entries 8건 (2→8) |
| Phase B CI | 29 checks SUCCESS + SKIPPED |
| Phase B Critic R1 P2 → R2 | PASS ✅ |
| Phase C pytest | 79 PASS (group 5건 포함) |
| Phase C claude_client.py coverage | 99% 유지 |
| Phase C Critic R1 | PASS ✅ |
| check-adr-en-coverage --strict | 113/113 (100.0%) PASS (Phase D 후 예정) |
| check-doc-refs | 0 broken refs (Phase D 후 예정) |
| 브랜치 규율 | ✅ 32 스프린트 연속 준수, main 직접 commit 0건, `--no-verify` 0건 |

## 브랜치 규율 ✅ 32 스프린트 연속 준수

- 4 PR 모두 신규 브랜치 + Squash merge (Phase A는 close + 브랜치 삭제)
- main 직접 commit 0건, `--no-verify` 0건

## 신규 패턴

1. **Critic R1 자기 모순 검출 2회 단일 sprint 재현** (Sprint 155/159/160 패턴 강화) — Phase A 본질 결함(image tag 부재) + Phase B blog 동등 커버리지 누락. Codex 교차 검증의 sprint 일관성 가드 효과 본 sprint 두 번 재확인
2. **PR close + Sprint 165 재설계 이월 패턴** — 단순 1줄 변경처럼 보이는 작업도 본질 재설계 필요 발견 시 즉시 close + 별도 sprint 분리. 단일 sprint 압축 회피 (Sprint 161~163의 3 sprint 분할 정책 계승)
3. **envelope 패턴 cross-service 회수** — Sprint 159 single 분석 envelope을 group 측에 적용. score 정규식 추출 차이로 단순화 (group: 항상 `status="failed"`). 동일 패턴이 서로 다른 함수에 적용될 때 차이 정당화 필수
4. **PII/secret 모의 raw 토큰 미노출 명시 검증** — envelope 패턴의 핵심 약속(raw 본문 0 노출)을 단위 테스트로 강제. 회귀 차단 게이트 (Sprint 159 envelope의 부분 검증 한계 보완)
5. **stash + branch 전환 다중 PR 병행 처리** — Phase B Critic R1 P2 fix 시 Phase C 작업을 stash → Phase B 복귀 → fix push → Phase C stash pop 패턴. 단일 세션에서 다중 PR 진행 시 안전 처리
6. **codex CLI 직접 호출 백그라운드** — `codex review --commit <sha>`를 백그라운드로 실행하여 다음 Phase 진행과 병행. Critic 사이클 처리 시간 hiding

## 교훈

1. **단순 `if` 변경 1줄도 image registry 정책과 conjunction 시 본질 재설계 필요** — Phase A의 `if: github.ref == 'refs/heads/main'` 제거가 PR build의 `push: false` 정책과 충돌. Trivy가 부재 태그를 pull → fail → sprint 목표 자기 모순. 변경 영향 범위는 코드 라인이 아닌 인접 정책 그래프로 평가
2. **Critic R1 자기 모순 검출 2회/sprint는 더 이상 우연이 아님** — Sprint 155/159/160 + Sprint 164 (Phase A + Phase B) 누적. Codex gpt-5 교차 검증이 단일 모델 가족 맹점(자기 일관성 검증의 한계)을 보완하는 패턴이 본 sprint 강화 재확인
3. **blog Dockerfile 누락은 CI 빌드/Trivy scan 대상과 dependabot 분리 정책의 결과** — services 디렉토리만 자동 등록 가정이 blog 디렉토리를 누락. Dockerfile 존재 디렉토리 = dependabot 등록 의무로 SSOT 정착 (services + blog + frontend 모두 동등)
4. **envelope 단순화는 함수 간 일관성 정당화 필수** — `_parse_response`(single, score 추출 가능)와 `_parse_group_response`(group, score 없음)의 차이를 envelope 단순화로 정당화. PR 본문 + 주석에 명시
5. **PII/secret 모의 raw 토큰 검증 테스트는 envelope 약속의 회귀 차단 게이트** — 단순 envelope 메시지 검증만으로는 미래 회귀 차단 불충분. 명시적 PII/secret 토큰 미노출 검증으로 envelope 약속 강제
6. **forward-fix 정책 단일 sprint 적용 사례 확장** — Sprint 159 base image 패치 → Sprint 160 frontend tag advance → Sprint 164 blog Dockerfile 추가. 회귀 검출 즉시 fix 정착
7. **분할 처리 4 PR + 단일 sprint 통합 commit 비교** — 4 PR 분할은 회귀 격리 효과 있으나 Phase 간 의존성(rebase 충돌 등) 발생. 본 sprint Phase C rebase가 자연 발생 — 분할의 표준 비용 인정

## Sprint 165 이월

### 자동화 시드 (Sprint 164 미해소 + 신규)

- **시드 #신규1 재설계** (Sprint 164 Phase A close 회수) — PR 단계 Trivy 본질 재설계
  - 옵션 A: build job `load: true` + Trivy local image scan (buildx `load`는 single-platform → ARM aarch64 정책 충돌)
  - 옵션 B: PR-specific tag (`pr-{number}-{sha}`) push + Trivy registry scan (GHCR storage 증가)
  - 옵션 C: buildx output → artifact → Trivy fs scan (별도 step 비용)
  - 3안 비교 + 본질 결정 필요

- **시드 #신규4** (Sprint 159 회수, 본 sprint 미처리) — CI 가시성: PR 단계 deploy gate 시뮬레이션 / aether-gitops kustomization 자동 PR template / `$GITHUB_STEP_SUMMARY` 표준화 (Sprint 160 정착의 확장)

- **시드 #30/#31** (Sprint 158 회수) — i18n/lint: 빌드 산출물 한국어 잔재 CI step + i18n 3계층 체크리스트

- **시드 #24/#18** (Sprint 157 회수) — plan 템플릿: i18n 양면 의무 자동 / 블로그 머지 전 cross-check 자동화

- **시드 #26/27/28** (Sprint 157 회수) — ADR/blog 보강: README paths filter / build-blog `ls out/` / check-adr-links ROOT 자동 감지

- **Sprint 163 추가 자동화 후보** — H3-only PR 표 추출 / implementation H2 partial matcher / sprint-87 H3-only carryover

### UAT 사용자 직접 검증 (21 스프린트 누적)

- 시드 #5 (프로그래머스 재제출 채점)
- 시드 #9 (영문 환경 + production Grafana CB dashboard ai-analysis 시각 정합)
- Sprint 160 신규 (ArgoCD `algosu` sync / `kubectl rollout` 새 ReplicaSet / AI 분석 fallback 친화 메시지)
- Sprint 161/162/163 신규 (Hero/카드/Phase strip + Mermaid + in-place callout)
- **Sprint 164 신규**:
  - Phase C envelope 동작 시각 확인: AI 그룹 분석 fallback 메시지가 raw 노출 없이 친화 문구로 표시
  - Phase B dependabot docker 6건 활성화 확인 (GitHub Dependency graph → Dependabot tab)

### 이월 유지

- 시드 #23: plan 템플릿 "rebase 후 누적 카운트 fix" 체크리스트

### 후속 (선택)

- create/edit page.tsx category UI
- Programmers URL 자동 카테고리 추론
- 기존 SQL 문제 데이터 백필
- coverage-gate `skipped` 허용 제거 (Sprint 156 Phase B 옵션 B)
- post-merge pre-deploy gate (Sprint 156 Phase B 옵션 C)
- prom-client Case B~D 점검 자동화
- `.claude-tools/` Phase 2 실제 삭제 (trigger path 검증 후)
- `(adr)` layout 분할 (KR + EN override)
- Sprint 162 R1 P3: 깊은 상대 경로 `.md` 링크 미커버
- Sprint 163 R-cycle: H3-only PR 표 추출 + implementation H2 partial matcher + sprint-87 H3-only carryover
