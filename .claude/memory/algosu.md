# AlgoSu 프로젝트 메모리

## 개요
알고리즘 스터디 관리 + AI 코드 리뷰 서비스
모놀리식(Next.js + Supabase) → MSA 전환 프로젝트

## 파일 경로
| 파일 | 경로 |
|---|---|
| MSA 아키텍처 설계서 (v3) | `/Users/leokim/Desktop/AlgoSu/plan/Project Plan/AlgoSu_MSA_Architecture_v3.md` |
| TF 킥오프 계획서 | `/Users/leokim/Desktop/AlgoSu/plan/Kick Off/AlgoSu_TF_Kickoff_Plan.md` |
| Agent 페르소나 프롬프트 | `/Users/leokim/Desktop/AlgoSu/plan/Persona Prompt/AlgoSu_TF_Persona_Prompts.md` |
| UI 디자인 시스템 | `/Users/leokim/Desktop/AlgoSu/plan/UI Mockup/algosu-ui-design.html` |
| 코드 규칙 문서 | `/Users/leokim/Desktop/AlgoSu/plan/Code Rules/AlgoSu_Code_Conventions.md` |

## 마이크로서비스 구성 (5개)
| 서비스 | 역할 | 기술 |
|---|---|---|
| Identity Service | 인증/권한 | NestJS |
| Problem Service | 문제/마감 관리 | NestJS |
| Submission Service | 코드 제출 + Saga Orchestrator | NestJS |
| GitHub Worker | 비동기 GitHub Push | Node.js |
| AI Analysis Service | Gemini API 코드 분석 | Python/FastAPI |

## AI Agent TF 구성 (10개)
| Agent | 역할 | Tier |
|---|---|---|
| Agent-00 Oracle | 최종 기획 의사결정자, PM 직접 소통 창구 | — |
| Agent-01 Gatekeeper | API Gateway + Identity Service + JWT + SSE | Tier 1 |
| Agent-02 Conductor | Submission Service + Saga Orchestrator | Tier 1 |
| Agent-03 Postman | GitHub Worker (비동기 Push) | Tier 2 |
| Agent-04 Sensei | AI Analysis Service (FastAPI + Gemini) | Tier 3 |
| Agent-05 Curator | Problem Service + CQRS Read Model | Tier 2 |
| Agent-06 Architect | k3s + CI/CD + 모니터링 인프라 | Tier 2 |
| Agent-07 Librarian | PostgreSQL + PgBouncer + TypeORM 마이그레이션 | Tier 1 |
| Agent-08 Herald | Next.js 페이지 로직 + SSE 수신 + 라우팅 | Tier 3 |
| Agent-09 Palette | 디자인 시스템 + shadcn/ui + Tailwind + 공통 컴포넌트 | Tier 3 |

## Agent 간 관계도

### 지휘 체계
```
Oracle (PM 소통 창구)
  └─ 지시 → 모든 Agent
  └─ 결정 중재: Agent 간 충돌 시 Oracle이 최종 판단
```

### 백엔드 데이터 흐름
```
Gatekeeper (API Gateway)
  ├─ JWT 검증 후 X-User-ID / X-Study-ID 헤더 주입 → 하위 서비스 전달
  ├─ Rate Limit (Redis) + X-Internal-Key 검증
  ├─ → Curator: 문제 조회/관리
  ├─ → Conductor: 코드 제출 + Saga 시작
  └─ SSE 스트림 → Herald (Redis Pub/Sub 구독)

Conductor (Submission Service)
  ├─ study_members 멤버십 검증 (M-02, v1.1)
  ├─ RabbitMQ → Postman: GitHub Push 작업 발행
  └─ RabbitMQ → Sensei: AI 분석 작업 발행

Postman (GitHub Worker)
  ├─ studies.github_repo 조회 → 스터디별 레포 Push (C-03, v1.1)
  └─ Redis Pub/Sub → Gatekeeper SSE 브로드캐스트

Sensei (AI Analysis)
  └─ Redis Pub/Sub → Gatekeeper SSE 브로드캐스트
```

