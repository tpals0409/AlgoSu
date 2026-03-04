# AlgoSu MSA 전환 TF — 킥오프 계획서

> 작성일: 2025년  
> 문서 버전: v1.0  
> 기반 문서: AlgoSu MSA Architecture Context v3

---

## 1. 프로젝트 목표 요약

AlgoSu 플랫폼을 모놀리식(Next.js + Supabase) 구조에서 **5개 마이크로서비스 기반 MSA**로 전환한다.  
1주일 내 핵심 구현(Phase 1~2)을 완료하고, 이후 애자일 스프린트로 Phase 3~4를 지속 확장한다.

---

## 2. TF 팀 구성 (AI Agent 기준)

> 각 Agent는 독립적인 실행 단위로, 역할 범위를 명확히 분리하여 병렬 작업을 극대화한다.

### 2.1 Agent 구성표

| Agent | 이름(역할) | 담당 서비스 / 영역 | 핵심 책임 |
|-------|-----------|-------------------|-----------|
| **Agent-00** | **Oracle(심판관)** | 전체 프로젝트 기획 의사결정 | 아키텍처 결정 최종 확정, Agent 간 충돌 중재, Phase 이행 승인, ADR 기반 판단 |
| **Agent-01** | **Gatekeeper(관문지기)** | API Gateway, Identity Service | JWT 검증 미들웨어, 내부 API Key 발급/관리, Rate Limit(Redis), 라우팅 설정 |
| **Agent-02** | **Conductor(지휘자)** | Submission Service, Saga Orchestrator | 코드 제출 CRUD, Saga 상태 관리(saga_step 컬럼), Draft API, 멱등성 처리 |
| **Agent-03** | **Postman(배달부)** | GitHub Worker | RabbitMQ 소비자, GitHub App Installation Token 갱신, Retry/DLQ 처리, 동기화 상태 관리 |
| **Agent-04** | **Sensei(분석가)** | AI Analysis Service (FastAPI) | Claude API 연동, Circuit Breaker, RabbitMQ 소비자, 분석 결과 저장 |
| **Agent-05** | **Curator(출제자)** | Problem Service, CQRS Read Model | 주차별 문제 CRUD, 마감 시간 관리, Redis 캐시, Dashboard Read Model 이벤트 구독 |
| **Agent-06** | **Architect(기반설계자)** | k3s, CI/CD, 모니터링 | k3s 매니페스트 관리, GitHub Actions 파이프라인, Prometheus/Grafana/Loki, Sealed Secrets |
| **Agent-07** | **Librarian(기록관리자)** | PostgreSQL, PgBouncer, TypeORM | DB 스키마 설계, TypeORM Migration 작성, Init Container 설정, Expand-Contract 패턴 적용 |
| **Agent-08** | **Herald(전령)** | Next.js, EventSource API | 코드 제출 UI, SSE 상태 표시 컴포넌트, Auto-save(localStorage + Draft API), 재연동 알림 |

**총 Agent 수: 9개 (Oracle 포함)**

### 2.2 Agent 간 의존관계

```
Librarian(기록관리자) ───────────────────────────────┐
                                                      ↓
Gatekeeper(관문지기) ──→ Conductor(지휘자) ───────→ Postman(배달부)
                    ↘                           ↘
                     Curator(출제자)              Sensei(분석가)
                                                      
Architect(기반설계자) ── 전체 서비스 배포/운영 지원
Herald(전령) ── Gatekeeper/Conductor/Curator API 소비
```

---

## 3. 1주일 구현 계획 (Phase 1 + Phase 2)

### 3.1 전체 일정 개요

| 기간 | 목표 | 완료 기준 |
|------|------|-----------|
| **Day 1~2** | 인프라 기반 + DB 스키마 확정 | k3s 클러스터 기동, 4개 DB 생성, 기본 CI 파이프라인 동작 |
| **Day 3~4** | 핵심 서비스 구현 (Gateway, Submission, Problem) | 코드 제출 API E2E 동작, Saga 상태 저장 확인 |
| **Day 5~6** | 비동기 처리 구현 (GitHub Worker, AI Analysis) | RabbitMQ 연동, GitHub Push 동작, AI 분석 이벤트 소비 |
| **Day 7** | SSE + Frontend 연동 + 통합 검증 | 제출 → GitHub Push → AI 분석 전체 플로우 UI에서 확인 |

---

### 3.2 일별 상세 작업 (Agent별)

#### Day 1 — 인프라 기반 구축

| Agent | 작업 |
|-------|------|
| Architect(기반설계자) | OCI VM 환경 확인, k3s 설치, GHCR 연결, GitHub Actions 기본 파이프라인 작성 |
| Librarian(기록관리자) | PostgreSQL + PgBouncer 컨테이너 구성, 4개 database 생성(identity/problem/submission/analysis_db), 사용자 권한 분리 |
| Gatekeeper(관문지기) | NestJS API Gateway 프로젝트 초기화, JWT 검증 미들웨어 기본 구현 |

