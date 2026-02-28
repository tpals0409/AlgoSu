# Phase 3: DB 분리 스프린트 계획서

> 작성일: 2026-02-28
> 작성자: Oracle (PM 위임)
> 참조: AlgoSu_MSA_Architecture_v3.md §8, §10.3

---

## 1. 현황 분석

### 1.1 현재 구조 (Phase 2 완료 후)

```
PostgreSQL 16.3 (단일 인스턴스, 포트 5432)
├── identity_db   (identity_user)  → users, studies, study_members, study_invites
├── problem_db    (problem_user)   → problems
├── submission_db (submission_user)→ submissions, drafts
└── analysis_db   (analysis_user)  → (미사용)
```

- **논리 분리**: 완료 (Database per Service, 사용자별 권한 격리)
- **물리 분리**: 미완료 (단일 PostgreSQL 프로세스)
- **Cross-DB FK**: Logical FK로 설계 (물리 FK 없음)

### 1.2 목표 구조

```
PostgreSQL A (Identity 전용)
└── identity_db → users, studies, study_members, study_invites

PostgreSQL B (Problem 전용)
└── problem_db → problems

PostgreSQL C (Submission 전용)
└── submission_db → submissions, drafts
```

> analysis_db는 현재 미사용, Phase 3에서 제외

---

## 2. 분리 우선순위

| 순위 | 서비스 | 근거 |
|------|--------|------|
| **1순위** | Problem | 변경 빈도 최저, 의존성 최소, 테이블 1개 |
| **2순위** | Submission | 핵심 서비스이나 Saga 의존성 있음, 테이블 2개 |
| **3순위** | Identity | 가장 복잡 (Gateway 직접 접근), 테이블 4개 |

> 변경 빈도 낮고 의존성 적은 것부터 → 팀이 절차를 학습한 후 핵심 서비스로 진행

---

## 3. Sprint 구조

### Sprint 3-1: Problem DB 물리 분리 (1주)

#### 사전 조건
- [x] problem_db 논리 분리 완료
- [x] Problem Service가 전용 사용자(problem_user)로 접근
- [x] Cross-DB FK 없음 (study_id는 Logical FK)
- [ ] k3s 클러스터 가동 중

#### 작업 목록

| # | 작업 | 담당 Agent | 예상 |
|---|------|-----------|------|
| 3-1-1 | Problem 전용 PostgreSQL k8s manifest 작성 | Architect | 0.5일 |
| 3-1-2 | Dual Write 미들웨어 구현 (Problem Service) | Librarian | 1일 |
| 3-1-3 | Reconciliation Cron 구현 | Librarian | 1일 |
| 3-1-4 | 1단계 Expand 실행 + 72h 모니터링 | Conductor | 3일 |
| 3-1-5 | 2단계 Switch Read 전환 + 48h 안정성 확인 | Conductor | 2일 |
| 3-1-6 | 3단계 Contract (구 DB 쓰기 제거) | Librarian | 0.5일 |

#### 3-1-1: Problem 전용 PostgreSQL manifest

```yaml
# infra/k3s/postgres-problem.yaml (신규)
Deployment: postgres-problem (postgres:16.3-alpine)
  - 별도 PVC (5Gi)
  - 환경변수: POSTGRES_DB=problem_db, POSTGRES_USER=problem_user
Service: postgres-problem (포트 5432)
```

#### 3-1-2: Dual Write 미들웨어

```typescript
// Problem Service에 추가
// src/database/dual-write.interceptor.ts

@Injectable()
export class DualWriteInterceptor implements NestInterceptor {
  // 1. 원본 DB에 쓰기 (기존 로직)
  // 2. 새 DB에 동일 데이터 쓰기 (비동기, 실패 시 로그만)
  // 3. 읽기는 원본 DB에서만 (Expand 단계)
}
```

**TypeORM 이중 연결 설정**:
```typescript
// app.module.ts
TypeOrmModule.forRootAsync({
  name: 'default',     // 기존 DB (공유 PostgreSQL)
  ...existingConfig
})
TypeOrmModule.forRootAsync({
  name: 'new',          // 신규 DB (Problem 전용 PostgreSQL)
  host: process.env.NEW_DATABASE_HOST,
  ...newConfig
})
```

#### 3-1-3: Reconciliation Cron

```typescript
// src/database/reconciliation.cron.ts
@Cron('0 * * * *')  // 매 1시간
async reconcile() {
  // 1. 구 DB에서 최근 2시간 변경분 checksum 조회
  const oldChecksums = await this.oldRepo.query(`
    SELECT id, md5(row_to_json(p)::text) AS checksum
    FROM problems p
    WHERE updated_at > NOW() - INTERVAL '2 hours'
  `);

  // 2. 새 DB에서 동일 레코드 checksum 조회
  const newChecksums = await this.newRepo.query(/* 동일 쿼리 */);

  // 3. 비교 → 불일치 발견 시
  //    - 로그 기록 (structured logging)
  //    - 2단계 전환 차단 플래그 설정
  //    - Alert 발생 (Prometheus 메트릭)
}
```