### DB 의존
```
Librarian (스키마/마이그레이션 관리)
  ├─ ← Gatekeeper: identity DB (users, study_members, study_invites — v1.1 신설)
  ├─ ← Curator: problem DB (problems, studies — v1.1 FK 추가)
  └─ ← Conductor: submission DB (submissions, drafts, sagas)
```

### 프론트엔드 레이어
```
Palette (디자인 시스템)
  ├─ 제공 → Herald: 공통 UI 컴포넌트 (Button, Card, Input, Badge, Modal, Dropdown 등)
  ├─ 제공 → Herald: globals.css (CSS 변수, 테마), tailwind.config
  └─ Oracle로부터 지시 수신 → 컴포넌트 설계/재작성

Herald (Next.js 페이지 로직)
  ├─ 사용 ← Palette: 디자인 시스템 컴포넌트
  ├─ API 호출 → Gatekeeper (모든 요청에 X-Study-ID 헤더 포함 — v1.1)
  ├─ SSE 수신 ← Gatekeeper: 제출 실시간 상태
  └─ 스터디 선택 전역 상태 관리 (NEW-02, v1.1)
```

### Palette ↔ 타 Agent 협업 규칙
| 상황 | 규칙 |
|------|------|
| 신규 컴포넌트 필요 | Herald가 Oracle에게 요청 → Oracle이 Palette에게 지시 |
| 디자인 시스템 변경 | Palette 완료 후 Herald에게 `.palette-herald-sync.md` 지시서 전달 |
| 스키마/API 변경 | 백엔드 Agent 완료 후 Oracle이 Herald·Palette에게 UI 반영 지시 |
| Palette 직접 접근 불가 | 백엔드 Agent는 Palette와 직접 소통하지 않음 (Oracle 경유) |

## 핵심 아키텍처 결정 (ADR)
- **Single Source of Truth**: 자체 DB (GitHub 의존 제거)
- **Saga 패턴**: Orchestration (saga_step: DB_SAVED → GITHUB_QUEUED → AI_QUEUED → DONE)
- **DB 전략**: PostgreSQL 단일 프로세스 + 논리적 Database per Service (4개 DB)
- **메시지 큐**: RabbitMQ (prefetch=2), 트래픽 증가 시 Kafka 마이그레이션 예정
- **실시간 상태**: SSE + Redis Pub/Sub (WebSocket 미사용)
- **인프라**: OCI Free Tier 단일 VM (ARM aarch64, 24GB RAM, k3s)
- **보안**: Sealed Secrets, GitHub App Installation Token (PAT 대체)
- **Circuit Breaker**: cockatiel (Gemini API만 적용)
- **마이그레이션**: Expand-Contract 3단계 + Init Container

## 7일 구현 계획 (Phase 1+2)
- Day 1~2: 인프라 기반 + DB 스키마
- Day 3~4: Gateway, Submission, Problem Service
- Day 5~6: GitHub Worker, AI Analysis, SSE
- Day 7: 통합 검증 + Frontend 연동

## Phase 로드맵
- Phase 1: 모듈화 (Modular Monolith)
- Phase 2: AI Analysis 서비스 분리
- Phase 3: 도메인 격리 + DB 분리 (Dual Write + Reconciliation Cron)
- Phase 4: 운영 안정화 (Sealed Secrets, AlertManager, ArgoCD)

## UI 디자인
- 메인 컬러: `#947EB0` (퍼플)
- 다크모드 우선 설계
- 폰트: Sora + Noto Sans KR + DM Mono

## SLO (MVP 기준)
- 제출 API P95: 500ms 이내
- GitHub Push: 60초 이내, 성공률 93%+
- AI 분석: 10분 이내, 성공률 85%+
- 월간 가용성: 98%+

## 레포 구조
- `algosu-app/`: 서비스 모노레포 (api-gateway, identity, problem, submission, ai-analysis, github-worker, frontend)
- `algosu-infra/`: k3s 매니페스트 + ArgoCD 설정
