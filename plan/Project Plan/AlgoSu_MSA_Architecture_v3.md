# AlgoSu — MSA 전환 아키텍처 컨텍스트 문서 v3

> Architecture Context & Decision Record
> 2025년 기준 | 기술 스택 확정판 (v3: 페인포인트 해결 방안 전면 반영)

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [제출 방식 변경 (핵심 패러다임 전환)](#2-제출-방식-변경-핵심-패러다임-전환)
3. [마이크로서비스 설계](#3-마이크로서비스-설계)
4. [인프라 및 기술 스택](#4-인프라-및-기술-스택)
5. [신뢰성 설계](#5-신뢰성-설계)
6. [CI/CD 파이프라인](#6-cicd-파이프라인)
7. [모니터링 설계](#7-모니터링-설계)
8. [단계별 이행 계획](#8-단계별-이행-계획-roadmap)
9. [위험 요소 및 대응 방안](#9-위험-요소-및-대응-방안)
10. [페인포인트 해결 설계 (v3 신규)](#10-페인포인트-해결-설계-v3-신규)
11. [기술 결정 기록 (ADR)](#11-기술-결정-기록-adr-요약)

---

## 1. 프로젝트 개요

AlgoSu는 알고리즘 스터디를 효율적으로 관리하고, AI를 활용해 스터디원의 코드를 분석 및 최적화 코드를 제안하는 **서비스형 플랫폼**입니다.

### 1.1 핵심 기능

- 코드 직접 제출 및 자체 DB CRUD 관리
- 개인 / 스터디 공용 GitHub 레포 동기화 (비동기 Push)
- AI 코드 리뷰 및 최적화 제안 (Gemini)
- 주차별 문제 관리 및 마감 시간 제어
- 스터디 대시보드 및 활동 통계

### 1.2 아키텍처 전환 방향

| 구분 | AS-IS | TO-BE |
|------|-------|-------|
| 구조 | 모놀리식 (Next.js Full-stack + Supabase) | 마이크로서비스 (MSA) |
| 제출 방식 | GitHub Webhook 수신 / API 폴링 (Pull) | 자체 DB 직접 저장 후 GitHub Push |
| AI 분석 | API 요청 내 동기 처리 | 메시지 큐 기반 비동기 Worker |
| DB | 공유 Supabase 단일 DB | 서비스별 전용 DB (Database per Service) |

---

## 2. 제출 방식 변경 (핵심 패러다임 전환)

### 2.1 변경 사유

기존 GitHub 의존 방식은 GitHub API 장애, Rate Limit, 사용자 레포 권한 변경 등 외부 요인에 의해 핵심 기능이 영향을 받는 구조적 취약점이 있었습니다.
자체 DB를 제출의 **Single Source of Truth**로 삼아 서비스 안정성을 확보합니다.

### 2.2 신규 제출 플로우 (Saga Orchestration)

```
사용자 코드 제출 (AlgoSu UI)
  ↓
[Step 1] 자체 DB 저장 (동기, 즉시) ← 제출 성공 기준
  ↓ 성공
[Step 2] RabbitMQ에 GitHub Push 이벤트 발행 (비동기)
  ↓ 성공                        ↓ 실패
[Step 3] AI 분석 이벤트 발행    보상: github_sync_status = FAILED
  ↓ 성공                             사용자 알림 발송
[Step 4] 완료
  ↓ 실패
  보상: analysis_status = FAILED
       사용자 알림 발송
```

> **Saga 방식**: Orchestration (Submission Service 내 Orchestrator 포함)
> **보상 트랜잭션**: 각 Step 실패 시 상태 컬럼 업데이트 + Slack/이메일 알림

### 2.3 GitHub 동기화 전략

| 항목 | 내용 |
|------|------|
| 연동 방식 (개인) | OAuth로 사용자 GitHub 토큰 수집 → 개인 레포 Push |
| 연동 방식 (공용) | AlgoSu GitHub App으로 스터디 공용 레포 일괄 관리 |
| 실패 처리 | RabbitMQ Retry 로직 + Dead Letter Queue + 실패 상태 사용자 알림 |
| 충돌 방지 | 파일 경로 규칙화로 Merge Conflict 사전 예방 |
| sync 상태 컬럼 | `PENDING` / `SYNCED` / `FAILED` / `TOKEN_INVALID` |

---

## 3. 마이크로서비스 설계

### 3.1 서비스 도메인

| 서비스 | 주요 역할 | 핵심 엔티티 | 언어/프레임워크 |
|--------|-----------|-------------|----------------|
| Identity Service | 인증, 프로필, 역할(Admin/Member) | Profile, Role | Node.js (NestJS) |
| Problem Service | 주차별 문제 등록/조회, 마감 관리 | Problem | Node.js (NestJS) |
| Submission Service | 코드 제출 CRUD, Saga Orchestrator, 동기화 상태 관리, Draft 저장 | Submission, Draft | Node.js (NestJS) |
| GitHub Worker | GitHub Push 비동기 처리, Retry, DLQ | SyncJob | Node.js |
| AI Analysis Service | 개인 피드백, 그룹 최적화 코드 합성, Circuit Breaker | Analysis, Feedback | Python (FastAPI) |

> **Dashboard**: 독립 서비스 대신 Submission/Problem Service 이벤트를 구독하는 Read Model (CQRS) 로 구현

### 3.2 서비스 간 통신

| 통신 유형 | 사용 기술 | 사용 시나리오 |
|-----------|-----------|---------------|
| 외부 (Client → Server) | REST / HTTPS | NestJS API Gateway를 통한 모든 클라이언트 요청 |
| 실시간 상태 푸시 | SSE (Server-Sent Events) | 제출 후 GitHub 동기화 / AI 분석 진행 상태 실시간 노출 |
| 내부 비동기 | RabbitMQ | 제출 완료 → GitHub Push / AI 분석 트리거 |
| 내부 동기 | REST (내부 HTTP) | Submission → Problem Service 마감 시간 조회 |
| 상태 이벤트 브로드캐스트 | Redis Pub/Sub | Worker 상태 변경 → Gateway SSE 구독 → 클라이언트 푸시 |
| 인증 처리 | JWT (Gateway 일괄 검증) + Internal API Key | Gateway에서 토큰 검증 후 X-Internal-Key 헤더로 서비스 전달 |

> ⚠️ **gRPC 미채택**: 현재 트래픽 규모와 팀 운영 부담을 고려해 내부 동기 통신은 REST로 통일.
> 마감 시간은 Redis에 캐싱하여 조회 성능 확보.

### 3.3 내부 서비스 인증 흐름

```
[외부 클라이언트]
    ↓ Bearer JWT
[NestJS API Gateway]
    JWT 검증 후 내부 헤더로 변환
    ↓ X-User-ID: 123
    ↓ X-User-Role: ADMIN
    ↓ X-Internal-Key: {서비스별 API Key}
[내부 서비스들]
    X-Internal-Key 검증 후 처리
    외부에서 직접 접근 시 401 반환
```

- Internal API Key는 k3s Secret으로 관리, 환경변수로 주입
- 서비스별 고유 Key 발급 (서비스 간 Key 공유 금지)

---

## 4. 인프라 및 기술 스택

### 4.1 배포 환경

| 항목 | 내용 |
|------|------|
| 클라우드 | Oracle Cloud Infrastructure (OCI) |
| VM 스펙 | VM.Standard.A1.Flex (ARM aarch64, Ubuntu 24.04 Minimal) |
| VM 수량 | **1대** (Free Tier 최대 스펙 단독 점유 — 24GB RAM / 4 OCPU) |

> **1대 선택 이유**: 총 리소스는 2대와 동일하나, 마감 직전 폭주 시 전체 24GB를 탄력적으로 배분 가능. k3s 멀티노드 운영 복잡도 제거. 진짜 SPoF는 VM이 아닌 OCI 리전 자체이므로 2대로 나눠도 리전 장애에는 동일하게 취약.

### 4.2 기술 스택

| 레이어 | 기술 | 비고 |
|--------|------|------|
| Frontend | Next.js (App Router), Tailwind CSS | |
| API Gateway | **Custom NestJS Gateway** | JWT 검증, 라우팅, Rate Limit (Redis 기반), SSE 엔드포인트 |
| 컨테이너 | **k3s** (경량 K8s) | ARM 공식 지원, Free Tier 최적화. 트래픽 증가 시 풀 K8s 전환 |
| 모니터링 | Prometheus + Grafana + Loki | 메트릭, 알림, 로그 중앙 수집. **스크랩 주기 30s, 로그 보존 72h** |
| DB (핵심) | **PostgreSQL 단일 프로세스 + PgBouncer** | 논리적 Database per Service (identity_db / problem_db / submission_db / analysis_db) |
| 캐시 / Pub/Sub | Redis | 세션 캐시, 마감 시간 캐싱, Rate Limit, **SSE 상태 브로드캐스트, GitHub App 토큰 캐시** |
| 메시지 큐 | **RabbitMQ** (prefetch=2) | 비동기 이벤트. 트래픽 증가 시 Kafka 마이그레이션 |
| 코드 저장 | PostgreSQL text 컬럼 | 대용량 시 S3 전환 검토 |
| CI | GitHub Actions | 변경 서비스만 빌드 (path filter) |
| CD | GitHub Actions (초기) → ArgoCD (GitOps, 서비스 증가 시) | |
| 이미지 레지스트리 | GHCR (GitHub Container Registry) | |
| Secret 관리 | **k3s Secret + Sealed Secrets** | GitHub OAuth 토큰 등 민감 정보 암호화 저장 |
| GitHub Bot 인증 | **GitHub App (Installation Token)** | 1시간 자동 만료, Rate Limit 15,000 req/h |

### 4.3 예상 리소스 배분 (24GB 기준)

| 컴포넌트 | RAM 할당 | 비고 |
|----------|---------|------|
| NestJS 서비스 × 4 | 1.6GB (각 400MB) | |
| AI Analysis Service | 2GB | 버스트 여유 확보 |
| PostgreSQL + PgBouncer | 1GB | 4개 DB 통합 운영 |
| RabbitMQ | 512MB | |
| Redis | 256MB | |
| 모니터링 스택 | 1.5GB | **상한선 필수 설정** |
| k3s 시스템 | 512MB | |
| **합계** | **~7.4GB** | 마감 폭주 시 버퍼 충분 |

---

## 5. 신뢰성 설계

### 5.1 Circuit Breaker

| 적용 대상 | 라이브러리 | Fallback 전략 |
|-----------|-----------|---------------|
| AI Analysis Service → Gemini API | `cockatiel` | `analysis_status = DELAYED` + "분석 지연 중" 알림 |
| GitHub Worker → GitHub API | Retry + Dead Letter Queue | `github_sync_status = FAILED` + 사용자 알림 |

**Circuit Breaker 동작 기준 (Gemini API)**

```
실패율 50% 초과 시  → Circuit OPEN (요청 즉시 차단, fallback 반환)
30초 후            → HALF-OPEN (소량 요청 테스트)
테스트 성공 시     → Circuit CLOSE (정상화)
```

### 5.2 코드 제출 입력값 검증

| 검증 레이어 | 검증 항목 |
|-------------|-----------|
| **Gateway (1차)** | 코드 최대 용량 100KB 초과 차단, 빈 값(최소 10자) 차단 |
| **Submission Service (2차)** | 허용 언어 타입 검증, 마감 시간 경계 처리 (서버 시각 기준), 중복 제출 멱등성 처리 |

---

## 6. CI/CD 파이프라인

### 6.1 전체 흐름

```
[PR 머지 → main 브랜치]
  ↓
[GitHub Actions - CI]
  1. 변경된 서비스 감지 (path filter)
  2. 단위 테스트 실행
  3. Docker 이미지 빌드 (ARM aarch64)
  4. GHCR에 이미지 푸시 (태그: main-{git-sha})
  5. k3s 매니페스트 image 태그 업데이트
  ↓
[GitHub Actions - CD (초기) / ArgoCD (서비스 증가 후)]
  6. 매니페스트 변경 감지
  7. Init Container: DB 마이그레이션 실행 (완료 후 앱 시작)
  8. k3s Rolling Update 배포
  9. Liveness Probe 통과 시 완료 / 실패 시 자동 롤백
```

> `latest` 태그 사용 금지 — 반드시 `main-{git-sha}` 태그로 롤백 보장

### 6.2 DB 마이그레이션 전략

**도구**: TypeORM 내장 Migration

**실행 주체**: Init Container (앱 Pod 시작 전 선행 실행)

```yaml
spec:
  initContainers:
    - name: db-migrate
      image: ghcr.io/algosu/submission-service:main-{git-sha}
      command: ["npm", "run", "migration:run"]
  containers:
    - name: submission-service
      image: ghcr.io/algosu/submission-service:main-{git-sha}
```

**Expand-Contract 패턴 (파괴적 변경 금지)**

Rolling Update 중 구/신 버전이 공존하는 시간이 있으므로, 컬럼 삭제·rename은 반드시 3단계로 분리합니다.

| 변경 유형 | 안전 여부 | 처리 방법 |
|-----------|----------|-----------|
| 컬럼 추가 (nullable) | ✅ 안전 | 한 번에 배포 |
| 컬럼 추가 (NOT NULL) | ⚠️ 주의 | DEFAULT 값 필수 지정 |
| 컬럼 삭제 / rename | ❌ 위험 | 3단계 Expand-Contract |
| 인덱스 추가 | ✅ 안전 | CONCURRENTLY 옵션 사용 |

```
[배포 1 - Expand]   새 컬럼 추가, 구 컬럼 유지, 신버전은 양쪽 모두 사용
[배포 2 - Migrate]  데이터 복사 완료, 코드는 새 컬럼만 사용
[배포 3 - Contract] 구 컬럼 삭제
```

### 6.3 레포지토리 구조

```
algosu-app/
├─ api-gateway/
├─ identity-service/
├─ problem-service/
├─ submission-service/
├─ ai-analysis-service/
├─ github-worker/
└─ frontend/

algosu-infra/
├─ apps/
│  ├─ submission-service/
│  │  ├─ deployment.yaml
│  │  └─ values.yaml
│  └─ ai-analysis-service/
└─ argocd/
   └─ applications.yaml
```

---

## 7. 모니터링 설계

### 7.1 서비스별 핵심 메트릭

| 서비스 | 핵심 메트릭 |
|--------|-------------|
| Submission Service | 제출 성공/실패율, 마감 직전 요청 급증 감지, Saga 단계별 완료율 |
| GitHub Worker | 동기화 큐 적체량, Push 성공/실패율, 재시도 횟수, DLQ 적체, TOKEN_INVALID 발생률 |
| AI Analysis Service | 큐 대기 시간, 분석 완료율, Gemini API 응답 시간, Circuit Breaker 상태 |
| Identity Service | 인증 실패율, 토큰 만료 빈도 |
| 전체 공통 | Pod CPU/Memory, HTTP 응답 시간 (P95), 에러율 (5xx) |

**알림 채널**: Prometheus AlertManager → Slack / 이메일

### 7.2 SLO (서비스 수준 목표) — MVP 기준

| 서비스 | 측정 항목 | MVP SLO | 향후 목표 |
|--------|-----------|---------|----------|
| Submission Service | API 응답시간 P95 | 500ms 이내 | 300ms |
| Submission Service | 제출 성공률 | 99% 이상 | 99.5% |
| GitHub Worker | Push 완료 시간 | 제출 후 60초 이내 | 30초 |
| GitHub Worker | 동기화 성공률 | 93% 이상 | 95% |
| AI Analysis Service | 분석 완료 시간 | 제출 후 10분 이내 | 5분 |
| AI Analysis Service | 분석 성공률 | 85% 이상 | 90% |
| Identity Service | 인증 API 응답시간 P95 | 300ms 이내 | 200ms |
| 전체 서비스 | 월간 가용성 | 98% 이상 (약 14시간 허용) | 99% |

---

## 8. 단계별 이행 계획 (Roadmap)

| Phase | 목표 | 주요 작업 |
|-------|------|-----------|
| **Phase 1** | 모듈화 (Modular Monolith) | 도메인별 폴더 구조 분리, 자체 제출 DB 설계 (saga_step 컬럼 포함), GitHub Worker 초기 구현, NestJS Gateway 구현, Draft API 구현 |
| **Phase 2** | AI Analysis 서비스 분리 | FastAPI Worker 추출, RabbitMQ 도입, 제출-분석 비동기 디커플링, Circuit Breaker (cockatiel) 적용, SSE 상태 노출 구현 |
| **Phase 3** | 도메인 격리 및 DB 분리 | Submission/Problem Service 독립 컨테이너화, **Dual Write 3단계**로 서비스별 전용 DB 이관, Reconciliation Cron 운영 |
| **Phase 4** | 운영 안정화 | Sealed Secrets 도입, Loki 중앙 로깅, AlertManager 알림 채널 연동, SLO 모니터링 대시보드 구성, GitHub App 전환 |

### Phase 3 Dual Write 상세 절차

```
[1단계 - Expand]
  구 DB 쓰기 + 새 DB 동시 쓰기
  읽기는 구 DB에서만
  Reconciliation Cron 시작 (매 1시간, md5 checksum 비교)
      ↓
  72시간 연속 불일치 0건 확인

[2단계 - Switch Read]
  읽기를 새 DB로 전환
  쓰기는 여전히 양쪽 유지
  Reconciliation 계속 실행
      ↓
  48시간 이상 안정 확인

[3단계 - Contract]
  구 DB 쓰기 코드 제거 → 이관 완료 ✅
  Reconciliation Cron 중단
```

**2단계 전환 조건 체크리스트**

- 72시간 연속 Reconciliation 통과 (불일치 0건)
- Dual Write 기간 중 신 DB 쓰기 실패율 0%
- 신 DB 쿼리 응답시간 P95가 구 DB와 동등 수준
- 팀 수동 샘플링 확인 (랜덤 10건 직접 비교)

> 롤백 필요 시: 읽기를 구 DB로 즉시 전환 가능 (데이터 양쪽 보존)

---

## 9. 위험 요소 및 대응 방안

| 위험 요소 | 대응 방안 |
|-----------|-----------|
| 데이터 일관성 | Saga Orchestration 패턴으로 분산 트랜잭션 대체, Eventual Consistency 수용 |
| Saga 중단 복구 | saga_step 컬럼 영속화 + 서비스 startup hook에서 미완료 Saga 자동 재개 |
| 운영 복잡도 | GitHub Actions + k3s 자동화로 수동 배포 제거, 서비스 증가 시 ArgoCD 도입 |
| 팀 역량 | Phase별 점진적 전환으로 학습 곡선 분산 |
| GitHub Push 실패 | RabbitMQ Retry + Dead Letter Queue + 실패 상태 사용자 알림 |
| GitHub 토큰 만료 | GitHub App Installation Token (1시간 자동 갱신) + Redis 캐시 + 개인 토큰 TOKEN_INVALID 상태 처리 |
| AI 비용 폭증 | Gemini API Circuit Breaker + 호출 상한선 + Grafana 사용량 모니터링 |
| 이미지 태그 관리 | `latest` 태그 사용 금지, `main-{git-sha}` 태그로 롤백 보장 |
| OAuth 토큰 노출 | k3s Secret + Sealed Secrets으로 암호화 저장, Git 커밋 금지 |
| Phase 3 다운타임 | Dual Write 3단계 + Reconciliation Cron으로 무중단 검증 이관 |
| Free Tier 리소스 경합 | k3s Resource Limit 전 서비스 필수 설정, PostgreSQL 단일 프로세스 통합, 모니터링 스택 상한선 설정 |
| Rolling Update + 스키마 충돌 | Init Container 마이그레이션 + Expand-Contract 3단계 패턴 |
| 브라우저 종료 시 코드 소실 | Auto-save (localStorage + 서버 Draft API) |

---

## 10. 페인포인트 해결 설계 (v3 신규)

### 10.1 Saga 상태 영속화

**문제**: Submission Service 재시작 시 진행 중인 Saga 상태가 메모리에서 소실될 수 있음.

**해결**: `submissions` 테이블에 `saga_step` 컬럼 추가. 서비스 재시작 시 startup hook에서 미완료 Saga를 자동 감지 및 재개.

```sql
-- submissions 테이블 추가 컬럼
saga_step  ENUM('DB_SAVED', 'GITHUB_QUEUED', 'AI_QUEUED', 'DONE')
```

```sql
-- 서비스 시작 시 미완료 Saga 조회
SELECT * FROM submissions
WHERE saga_step NOT IN ('DONE')
AND created_at > NOW() - INTERVAL '1 hour';
```

**멱등성 보장 순서**: DB 업데이트(saga_step 갱신) → RabbitMQ 발행 순서 고정. 역순 시 재시작 후 중복 발행 위험.

---

### 10.2 GitHub Bot 토큰 생애주기 관리

**문제**: Bot 계정 PAT/OAuth 토큰은 사람 계정에 종속되어 비밀번호 변경, 2FA 설정만으로도 전체 스터디 동기화가 일괄 중단될 수 있음.

**해결**: GitHub App 기반 Installation Token 방식으로 전환.

| 항목 | PAT / OAuth | GitHub App |
|------|------------|------------|
| 토큰 종속 | 사람 계정 | App 자체 |
| 유효기간 | 무기한 or 설정값 | 1시간 (자동 갱신) |
| Rate Limit | 5,000 req/h | **15,000 req/h** |
| 탈취 피해 | 계정 전체 노출 | 1시간 내 자동 만료 |

**갱신 전략**: Cron 50분마다 Installation Token 재발급 → Redis 캐시(TTL 3600s). Redis miss 시 즉시 재발급 fallback.

**개인 사용자 토큰 실패 처리**:

```
401 Unauthorized → github_sync_status = TOKEN_INVALID
                   사용자에게 "GitHub 재연동 필요" 알림
                   재연동 전까지 해당 사용자 Push 스킵 (재시도 대상 제외)

403 Forbidden    → 동일하게 TOKEN_INVALID 처리
기타 5xx         → 기존 Retry + DLQ 로직 유지
```

---

### 10.3 Dual Write Reconciliation

**문제**: Phase 3 Dual Write 기간 중 구 DB ↔ 새 DB 데이터 불일치를 감지할 방법이 없었음.

**해결**: 자동화 Reconciliation Cron + 명확한 전환 조건.

```
[Reconciliation Cron - 매 1시간]
  최근 2시간 변경분 대상으로 md5 checksum 비교
  불일치 발견 시 → Slack 알림 + 2단계 전환 차단 플래그 설정
```

```sql
-- checksum 비교 쿼리 (PostgreSQL)
SELECT id, md5(row_to_json(p)::text) AS checksum
FROM problems p
WHERE updated_at > NOW() - INTERVAL '2 hours';
```

**DB 분리 우선순위**: Problem Service → Submission Service → Identity Service 순. 변경 빈도가 낮고 의존성이 적은 것부터 분리하여 팀이 절차를 경험 후 핵심 서비스로 진행.

---

### 10.4 비동기 처리 실시간 상태 노출 (SSE)

**문제**: 제출 후 GitHub 동기화(최대 60초) + AI 분석(최대 10분) 진행 상태를 사용자가 확인할 방법 없음.

**해결**: SSE(Server-Sent Events) + Redis Pub/Sub 조합. WebSocket 대비 구현 공수 절반, 서버 재시작 시 클라이언트 자동 재연결.

**전체 흐름**:

```
[GitHub Worker / AI Analysis Service]
  상태 변경 시 Redis Pub/Sub에 publish
      ↓
[NestJS Gateway - GET /sse/submissions/:id]
  Redis 채널 구독 → SSE 스트림으로 클라이언트에 푸시
      ↓
[Next.js 클라이언트]
  EventSource API로 수신 → UI 상태 업데이트
  최종 상태(DONE/FAILED) 수신 시 연결 자동 종료
```

**UI 상태 표현**:

```
제출 직후:   ✅ 제출 완료  |  ⏳ GitHub 동기화 중...  |  ⏳ AI 분석 대기 중...
GitHub 완료: ✅ 제출 완료  |  ✅ GitHub 동기화 완료  |  ⏳ AI 분석 중... (약 5~10분)
전체 완료:   ✅ 제출 완료  |  ✅ GitHub 동기화 완료  |  ✅ AI 분석 완료 → 피드백 보기
실패 시:     ✅ 제출 완료  |  ❌ GitHub 동기화 실패 · 재시도 예정
```

**노출 위치**: 제출 페이지 인라인(즉각 피드백) + 상단 벨 아이콘(페이지 이동 후 추적).

---

### 10.5 Auto-save (브라우저 종료 시 코드 소실 방지)

**문제**: 코드 작성 중 브라우저 종료/탭 닫기 시 작성 내용 전체 소실.

**해결**: localStorage(즉각) + 서버 Draft API(30초마다) 2계층 저장.

**저장 주기**: debounce 1초 → localStorage 저장 / 마지막 서버 저장으로부터 30초 경과 시 Draft API 호출.

**drafts 테이블**:

```sql
CREATE TABLE drafts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  problem_id  UUID NOT NULL,
  code        TEXT,
  language    VARCHAR(20),
  saved_at    TIMESTAMP DEFAULT NOW(),
  UNIQUE (user_id, problem_id)   -- 문제당 1개 초안만 유지
);
```

**복원 우선순위**: 서버 Draft와 localStorage 중 saved_at이 더 최근인 것 우선 복원.

**정리 정책**:
- 정식 제출 완료 시 Draft 즉시 삭제 (트랜잭션 내)
- 매일 새벽 3시 Cron으로 7일 이상 된 Draft 자동 삭제

---

### 10.6 Free Tier 리소스 경합 대응

**k3s Resource Limit 필수 설정** (모든 Pod에 requests/limits 명시)

```yaml
# AI Analysis Service (가장 넉넉하게)
resources:
  requests: { memory: "512Mi", cpu: "250m" }
  limits:   { memory: "2Gi",   cpu: "1000m" }

# 모니터링 스택 (상한선 필수 — 없으면 Loki가 무제한 증가)
resources:
  requests: { memory: "256Mi", cpu: "100m" }
  limits:   { memory: "1Gi",   cpu: "500m" }
```

**PostgreSQL 통합**: Database per Service 원칙 유지하되, 물리적 프로세스는 1개. 서비스별 database + 사용자 권한으로 논리적 격리.

```
PostgreSQL 프로세스 1개 + PgBouncer 1개
├── database: identity_db    (identity_user 전용)
├── database: problem_db     (problem_user 전용)
├── database: submission_db  (submission_user 전용)
└── database: analysis_db    (analysis_user 전용)
```

**AI Worker 처리량 제한**: RabbitMQ prefetch count = 2. 마감 폭주 시 나머지는 큐 대기, 서비스 전체 안정성 우선.

**모니터링 스택 경량화**:
- Prometheus 스크랩 주기: 15s → 30s
- Loki 로그 보존 기간: 72h

---

## 11. 기술 결정 기록 (ADR 요약)

| 결정 항목 | 선택 | 미채택 대안 | 사유 |
|-----------|------|------------|------|
| API Gateway | Custom NestJS | Kong, AWS API Gateway | ARM Free Tier 메모리 절감, 팀 친숙 스택 |
| 메시지 큐 | RabbitMQ | Kafka, Redis Stream | Task Queue 패턴 적합, ARM 안정 지원. 트래픽 증가 시 Kafka 마이그레이션 예정 |
| 컨테이너 오케스트레이션 | k3s | 풀 K8s, Docker Compose | ARM 공식 지원, Free Tier 리소스 최적화 |
| VM 수량 | 1대 | 2대 | 총 리소스 동일, 탄력적 배분 유리, 운영 단순성 |
| 내부 서비스 인증 | Internal API Key | 네트워크 신뢰, mTLS | 보안성과 구현 단순성 균형 |
| Saga 패턴 | Orchestration | Choreography | 장애 추적 명확, 보상 트랜잭션 중앙 관리 |
| Saga 상태 저장 | submissions 테이블 컬럼 | 별도 Saga 테이블, Temporal | 추가 인프라 없음, 기존 컬럼과 자연스러운 통합 |
| DB 이관 전략 | Dual Write + Reconciliation Cron | Feature Flag + Strangler Fig | 코드 레벨 구현, 무중단, 자동 검증 |
| GitHub Bot 인증 | GitHub App Installation Token | PAT, OAuth Token | 사람 계정 독립, 1시간 자동 만료, Rate Limit 3배 |
| 실시간 상태 노출 | SSE + Redis Pub/Sub | WebSocket, Polling | 단방향 충분, 구현 단순, 자동 재연결 |
| Auto-save | localStorage + 서버 Draft API | localStorage 단독, 서버 단독 | 네트워크 장애 대응 + 다기기 복원 조합 |
| PostgreSQL 운영 | 단일 프로세스 + PgBouncer | 서비스별 독립 프로세스 | Free Tier 메모리 절감, 논리적 격리 유지 |
| DB 마이그레이션 | TypeORM Migration + Init Container | auto-migrate, Flyway | NestJS 친화적, Rolling Update 안전성 보장 |
| Circuit Breaker | cockatiel (Gemini만) | nestjs-resilience, 전체 적용 | 경량, GitHub Worker는 Retry로 충분 |
| Secret 관리 | Sealed Secrets | HashiCorp Vault | Vault 운영 리소스 부담 제거 |
| SLO 기준 | MVP 여유 기준 | 엄격한 기준 | OCI Free Tier 단일 노드 환경, 초기 안정화 우선 |

---

> **문서 버전**: v3
> **최종 수정**: 2025년
> **변경 이력**: v1 초안 → v2 설계 결정 반영 → v3 페인포인트 7개 해결 방안 전면 반영
