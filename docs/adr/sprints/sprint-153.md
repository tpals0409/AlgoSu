---
sprint: 153
title: "docs/ 폴더 최적화 + broken ref 부채 일괄 해소"
date: "2026-05-13"
status: completed
agents: [Oracle, Scribe]
related_adrs: ["sprint-150", "sprint-151", "sprint-152"]
related_memory: ["sprint-window"]
---
# Sprint 153 — docs/ 폴더 최적화 + broken ref 부채 일괄 해소

## 목표

- docs/ 루트에 산재한 23 파일을 의미 단위 서브디렉토리로 정리하여 트리 깊이 1단계 일관성 회복
- audit 산출물 보존 정책 명문화 + raw jsonl 부피 제거
- 검증 중 발견한 미작성 문서 5종(23회 broken ref) 일괄 해소

## 결정

- **Phase A/D/E/F**: 위치 이동 (`git mv`) + 본문 불변 + Phase D 카테고리(`conventions/` / `patterns/`) 일관성 적용
- **Phase B**: 정리본 `.md`만 영구 보존, 원시 `.jsonl`은 비보존 — `docs/audits/README.md`에 SSOT 명문화
- **Phase C**: 신규 진입자 navigation을 위해 `docs/README.md` + `docs/adr/README.md` 인덱스 신규
- **Phase G**: broken ref 5종 부채를 본 sprint 범위에 포함 — 코드 주석에 박힌 `monitoring-log-rules §섹션` 13개를 정확히 매칭하는 stub 작성으로 해소
- 모든 phase 독립 PR + Squash merge — 변경 범위/위험도 분리

## 구현 (8 PR squash merge, origin/main `3873f6d` → `661cd59`)

