# AlgoSu 종합 기능 검토 보고서

> 기획서 v3.1 기반 | 페인포인트 14건 + 피어 코드 리뷰 + 유저 시나리오 89건 통합 반영
> 2026.03.01

---

## 1. Executive Summary

본 보고서는 AlgoSu 기획서 v3.1을 기반으로 유저 시나리오 도출, 페인포인트 분석, 신규 기능 제안을 통합한 종합 기능 검토 보고서입니다.

**분석 결과 요약**

- 유저 시나리오: 15개 카테고리, 89개 시나리오 도출 (Happy Path 27 / Edge Case 34 / Failure 28)
- 페인포인트: 14건 식별 (높음 3 / 중간 5 / 낮음 6)
- 신규 기능 제안: 6건 (필수 3 / 권장 3)

**핵심 진단**

기획서의 인프라 및 신뢰성 설계(Saga, Circuit Breaker, DLQ, GitOps)는 매우 탄탄합니다. 그러나 스터디 플랫폼의 핵심 가치인 "함께 학습하는 경험"을 구현하는 기능 설계가 부재하여, 현재 구조로는 "AI 코드 리뷰를 받는 개인 도구"에 가깝습니다. 아래 제안을 반영하면 스터디 플랫폼으로서의 정체성이 확립됩니다.

---

## 2. 페인포인트 전체 현황

기획서 v3에서 7개의 기술 페인포인트(Saga 영속화, GitHub Bot 토큰, Dual Write 등)를 이미 해결했습니다. 본 보고서에서는 아직 해결되지 않은 14개의 페인포인트를 새로 식별했으며, 심각도별로 분류합니다.

| ID | 페인포인트 | 심각도 | 카테고리 | 해결 Phase |
|----|-----------|--------|----------|-----------|
| PP-01 | 피어 코드 리뷰 기능 부재 | 🔴 높음 | 기능 | Phase 2 |
| PP-02 | 스터디 그룹 관리 도메인 부재 | 🔴 높음 | 설계 | Phase 1 |
| PP-03 | 사용자 간 상호작용 전무 | 🔴 높음 | 기능 | Phase 2~3 |
| PP-04 | 코드 에디터 경험 미설계 | 🟡 중간 | UX | Phase 1 |
| PP-05 | AI 비용 제어 구체성 부족 | 🟡 중간 | 운영 | Phase 2 |
| PP-06 | DLQ 운영 절차 부재 | 🟡 중간 | 운영 | Phase 2 |
| PP-07 | GitHub 실패 시 사용자 자가 해결 수단 부족 | 🟡 중간 | UX | Phase 2 |
| PP-08 | 마감 리마인더/미제출 관리 부재 | 🟡 중간 | 기능 | Phase 2 |
| PP-09 | 멀티 스터디 시나리오 미정의 | 🟢 낮음 | 설계 | Phase 1 |
| PP-10 | 코드 저장소 확장 기준 모호 | 🟢 낮음 | 운영 | Phase 4 |
| PP-11 | 테스트 전략 미명시 | 🟢 낮음 | 품질 | 전 Phase |
| PP-12 | 에러 메시지 표준화 없음 | 🟢 낮음 | 설계 | Phase 1 |
| PP-13 | 데이터 백업/복구 전략 없음 | 🟢 낮음 | 운영 | Phase 1 |
| PP-14 | 허용 언어 목록 미정의 | 🟢 낮음 | 기능 | Phase 1 |

---

## 3. 심각도 높음: 상세 분석 및 해결 방안

---

### 3.1 PP-02: 스터디 그룹 관리 도메인 부재

**문제**

기획서에는 Identity Service에 Profile/Role만 있고, 스터디 그룹 자체를 관리하는 엔티티와 로직이 없습니다. "스터디 대시보드 및 활동 통계"가 핵심 기능으로 명시되어 있지만, 정작 스터디를 생성하고 멤버를 관리하는 도메인이 설계에서 빠져 있습니다.

