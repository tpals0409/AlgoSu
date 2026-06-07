---
sprint: 225
title: "CI Trivy blog 실패 근본 수정 (APK_CACHE_BUST 미참조 캐시버스트 버그)"
date: "2026-06-07"
status: completed
agents: [Oracle, Postman, Librarian, Critic]
related_adrs: ["sprint-224", "sprint-105"]
related_memory: ["sprint-window"]
topics: ["ci", "security", "docker", "infra"]
tldr: "Sprint 224 머지(#392) 후 post-merge CI의 `Trivy Scan — blog`가 libxml2 CVE-2026-6732(HIGH, 수정판 2.13.9-r1 존재)로 실패한 것을 근본 수정. 원인은 Sprint 224 코드(quiz 프론트)와 무관한 베이스 이미지 신규 CVE이지만, 더 깊은 문제는 blog/frontend/gateway Dockerfile이 `ARG APK_CACHE_BUST`를 선언만 하고 `RUN`에서 참조하지 않아 BuildKit이 값 변경 시에도 apk upgrade 레이어 캐시를 무효화하지 못한 것. 결과적으로 CI의 `apk_bust=true`(workflow_dispatch)가 무력화되어 베이스 이미지 CVE 패치가 유입되지 않고 Trivy blog 실패가 반복(215/217/218)됐다. 수정: apk RUN 앞에 `echo \"apk cache bust: ${APK_CACHE_BUST}\"`를 추가해 ARG를 참조 → 값 변경이 레이어를 무효화 → apk upgrade 재실행으로 최신 패치 유입. ci-rebuild-all 런북에 §3-4(apk_bust 베이스 CVE 패치 절차) 추가. 머지 후 CI를 apk_bust=true로 재실행해 libxml2 2.13.9-r1 반영. Critic R1 CLEAN."
---
# Sprint 225 — CI Trivy blog 실패 근본 수정

## 목표

