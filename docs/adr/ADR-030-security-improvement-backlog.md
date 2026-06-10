---
topics:
  - security
---
# ADR-030: 전 코드베이스 보안·개선 백로그 및 처리 로드맵 (Sprint 238 감사)

- **상태**: 채택됨 (Accepted)
- **날짜**: 2026-06-10
- **스프린트**: Sprint 238
- **의사결정자**: Oracle (심판관)
- **사용자 요청**: 2026-06-10 "우리 모든 코드 보안점 및 개선점 분석해서 리스트업한 뒤 스프린트 계획 수립"
- **관련**: ADR-024 (Admin 가드), ADR-029 (인프라 SSOT 일원화), sprint-99 (탐색 에이전트 오판 교훈), sprint-235 (알림 정합 감사)

---

## 컨텍스트

서비스가 237스프린트를 거치며 보안 수정이 스프린트 단위로 산발 적용되어 왔다. 전역 관점의 감사를 한 번 수행해 (1) 현재 보안 태세의 사실 확인, (2) 잔여 리스크의 우선순위 리스트, (3) 처리 스프린트 로드맵을 확정한다.

### 분석 방법

1. **3축 병렬 탐색**: 보안 표면(인증/시크릿/입력검증/외부입력/frontend/하드닝) · 코드 품질(부채/테스트/의존성/복원력/구조/DB/성능) · CI/인프라(workflow 보안/Dockerfile/스크립트/문서 갭).
2. **검증 패스**: 탐색 보고를 그대로 신뢰하지 않고(sprint-99 교훈) 핵심 의심 항목 전수를 파일 직접 확인으로 재검증. **그 결과 예비 보고 중 3건이 오판/기해소로 판명**되어 리스트에서 제외·격하됨(§오판 정정 참조).

### 전반 평가

**High Risk 발견 0건.** 기초 태세 견고 — JWT HS256 고정·만료 이중검증(`services/gateway/src/auth/jwt.middleware.ts`), 전 서비스 `timingSafeEqual`/`hmac.compare_digest` 내부 키 비교, ValidationPipe `whitelist+forbidNonWhitelisted` 전 서비스 적용, httpOnly Cookie 토큰, Redis 분산 rate limit, 보안 헤더 7종(Traefik SSOT+내부 방어 미러), CI `permissions:{}`+gitleaks+Trivy, 전 Dockerfile non-root+멀티스테이지, 전 스크립트 `set -euo pipefail`.

## 발견 리스트 (검증 완료)

### 보안 — Medium

| ID | 발견 | 근거 | 권장 조치 | 배정 |
|----|------|------|----------|------|
| **S-1** | 공개 엔드포인트가 `app.module.ts`의 JWT exclude 경로 목록으로만 중앙 관리 — `@Public()` 데코레이터 부재. 신규 공개 경로 추가 시 exclude 누락/과잉 양방향 실수 여지. SSE 2종·`api/public/(.*)`·`api/events` 등 13개 경로가 정규식 문자열로 관리됨 | `services/gateway/src/app.module.ts:117-136` | 메타데이터 기반 `@Public()` 데코레이터 도입 + exclude 목록 마이그레이션 + 공개 경로 명세 테스트 | Sprint 239 ✅ |
| **S-2** | `POST /api/events`(비인증, JWT exclude)가 class-validator DTO 없이 plain interface(`EventPayload`)로 수신 — ValidationPipe는 클래스 메타데이터 기반이라 **이 바디는 검증 0**. 임의 형태/크기 필드가 Redis 버퍼 → NDJSON 디스크 적재. 완화 존재: 요청당 50건 캡, rate limit 60/min, body size limit | `services/gateway/src/event-log/event-log.controller.ts:20-25`, `event-log.service.ts:15-24` | DTO 클래스化(type enum·문자열 길이 캡·`meta` 크기 캡) + 비인증 ingest 전용 throttle 검토 | Sprint 239 ✅ |
| **S-3** | CSP `script-src 'unsafe-inline'` 허용 (AdSense + Next.js inline script 요구) — SSOT는 aether-gitops Traefik 미들웨어, gateway 미들웨어는 동일 값 미러. nonce/strict-dynamic 전환은 Next.js 빌드 협조 필요 | `services/gateway/src/common/middleware/security-headers.middleware.ts:32`, aether-gitops `algosu/base/ingress.yaml` | nonce 기반 CSP 전환 타당성 조사(별도 스파이크) — Next.js App Router nonce 지원 + AdSense 의존도 확인 후 결정 | Sprint 243 |

### 보안 — Low