구체적으로 빠져 있는 것:
- Study 엔티티 (스터디명, 설명, 생성일, 설정 등)
- StudyMembership (사용자-스터디 관계, 스터디 단위 역할)
- 스터디 생성/수정/삭제/초대/가입/탈퇴 API
- Problem, Submission에 study_id FK 연결

**영향**
- 문제 등록 시 "어떤 스터디의 문제인지" 연결 불가
- 대시보드에서 스터디별 통계 산출 불가
- 접근 제어의 기준이 불명확 (누가 어떤 데이터에 접근 가능한지)
- 멀티 스터디(PP-09)도 함께 해결 불가

**해결 방안: 데이터 모델**

```sql
-- identity_db에 추가
CREATE TABLE studies (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(100) NOT NULL,
  description  TEXT,
  invite_code  VARCHAR(20) UNIQUE NOT NULL,
  github_repo_url VARCHAR(255),
  created_by   UUID NOT NULL REFERENCES profiles(id),
  created_at   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE study_memberships (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id  UUID NOT NULL REFERENCES studies(id),
  user_id   UUID NOT NULL REFERENCES profiles(id),
  role      VARCHAR(10) NOT NULL DEFAULT 'MEMBER',  -- ADMIN / MEMBER
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (study_id, user_id)
);

-- problem_db: problems 테이블에 추가
ALTER TABLE problems ADD COLUMN study_id UUID NOT NULL;

-- submission_db: submissions 테이블에 추가
ALTER TABLE submissions ADD COLUMN study_id UUID NOT NULL;
```

**해결 방안: API 설계**

| 엔드포인트 | 설명 | 접근 제어 |
|-----------|------|----------|
| POST /api/studies | 스터디 생성 | 인증된 사용자 |
| GET /api/studies | 내 스터디 목록 조회 | 인증된 사용자 |
| GET /api/studies/:id | 스터디 상세 조회 | 해당 스터디 멤버 |
| PATCH /api/studies/:id | 스터디 설정 수정 | Admin |
| POST /api/studies/:id/join | 초대 코드로 가입 | 인증된 사용자 |
| DELETE /api/studies/:id/members/:userId | 멤버 제거 | Admin |
| PATCH /api/studies/:id/members/:userId/role | 역할 변경 | Admin |

> **구현 시점: Phase 1 (필수)** — 모든 도메인의 기반이 되는 엔티티이므로 최우선 구현.

---

### 3.2 PP-01 / PP-03: 피어 코드 리뷰 및 사용자 상호작용

**문제**

현재 기획에서 사용자가 다른 사용자의 존재를 인식하는 유일한 접점은 대시보드의 제출 현황 통계뿐입니다. 스터디원끼리 서로의 코드를 열람하거나, 피드백을 주고받거나, 학습 경험을 공유할 채널이 없습니다.

**설계 방향: Submission Service 통합 (권장)**

코드 리뷰는 "제출된 코드에 코멘트를 다는 행위"이므로 Submission Service 도메인에 자연스럽게 속합니다. 별도 서비스 분리는 불필요하며 기존 인프라를 그대로 활용합니다.

**핵심 기능**

| 기능 | 설명 | 비고 |
|------|------|------|
| 마감 후 풀이 열람 | 본인 제출 완료 + 마감 경과 시 타인 코드 열람 | 베끼기 방지 |
| 라인별 코멘트 | 특정 라인에 코멘트 부착, 전체 코멘트도 가능 | 마크다운 지원 |
| 답글 (1depth) | 코멘트에 대한 답글 | 답글의 답글은 없음 |
| 실시간 알림 | 내 코드에 코멘트 달리면 SSE + 인앱 알림 | 기존 인프라 활용 |

**데이터 모델**

```sql
-- submission_db에 추가
CREATE TABLE review_comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(id),
  author_id     UUID NOT NULL,
  line_number   INTEGER,           -- NULL이면 전체 코멘트
  content       TEXT NOT NULL,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE review_replies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id  UUID NOT NULL REFERENCES review_comments(id),
  author_id   UUID NOT NULL,
  content     TEXT NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_review_comments_submission ON review_comments(submission_id);
CREATE INDEX idx_review_replies_comment ON review_replies(comment_id);
```

**API 설계**

