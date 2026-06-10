---
sprint: 238
title: "전 코드베이스 보안점·개선점 분석 리스트업 + 스프린트 계획 수립 (ADR-030)"
date: "2026-06-10"
status: completed
agents: [Oracle]
related_adrs: ["ADR-030", "ADR-029", "sprint-99", "sprint-235"]
related_memory: ["sprint-window", "feedback-sprint-scoping", "feedback-plan-recommendation-flow"]
topics: ["security", "audit", "planning"]
tldr: "fable 모델 전환 후 첫 스프린트. /start 인자 '모든 코드 보안점 및 개선점 분석 → 리스트업 → 스프린트 계획 수립'으로 시작. 3축 병렬 탐색(보안 표면/코드 품질/CI·인프라) 후 sprint-99 교훈에 따라 핵심 의심 항목 전수를 파일 직접 Read로 재검증 — 그 결과 예비 보고 5건이 오판/기해소/격하로 판명(Saga 보상 실재·Monaco 지연 로드 기적용·SP196 GIN 기해소·ShareLinkGuard 양호·키 네이밍은 컨벤션), 신규 발견 1건 추가(POST /api/events 비인증+plain interface라 ValidationPipe 검증 0). 결론 High Risk 0건, Medium 3건(S-1 @Public 부재·S-2 events DTO·S-3 CSP unsafe-inline)+Low 5건+개선 7건을 ADR-030(신규 영구 ADR, KR+EN)으로 SSOT화하고 처리 로드맵 Sprint 239~243 확정(quick wins→런북→BE 분해→FE 분해→공급망). 검증: ADR 게이트 6종 통과(index 영구 10·EN 186/186·links 0·i18n 0·doc-refs clean·conversion PASS), Critic(Codex gpt-5.5 --base aea9528) R1 CLEAN, PR #426 CI green auto-merge squash 22da1f3."
---
# Sprint 238 — 전 코드베이스 보안점·개선점 분석 리스트업 + 스프린트 계획 수립

## 목표

- 전 서비스(frontend/gateway/identity/submission/problem/github-worker/ai-analysis)+infra+CI를 보안·개선 관점에서 전역 감사한다.
- 검증된 발견을 우선순위 리스트로 SSOT화하고, 처리 다중 스프린트 로드맵을 수립한다.

## 배경

- `/start` 인자 "fable 모델로 변경했습니다. 우리 모든 코드 보안점 및 개선점 분석해서 리스트업한 뒤 스프린트 계획 수립하세요"로 시작. fable 모델 전환 후 첫 스프린트.
- 237스프린트 동안 보안 수정이 스프린트 단위로 산발 적용 — 전역 관점 감사는 미수행 상태였다.
- 기존 Sprint 238 후보였던 하네스 점검은 차기 슬롯으로 이월.

## 작업 요약 (start `aea9528`, 1 commit → squash `22da1f3`, PR #426)

- **3축 병렬 탐색**: Explore 에이전트 3개 동시 투입 — ①보안 표면(인증/시크릿/입력검증/외부입력/frontend/하드닝) ②코드 품질(부채/테스트/의존성/복원력/구조/DB/성능) ③CI·인프라(workflow/Dockerfile/스크립트/문서 갭).
- **검증 패스**: 탐색 보고의 핵심 의심 항목(M1~M3, I1, I4, I5 등)을 파일 직접 Read로 전수 재확인. 오판 5건 제외/격하 + 신규 1건(S-2) 발견.
- **ADR-030 작성**: 발견 리스트(Medium 3·Low 5·개선 7, 각 항목 근거 파일:라인+권장 조치+배정 스프린트) + 오판 정정 기록 + 로드맵 Sprint 239~243. 신규 영구 ADR(9→10번째), KR+EN 동시 작성, README 인덱스 갱신(다음 빈 번호 ADR-031).

## 핵심 결정