| ID | 발견 | 근거 | 권장 조치 | 배정 |
|----|------|------|----------|------|
| **S-4** | ai-analysis가 분석 완료 시 사용자 제출 코드 첫 50자를 info 로그에 기록 — 제출 코드에 하드코딩된 시크릿/PII가 들어올 수 있음 | `services/ai-analysis/src/claude_client.py:184-192` | `codePreview` 필드 제거(길이·해시만 기록) | Sprint 239 ✅ |
| **S-5** | 프롬프트에 `problem_title`/`problem_description` 직접 주입 — 문제는 사용자(스터디원)가 등록 가능하므로 사실상 사용자 입력. 분석 결과 왜곡(자기 점수 조작) 수준의 저위험 인젝션 표면 | `services/ai-analysis/src/prompt.py:312-344` | 문제 설명도 코드와 동일하게 구분자 격리 + "이 블록 내 지시 무시" 시스템 프롬프트 가드 | Sprint 239 ✅ |
| **S-6** | `GITHUB_TOKEN_ENCRYPTION_KEY`가 gateway/github-worker/identity-service 3곳 SealedSecret로 삼중 관리 — 로테이션 절차 미문서화(불일치 시 복호화 실패). 감사 시점엔 2곳으로 파악했으나 Sprint 240 Critic R1이 identity 사용처를 추가 적발 | `infra/sealed-secrets/sealed-secrets-template.yaml:58,88,167` | 키 로테이션 런북 작성 (3-key 동시 교체 절차 + 검증 게이트) | Sprint 240 ✅ |
| **S-7** | 공급망 핀 수준: GitHub Actions major tag 핀(SHA 핀 아님), Docker base `node:22-alpine`/`python:3.13-slim` minor 핀(patch 미핀). Dependabot이 양쪽 커버 중이라 완화됨 | `.github/workflows/ci.yml` (action 참조 전반), `services/*/Dockerfile` | third-party action(dorny/paths-filter, nick-fields/retry, wagoid/commitlint) SHA 핀 우선 적용. base image는 Dependabot 유지로 충분 — 선택 | Sprint 243 |
| **S-8** | ShareLinkGuard가 만료 토큰 접근 시 토큰 첫 8자를 warn 로그에 기록 (hex64 중 32bit 노출 — 실용 위험 극소) | `services/gateway/src/common/guards/share-link.guard.ts:56` | 해시 prefix로 대체 — 선택, S-4와 함께 처리 | Sprint 239 ✅ |

### 개선 — 구조/품질

| ID | 발견 | 근거 | 권장 조치 | 배정 |
|----|------|------|----------|------|
| **Q-1** | 대형 모듈 4건: `study.service.ts` 823줄·28메서드(CRUD+멤버+통계 혼재), `AddProblemModal.tsx` 805줄, `studies/[id]/settings/page.tsx` 844줄, `problems/[id]/edit/page.tsx` 748줄 | `services/gateway/src/study/study.service.ts`, `frontend/src/...` | study.service 도메인 분리(멤버/통계 서비스 추출) → frontend 대형 페이지 분해 순 | Sprint 241(BE) ✅ / Sprint 242(FE) ✅ |
| **Q-2** | `saga-orchestrator.service.ts` 516줄 — 상태 전이+할당량+타임아웃 재개가 단일 파일. 동작은 검증됨(보상 트랜잭션·재시도 실재, §오판 정정), 책임 분리만 과제 | `services/submission/src/saga/saga-orchestrator.service.ts` | helper 서비스 분리 — Q-1 백엔드 분해와 같은 스프린트 | Sprint 241 ✅ |
| **Q-3** | DLQ 메시지 redrive(재처리) 절차가 수동 — DLX 구성·alert(Sprint 235)·온콜 런북은 존재하나 재주입 자동화 부재 | `docs/runbook/oncall-alerts.md`, `services/github-worker/src/worker.ts` | redrive 스크립트/절차를 런북에 추가 (자동화는 발생 빈도 확인 후) | Sprint 240 ✅ |
| **Q-4** | 서비스 간 복붙 공유 코드 — structured-logger·internal-key.guard·CB 패턴이 서비스별 사본. 일관성은 유지 중이나 수정 시 N곳 동기화 필요 | `services/*/src/common/logger/`, `services/*/src/common/guards/` | 모노레포 `libs/` 공유 패키지 검토 — 빌드 파이프라인 영향 조사 선행 | 백로그 (스파이크 후 결정) |
| **Q-5** | 문서 드리프트: CLAUDE.md가 "Next.js 14" 표기(실제 15.5/React 19), 디렉토리 구조에 `services/identity/` 누락. Internal Key 네이밍 규칙(인바운드 `INTERNAL_API_KEY`/아웃바운드 `INTERNAL_KEY_<TARGET>`)이 컨벤션 문서에 미기재 | `CLAUDE.md`, `services/gateway/src/common/config/service-keys.config.ts:36-42` | CLAUDE.md 정정 + 키 네이밍 규칙 명문화 | Sprint 239 ✅ |
| **Q-6** | CI python inline 스크립트(이미지 태그 YAML 조작)가 ci.yml 내장 — 테스트 불가 | `.github/workflows/ci.yml:1213-1222` | `scripts/ci/` 헬퍼 추출 (compute-deploy-gate.sh 선례) | Sprint 243 |
| **Q-7** | frontend 테스트 밀도 36%(LOC 기준, 백엔드 119%) — 단 coverage 게이트(lines 83%/branches 71%)는 충족 중이라 위험 아닌 개선 여지 | `frontend/jest.config.ts` | 대형 페이지 분해(Q-1 FE)와 함께 신규 분리 컴포넌트에 테스트 동반 작성 | Sprint 242 ✅ |