| 엔드포인트 | 설명 | 접근 제어 |
|-----------|------|----------|
| GET /api/studies/:studyId/problems/:problemId/submissions | 같은 문제 풀이 목록 | 멤버 + 본인 제출 + 마감 경과 |
| GET /api/submissions/:id/reviews | 특정 제출의 코멘트 목록 | 같은 스터디 멤버 |
| POST /api/submissions/:id/reviews | 코멘트 작성 | 같은 스터디 멤버 |
| POST /api/reviews/:commentId/replies | 답글 작성 | 같은 스터디 멤버 |
| PATCH /api/reviews/:commentId | 코멘트 수정 | 작성자 본인 |
| DELETE /api/reviews/:commentId | 코멘트 삭제 | 작성자 본인 + Admin |

**실시간 알림 연동** — 기존 SSE + Redis Pub/Sub 인프라를 그대로 활용

```
[코멘트 작성] → [Submission Service] → Redis Pub/Sub publish
    → [Gateway SSE] → 해당 submission 작성자에게 push
    → [클라이언트] "OOO님이 코드에 코멘트를 남겼습니다"
```

**UI 화면 (개념)**

```
┌─────────────────────────────────────────────────────────────┐
│ [Week 3] 두 수의 합 - 스터디원 풀이                          │
├─────────────────────────────────────────────────────────────┤
│  👤 김민수   Python   제출: 3/15 23:40   코멘트 3개          │
│  👤 이서윤   Java     제출: 3/15 22:10   코멘트 1개          │
│  👤 박지호   C++      제출: 3/16 00:55   코멘트 0개          │
│                                                             │
│  🔒 마감 전에는 다른 풀이를 볼 수 없습니다 (마감 후 자동 공개)  │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ 👤 김민수의 풀이  |  Python  |  AI 피드백 보기                │
├────┬─────────────────────────────────────────────────────────┤
│  1 │ def two_sum(nums, target):                              │
│  2 │     hash_map = {}                                       │
│  3 │     for i, num in enumerate(nums):           💬 2       │
│  4 │         complement = target - num                       │
│  5 │         if complement in hash_map:                      │
│  6 │             return [hash_map[complement], i]            │
│  7 │         hash_map[num] = i                               │
│  8 │     return []                                💬 1       │
├────┴─────────────────────────────────────────────────────────┤
│  📌 Line 3  이서윤                                           │
│  enumerate 대신 range(len())을 쓸 때와 성능 차이가 있을까요?  │
│    ↳ 김민수: enumerate가 파이썬에서 더 관용적이고 성능도       │
│      동일합니다!                                              │
│                                                              │
│  📝 전체 코멘트  이서윤                                       │
│  깔끔하네요! 해시맵 접근법 잘 배웠습니다.                      │
│                                                              │
│ ┌──────────────────────────────────────┐                     │
│ │ 코멘트 작성...              [등록]   │                     │
│ └──────────────────────────────────────┘                     │
└──────────────────────────────────────────────────────────────┘
```

**기존 아키텍처 영향도**

| 구성 요소 | 변경 | 내용 |
|-----------|------|------|
| Submission Service | ✏️ 수정 | Review 모듈, API, 비즈니스 로직 추가 |
| submission_db | ✏️ 수정 | review_comments, review_replies 테이블 추가 |
| Gateway | ✏️ 수정 | 리뷰 라우팅 추가 |
| SSE / Redis Pub/Sub | ✏️ 수정 | 코멘트 알림 이벤트 타입 추가 |
| Frontend | ✏️ 수정 | 풀이 목록 화면, 코드 리뷰 화면 신규 |
| Identity / Problem / GitHub Worker / AI / RabbitMQ / k3s / ArgoCD | 변경 없음 | — |

**리소스 영향**: Submission Service 400MB 내 처리 가능. 추가 인프라 불필요.

> **구현 시점: Phase 2** — SSE 구현과 함께 진행. 스터디 플랫폼 핵심 가치 기능.

---

## 4. 심각도 중간: 상세 분석 및 해결 방안

---

### 4.1 PP-04: 코드 에디터 경험 미설계

**문제**

