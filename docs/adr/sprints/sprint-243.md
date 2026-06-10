---
sprint: 243
title: "공급망·CSP 스파이크·CI 정리 (ADR-030 로드맵 5순위 종결)"
date: "2026-06-10"
status: completed
agents: [Oracle, Gatekeeper, Conductor, Critic, Scribe]
related_adrs: ["ADR-030", "sprint-242", "sprint-238"]
related_memory: ["sprint-window"]
topics: ["security", "ci", "supply-chain"]
tldr: "ADR-030 처리 로드맵 5순위 종결 스프린트. [A] S-7: 서드파티 action 8종 16건 SHA 핀(f8e1d22)+드리프트 가드 check-action-pins.mjs 신규+secret-scan job 연결(3ae946d)+download-artifact 4곳 @v6 통일. Oracle gh api로 SHA↔태그 일치+major 태그 타깃 동일(동작 불변) 전수 검증. [B] Q-6: inline python3 -c를 scripts/ci/update-image-tags.py로 추출(6523ddd), argparse+매칭0건 stderr 경고, fixture 3케이스+byte-identical 검증. [C] S-3: nonce 스파이크 결정=보류(Monaco unsafe-eval nonce 해소불가/실익 marginal/force-dynamic 캐시손실/ADR-029 SSOT 멀티레포 비용). Critic auto-critic R1 gatekeeper P2 1건(.github/actions 재귀 탐색)→eedb3c2 수정→재리뷰 CLEAN. conductor R1 CLEAN(Low 1: 헬퍼 단위테스트 부재→이월). 인시던트 2건(gatekeeper 세션 한도 중단·하네스 상태 오기록 재발). ADR-030 로드맵 전 항목 종결."
---
# Sprint 243 — 공급망·CSP 스파이크·CI 정리 (ADR-030 로드맵 5순위 종결)

## 목표

- ADR-030 처리 로드맵 5순위(최종) — 잔여 3건 처리로 로드맵 종결: S-7 공급망 하드닝, S-3 CSP nonce 스파이크(결정만), Q-6 CI 헬퍼 추출.
- 코드 변경은 동작 불변(CI 검증 흐름 동일, 서비스 커버리지 무변경).
- Critic 머지 게이트 필수.

## 배경

- `/start` 인자: ADR-030 §결정 로드맵 5순위 처리.
- **S-7**: GitHub Actions 서드파티 action이 major tag 핀(가변) — SHA 핀(불변)으로 격상해 공급망 공격 표면 제거. Sprint 238 감사에서 Dependabot 완화로 "선택" 등록.
- **S-3**: `unsafe-inline` CSP 제거 가능성 스파이크 — Next.js App Router nonce 지원 + AdSense·Monaco 의존도 확인 후 적용/보류 결정. 결정만 내리는 스파이크 스프린트.
- **Q-6**: `ci.yml` deploy job 내 inline `python3 -c` (kustomization.yaml 이미지 태그 갱신) 스크립트가 테스트 불가 상태 — `scripts/ci/` 헬퍼로 추출(compute-deploy-gate.sh 선례).

## 작업 요약 (Gatekeeper + Conductor, 총 4 commit)

### A — S-7 GitHub Actions SHA 핀 (Gatekeeper, commit `f8e1d22`)

**핀 대상 서드파티 action 8종 16건**

| action | 버전 | 핀 건수 |
|--------|------|---------|
| `dorny/paths-filter` | v4.0.1 | 1건 |
| `wagoid/commitlint-github-action` | v6.2.1 | 1건 |
| `marocchino/sticky-pull-request-comment` | v2.9.4 | 1건 |
| `docker/setup-qemu-action` | v4.1.0 | 3건 |
| `docker/setup-buildx-action` | v4.1.0 | 3건 |
| `nick-fields/retry` | v3.0.2 | 3건 |
| `docker/build-push-action` | v7.2.0 | 3건 |
| `dependabot/fetch-metadata` | v2.5.0 | 1건 |

- 전환 방식: `owner/repo@vX.Y.Z` → `owner/repo@<40-hex-sha> # vX.Y.Z` (Dependabot 추적 주석 병기).
- **추가**: `actions/download-artifact` ci.yml 1곳이 @v4 — upload 전부 v6 대비 @v6 통일(4곳 정합).
- **Oracle gh api 전수 검증**: 각 action repo에서 `gh api repos/<owner>/<repo>/git/ref/tags/<tag>` 로 SHA↔태그 일치 확인 + major 태그 타깃(refs/tags/v2·refs/tags/v3 등)이 동일 SHA 가리킴 확인 → **동작 불변**.
- **참고**: marocchino/sticky-pull-request-comment `@v2`는 브랜치 ref (v2 브랜치 head 추적) — 스냅샷 SHA로 고정이 올바름.