| PR | Phase | 변경 |
|----|-------|------|
| [#236](https://github.com/tpals0409/AlgoSu/pull/236) | A | 루트 단발 sprint 노트 3 (`sprint-{40,48,51}-*.md`) → `adr/sprints/sprint-{NN}.md` + Sprint 62+ frontmatter 컨벤션 보정 |
| [#237](https://github.com/tpals0409/AlgoSu/pull/237) | B | `docs/audits/sprint-118/_raw/*.jsonl` 7건(593라인, 260K) 제거 + `docs/audits/README.md` 보존 정책 신규 |
| [#238](https://github.com/tpals0409/AlgoSu/pull/238) | C | `docs/README.md` + `docs/adr/README.md` 인덱스 신규 (5 카테고리 + ADR 3 유형) |
| [#239](https://github.com/tpals0409/AlgoSu/pull/239) | D | 컨벤션/패턴 6개 → `conventions/` + `patterns/` (cross-ref 0건 — 안전한 위치 이동) |
| [#240](https://github.com/tpals0409/AlgoSu/pull/240) | E | runbook 14개 → `docs/runbook/` + 영역별 인덱스 README. **단, sed 결과 19개 cross-ref가 staging 누락으로 commit에서 제외** |
| [#241](https://github.com/tpals0409/AlgoSu/pull/241) | E hotfix | Phase E 누락 19개 cross-ref 일괄 복원 (`git ls-files \| xargs sed`) |
| [#242](https://github.com/tpals0409/AlgoSu/pull/242) | F | `sprint-95-programmers-dataset.md` → `docs/adr/topics/` (5 cross-ref 갱신: sprint-95 ADR + gateway TS JSDoc + 2 README) |
| [#243](https://github.com/tpals0409/AlgoSu/pull/243) | G | broken ref 5종 23회 참조 일괄 정리 — 3 신규 작성(`monitoring-logging.md` §1~§11 / `ci-cd.md` §1~§7 / `annotation-dictionary.md` 13 guard + 10 event + 16 domain) + 24 sed + 1 ref 제거 |

### 사고 1건 + 복구 1건

- **사고**: Phase E PR #240에서 `git mv` + 신규 README는 commit됐으나 sed로 처리한 cross-ref 갱신 19 파일이 staged area 누락으로 commit에서 제외 → main에 broken link 19건 노출
- **부수 사고**: 머지 전 워킹트리 변경 분리를 위해 `git stash push -u`했다가 hotfix 직후 `git stash drop`으로 stash 제거 → 함께 stashed된 untracked sprint-149/150/151/152.md ADR 4건이 손실
- **복구**: 
  1. PR #241로 cross-ref 19건 일괄 복원 (CI green merge)
  2. 손실 ADR 4건은 `git fsck --no-reflogs --unreachable` → stash commit `792f75bd`의 3rd parent tree에서 4 blob 모두 100% 복구

### Phase G 부채 해소 상세

| 슬러그 (미작성) | 해소 방식 | 영향 파일 |
|----------------|----------|-----------|
| `monitoring-log-rules.md` | `conventions/monitoring-logging.md` 신규 작성 — 코드 주석 §1~§11-2 13개 §섹션 정확히 매칭 (구조화 로깅 / sanitize / Saga / MQ / 에러 코드 / slow query / 메트릭 / Prometheus alert) | 15 |
| `ci-cd-rules.md` | `conventions/ci-cd.md` 신규 작성 — Conventional Commits + 브랜치/PR/CI/보안/의존성/배포 (§7-2 Layer 순차) | 3 |
| `annotation-dictionary.md` | `conventions/annotation-dictionary.md` 신규 작성 — `@guard` 13 + `@event` 10 + `@domain` 16 catalog | 3 |
| `migration-rules.md` | `conventions/migration-naming.md`로 ref 갱신 (Phase D conventions/ 활용) | 1 |
| `work-progress-guide.md` | scribe.md ref 제거 (단일 참조 + 미작성 문서) | 1 |
| **합계** | **3 신규 + 24 sed + 1 ref 제거** | **23회 broken link 해소** |

## 검증

- 8 PR 모두 CI fail 0, mergeStateStatus CLEAN ✅
- 4 슬러그 broken ref grep: 0건 (`monitoring-log-rules` / `ci-cd-rules` / `migration-rules` / `work-progress-guide`)
- docs/ 루트 파일 수: **23 → 1** (README.md만 잔존)
- docs/ 트리 깊이 1단계 일관성 회복 (`adr/` `audits/` `assets/` `conventions/` `patterns/` `runbook/` 모두 서브디렉토리)
- docs/ 부피: 1.7M → 1.5M (audits raw 260K 제거)
- conventions 6개로 확장 (3개 신규 + 3개 기존)

## 브랜치 규율

✅ **19 스프린트 연속 준수** — 8 PR 모두 신규 브랜치 + Squash merge, main 직접 commit 0건 (Sprint 134 위반 이후)

## 신규 패턴

- **재검증으로 "범위 외" 평가 깨기** — 이전 plan에서 "cross-ref 영향 큼"으로 범위 외 처리한 컨벤션/패턴 6개를 Phase D 진입 전 재검증 → cross-ref 0건 확인 후 즉시 처리. 그동안 누적된 "안전한데 미해소" 부채 발굴 가능성
- **부채 발견 → 본 sprint 범위 확장 (Phase G)** — 검증 중 broken ref 23건 발견 → 별도 sprint 이월하지 않고 즉시 처리. 단일 sprint 안에서 "정리 + 검증 + 추가 부채 해소" 사이클 완결
- **코드에 박힌 §섹션 번호로 stub 작성 가이드** — `monitoring-log-rules §1~§11` 13개 §섹션이 코드/인프라 주석에 박혀있어 stub 작성 시 정확한 섹션 번호 + 의미를 코드에서 역으로 추출 가능. "코드가 문서의 정의역을 강제한다" 패턴
- **`git fsck --no-reflogs --unreachable`로 stash drop 손실 복구** — `git stash drop` 후에도 stash commit이 GC 전까지 unreachable 상태로 잔존. 3rd parent tree에서 untracked blob까지 100% 복구 가능
- **단일 sprint 8 PR + 1 hotfix 묶음** — Sprint 150 (3 PR) / 152 (3 PR) 패턴 확장. 각 PR 영향 범위 분리 + CI green merge 순차 진행으로 위험 점진 흡수

## 교훈

- **`git mv` + Edit/sed는 staging이 분리된다 — `git add -u` 명시 필수** — Phase A에서 한 번 발견한 패턴이 Phase E에서 그대로 재발 → main에 broken link 노출. `git commit`은 staged만 처리하므로 sed 결과는 명시 staging 없이는 commit에 들어가지 않음. Phase F/G에서는 `git add docs/ services/` 또는 `git add -u`로 명시 staging
- **`git stash push -u` 후 `git stash drop` 시 untracked 파일 영구 손실 위험** — `-u`로 stashed된 untracked는 일반 `stash list`/`reflog stash`에 안 보이는 경우 있음. drop 직전 stash 보존이 필요하면 `git stash show -u stash@{0}` 또는 별도 commit으로 격리. 손실 시 `git fsck --unreachable`로 즉시 복구 시도
- **paths filter는 양날의 검 (Sprint 150 교훈 직접 재확인)** — 본 sprint 8 PR 모두 docs-only이지만 Coverage Gate / Test가 정상 실행. paths filter는 변경된 서비스만 빌드하지만 main 기준 검증은 노출 가능
- **부채 발견 시 본 sprint 범위 확장 vs 이월의 결정 기준** — 영향 범위가 명확 + 본 작업과 도메인 일치 + cycle 시간 여유 → 즉시 처리. broken ref 23건은 docs/ 정리와 같은 도메인이라 본 sprint 처리 결정. UAT 외부 확인 필요한 시드 #5/#9 등은 이월 유지
- **"단순 정리"라도 사고 가능 — git 명령 조합의 staging 모델 정확한 이해 필수** — git mv (auto staged) / Edit (unstaged) / sed (unstaged) / git stash -u (untracked 포함) / git stash drop (영구 제거). 각 명령의 staging/storage 효과를 정확히 알아야 사고 회피
- **사용자 직접 검증이 부채 발굴 트리거** — Phase A~F 완료 후 사용자가 "에이전트 문서에도 변경사항 적용되었는지 확인해" 요청 → 발견된 부채가 본 sprint Phase G로 즉시 흡수. 사용자 검증 사이클을 sprint 종료 전 한 번 더 권장

## Sprint 154 이월 시드

### UAT 사용자 직접 (이월 유지)

- 시드 #5: 프로그래머스 재제출 채점 통과 확인 (10 스프린트 누적 — Sprint 145~153)
- 시드 #9: 영문 환경 + production Grafana CB dashboard ai-analysis 시각 정합 (10 스프린트 누적)

### Sprint 152 신규 자동화 후보 (이월 유지)

- 시드 #18: 블로그 글 머지 전 도메인 사실 cross-check 자동화 (ADR 누적 갯수 / 스프린트 번호 / GitHub URL 유효성)
- 시드 #19: 신규 블로그 글 작성 시 KR/EN 양면 동시 작성 plan 의무 — plan 템플릿 갱신 + CI 룰

### Sprint 153 신규 시드 2건

- 시드 #20: **`git add` staging 모델 plan 단계 명시화** — `git mv` + Edit/sed 결합 작업 시 plan 템플릿에 "sed 후 `git add -u` 의무" 체크리스트 추가. Phase A/E 두 차례 재발한 패턴 차단
- 시드 #21: **broken ref 정기 점검 자동화 후보** — `git ls-files | xargs grep -l "docs/.*\.md"` + 파일 존재 검증 lint. 본 sprint Phase G로 23건 적발 → 정기 자동화 시 부채 누적 차단

### 후속 (선택, Sprint 151 그대로)

- create/edit page.tsx category UI 추가
- Programmers URL 자동 카테고리 추론
- 기존 SQL 문제 데이터 백필
- Sprint 150 미해소 3건 (`.claude-tools/` 정리 / CI paths filter 우회 부채 점검 자동화 / prom-client default metric stale 점검)

### 향후 docs 정리 후속

- runbook/conventions 문서를 신규 카테고리로 추가 분리할 필요가 있을 때 **본 sprint Phase D/G 패턴(cross-ref 재검증 + sed 일괄 + `git add -u` 명시) 직접 계승**
- 토픽 ADR 누적 시 `docs/adr/topics/` 하위에 추가 (Phase F로 디렉토리 마련됨)

## 관련 메모리

- [sprint-window.md](../../../.claude/projects/-Users-leokim-Desktop-leo-kim-AlgoSu/memory/sprint-window.md)
- [feedback-blog-workflow](../../../.claude/projects/-Users-leokim-Desktop-leo-kim-AlgoSu/memory/feedback-blog-workflow.md) — 사용자 검증 사이클 패턴 직접 재확인