"코드 직접 제출"이 핵심인데, 사용자가 코드를 작성하는 에디터 UI에 대한 설계가 없습니다. Auto-save는 있지만, 에디터 자체의 스펙이 빠져 있습니다.

**해결 방안**

| 항목 | 권장 사항 |
|------|----------|
| 에디터 라이브러리 | Monaco Editor (VS Code 기반) — 사용자 친숙도 최고 |
| 대안 | CodeMirror 6 — 번들 크기 작음, 모바일 지원 우수 |
| 구문 강조 | Python, Java, C++, JavaScript, Go, Kotlin, TypeScript 최소 지원 |
| 필수 기능 | 구문 강조, 자동 인덴트, 줄 번호, 탭 크기 설정, 다크/라이트 모드 |
| 선택 기능 (MVP 이후) | 자동 완성, 괄호 자동 닫기, 코드 접기 |
| 코드 실행 | MVP 제외 — 보안 리스크. 백준/LeetCode 링크로 테스트 유도 |

> **구현 시점: Phase 1** — 제출 화면의 핵심 구성 요소

---

### 4.2 PP-05: AI 비용 제어 구체성 부족

**문제**

"Circuit Breaker + 호출 상한선 + 모니터링"이 있지만, 구체적인 상한선 숫자와 초과 시 사용자 경험이 정의되지 않았습니다.

**해결 방안**

| 제어 항목 | 권장 수치 | 초과 시 동작 |
|----------|----------|-------------|
| 사용자당 일일 AI 분석 | 5회 | "오늘 분석 한도에 도달했습니다. 내일 다시 시도해주세요" |
| 스터디당 일일 AI 분석 | 50회 | Admin에게 알림, 추가 분석 큐잉 중단 |
| 월간 Gemini API 예산 | 설정 가능 (Admin) | 80% 도달: Admin 알림 / 100%: 신규 분석 중단 |
| 재제출 시 이전 분석 | 이전 분석 진행 중이면 취소하지 않음 | 새 분석만 큐잉, 이전 결과는 보존 |

구현 방법:
- Redis 기반 카운터 (사용자별/스터디별 일일 카운트, TTL 24h)
- Grafana 대시보드에 비용 추적 패널 추가
- AlertManager에 예산 임계치 알림 규칙 추가

> **구현 시점: Phase 2** — AI Analysis Service 분리와 함께

---

### 4.3 PP-06: DLQ 운영 절차 부재

**문제**

GitHub Push와 AI 분석 실패 시 DLQ로 이동하지만, DLQ에 쌓인 메시지를 어떻게 처리하는지 운영 절차가 없습니다.

**해결 방안**

| 절차 | 내용 |
|------|------|
| 모니터링 | DLQ 적체량을 Prometheus 메트릭으로 노출 |
| 알림 | 10건 초과 시 Slack 알림 (AlertManager) |
| 수동 재처리 | 관리자용 API: POST /admin/dlq/reprocess (메시지를 원래 큐로 재발행) |
| 보존 기간 | 72시간 |
| 최종 처리 | 72시간 경과 메시지 → 영구 실패 처리 + 사용자 최종 알림 |
| 대시보드 | Grafana에 DLQ 현황 패널 (적체량, 실패 유형별 분류) |

> **구현 시점: Phase 2** — RabbitMQ 도입과 함께

---

### 4.4 PP-07: GitHub 동기화 실패 시 사용자 자가 해결 수단 부족

**문제**

사용자가 "실패" 알림만 받고 어떻게 해야 하는지 모릅니다. 결국 운영자에게 문의하게 되어 운영 부담이 증가합니다.

**해결 방안: 실패 유형별 사용자 액션 매핑**

| 실패 유형 | github_sync_status | 사용자에게 노출할 메시지 | 액션 버튼 |
|----------|-------------------|----------------------|----------|
| 토큰 만료/취소 | TOKEN_INVALID | "GitHub 연동이 만료되었습니다" | [GitHub 재연동] |
| 일시적 API 장애 | FAILED | "GitHub 동기화에 실패했습니다. 자동 재시도됩니다" | [수동 재시도] |
| 레포 삭제됨 | FAILED | "연결된 레포를 찾을 수 없습니다" | [레포 설정 변경] |
| 권한 부족 | TOKEN_INVALID | "GitHub 레포 접근 권한이 없습니다" | [GitHub 재연동] |
| 원인 불명 | FAILED | "동기화에 문제가 발생했습니다" | [재시도] [문의하기] |