#### 3-1-4~6: Dual Write 3단계 실행

**1단계 (Expand) — 72시간**:
- 환경변수 `DUAL_WRITE_MODE=expand` 설정
- 구 DB 쓰기 + 새 DB 동시 쓰기
- 읽기는 구 DB에서만
- Reconciliation Cron 가동

**2단계 전환 체크리스트**:
- [ ] 72시간 연속 Reconciliation 통과 (불일치 0건)
- [ ] 신 DB 쓰기 실패율 0%
- [ ] 신 DB 쿼리 P95 ≤ 구 DB P95
- [ ] 수동 샘플링 10건 확인

**2단계 (Switch Read) — 48시간+**:
- 환경변수 `DUAL_WRITE_MODE=switch-read` 설정
- 읽기를 새 DB로 전환
- 쓰기는 양쪽 유지
- 롤백: 읽기를 구 DB로 즉시 전환 가능

**3단계 (Contract)**:
- 환경변수 `DUAL_WRITE_MODE=off` 설정 (새 DB only)
- 구 DB 쓰기 코드 제거
- DualWriteInterceptor 제거
- Reconciliation Cron 중단
- Problem Service DB 연결을 새 PostgreSQL로 변경

---

### Sprint 3-2: Submission DB 물리 분리 (2주)

#### 추가 고려사항
- Saga 상태(saga_step) 영속성 유지 필수
- drafts 테이블 동시 마이그레이션
- RabbitMQ 메시지 처리 중 전환 시 데이터 손실 방지

| # | 작업 | 담당 Agent | 예상 |
|---|------|-----------|------|
| 3-2-1 | Submission 전용 PostgreSQL manifest | Architect | 0.5일 |
| 3-2-2 | Dual Write 미들웨어 (submissions + drafts) | Librarian | 2일 |
| 3-2-3 | Saga 상태 마이그레이션 검증 로직 | Conductor | 1일 |
| 3-2-4 | Reconciliation Cron (2 테이블) | Librarian | 1일 |
| 3-2-5 | 1단계 Expand (72h) | Conductor | 3일 |
| 3-2-6 | 2단계 Switch Read (48h+) | Conductor | 2일 |
| 3-2-7 | 3단계 Contract | Librarian | 0.5일 |

**Submission 특화 주의사항**:
```
1. Saga 진행 중인 제출은 전환 대상에서 제외
   WHERE saga_step IN ('DONE', 'FAILED') 인 레코드만 검증

2. Draft 자동저장 중 전환 시 데이터 유실 방지
   → localStorage fallback (프론트엔드)

3. idempotency_key 유니크 제약 양쪽 DB에서 유지
```

---

### Sprint 3-3: Identity DB 물리 분리 (2주)

#### 추가 고려사항
- **Gateway 직접 접근**: Gateway가 identity_db를 직접 참조 (가장 복잡)
- **4개 테이블**: users, studies, study_members, study_invites
- **OAuth 세션**: 전환 중 로그인 세션 유지 필수

| # | 작업 | 담당 Agent | 예상 |
|---|------|-----------|------|
| 3-3-1 | Identity 전용 PostgreSQL manifest | Architect | 0.5일 |
| 3-3-2 | Gateway → Identity API 전환 (직접 DB 접근 제거) | Gatekeeper | 3일 |
| 3-3-3 | Dual Write 미들웨어 (4 테이블) | Librarian | 2일 |
| 3-3-4 | Reconciliation Cron (4 테이블) | Librarian | 1일 |
| 3-3-5 | 1단계 Expand (72h) | Conductor | 3일 |
| 3-3-6 | 2단계 Switch Read (48h+) | Conductor | 2일 |
| 3-3-7 | 3단계 Contract | Librarian | 0.5일 |

**Identity 특화 주의사항**:
```
1. Gateway TypeORM 직접 접근 → Identity Service API 호출로 전환
   - 현재: Gateway → identity_db 직접 쿼리
   - 목표: Gateway → Identity Service HTTP API → identity_db
   - 영향 범위: auth, study 관련 모든 Gateway 핸들러

2. OAuth 토큰 갱신 중 DB 전환 시
   - Redis 세션 기반이므로 DB 전환 영향 최소
   - 단, users 테이블 lookup은 전환 시점에 일시적 latency 증가

3. study_members 조회 빈도 높음 (StudyMemberGuard)
   - Redis 캐싱 강화 (TTL 300s → 600s during migration)
```

---

## 4. 공통 인프라 요구사항

### 4.1 Dual Write 모듈 (공유 라이브러리)