#### Day 2 — DB 스키마 + 핵심 Entity 설계

| Agent | 작업 |
|-------|------|
| Librarian(기록관리자) | TypeORM Migration 파일 작성 (submissions 테이블 — saga_step ENUM 포함, drafts 테이블, problems 테이블, identity 테이블) |
| Gatekeeper(관문지기) | Rate Limit(Redis 기반) 미들웨어, Internal API Key 발급 로직, 라우팅 테이블 구성 |
| Curator(출제자) | Problem Service NestJS 프로젝트 초기화, 마감 시간 Redis 캐싱 구조 설계 |

#### Day 3 — Submission Service + Saga Orchestrator 구현

| Agent | 작업 |
|-------|------|
| Conductor(지휘자) | 코드 제출 CRUD API 구현, Saga Orchestrator 클래스 작성(saga_step 상태 전이 로직), Draft API(UPSERT) 구현 |
| Librarian(기록관리자) | Init Container 마이그레이션 k8s YAML 작성, 멱등성 보장 순서 검증(DB 업데이트 → MQ 발행) |
| Curator(출제자) | 주차별 문제 등록/조회 API, 마감 시간 조회(캐시 우선), Submission Service 내부 HTTP 연동 |

#### Day 4 — Gateway 완성 + 서비스 간 통신 연결

| Agent | 작업 |
|-------|------|
| Gatekeeper(관문지기) | X-User-ID / X-User-Role / X-Internal-Key 헤더 전달 로직 완성, 각 서비스별 라우팅 연결, 코드 입력값 1차 검증(100KB, 최소 10자) |
| Conductor(지휘자) | Submission Service 2차 검증(언어 타입, 마감 시간 서버 기준, 중복 제출 멱등성) 완성, 서비스 startup hook — 미완료 Saga 자동 재개 로직 |
| Herald(전령) | Next.js 코드 제출 UI 페이지 구현, Auto-save(debounce 1초 → localStorage, 30초 → Draft API) 구현 |

#### Day 5 — RabbitMQ + GitHub Worker 구현

| Agent | 작업 |
|-------|------|
| Postman(배달부) | RabbitMQ 소비자 구현(prefetch=2), GitHub App Installation Token Cron(50분 갱신, Redis TTL 3600s), Retry 로직 + Dead Letter Queue 설정, TOKEN_INVALID / 5xx 오류 분기 처리 |
| Architect(기반설계자) | RabbitMQ k3s 배포, Redis Pub/Sub 채널 구성, k3s Resource Limit 전 서비스 적용 |
| Conductor(지휘자) | RabbitMQ GitHub Push 이벤트 발행 연동(Saga Step 2), 보상 트랜잭션(FAILED 상태 업데이트 + 알림) 구현 |

#### Day 6 — AI Analysis Service + SSE 구현

| Agent | 작업 |
|-------|------|
| Sensei(분석가) | FastAPI AI Analysis Worker 구현, RabbitMQ 소비자, Claude API 연동, Circuit Breaker(실패율 50%, HALF-OPEN 30초), analysis_status = DELAYED fallback 처리 |
| Gatekeeper(관문지기) | SSE 엔드포인트(`GET /sse/submissions/:id`) 구현, Redis Pub/Sub 구독 → SSE 스트림 전달, 최종 상태(DONE/FAILED) 수신 시 연결 종료 |
| Architect(기반설계자) | Prometheus + Grafana + Loki 배포(스크랩 30s, 로그 보존 72h), 모니터링 스택 Resource Limit 설정 |

#### Day 7 — 통합 검증 + 프론트 SSE 연동

| Agent | 작업 |
|-------|------|
| Herald(전령) | EventSource API SSE 수신 구현, UI 상태 3단계 표시(제출완료 / GitHub동기화 / AI분석), 상단 벨 아이콘 알림, 재연동 필요 시 안내 메시지 |
| Conductor(지휘자) | 전체 Saga 플로우 E2E 테스트(제출 → GitHub Push → AI 분석 → DONE) |
| Architect(기반설계자) | Rolling Update 검증, Liveness Probe 동작 확인, 이미지 태그 `main-{git-sha}` 규칙 점검 |
| Librarian(기록관리자) | Sealed Secrets 적용(GitHub OAuth 토큰, Internal API Key), k3s Secret 환경변수 주입 확인 |

---

## 4. 킥오프 미팅 아젠다 (Day 0)

> 전체 Agent 동기화를 위한 사전 정렬 세션