핵심: 에러 메시지와 액션 버튼을 분기하여 사용자가 스스로 문제를 해결할 수 있도록 유도.

> **구현 시점: Phase 2** — GitHub Worker 안정화와 함께

---

### 4.5 PP-08: 마감 리마인더 / 미제출 관리 부재

**문제**

주차별 마감 관리는 있지만, 마감 전 미제출자 독려와 Admin의 참여율 관리 기능이 없습니다.

**해결 방안**

| 기능 | 설명 | 구현 방식 |
|------|------|----------|
| 마감 리마인더 | 마감 24시간 전, 1시간 전 미제출자에게 알림 | Cron → 미제출자 조회 → 인앱/이메일 알림 |
| 미제출자 리스트 | Admin 대시보드에 실시간 미제출자 표시 | Problem + Submission 조인 쿼리 |
| 연속 미제출 경고 | 3주 연속 미제출 시 Admin에게 자동 알림 | 주간 Cron |
| 리마인더 설정 | 스터디별로 리마인더 On/Off, 시간 커스텀 | Study 설정에 포함 |

> **구현 시점: Phase 2** — SSE 알림 인프라 구축 후

---

## 5. 심각도 낮음: 요약 및 권장 사항

---

### 5.1 PP-09: 멀티 스터디 시나리오 미정의

PP-02(Study/StudyMembership 도메인)를 구현하면 자동으로 해결됩니다. Role을 스터디 단위로 부여하면 "스터디 A에서는 Admin, 스터디 B에서는 Member" 시나리오를 자연스럽게 지원합니다.

### 5.2 PP-10: 코드 저장소 확장 기준 모호

정량적 전환 기준을 설정합니다.
- submission_db 전체 5GB 초과 시 S3 전환 검토
- 하이브리드 전략: 최근 12주 데이터는 DB 유지, 이전 데이터만 S3 아카이빙
- Phase 4에서 모니터링 후 판단

### 5.3 PP-11: 테스트 전략 미명시

| Phase | 테스트 범위 |
|-------|-----------|
| Phase 1 | 핵심 플로우(제출 Saga) 단위 테스트, 최소 커버리지 70% |
| Phase 2 | 서비스 간 통합 테스트 (제출 → GitHub Push → AI 분석) |
| Phase 3 | Dual Write Reconciliation 자동 테스트 |
| Phase 4 | 부하 테스트 (k6로 마감 폭주 시뮬레이션) |

### 5.4 PP-12: 에러 메시지 표준화 없음

공통 에러 응답 포맷을 정의합니다.

```json
{
  "error": {
    "code": "SUBMISSION_DEADLINE_EXCEEDED",
    "message": "마감 시간이 지났습니다.",
    "details": { "deadline": "2026-03-15T23:59:59Z" }
  }
}
```

NestJS Exception Filter를 Gateway에 구현하여, 모든 서비스의 에러를 통일된 포맷으로 변환. Phase 1에서 에러 코드 카탈로그 문서를 작성합니다.

### 5.5 PP-13: 데이터 백업/복구 전략 없음

자체 DB가 SSOT인 만큼, DB 손상 시 모든 제출 데이터를 잃게 됩니다.

| 항목 | 권장 사항 |
|------|----------|
| 백업 방식 | pg_dump 기반 일일 백업 Cron (새벽 4시) |
| 저장소 | OCI Object Storage (Free Tier 포함) |
| 보존 기간 | 최소 7일 (일별), 최근 4주분 주별 |
| 복구 테스트 | 분기 1회 복구 드릴 |
| 구현 시점 | Phase 1 |

### 5.6 PP-14: 허용 언어 목록 미정의

**MVP 지원 언어 (권장)**: Python, Java, C++, JavaScript, TypeScript, Go, Kotlin