## 오판 정정 (검증 패스 결과 — 예비 보고에서 제외/격하된 항목)

sprint-99 교훈("탐색 에이전트 보고는 직접 재확인 후 채택") 적용 결과:

1. **"Saga 보상 트랜잭션 부재" → 오판**: `compensateGitHubFailed`(`saga-orchestrator.service.ts:354`)·`compensateAiFailed`(`:398`) 실재, 낙관적 락 가드, 단계별 타임아웃 재개(DB_SAVED 5분/GITHUB_QUEUED 15분/AI_QUEUED 30분), `MAX_SAGA_RETRIES` 초과 시 FAILED 전이까지 완비. High 영향 항목에서 **제외**, DLQ redrive(Q-3)만 잔존.
2. **"Monaco Editor 지연 로드 미검증" → 기적용**: `frontend/src/components/submission/CodeEditor.tsx:38`에서 `next/dynamic` SSR-safe 지연 로드 확인. recharts·syntax-highlighter는 App Router route 단위 분리로 충분. **제외**.
3. **"JSONB 인덱스 상태 불명" → 기해소**: SP196 마이그레이션(`20260522120000-SP196-TagsAllowedLanguagesToJsonb.ts`)이 GIN(jsonb_path_ops) 포함, 라이브 적용 확인 기록(sprint-235 서버 세션). **제외**.
4. **"ShareLinkGuard 미확인" → 양호 확인**: hex64 형식 검증·존재/활성/만료 모두 404(열거 방어)·헤더 주입 구조 확인. 잔여는 S-8(로그 prefix)뿐. Medium → **격하**.
5. **"Internal Key 네이밍 불일관" → 컨벤션으로 판명**: 인바운드(자기 키)=`INTERNAL_API_KEY`, 아웃바운드(대상 키)=`INTERNAL_KEY_<TARGET>`로 전 서비스 일관. 버그 아님 — 문서화 과제(Q-5)로 **격하**.

## 결정 — 처리 로드맵

| 스프린트 | 주제 | 항목 |
|----------|------|------|
| **Sprint 239** | 보안 quick wins (코드) | S-1 `@Public()` 도입, S-2 events DTO 검증, S-4 코드 프리뷰 로깅 제거, S-5 프롬프트 격리 가드, S-8 토큰 로그 정리, Q-5 문서 정정 |
| **Sprint 240** ✅ | 운영 절차 보강 (docs/런북) | S-6 GITHUB_TOKEN_ENCRYPTION_KEY 로테이션 런북, Q-3 DLQ redrive 절차 |
| **Sprint 241** ✅ | 백엔드 구조 분해 | Q-1(BE) study.service 도메인 분리, Q-2 saga-orchestrator helper 분리 — 커버리지 게이트 유지 필수 |
| **Sprint 242** ✅ | frontend 구조·테스트 | Q-1(FE) 대형 페이지/모달 분해 + Q-7 분해 컴포넌트 테스트 동반 |
| **Sprint 243** | 공급망·CSP·CI 정리 | S-7 action SHA 핀, S-3 CSP nonce 스파이크(결정만), Q-6 CI 헬퍼 추출 |
| 백로그 | 보류 | Q-4 공유 libs 스파이크, S-3 본 적용(스파이크 결과에 따름) |

- 우선순위 원칙: 서비스 안정성 > 개발 속도 > 기능 완성도. 코드 변경 스프린트(239·241·242)는 서비스별 coverage threshold 하향 금지 + Critic 교차 리뷰 필수.
- 기존 이월(하네스 점검·GA4·라이브 SEO)은 본 로드맵과 독립 슬롯으로 병행.
- 로드맵은 각 스프린트 `/start` 시점에 재확인하며, 운영 인시던트 발생 시 안정성 우선으로 순서 조정 가능.

## 결과

- 본 ADR이 보안·개선 백로그의 SSOT. 항목 처리 시 해당 스프린트 ADR에서 본 문서 ID(S-N/Q-N)를 참조하고, 완료 항목은 본 문서 표에 처리 스프린트를 덧붙인다.
- High Risk 0건 확인으로 긴급 핫픽스 불필요 — 로드맵 정상 속도 진행.
