---
sprint: 255
title: "추천 문제 로딩 복구 + 플랫폼 토글 종속 — 배포 갭 규명 및 platform 필터"
date: "2026-07-22"
status: completed
agents: [Oracle]
related_adrs: ["sprint-254", "sprint-251"]
related_memory: ["sprint-window"]
topics: ["frontend", "problem", "recommendation", "deployment", "security", "ci"]
tldr: "Sprint 254 추천 기능이 프로덕션에서 '추천을 불러오지 못함' 증상. 진단 결과 코드 버그가 아니라 배포 갭 — PR #479 머지 후 main CI의 `Trivy Scan — problem`만 실패해 서비스별 fail-closed 게이트가 problem-service의 GitOps 태그 갱신을 스킵, 배포 이미지가 구버전(`ee4d4fe`)에 고정돼 `/recommendations` 라우트가 없었음. PR #481 `c889092`로 전이 CVE(brace-expansion·js-yaml) override 해소→게이트 언블록→재배포로 복구. 이어 기능 개선 PR #482 `e14e8c6` — 추천을 문제 추가 모달의 플랫폼 토글(BOJ/프로그래머스)에 종속시켜 선택 플랫폼 문제만 노출(BE `platform` 파라미터로 cross-study DB 필터+Tier3 seed 필터, BOJ 콜드스타트 seed 신설, FE 훅 탭 전환 재조회). Critic(Codex gpt-5.5, 포그라운드) P2 탭 전환 race를 epoch 패턴으로 해소(`86b041d`)."
---
# Sprint 255 — 추천 문제 로딩 복구 + 플랫폼 토글 종속

_날짜: 2026-07-22_

## 목표

Sprint 254에서 추가한 추천 문제 기능이 **프로덕션에서 추천을 불러오지 못하는** 증상을 보고받아 복구한다. 이어 추천 노출이 모든 플랫폼을 혼합하던 문제를 **문제 추가 모달의 플랫폼 토글(BOJ/프로그래머스)에 종속**시켜 선택 플랫폼 문제만 제안하도록 개선한다.

**배경 / 제약**: 실제 배포 URL(`https://algo-su.com`)에서 재현. 소스 코드 경로(FE 훅 → 게이트웨이 → 컨트롤러 라우트 우선순위 → 서비스 Tier3 시드 폴백)는 정적 분석상 결함 없음 → 원인은 코드가 아닌 런타임/배포 갭으로 가설 수립.

## 결정 사항

### D1. 근본원인 = 배포 갭 (코드 버그 아님)

CI 로그 물리 증거로 확정. PR #479(`4b60583`) 머지 후 main CI에서 **`Trivy Scan — problem` 잡만 실패**했고, deploy 잡의 **서비스별 fail-closed 게이트**가 Trivy 실패 서비스의 GitOps 이미지 태그 갱신을 스킵했다(로그: `⚠ algosu-problem SKIPPED (Trivy status: fail — service-scoped security gate)`). 결과적으로 배포된 problem-service는 구버전 `ee4d4fe`(Sprint 251)에 고정 → `/recommendations` 라우트 부재 → 신규 FE가 없는 라우트를 호출해 실패. 프론트엔드는 정상 배포돼 신·구 불일치가 발생.

- `main-4b60583` problem 이미지는 **빌드·GHCR 푸시까지 성공**(태그 갱신만 누락) — 이미지 자체는 존재.

### D2. 복구 = 전이 CVE override 해소로 게이트 언블록 (A안)

Trivy 실패 사유는 problem-service의 **신규 공표 전이 의존성 HIGH CVE 2건**(기능 무관 드리프트):
- `brace-expansion` → CVE-2026-13149 (DoS)
- `js-yaml` → CVE-2026-59869 (DoS)

`.trivyignore` 임시 등록(B안, 빠르지만 DoS 유예) 대신 **`services/problem/package.json` overrides로 패치 버전 고정**(A안, 실제 보안 해소 + 언블록 동시) 채택 — 서비스 안정성 우선 원칙. 기존 multer·tmp·ajv override 선례와 동일 패턴:
- `brace-expansion@>=3.0.0 <=5.0.6` → `5.0.7`, `brace-expansion@<=1.1.15` → `1.1.16`
- `js-yaml@>=4.0.0 <=4.2.0` → `4.3.0`, `js-yaml@<=3.14.2` → `3.15.0`

PR #481 `c889092` 머지 → CI green → Trivy problem 통과 → GitOps 태그 갱신 → problem-service 재배포 → 추천 라우트 복구.

### D3. 추천을 플랫폼 토글에 종속 (기능 개선)