스터디별로 허용 언어를 설정할 수 있게 하면 유연성 확보. Study 설정 또는 Problem 단위로 관리.

---

## 6. 기존 서비스 도메인 수정안

페인포인트 해결 후 변경되는 서비스 도메인 전체 구조입니다.

### 6.1 수정된 서비스 도메인 테이블

| 서비스 | 주요 역할 | 핵심 엔티티 | 변경 사항 |
|--------|----------|------------|----------|
| Identity Service | 인증, 프로필, **스터디 관리**, 역할 | Profile, Role, **Study, StudyMembership** | 🆕 Study 도메인 추가 |
| Problem Service | 주차별 문제 등록/조회, 마감 관리, **리마인더** | Problem | 🆕 study_id FK, 리마인더 Cron |
| Submission Service | 코드 제출 CRUD, Saga, Draft, **피어 코드 리뷰** | Submission, Draft, **ReviewComment, ReviewReply** | 🆕 Review 모듈, study_id FK |
| GitHub Worker | GitHub Push 비동기 처리, Retry, DLQ, **DLQ 운영** | SyncJob | 🆕 실패 유형 분류, 관리자 재처리 API |
| AI Analysis Service | 피드백, 그룹 합성, Circuit Breaker, **비용 제어** | Analysis, Feedback | 🆕 일일 한도, 예산 상한 |

### 6.2 수정된 DB 스키마 요약

```
PostgreSQL (단일 프로세스 + PgBouncer)
├── identity_db
│   ├── profiles (기존)
│   ├── roles (기존)
│   ├── studies (🆕)
│   └── study_memberships (🆕)
├── problem_db
│   └── problems (+ study_id 🆕)
├── submission_db
│   ├── submissions (+ study_id 🆕)
│   ├── drafts (기존)
│   ├── review_comments (🆕)
│   └── review_replies (🆕)
└── analysis_db
    ├── analyses (기존)
    └── feedbacks (기존)
```

### 6.3 수정된 Gateway 라우팅 요약

```
기존 라우팅:
  /api/auth/*         → Identity Service
  /api/problems/*     → Problem Service
  /api/submissions/*  → Submission Service
  /sse/submissions/*  → Gateway SSE

추가 라우팅:
  /api/studies/*                                    → Identity Service (🆕)
  /api/studies/:id/problems/:id/submissions         → Submission Service (🆕 풀이 열람)
  /api/submissions/:id/reviews/*                    → Submission Service (🆕 코드 리뷰)
  /api/reviews/:id/replies/*                        → Submission Service (🆕 답글)
  /admin/dlq/*                                      → GitHub Worker (🆕 DLQ 관리)
```

---

## 7. 수정된 Roadmap

기존 Phase에 페인포인트 해결 작업을 삽입합니다.

### Phase 1: 모듈화 (Modular Monolith)

| 구분 | 작업 |
|------|------|
| 기존 | 도메인별 폴더 구조 분리, 자체 제출 DB 설계, GitHub Worker 초기 구현, NestJS Gateway, Draft API |
| 🆕 PP-02 | Study, StudyMembership 엔티티 설계 및 API 구현 |
| 🆕 PP-04 | 코드 에디터 라이브러리 선정 및 기본 통합 (Monaco Editor 권장) |
| 🆕 PP-09 | 멀티 스터디 지원 (PP-02와 함께 자동 해결) |
| 🆕 PP-12 | 에러 응답 표준 포맷 정의, Gateway Exception Filter |
| 🆕 PP-13 | pg_dump 일일 백업 Cron 설정, OCI Object Storage 연동 |
| 🆕 PP-14 | 허용 언어 목록 정의 (7개 언어) |

### Phase 2: AI Analysis 분리 + 상호작용 기능