1. **High Risk 0건 → 긴급 핫픽스 불필요, 로드맵 정상 속도**: JWT HS256 고정·만료 이중검증, 전 서비스 timingSafeEqual, ValidationPipe whitelist, httpOnly 쿠키, Redis rate limit, CI 최소권한+gitleaks+Trivy, non-root Dockerfile 등 기초 태세 견고 확인.
2. **탐색 보고는 검증 패스 후 채택** (sprint-99 교훈의 제도화): 예비 보고 그대로면 "Saga 보상 부재(High)" 등 오판 5건이 백로그에 들어갈 뻔했다. 검증 패스가 신규 실 발견(S-2)도 produced — 검증은 제거만이 아니라 발견도 한다.
3. **백로그 SSOT = ADR-030**: 항목 처리 시 해당 스프린트 ADR이 S-N/Q-N ID를 참조하고, 완료 시 ADR-030 표에 처리 스프린트를 덧붙인다.
4. **로드맵 분할** ([feedback-sprint-scoping]): Sprint 239(보안 quick wins 코드) → 240(운영 런북) → 241(BE 구조 분해) → 242(FE 분해+테스트) → 243(공급망·CSP 스파이크·CI 정리). 코드 변경 스프린트는 coverage threshold 유지+Critic 필수.

## 검증

- **ADR 게이트 6종**: index count(영구 10/토픽 1/sprint 175) · EN coverage 186/186 · links 0 broken(1584 내부 링크) · i18n residue 최대 2.19%(임계 8%) · doc-refs 447 clean · conversion PASS.
- **Critic**(Codex gpt-5.5, `codex review --base aea9528`): **R1 CLEAN** — "no blocking issues were found".
- **CI PR #426**: 전 체크 green(Failed 0), auto-merge SQUASH → `22da1f3`. post-merge 로컬 main FF 동기화 + 작업 브랜치 정리 확인.

## 교훈

1. **전역 감사는 "탐색 → 검증 → 리스트업"의 2단 구조가 필수** — 병렬 탐색은 커버리지를, 검증 패스는 정확도를 담당한다. 오판 5건 제외와 신규 1건 발견이 모두 검증 패스에서 나왔다.
2. **ValidationPipe는 클래스 메타데이터 기반** — plain TS interface로 받는 바디는 whitelist 설정과 무관하게 검증이 0이다. "전 서비스 ValidationPipe 적용"이라는 사실이 "전 엔드포인트 검증됨"을 의미하지 않는다(S-2).
3. **오판 정정도 기록 자산** — 무엇이 왜 오판이었는지(비배포 미러 사건 sprint-232와 동형) ADR에 남기면 동일 항목의 재제기를 차단한다.
4. **감사 결과가 "양호"여도 산출물은 있다** — High Risk 0건이라는 사실 확인 자체와, 산발 수정 이력의 전역 좌표(로드맵)가 결과물이다.

신규패턴: **3축 병렬 탐색 + 검증 패스 감사 패턴**(Explore 병렬 커버리지 확보 → 핵심 의심 전수 직접 재확인 → 오판 정정 기록과 함께 백로그 SSOT화).

## 이월

- **(Sprint 239 확정) 보안 quick wins**: S-1 `@Public()` 도입, S-2 events DTO 검증, S-4 코드 프리뷰 로깅 제거, S-5 프롬프트 격리 가드, S-8 토큰 로그 정리, Q-5 CLAUDE.md/키 네이밍 문서 정정 — ADR-030 참조.
- 하네스 점검(harness-checkup `--full` + Codex 모델 핀 항구화) — 별도 슬롯.
- (사용자 콘솔) GA4 잔여 3건 · (사용자/운영) 라이브 SEO 검증 · 하네스 cron 검토 · (선택) webhook regenerate · 누적 UAT.
- (블로그 후속 소재) CS 퀴즈 미니게임 · 만들었다가 지운 것들 · zstd 실험 롤백.