문제 추가 모달은 플랫폼 토글이 있으나 추천은 이를 무시하고 전 플랫폼을 혼합 노출했다. 추천을 토글에 종속시켜 선택 플랫폼 문제만 제안:
- **BE**: `RecommendQueryDto`에 `platform` 파라미터 추가 → 컨트롤러 → `recommendForStudy`로 위임. cross-study 후보 조회(`findRecommendationCandidates`)의 DB `where`에 `sourcePlatform` **조건부 필터**, Tier3 시드 폴백도 플랫폼 필터. **미지정 시 전체 노출**(하위 호환).
- **콜드스타트**: BOJ 대표 문제 **seed 셋 신설**(`recommendation-seeds.ts`). solved.ac 세부 티어는 단정하지 않고 `level=null`, 난이도 대분류만 사용.
- **FE**: `use-problem-recommendation` 훅이 `platform` 옵션을 받아 **탭 전환 시 재조회**(노출이력 리셋). `SearchStep`이 현재 탭 platform을 주입.

PR #482 `e14e8c6` 머지.

### D4. Critic 게이트 = 포그라운드 차단 실행 (ACP reap 회피)

background PTY 래퍼 방식이 이 ACP 환경에서 **2회 연속 reap**(판정 없이 SIGKILL, `.done` 마커 미생성). 3번째 동일 재시도 대신 **포그라운드 차단 실행**(macOS `script` PTY 에뮬레이션, base `c889092`, `-c model="gpt-5.5"` 핀)으로 전환 → reap 없이 완주. 판정: **P2 1건**(탭 전환이 이전 플랫폼 조회 in-flight 중이면 `loadingRef` 가드로 재조회가 드롭돼 구플랫폼 응답이 화면을 덮는 race). **epoch ref 기반 stale 폐기 패턴**으로 해소 + 회귀 테스트 추가(`86b041d`).

## 완료 항목

- **PR #481 `c889092`** — problem-service Trivy HIGH CVE override 해소 (병렬 Oracle 세션 선행 완료). 배포 갭 언블록.
- **PR #482 `e14e8c6`** — 추천 플랫폼 토글 종속
  - BE(`services/problem`): `RecommendQueryDto.platform` + 컨트롤러 위임 + `recommendForStudy` platform 필터 + `findRecommendationCandidates` `sourcePlatform` 조건부 where + `recommendation-seeds.ts` BOJ seed 신설
  - FE: `use-problem-recommendation.ts`(platform 옵션 + 탭 전환 재조회 + epoch stale 폐기), `SearchStep.tsx` 현재 탭 platform 주입

**검증(Oracle 직접 재검 — 자기보고 불신)**: problem BE tsc(feature 클린)·ESLint 0·jest 252 pass. FE tsc 0·ESLint 0·jest 98 pass, 추천 훅 14/14(신규 race 회귀 테스트 포함).

**Critic(Codex gpt-5.5, base `c889092`, 포그라운드)**: P2 1건 → epoch 패턴 해소(`86b041d`). 로컬 게이트 그린으로 재검 종결.

## 인시던트

1. **배포 갭 오진 리스크**: "코드는 정상인데 추천이 안 뜬다"는 정적 분석만으로는 코드 결함으로 오인하기 쉬웠음. 실제 배포 URL 재현 + CI 로그(잡별 결과·GitOps 태그) 물리 증거 추적으로 problem 구버전 고정을 규명.
2. **Critic ACP reap 2회 연속**: background PTY 래퍼가 세션 경계에서 SIGKILL로 판정 유실 반복(Sprint 254 동형). 포그라운드 차단 실행으로 해결.
3. **병렬 Oracle 세션 선행(복구 파트)**: A안 착수 직전 병렬 세션이 이미 동일 override·PR #481을 완료·머지 → 재구축 대신 CI/재배포 검증으로 전환.

## 이월

- [ ] GA4 admin Enhanced Measurement OFF / 프로덕션 UAT / 데이터 스트림 URL 정합 (사용자 직접)
- [ ] 서버 재배포 + 라이브 SEO 검증 (운영, Sprint 212/213 산출물)
- [ ] 하네스 체크업 `--full` CI 정기 실행 자동화(cron 월 1회) 검토 (Sprint 209 후속)
- [ ] BOJ 추천 seed 목록 실제 대표성 재검토 (Oracle 판단으로 초안 작성 — 교체 여지)

## 교훈

- **서비스별 fail-closed Trivy 게이트는 기능 무관 전이 CVE 드리프트에도 해당 서비스 배포를 막는다**: 코드가 main에 머지돼도 런타임엔 없는 "배포 갭"이 생김. 신규 기능 배포 확인은 CI green뿐 아니라 **GitOps 이미지 태그 갱신까지** 확인해야 한다.
- **"코드 정상 = 기능 정상"이 아니다**: 정적 분석이 깨끗해도 배포 파이프라인/이미지 버전 갭을 의심하고, 실제 배포 URL 재현 + CI 잡별 로그로 검증할 것.
- **Critic ACP background reap 반복 시 포그라운드 차단 실행이 확실한 종결 경로**: 판정을 확실히 남긴다(수분~수십분 블로킹 감수).
- **표시 platform 종속 UX는 조회 취소/재조회 시 epoch 가드로 stale 응답을 폐기**해야 한다: in-flight 가드만으로는 늦게 도착한 구플랫폼 응답이 화면을 덮을 수 있음.