| 구분 | 작업 |
|------|------|
| 기존 | FastAPI Worker 추출, RabbitMQ 도입, Circuit Breaker, SSE 상태 노출 |
| 🆕 PP-01/03 | 피어 코드 리뷰 (풀이 열람, 라인별 코멘트, 답글, 알림) |
| 🆕 PP-05 | AI 비용 제어 (일일 한도, 예산 상한, Grafana 패널) |
| 🆕 PP-06 | DLQ 운영 절차 (모니터링, 알림, 관리자 재처리 API) |
| 🆕 PP-07 | GitHub 실패 유형별 사용자 가이드 UI |
| 🆕 PP-08 | 마감 리마인더 알림, Admin 미제출자 대시보드 |
| 🆕 PP-11 | 서비스 간 통합 테스트 |

### Phase 3: 도메인 격리 및 DB 분리

| 구분 | 작업 |
|------|------|
| 기존 | Submission/Problem Service 독립 컨테이너화, Dual Write 3단계 DB 이관 |
| 🆕 PP-11 | Dual Write Reconciliation 자동 테스트 |
| 변경 없음 | Reconciliation Cron, 전환 조건 체크리스트 등 기존 설계 유지 |

### Phase 4: 운영 안정화

| 구분 | 작업 |
|------|------|
| 기존 | Sealed Secrets, Loki 중앙 로깅, AlertManager, SLO 대시보드, GitHub App 전환 |
| 🆕 PP-10 | 코드 저장소 용량 모니터링 + S3 전환 기준 평가 |
| 🆕 PP-11 | 부하 테스트 (k6, 마감 폭주 시뮬레이션) |

---

## 8. 리소스 영향도 평가

| 항목 | 기존 (v3.1) | 변경 후 | 차이 |
|------|-----------|---------|------|
| NestJS 서비스 | × 4 (1.6GB) | × 4 (1.6GB) | 변경 없음 (기존 서비스에 모듈 추가) |
| AI Analysis Service | 2GB | 2GB | 변경 없음 |
| PostgreSQL + PgBouncer | 1GB | 1GB | 테이블 추가, 물리적 부담 미미 |
| RabbitMQ | 512MB | 512MB | 변경 없음 |
| Redis | 256MB | 256MB | AI 한도 카운터 추가, 메모리 미미 |
| 모니터링 스택 | 1.5GB | 1.5GB | Grafana 패널 추가, 리소스 영향 없음 |
| k3s 시스템 | 512MB | 512MB | 변경 없음 |
| **합계** | **~7.4GB** | **~7.4GB** | **추가 인프라 0, 24GB 내 충분** |

핵심: **새로운 서비스나 인프라를 추가하지 않고**, 기존 서비스에 모듈을 확장하는 방식이므로 Free Tier 리소스에 부담이 없습니다.

---

## 9. 유저 시나리오 추가분

페인포인트 해결로 인해 새로 발생하는 유저 시나리오입니다. (기존 89개 + 아래 25개 = 총 114개)

### 9.1 스터디 그룹 관리 (PP-02 해결)

| ID | 시나리오 | 유형 |
|----|---------|------|
| SC-NEW-01 | 사용자가 새 스터디를 생성하고 초대 코드 공유 | ✅ Happy |
| SC-NEW-02 | 초대 코드로 스터디에 가입 | ✅ Happy |
| SC-NEW-03 | Admin이 멤버를 제거 | ⚠️ Edge |
| SC-NEW-04 | 마지막 Admin이 탈퇴 시도 (다른 멤버에게 위임 필요) | ⚠️ Edge |
| SC-NEW-05 | 한 사용자가 여러 스터디에 참여 (멀티 스터디) | ✅ Happy |
| SC-NEW-06 | 잘못된 초대 코드로 가입 시도 | ❌ Failure |
| SC-NEW-07 | 이미 가입한 스터디에 재가입 시도 | ⚠️ Edge |

### 9.2 피어 코드 리뷰 (PP-01/03 해결)