| 순서 | 항목 | 시간 | 담당 |
|------|------|------|------|
| 1 | 프로젝트 목표 및 아키텍처 브리핑 | 15분 | Oracle(심판관) |
| 2 | Agent별 역할 및 경계 확인 | 10분 | Oracle(심판관) + 전체 |
| 3 | 인터페이스 계약 확정 (내부 API 스펙, MQ 메시지 포맷) | 20분 | Gatekeeper / Conductor / Postman / Sensei |
| 4 | DB 스키마 최종 확인 | 10분 | Librarian(기록관리자) |
| 5 | 개발 환경 및 브랜치 전략 공유 | 10분 | Architect(기반설계자) |
| 6 | 완료 기준(Definition of Done) 합의 | 10분 | Oracle(심판관) + 전체 |
| 7 | 리스크 공유 및 에스컬레이션 기준 | 5분 | Oracle(심판관) |

---

## 5. Definition of Done (완료 기준)

### 1주일 완료 기준 (Phase 1 + 2)

- [ ] 코드 제출 → 자체 DB 저장이 P95 500ms 이내로 동작
- [ ] Saga saga_step 컬럼이 `DB_SAVED → GITHUB_QUEUED → AI_QUEUED → DONE` 순서로 정상 전이
- [ ] GitHub Worker가 제출 후 60초 이내 Push 완료 (성공률 93% 이상)
- [ ] AI Analysis Service가 Circuit Breaker 동작 포함 정상 소비
- [ ] SSE로 UI에서 실시간 상태 3단계 표시 확인
- [ ] Auto-save Draft API 정상 동작 (localStorage 1초, 서버 30초)
- [ ] 서비스 재시작 후 미완료 Saga 자동 재개 확인
- [ ] 모든 Pod에 k3s Resource Limit 설정 완료
- [ ] `main-{git-sha}` 이미지 태그로 CI/CD 파이프라인 정상 동작

---

## 6. 리스크 관리

| 리스크 | 발생 가능성 | 영향도 | 대응 방안 | 담당 |
|--------|------------|--------|-----------|------|
| Saga 보상 트랜잭션 누락 | 중 | 높음 | Day 3~4 멱등성 테스트 필수화, saga_step 상태 로그 상시 확인 | Conductor(지휘자) |
| RabbitMQ 연동 지연 | 중 | 중 | Day 5 시작 전 MQ 메시지 포맷 계약 문서화 | Postman(배달부) |
| Free Tier 리소스 경합 | 낮음 | 높음 | Day 6 이전 전 서비스 Resource Limit 강제 적용 | Architect(기반설계자) |
| GitHub App 토큰 Cron 미완성 | 중 | 높음 | Day 5에 Redis fallback 로직 포함하여 완성 | Postman(배달부) |
| AI Analysis 비용 폭증 | 낮음 | 높음 | Circuit Breaker + Grafana 사용량 알림 Day 6 완료 | Sensei(분석가) / Architect(기반설계자) |
| 일정 내 SSE 미완성 | 낮음 | 중 | Herald Day 6 의존성 조기 연결(Gatekeeper SSE 엔드포인트 Day 6) | Gatekeeper(관문지기) / Herald(전령) |

---

## 7. 애자일 확장 계획 (1주일 이후)

1주일 구현 완료 후, 2주 스프린트 단위로 Phase 3~4를 진행한다.

| 스프린트 | Phase | 목표 |
|---------|-------|------|
| Sprint 1~2 | Phase 3 | Problem DB 분리 (Dual Write + Reconciliation Cron 72시간 검증) |
| Sprint 3~4 | Phase 3 | Submission DB 분리, Identity DB 분리 |
| Sprint 5 | Phase 4 | Sealed Secrets 전환, AlertManager 알림 채널, SLO 대시보드 |
| Sprint 6 | Phase 4 | GitHub App 완전 전환, ArgoCD GitOps 도입 검토 |

---

## 8. 커뮤니케이션 규칙

| 항목 | 규칙 |
|------|------|
| 일일 동기화 | 매일 EOD — 각 Agent 진행 상황 + 블로커 공유 |
| 인터페이스 변경 | API 스펙/MQ 메시지 포맷 변경 시 관련 Agent에 즉시 공유 |
| 에스컬레이션 기준 | 4시간 이상 블로커 미해소 시 Oracle(심판관)에게 즉시 보고 |
| 최종 결정 | 아키텍처 방향·인터페이스 계약·Phase 이행 순서는 Oracle(심판관)이 최종 확정 |
| 브랜치 전략 | `feature/{agent-id}/{기능명}` → PR → main 머지 |
| 이미지 태그 | `latest` 사용 금지 — 반드시 `main-{git-sha}` |

---

> **문서 버전**: v1.0  
> **다음 업데이트 기준**: Day 7 통합 검증 완료 후 Sprint 계획으로 갱신