```
services/shared/dual-write/
├── dual-write.interceptor.ts    # NestJS Interceptor
├── dual-write.module.ts         # DynamicModule
├── reconciliation.service.ts    # Cron 기반 검증
└── dual-write.config.ts         # 모드 설정 (expand/switch-read/off)
```

### 4.2 모니터링 메트릭 추가

```
algosu_{service}_dual_write_total        [Counter] labels: target(old|new), result(success|fail)
algosu_{service}_dual_write_latency_seconds [Histogram] labels: target
algosu_{service}_reconciliation_mismatches  [Gauge]
algosu_{service}_reconciliation_runs_total  [Counter] labels: result(pass|fail)
```

### 4.3 Alert 추가 (prometheus-rules.yaml)

```yaml
- alert: DualWriteFailure
  expr: rate(algosu_{service}_dual_write_total{result="fail"}[5m]) > 0
  severity: critical

- alert: ReconciliationMismatch
  expr: algosu_{service}_reconciliation_mismatches > 0
  severity: critical
```

### 4.4 환경변수

| 변수 | 값 | 설명 |
|------|-----|------|
| `DUAL_WRITE_MODE` | `off`/`expand`/`switch-read` | Dual Write 모드 |
| `NEW_DATABASE_HOST` | `postgres-{service}` | 신규 DB 호스트 |
| `NEW_DATABASE_PORT` | `5432` | 신규 DB 포트 |
| `NEW_DATABASE_NAME` | `{service}_db` | 신규 DB 이름 |
| `NEW_DATABASE_USER` | `{service}_user` | 신규 DB 사용자 |
| `NEW_DATABASE_PASSWORD` | (Sealed Secret) | 신규 DB 비밀번호 |

---

## 5. 롤백 계획

### 각 단계별 롤백

| 단계 | 롤백 방법 | 소요 시간 | 데이터 손실 |
|------|----------|----------|-----------|
| Expand | `DUAL_WRITE_MODE=off` 설정, 새 DB 쓰기 중단 | 즉시 | 없음 |
| Switch Read | `DUAL_WRITE_MODE=expand` 복귀 (읽기를 구 DB로) | 즉시 | 없음 |
| Contract | 불가 (구 DB 쓰기 코드 제거됨) | — | — |

> Contract 단계 진입 전 반드시 PM 승인 필요

---

## 6. 전체 타임라인

```
Week 1-2:  Sprint 3-1 (Problem DB 분리)
  ├── Day 1-2: Manifest + Dual Write 구현 + Reconciliation
  ├── Day 3-5: Expand (72h 모니터링)
  └── Day 6-7: Switch Read + Contract

Week 3-4:  Sprint 3-2 (Submission DB 분리)
  ├── Day 1-3: Dual Write + Saga 검증
  ├── Day 4-6: Expand (72h)
  └── Day 7-10: Switch Read (48h+) + Contract

Week 5-6:  Sprint 3-3 (Identity DB 분리)
  ├── Day 1-3: Gateway API 전환 + Dual Write
  ├── Day 4-6: Expand (72h)
  └── Day 7-10: Switch Read (48h+) + Contract
```

**총 예상 기간: 6주**

---

## 7. 성공 기준 (DoD)

- [ ] 각 서비스가 독립 PostgreSQL 인스턴스에 연결
- [ ] 전 서비스 SLO 유지 (가용성 99.5%, 에러율 <5%, P95 <1s)
- [ ] Reconciliation 최종 실행 결과 불일치 0건
- [ ] Gateway가 identity_db 직접 접근 제거 (API 호출로 대체)
- [ ] 공유 PostgreSQL 인스턴스 제거 (또는 identity만 유지)
- [ ] Grafana 대시보드에 Dual Write 메트릭 패널 추가
- [ ] 롤백 절차 문서화 및 테스트 완료

---

## 8. Agent 역할 분담

| Agent | 책임 |
|-------|------|
| **Architect** | 전용 PostgreSQL manifest, Kustomize overlay 수정, 모니터링 메트릭 설계 |
| **Librarian** | Dual Write 모듈 구현, Reconciliation Cron 구현, TypeORM 설정 |
| **Conductor** | Saga 상태 마이그레이션 검증, Dual Write 실행 조율 |
| **Gatekeeper** | Gateway → Identity API 전환, 보안 검증 (인증/인가 영향 분석) |
| **Oracle** | 전체 조율, 전환 승인, PM 보고 |

---

## 9. 보안 체크리스트

- [ ] 신규 PostgreSQL 비밀번호 Sealed Secrets 적용
- [ ] Dual Write 중 양쪽 DB 인증 정보 별도 관리
- [ ] Reconciliation 로그에 민감 데이터 제외 (id, checksum만)
- [ ] 전환 완료 후 구 DB 접근 권한 즉시 회수
- [ ] PgBouncer 연결 풀 신규 DB에도 적용