---

### A — S-7 드리프트 가드 + secret-scan 연결 (Gatekeeper, commit `3ae946d`)

**`scripts/check-action-pins.mjs` 신규**

- `.github/workflows`·`.github/actions` 하위 모든 `uses:` 라인 스캔.
- 1st-party(`actions/`·`github/` owner) 및 로컬(`./`) 경로 면제.
- 서드파티 action이 40-hex commit SHA 핀이 아니면 exit 1.
- 실측: 현 16건 전부 핀(EXIT=0), unpinned 주입 시 EXIT=1 양성/음성 케이스 확인.

**`ci.yml` secret-scan job에 실행 스텝 추가** — 신규 워크플로우/action 추가 시 핀 누락 자동 차단.

---

### B — Q-6 CI 헬퍼 추출 (Conductor, commit `6523ddd`)

`ci.yml` deploy job `update_tags` 스텝의 inline `python3 -c` → `scripts/ci/update-image-tags.py` 추출.

**설계 결정 (compute-deploy-gate.sh 선례)**:
- GHA context 의존(후보 수집·Trivy 게이트) 로직은 ci.yml inline 유지.
- 순수 변환 로직(kustomization.yaml `images[]` 태그 갱신)만 헬퍼로 분리 → 단독 테스트 가능.

**추출 시 개선점 (동작 불변)**:
- `argparse`: `--sha`(필수)·`--file`(기본 kustomization.yaml)·가변 서비스명.
- 매칭 0건 서비스는 `stderr` 경고 (기존 inline은 silent → 가시성 개선).

**검증**: fixture 3케이스(갱신 대상·비대상·매칭 없음) 실측 + 추출 전후 출력 byte-identical diff 확인.

---

### Critic auto-critic R1 수정 (commit `eedb3c2`)

Gatekeeper 산출물(`f8e1d22`, `3ae946d`) 교차 리뷰: **P2 1건** 발견.

**P2 (`eedb3c2`)**: `check-action-pins.mjs`의 `collectFiles()`가 `.github/actions` 하위 직접 자식 1단계만 검사 — 중첩 composite action(`.github/actions/a/b/action.yml`)이 SHA 핀 가드를 우회 가능. `collectActionManifests()` 재귀 함수로 교체해 `action.yml`/`action.yaml` 전수 수집. `existsSync(ACTIONS_DIR)` 가드 유지.

재리뷰: **✅ CLEAN**.

---

### S-3 CSP nonce 스파이크 결정

스파이크 조사 결과 **보류**:

| 제약 항목 | 상세 |
|-----------|------|
| Monaco Editor `unsafe-eval` | Next.js nonce는 `script-src` nonce 기반 — Monaco가 내부적으로 `eval()` 사용, nonce로 `unsafe-eval` 제거 불가. 실질 보안 이득 marginal |
| force-dynamic 전환 비용 | nonce를 서버에서 생성·주입하려면 전 라우트를 SSR/force-dynamic으로 전환 필요 → ISR·CDN 캐시 손실 |
| ADR-029 SSOT 이전 비용 | CSP SSOT는 aether-gitops Traefik 미들웨어 — 변경을 멀티레포에서 조율해야 함 |
| AdSense 의존도 | AdSense는 `frontend`와 무관(아직 미연동), 제약 사항 아님 |
| Next.js 15 nonce 지원 여부 | `proxy.ts` nonce 자체는 지원 확인됨 (적용 기술적 가능, but 위 비용이 초과) |

**재검토 트리거**: ① Monaco 교체 완료 시 ② 전 라우트 SSR 전환 결정 시 ③ ADR-029 Traefik SSOT 재논의 시.

---

## Critic

### auto-critic (Gatekeeper S-7 + 드리프트 가드)

- **R1 [P2]**: `.github/actions` 재귀 탐색 누락 → `eedb3c2` 수정 → **R2 CLEAN**.

### auto-critic (Conductor Q-6)

- **R1**: **✅ CLEAN** (Low 1: `update-image-tags.py` 단위 테스트 부재 — 이월 검토).

---

## 인시던트

1. **Gatekeeper 1차 실행 세션 한도 중단**: SHA 핀 편집 작업 중 Claude 세션 한도 초과로 중단. 변경 중인 working tree는 보존 상태 — Oracle이 partial 편집 내용 직접 검증 후 "검증된 편집 그대로 완성" 노트 첨부 재디스패치로 복구. `f8e1d22` 정상 커밋.