| ID | 시나리오 | 유형 |
|----|---------|------|
| SC-NEW-08 | 마감 후 다른 스터디원의 풀이를 열람 | ✅ Happy |
| SC-NEW-09 | 마감 전 타인 풀이 열람 시도 (차단) | ❌ Failure |
| SC-NEW-10 | 본인 미제출 상태에서 타인 풀이 열람 시도 (차단) | ❌ Failure |
| SC-NEW-11 | 특정 라인에 코멘트 작성 | ✅ Happy |
| SC-NEW-12 | 전체 코멘트 작성 | ✅ Happy |
| SC-NEW-13 | 코멘트에 답글 작성 | ✅ Happy |
| SC-NEW-14 | 내 코드에 코멘트가 달리면 실시간 알림 수신 | ✅ Happy |
| SC-NEW-15 | 본인이 작성한 코멘트 수정/삭제 | ⚠️ Edge |
| SC-NEW-16 | 다른 스터디의 제출에 코멘트 시도 (권한 없음) | ❌ Failure |

### 9.3 마감 리마인더 (PP-08 해결)

| ID | 시나리오 | 유형 |
|----|---------|------|
| SC-NEW-17 | 마감 24시간 전 미제출자에게 자동 리마인더 | ✅ Happy |
| SC-NEW-18 | 마감 1시간 전 미제출자에게 긴급 리마인더 | ✅ Happy |
| SC-NEW-19 | Admin이 미제출자 리스트 실시간 조회 | ✅ Happy |
| SC-NEW-20 | 3주 연속 미제출 멤버에 대해 Admin에게 자동 경고 | ⚠️ Edge |

### 9.4 AI 비용 제어 (PP-05 해결)

| ID | 시나리오 | 유형 |
|----|---------|------|
| SC-NEW-21 | 사용자가 일일 AI 분석 5회 한도 도달 | ⚠️ Edge |
| SC-NEW-22 | 월간 API 예산 80% 도달 시 Admin 알림 | ⚠️ Edge |
| SC-NEW-23 | 월간 예산 100% 도달 시 AI 분석 큐잉 중단 | ❌ Failure |

### 9.5 DLQ 운영 (PP-06 해결)

| ID | 시나리오 | 유형 |
|----|---------|------|
| SC-NEW-24 | DLQ 10건 초과 시 운영팀 Slack 알림 | ⚠️ Edge |
| SC-NEW-25 | 관리자가 DLQ 메시지 수동 재처리 | ✅ Happy |

---

## 10. 위험 요소 추가분

기존 기획서 섹션 10(위험 요소 및 대응 방안)에 추가해야 할 항목:

| 위험 요소 | 대응 방안 |
|-----------|----------|
| 마감 전 타인 코드 열람 (베끼기) | 마감 경과 + 본인 제출 완료 이중 조건 필수 |
| 악의적/비건설적 코멘트 | Admin 삭제 권한, MVP 이후 신고 기능 |
| Submission Service 비대화 | 트래픽 모니터링 후 Review 도메인 독립 분리 가능 |
| AI 비용 예측 불가능 | 사용자/스터디/월간 3중 한도 + Grafana 비용 추적 |
| DLQ 방치 | 적체량 메트릭 + 알림 + 72시간 초과 영구 실패 처리 |
| DB 데이터 유실 | pg_dump 일일 백업 + OCI Object Storage + 분기별 복구 드릴 |

---

## 11. 결론

### 11.1 반드시 해야 하는 것 (Phase 1~2)

1. **스터디 그룹 도메인 설계** (PP-02) — 모든 기능의 기반. Phase 1 필수.
2. **피어 코드 리뷰** (PP-01/03) — 스터디 플랫폼의 존재 이유. Phase 2 필수.
3. **코드 에디터 통합** (PP-04) — 제출 UX의 핵심. Phase 1 필수.

### 11.2 하면 좋은 것 (Phase 2)

4. AI 비용 제어 구체화 (PP-05)
5. DLQ 운영 절차 수립 (PP-06)
6. 마감 리마인더 (PP-08)

### 11.3 나중에 해도 되는 것 (Phase 3~4)

7. GitHub 실패 UX 개선 (PP-07)
8. 에러 표준화 (PP-12) — 일찍 할수록 좋지만 Phase 1 범위가 커지면 후순위
9. 백업 전략 (PP-13)
10. 나머지 PP-09~14

### 11.4 한 줄 총평

> 인프라는 이미 훌륭합니다. 이제 **"같이 하는 스터디"를 만드는 기능**을 올려야 합니다.