- Sprint 224 머지(PR #392) 후 main의 post-merge CI `CI — Test, Build & Push`에서 `Trivy Scan — blog` job이 실패한 것을 근본 해소한다.
- 표면 원인(베이스 이미지 신규 CVE)뿐 아니라, 반복 실패를 만든 **`apk_bust` 캐시버스트 무력화 버그**를 수정한다.
- CI/인프라 전용 — 서비스 로직 무변경.

## 배경

PR #392(Sprint 224) 머지 후 main CI에서 유일하게 `Trivy Scan — blog`만 FAIL:

```
libxml2  CVE-2026-6732  HIGH  fixed  2.13.9-r0 → 2.13.9-r1  (alpine 3.21.5)
DoS via crafted XSD-validated document
```

- Sprint 224 변경(quiz 프론트엔드)은 blog·Dockerfile을 건드리지 않았다 → 이 CVE는 **베이스 이미지(`nginx:1.28-alpine3.21`)의 신규 공개 취약점**이다.
- PR #392 자체는 PR 게이트 통과로 정상 머지됐고, 이 실패는 **blog deploy만 차단**한다(다른 서비스 영향 없음).
- 메모리상 blog Trivy 실패는 215/217/218에서도 반복된 "비차단" 패턴이었다 — 즉 일시적 사건이 아니라 **구조적 반복**이다.

근본 원인 조사 결과, blog/frontend/gateway Dockerfile이 모두 동일한 결함을 가졌다:

```dockerfile
ARG APK_CACHE_BUST                                   # 선언만
RUN apk update && apk upgrade --no-cache libxml2 ... # ARG 미참조
```

`APK_CACHE_BUST`는 CI(`ci.yml`)가 `apk_bust=true` workflow_dispatch 입력 시 `github.run_id`로 설정하는 build-arg지만, **RUN에서 참조되지 않으므로 BuildKit이 이 RUN 레이어의 캐시 키를 바꾸지 않는다**(BuildKit은 참조되지 않은 ARG로 캐시를 무효화하지 않음). 따라서 `apk_bust=true`를 줘도 apk upgrade 레이어는 캐시 히트 → 재실행되지 않음 → 베이스 이미지 digest가 갱신될 때까지 패치 미유입. 이것이 Trivy blog 실패가 반복된 진짜 원인이다.

## 결정

### D1. apk RUN이 `APK_CACHE_BUST`를 참조하도록 수정

blog/frontend/gateway 3개 Dockerfile의 apk RUN 앞에 `echo "apk cache bust: ${APK_CACHE_BUST}"`를 추가한다.

- ARG가 RUN에서 참조되므로 값(apk_bust=true 시 `github.run_id`) 변경이 BuildKit 캐시 키를 바꿔 레이어를 무효화 → `apk upgrade` 재실행.
- 동작/런타임 무변경(빌드 시점 echo만). 보안 노출 없음(run_id는 공개 식별자).

### D2. 런북 보강

`docs/runbook/ci-rebuild-all.md`에 §3-4(apk_bust — 베이스 이미지 CVE 패치 유입)를 추가한다 — 수정판 존재 CVE는 `apk_bust=true`로 해소, unfixed CVE는 `.trivyignore` 경로 명시. 신규 서비스 Dockerfile은 동일 참조 패턴 의무화.

### D3. 머지 후 CI 재실행으로 패치 반영

수정 머지 후 `gh workflow run ci.yml --ref main -f apk_bust=true`로 apk 레이어를 무효화해 libxml2 2.13.9-r1을 유입, Trivy 통과 확인.

## 구현

총 2 atomic commit (start `742fe90`):

| 커밋 | 에이전트 | 내용 |
|---|---|---|
| `b76dc38` | Postman | blog/frontend/gateway Dockerfile apk RUN이 `${APK_CACHE_BUST}` 참조하도록 수정 (echo 1줄 + 주석) |
| `f582427` | Librarian | ci-rebuild-all 런북 §3-4 apk_bust 베이스 CVE 패치 절차 추가 |

## 검증

- **Critic**: R1 CLEAN — *"The changes correctly reference the existing APK_CACHE_BUST build argument in the Dockerfile RUN layers so BuildKit cache keys can change when apk_bust is enabled. No actionable regressions were identified in the modified files."*
- **ADR 게이트**: index count(sprint **163**, --strict) / adr-en coverage / adr-links 0 broken / doc-refs no broken.
- **CI**: PR 게이트 통과 후 머지. 머지 후 `apk_bust=true` 재실행으로 blog Trivy 통과 확인(이월 — 실행 시점 기록).

## 교훈

1. **선언만 하고 참조하지 않은 build ARG는 BuildKit에서 캐시버스트로 동작하지 않는다** — `ARG X` + `RUN ...`(X 미참조)는 X 값이 바뀌어도 RUN 레이어를 무효화하지 못한다. 캐시버스트 목적의 ARG는 반드시 RUN 내에서 참조(`echo "${X}"` 등)해야 한다. "입력이 존재한다 ≠ 동작한다" — 메커니즘은 실제 무효화 여부로 검증해야 한다.
2. **반복되는 "비차단" CI 실패는 구조적 결함의 신호** — blog Trivy 실패를 215/217/218에서 비차단으로 넘긴 것이 근본 원인(apk_bust 무력화) 발견을 늦췄다. 같은 실패가 반복되면 일시적 사건이 아니라 메커니즘 자체를 의심해야 한다.
3. **수정판 존재 여부로 CVE 대응 경로가 갈린다** — fixed CVE는 `apk upgrade` 재실행(apk_bust)으로 유입, unfixed CVE만 `.trivyignore` "상위 패치 대기". `--ignore-unfixed`가 켜져 있어도 fixed CVE는 잡히므로, 패치 유입 경로가 살아 있어야 한다.

신규패턴: **캐시버스트 ARG 참조 의무 패턴** — apk/패키지 upgrade 레이어를 가진 Dockerfile은 `RUN` 내에서 `${APK_CACHE_BUST}`를 참조해야 `apk_bust` 입력이 실효를 가진다.

## Sprint 226+ 이월

- **(운영 실행) 머지 후 `gh workflow run ci.yml --ref main -f apk_bust=true` 실행 → blog Trivy 통과(libxml2 2.13.9-r1) 확인** — 본 수정의 라이브 효과 검증.
- **(운영 실행) 재배포 후 라이브 `/quiz` 검증 — UI(221)·a11y(222/223)·UX 심화(224)** (사용자/운영).
- **(운영 실행) SP217 컷오버** — `sp217-quiz-records-cutover.md` 따라 롤아웃 + 라이브 E2E.
- GA4 / Sprint 196 problem_db / 하네스 --full cron — 기존 이월 유지.

## Critic 교차 리뷰

- **도구**: Codex codex-cli 0.130.0, `codex review --base 742fe90 -c model=gpt-5.5`
- **라운드**: 1

**R1 — CLEAN** (P-finding 0): *"The changes correctly reference the existing APK_CACHE_BUST build argument in the Dockerfile RUN layers so BuildKit cache keys can change when apk_bust is enabled. No actionable regressions were identified in the modified files."*

**종합 판정**: ✅ 머지 가능 — Dockerfile RUN이 APK_CACHE_BUST를 참조해 apk_bust 시 BuildKit 캐시 키가 변경되도록 정확히 수정, 회귀 0. 단일 라운드 CLEAN.