2. **하네스 상태 오기록 재발 (Sprint 242 동일 버그 2회차)**: gatekeeper inbox 결과 파일이 `status: success`로 실재했으나, oracle-runner가 `completed_no_result`로 상태 기록 → Oracle이 conductor 작업을 `cancelled` 처리 → Oracle이 inbox 파일을 직접 확인해 상태 보정 후 conductor 재디스패치. inbox 파일=SSOT 원칙 재확인. 추가로 워처가 stale `.out` 파일을 오탐(mtime 가드로 해소, 워처 재시작 후 정상). 하네스 버그 근본 수정은 이월.

---

## 핵심 결정

1. **SHA 핀은 주석 병기가 Dependabot 호환의 핵심**: `@<sha> # vX.Y.Z` 형식 없이 SHA만 있으면 Dependabot이 버전 추적을 못함. 주석 버전 태그가 Dependabot 파싱 기준.
2. **드리프트 가드는 재귀 탐색이 완결**: composite action이 중첩될 수 있으므로 1단계 탐색은 가드로 불완전. Critic P2가 이를 적발.
3. **CI 헬퍼 추출 경계 — GHA context 의존 로직은 inline 유지**: compute-deploy-gate.sh 선례와 동일. 순수 변환 로직만 분리해야 헬퍼가 독립 테스트 가능.
4. **CSP unsafe-inline 제거 선결 조건 = Monaco unsafe-eval 해소**: nonce가 기술적으로 가능해도 Monaco가 eval() 쓰면 실익이 없음. 비용-편익 분석을 스파이크로 명문화.

---

## 검증

- **ADR 게이트**:
  - `node scripts/check-adr-index-count.mjs --strict` — EXIT=0 (index **181**)
  - `node scripts/check-adr-en-coverage.mjs --strict` — EXIT=0 (EN coverage)
  - `node scripts/check-adr-links.mjs` — EXIT=0
  - `node scripts/check-i18n-residue.mjs --strict` — EXIT=0
  - `node scripts/check-doc-refs.mjs` — EXIT=0
  - `node scripts/check-adr-conversion.mjs` — EXIT=0
- **CI 동작 불변 검증**:
  - `node scripts/check-action-pins.mjs` — EXIT=0 (16건 전부 SHA 핀 확인)
  - SHA↔태그 일치 gh api 전수 검증 — Oracle 직접 수행
  - fixture 3케이스 + byte-identical diff 확인 — Q-6 헬퍼 추출 전후 동일 출력
- **브랜치**: `chore/sprint-243-supply-chain-csp-ci` (4 commits: `f8e1d22`·`3ae946d`·`6523ddd`·`eedb3c2`)

---

## 교훈

1. **공급망 가드는 재귀 탐색이 완결**: composite action 중첩을 고려하지 않은 1단계 탐색은 가드 구멍. 스크립트 작성 시 디렉토리 구조가 평탄하다고 가정 금지 (Critic P2 적발).
2. **스파이크 결정은 비용-편익 명문화가 핵심**: S-3처럼 "기술적으로 가능"이어도 비용이 이익을 초과하면 보류. 근거를 ADR에 명기해야 재논의 시 동일 분석 반복을 차단.
3. **하네스 오기록은 inbox 파일 직접 확인으로 복구**: Sprint 242와 동일 버그 2회차. inbox `status: success`가 최우선 SSOT, 상태 파일은 보조. 근본 수정 없이 패턴이 고착되고 있어 하네스 버그 슬롯 우선순위 상향 필요.
4. **세션 한도 중단도 working tree 보존으로 복구 가능**: Claude 세션이 종료되어도 git staging area와 modified working tree는 남음. Oracle 검증 후 재디스패치가 복구 경로.

---

## 다음 스프린트 이월 시드

**ADR-030 로드맵 완전 종결** — 잔여 백로그: Q-4 libs 공유 스파이크(사용자 확정), S-3 재검토 트리거(Monaco 교체 선행).

**기술 부채 시드 (우선순위 순)**:
- Critic task JSON 상태 오기록 하네스 버그 (oracle-reap/runner — **2회 재발, 우선순위 상향**)
- CI 헬퍼(`update-image-tags.py`) 단위 테스트 — Low(Conductor Critic R1) 이월
- 동기 로그 호출 싱글톤 context 한계 (transient scope 전환 검토)
- `errors` / `problems` i18n 네임스페이스 문구 불일치
- ConfirmStep `tErrors` pre-existing 결함
- 인라인 style 토큰화 (Tailwind 토큰 클래스 전환)

**기존 이월 (연속)**:
- `Quality — docs` required 게이트 승격 검토
- 하네스 점검 슬롯 (pane 가드 항구화 + 윈도우 장식 근본 해소 + Codex 모델 핀)
- GA4 3건 · 라이브 SEO · 하네스 cron · webhook regenerate · 누적 UAT · 블로그 소재 3건
