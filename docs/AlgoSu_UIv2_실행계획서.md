# AlgoSu UI v2 전면 교체 실행 계획서

> PM 결정 14개 토픽 전체 확정 기반 | 2026.03.02 | Oracle(심판관) 작성
> 참조: `memory/algosu-ui-v2.md` (385줄, 전체 결정 원문)

---

## 1. Executive Summary

UI v2 전면 교체는 디자인 리빌드 + 신규 기능 + 보안 강화를 동시 수행하는 대규모 작업입니다.

- **총 결정 사항**: 14개 토픽, 80+ 개별 결정
- **백엔드 신규/변경**: ~25개 작업 (UUID 마이그레이션, httpOnly Cookie, 알림 9종, AI 정책, Review API 등)
- **프론트엔드 리빌드**: 9개 페이지 전체 + 공통 컴포넌트 13종 + 디자인 시스템
- **작업 순서**: 백엔드 먼저 → 프론트 수정 → 프론트-백엔드 매칭 (PM 확정)
- **TF 11명 전원 투입**, Sprint 6개 (UI-1 ~ UI-6)

### 기존 Sprint 통합

| 기존 Sprint | 처리 |
|---|---|
| 3-1 Contract (Problem DB switch-read) | **유지** — UI v2 착수 전 완료 필수 |
| 3-2-A (Monaco + ExceptionFilter + 알림 + AI + S6 + S7) | **UI-1/UI-2에 흡수** — 겹치는 항목 통합 |
| 3-2-B (Submission DB 분리) | **UI-2와 병렬** — Architect/Librarian 전담 |
| 3-3 (Identity DB 분리) | **UI-3과 병렬** — Architect/Librarian 전담 |
| 4-1 피어 코드 리뷰 | **UI-5에 흡수** — Code Review 풀스택 |
| 4-2 운영 강화 | **UI-6에 흡수** — Integration Sprint |
| 4-3 테스트 + 안정화 | **UI-6에 흡수** |

---

## 2. Sprint 계획 총괄

```
[3-1 Contract] ─→ [UI-1 Backend Foundation] ─→ [UI-2 Backend Features] ─→ [UI-3 Frontend Core] ─→ [UI-4 Frontend Pages] ─→ [UI-5 Code Review] ─→ [UI-6 Integration]
                          ↘ [3-2 Submission DB] ──────→ [3-3 Identity DB] ↗
```

| Sprint | 이름 | 핵심 목표 | 주요 Agent |
|---|---|---|---|
| 3-1 Contract | Problem DB switch-read | dual-write expand→switch-read 전환 | Architect, Librarian |
| **UI-1** | Backend Foundation | UUID + httpOnly + CORS + MinIO + ExceptionFilter + 보안 | Gatekeeper, Architect, Librarian |
| **UI-2** | Backend Features | 알림 9종 + AI 정책 + Monaco + 프로필 + 스터디 정책 | Herald, Sensei, Palette, Conductor |
| **UI-3** | Frontend Core | 디자인 시스템 + 공통 컴포넌트 + Landing/Login/Dashboard | Palette |
| **UI-4** | Frontend Pages | Problems + Submissions + Study/Profile + Notifications | Palette, Herald |
| **UI-5** | Code Review 풀스택 | Review API + 스터디룸 UI + 전환 페이지 | Postman, Palette, Gatekeeper |
| **UI-6** | Integration + Stabilization | 매칭 + 운영 강화 + 테스트 + 배포 | Scout, Sensei, Architect |

**병렬 트랙**: 3-2 Submission DB 분리 (UI-2 병렬) → 3-3 Identity DB 분리 (UI-3 병렬)

---

## 3. Sprint 상세

### Sprint UI-1: Backend Foundation

> 전제: Sprint 3-1 Contract 완료 후 착수
> 목표: UI v2 전체의 기반이 되는 인프라·보안 변경

| # | 작업 | 상세 | Agent | 영향 범위 |
|---|---|---|---|---|
| 1 | **UUID publicId 마이그레이션** | 모든 엔티티(User, Study, Problem, Submission, Notification)에 `publicId` UUID v4 컬럼 추가 + unique index. 기존 데이터 UUID 생성. API 응답/요청을 publicId 기반으로 전환 | Librarian | 전 서비스 (Gateway, Problem, Submission, Identity) |
| 2 | **httpOnly Cookie JWT 전환** | Identity: JWT 발급 시 `Set-Cookie: token=...; HttpOnly; Secure; SameSite=Lax; Path=/`. Gateway: Cookie 파싱 미들웨어. Frontend: `localStorage` 완전 제거, `fetch credentials: 'include'` | Gatekeeper | Identity, Gateway, Frontend |
| 3 | **CORS 설정 변경** | 모든 서비스: `credentials: true` + 명시적 Origin (프론트 도메인). 와일드카드(*) 제거 | Gatekeeper | 전 백엔드 서비스 |
| 4 | **NestJS ExceptionFilter** | 표준 에러 응답 포맷 (`{ error, message, statusCode }`). 각 서비스에 복사 배치 | Gatekeeper | 전 백엔드 서비스 |
| 5 | **S7 초대코드 max_uses 수정** | `joinByInviteCode()`에 max_uses 검증 추가 | Gatekeeper | Gateway |
| 6 | **SSE S6 소유권 검증** | submission SSE에 `submission.userId !== userId → 403` 추가 | Gatekeeper | Gateway |
| 7 | **MinIO 배포** | k3d manifest (Deployment + Service + PVC) + SealedSecret. 버킷: `avatars` (프로필 이미지) | Architect | k3d 클러스터 |
| 8 | **CSP 헤더 설정** | `script-src 'self'`, `style-src 'self' 'unsafe-inline'`, `img-src 'self' blob: {MINIO_URL}`, `font-src 'self'`. MinIO URL 환경변수 동적 삽입 | Gatekeeper | Frontend (Next.js config) |
| 9 | **T6 Next.js Middleware 라우트 가드** | Public 경로(`/`, `/login`, `/auth/*`) vs Protected 분리. Cookie 존재 여부 체크 → `/login?redirect={원래URL}`. 로그인 상태 `/login` → `/dashboard`. Open Redirect 방지 (내부 경로만 허용) | Palette | Frontend |

**의존 관계**: #1(UUID) 완료 후 → #2(httpOnly), #3(CORS) 착수 가능. #7(MinIO) 독립 병렬.

---

### Sprint UI-2: Backend Features

> 목표: UI v2에 필요한 모든 백엔드 기능 API 구현
> 병렬 트랙: Architect + Librarian → 3-2 Submission DB 분리

| # | 작업 | 상세 | Agent |
|---|---|---|---|
| 1 | **알림 시스템 확장** | NotificationType ENUM 9종 마이그레이션. DEADLINE_REMINDER 스케줄러: 매시간 Cron, 24h전 + 1h전, 미제출자만 발송. 읽은 알림 패널 미표시 + 30일 자동 삭제 + 전체 읽음 API | Herald, Curator |
| 2 | **AI 프롬프트 + highlights** | 5카테고리(정확성/효율성/가독성/구조/BP) score(0~100) + comment + highlights[]. startLine/endLine + type 3종(issue/suggestion/good). Claude Sonnet, 한국어, 1000토큰 제한. 총평 + 최적화 코드 | Sensei |
| 3 | **AI 비용 정책** | Redis 일일 카운터 (`ai_limit:{userId}:{date}`, TTL 24h). 5회/유저. 과거 문제 미차감 (가입일 vs 문제 생성일 비교). 한도 초과 시 AI 스킵 + 제출 허용. AI 실패 시 미차감 + 자동 재시도 3회. 한도 조회 API (`GET /api/analysis/quota`) | Sensei |
| 4 | **Monaco Editor 통합** | `@monaco-editor/react`, SSR safe `dynamic import`. 언어별 BOJ 템플릿 자동 삽입 (7개 언어). 자동완성 토글 (기본 ON). 코드 100KB 제한. AI highlights 라인 강조 표시 | Palette |
| 5 | **프로필 이미지/아바타** | MinIO 연동 업로드 API. 타입 제한 (jpg/png/webp) + 2MB + Magic Byte 검증 + 서버 리사이징(200x200). 프리셋 아바타 8종 SVG (알고리즘 테마: 그래프노드·이진트리·스택큐·정렬바·미로경로·해시·재귀나선·링크드리스트). primary 보라 그라데이션 통일. 가입 시 랜덤 배정 | Postman (API), Palette (SVG) |
| 6 | **그라운드 룰 CRUD** | Study 엔티티에 `groundRules` TEXT 필드 (500자). ADMIN 작성/수정, MEMBER 읽기. API: `PATCH /api/studies/:id/ground-rules` | Conductor |
| 7 | **스터디 정책 일괄** | 멤버 제한 50명 (가입 시 검증). 초대코드 24h 만료 + brute force 5회/15분 잠금. ADMIN 위임 필수 (탈퇴 전). 닉네임 필수 (생성/가입). 지각 제출 (마감 후 허용 + `isLate` 플래그). CLOSED 스터디 읽기전용 가드 | Conductor (비즈니스), Gatekeeper (보안) |
| 8 | **토큰 서버측 자동 갱신** | API 요청 시 만료 임박(5분) 감지 → 응답에 새 토큰 쿠키 자동 발급. 프론트 갱신 로직 불필요 | Gatekeeper |

**병렬 트랙**: Architect + Librarian → Sprint 3-2 (Submission DB 분리) 동시 진행

---

### Sprint UI-3: Frontend Core

> 목표: 디자인 시스템 구축 + 핵심 3페이지 리빌드
> 병렬 트랙: Architect + Librarian → 3-3 Identity DB 분리

| # | 작업 | 상세 | Agent |
|---|---|---|---|
| 1 | **Tailwind 디자인 시스템** | `tailwind.config.ts`: 모든 컬러 토큰 CSS 변수 매핑 (47개 토큰). 듀얼 테마 (light/dark) CSS variables. `prefers-color-scheme` 기본 + 수동 토글. `next/font` 설정 (Sora, NotoSansKR, JetBrainsMono) | Palette |
| 2 | **공통 컴포넌트 라이브러리** | Logo, DiffBadge(난이도 6티어+Unrated), TimerBadge(4상태), StatusBadge, ScoreBadge, LangBadge, ScoreGauge(SVG), CategoryBar, Toast(7유형), NotifPanel, BackBtn, Skeleton. Hooks: useAnimVal, useInView | Palette |
| 3 | **레이아웃 리빌드** | Glassmorphism Nav (`backdrop-filter: blur(20px) saturate(180%)`). 아바타 드롭다운 (프로필/스터디관리/로그아웃). 스터디 셀렉터 드롭다운 (+참여 항목). 모바일 햄버거 메뉴. 그라운드 룰 아이콘 팝오버 | Palette |
| 4 | **Landing 페이지** | Hero + 핵심기능 3종 + AI 프리뷰 + CTA + Footer. IntersectionObserver fade-in 애니메이션. 비로그인 시만 노출 | Palette |
| 5 | **Login 페이지** | OAuth 3종 버튼 (Google/Naver/Kakao 스타일). 하단 약관 안내문 (링크). redirect 파라미터 전달 (OAuth state) | Palette |
| 6 | **Dashboard 페이지** | 3 KPI (제출률/AI점수/스트릭). 주차별 바 차트. "이번주 문제" (미제출 상단, 제출 완료 opacity↓). 최근 제출 목록. 스터디룸 카드 (풀폭, 하단). GitHub 온보딩 배너. C2 dual CTA (빈 상태). 모바일 순서: KPI→이번주→차트→최근제출→스터디룸 | Palette |

**병렬 트랙**: Architect + Librarian → Sprint 3-3 (Identity DB 분리) 동시 진행

---

### Sprint UI-4: Frontend Pages

> 목표: 나머지 기능 페이지 전체 리빌드

| # | 작업 | 상세 | Agent |
|---|---|---|---|
| 1 | **Problems 페이지** | 목록: 통합 검색(BOJ 번호+제목) + 필터(난이도별+주차별) + 페이지 번호 방식. 상세/에디터: Monaco Editor + C1 가드(GitHub 미연동 시 차단) + AI 한도 표시("오늘 N/5회") + 지각 배지. 생성(ADMIN): BOJ 검색 + 요일 선택 + 알고리즘 태그 + 23:59 고정 | Palette, Curator |
| 2 | **Submissions 페이지** | 필터 3개 (문제/상태/언어). 최신순 고정. 아코디언 AI 결과 뷰 (점수 게이지 + 5개 카테고리 바 + AI 총평 + 코드 비교 탭 + GitHub 커밋 링크). "크게 보기" 전체 화면. 지각 배지 표시 | Palette |
| 3 | **Study/Profile 3탭** | 탭 1 관리(ADMIN): 정보 수정 + 멤버 관리(역할/강퇴) + 초대코드 + 그라운드 룰(500자) + 스터디 종료(재입력 확인). 탭 2 통계: 주차별 차트 + 난이도 분포(6티어) + 언어 분포 + 멤버별 현황 + 태그 칩 그리드. 탭 3 프로필: 이미지 업로드/프리셋 + 닉네임 + GitHub 관리 + 테마 + 알림 토글 + 약관/개인정보 + 탈퇴 | Palette |
| 4 | **Notifications** | Toast 7유형 (프로그레스바, auto-dismiss). 알림 패널 (미읽음만 표시, 전체 읽음 버튼, 30일 자동 삭제). 10초 폴링 + 토스트 자동 표시. 클릭 시 `notification.link` 이동 | Palette, Herald |
| 5 | **Error/Empty states** | 4 통일 패턴 (빈/에러/404/네트워크). 알고리즘 테마 SVG 일러스트 + 보라 그라데이션. CTA 버튼. HTTP_ERROR_MESSAGES 한국어 매핑 | Palette |

---

### Sprint UI-5: Code Review 풀스택

> 목표: 피어 코드 리뷰 백엔드 + 프론트 동시 구현 (풀스택)

| # | 작업 | 상세 | Agent |
|---|---|---|---|
| 1 | **Review 테이블 마이그레이션** | `review_comments` + `review_replies` (soft-delete). `submission_id` 물리 FK, `author_id` cross-DB logical FK, `study_id` IDOR 방어용, `line_number` nullable. 인덱스 4개 | Librarian |
| 2 | **Review API 6개** | POST/GET/PATCH/DELETE reviews + POST/DELETE replies. IDOR 방어: study_id 스코핑 + author_id 이중 검증. 삭제 시 "삭제된 댓글입니다" (soft-delete) | Postman, Gatekeeper |
| 3 | **스터디 노트 API** | 문제별 1개, 스터디 공유, 멤버 전체 열람 | Postman |
| 4 | **A1 마감 후 열람 가드** | 마감 전 타인 코드 열람 차단 + 코드리뷰 차단. 마감 후에만 열림 (베끼기 방지) | Gatekeeper |
| 5 | **스터디룸 전환 페이지** | Logo B 노드 연결 애니메이션 + 문제 정보 카드 + 프로그레스바. 서브 멘트 랜덤 8종. 1~1.5초. 코드리뷰 최초 진입 시 1회 | Palette |
| 6 | **스터디룸 포커스 모드** | Nav 사라짐 → 전용 미니 헤더 ([← 나가기] [문제명] [난이도·주차] [멤버수] [타이머]). 나가기 → 대시보드 복귀. 토스트만 유지, 벨 숨김 | Palette |
| 7 | **2패널 코드 리뷰 UI** | Monaco ReadOnly + glyphMargin 라인 마커 + 우측 코멘트 패널. AI 하이라이트(issue/suggestion/good) 시각 강조. 모바일: '코드'/'리뷰' 탭 전환 | Palette |

---

### Sprint UI-6: Integration + Stabilization

> 목표: 전체 매칭 + 운영 도구 + 테스트 + 배포

| # | 작업 | 상세 | Agent |
|---|---|---|---|
| 1 | **프론트-백엔드 매칭** | 모든 API 연동 전수 검증. 더미 데이터 → 실제 API 교체. UUID 기반 URL 동작 확인. httpOnly Cookie 플로우 E2E. 라우트 가드 전 경로 검증 | Scout, Sensei |
| 2 | **운영 강화** | DLQ 관리 API (Gateway RabbitMQ Mgmt 프록시 + SystemAdminGuard). pg_dump Cron + OCI Storage 백업 | Architect |
| 3 | **통합 테스트** | 커버리지 70% 목표. 주요 시나리오 E2E (로그인→제출→AI분석→리뷰). IDOR/보안 시나리오 검증. 성능: P95 < 1s 확인 | Sensei, Scout |
| 4 | **k3d 검증 + k3s 배포** | MinIO 포함 전체 서비스 k3d 검증. aether-gitops 태그 업데이트. ArgoCD(OCI) 자동 배포. prod overlay 패치 | Architect |
| 5 | **레거시 정리 (audit-report 25건)** | 아래 상세 참조 | Gatekeeper, Architect, Herald |

#### 5-1. 레거시 정리 상세 (audit-report-2026-02-28 미해결 25건)

> 출처: `audit-report-2026-02-28.md` 전수 분석 결과, UI v2 및 기존 Sprint에서 해결되지 않는 코드 품질·운영 개선 항목

**간단 수정 (5건)**

| ID | 내용 | 담당 |
|---|---|---|
| C5 | Deployment `strategy.type: RollingUpdate` 명시 (현재 누락) | Architect |
| C8 | PgBouncer 도입 시 포트 6432 사용 (현재 5432 직연결) | Architect |
| H2 | MetricsService 누락 — Prometheus 메트릭 수집 클래스 추가 | Herald |
| H11 | DB 쿼리 타임아웃 200ms 설정 (`statement_timeout`) | Architect |
| M10 | API key 비교 `timingSafeEqual` 적용 (timing attack 방어) | Gatekeeper |

**코드 품질 (8건)**

| ID | 내용 | 담당 |
|---|---|---|
| H3 | 프로덕션 `console.log` 전수 제거 → 구조화 로거 전환 | Herald |
| H10 | 전 서비스 Winston/Pino 구조화 로거 통일 | Herald |
| M3 | Saga 패턴 타임아웃 설정 (GitHub Worker 등) | Gatekeeper |
| M5 | `x-trace-id` 헤더 전파 미들웨어 추가 | Gatekeeper |
| M9 | `process.env` 직접 참조 → ConfigService 통일 | Gatekeeper |
| M15 | SQL 쿼리 화이트리스트/파라미터 바인딩 전수 검증 | Gatekeeper |
| M16 | RequestIdMiddleware 도입 (요청 추적용) | Gatekeeper |
| H13 | GitHub Worker 헬스체크 엔드포인트 추가 | Herald |

**인프라/캐시 (8건)**

| ID | 내용 | 담당 |
|---|---|---|
| H9 | Sealed Secret 템플릿 표준화 (현재 수동 생성) | Architect |
| H16 | SSE 연결 타임아웃 + 재연결 로직 강화 | Gatekeeper |
| M4 | Redis 캐시 전략 수립 (문제 목록, 스터디 정보 등) | Architect |
| M7 | 캐시 무효화 이벤트 연동 (CRUD 시 캐시 flush) | Architect |
| M8 | 캐시 키 네이밍 불일치 수정 (서비스 간 통일) | Architect |
| M11 | Redis 연결 에러 핸들링 강화 (graceful degradation) | Architect |
| M13 | SSE용 Redis Pub/Sub 전용 클라이언트 분리 | Architect |
| M14 | RabbitMQ 재연결 로직 강화 (exponential backoff) | Architect |

**DB 정리 (2건)**

| ID | 내용 | 담당 |
|---|---|---|
| M1 | Dead migration 파일 정리 (사용되지 않는 마이그레이션 제거) | Architect |
| M2 | `role` 컬럼 VARCHAR → ENUM 전환 마이그레이션 | Architect |

**운영 (2건)**

| ID | 내용 | 담당 |
|---|---|---|
| M19 | Grafana PVC 추가 (현재 emptyDir → 재시작 시 대시보드 소실) | Architect |
| M20 | Loki/Prometheus liveness/readiness probe 추가 | Architect |

---

## 4. Agent 배정 총괄

| Agent | Tier | 주 담당 Sprint | 핵심 작업 |
|---|---|---|---|
| **Gatekeeper** | 1 | UI-1, UI-2, UI-5 | httpOnly Cookie, CORS, ExceptionFilter, S7, SSE S6, CSP, brute force, IDOR, 마감 가드 |
| **Conductor** | 1 | UI-2 | 그라운드 룰, 스터디 정책 (멤버 제한, 초대코드, ADMIN 위임, 닉네임, 지각, CLOSED) |
| **Librarian** | 1 | UI-1, UI-5 | UUID 마이그레이션, Review 테이블, 문서 갱신 |
| **Architect** | 2 | UI-1, UI-6 | MinIO 배포, k3d/k3s manifest, pg_dump, DLQ API, 3-2/3-3 DB 분리 (병렬) |
| **Postman** | 2 | UI-2, UI-5 | 이미지 업로드 API, Review API 6개, 스터디 노트 API |
| **Curator** | 2 | UI-2, UI-4 | 마감 리마인더 Cron, Problems 페이지 비즈니스 로직 |
| **Scribe** | 2 | 전 Sprint | 메모리/Skill/문서 갱신, Sprint 종료 문맥 정리 |
| **Palette** | 3 | UI-2~UI-5 | Monaco Editor, 프리셋 아바타 SVG, 디자인 시스템, 공통 컴포넌트, 전 페이지 UI, 스터디룸 |
| **Herald** | 3 | UI-2, UI-4 | 알림 9종 확장, DEADLINE_REMINDER, Toast/Panel UI |
| **Sensei** | 3 | UI-2, UI-6 | AI 프롬프트 설계, AI 비용 정책, 통합 테스트 검증 |
| **Scout** | 3 | UI-6 | 프론트-백엔드 매칭 검증, E2E 탐색 |

---

## 5. 신규 마이그레이션 목록

| # | 파일명 | DB | 내용 |
|---|---|---|---|
| 1 | `AddPublicIdToUsers.ts` | identity_db | users.publicId UUID + unique index |
| 2 | `AddPublicIdToStudies.ts` | identity_db | studies.publicId UUID + unique index |
| 3 | `AddPublicIdToProblems.ts` | problem_db | problems.publicId UUID + unique index |
| 4 | `AddPublicIdToSubmissions.ts` | submission_db | submissions.publicId UUID + unique index |
| 5 | `AddPublicIdToNotifications.ts` | identity_db | notifications.publicId UUID + unique index |
| 6 | `ExtendNotificationTypeEnum9.ts` | identity_db | ENUM 4개 추가 (DEADLINE_REMINDER, MEMBER_JOINED, MEMBER_LEFT, STUDY_CLOSED) |
| 7 | `AddGroundRulesToStudies.ts` | identity_db | studies.groundRules TEXT nullable |
| 8 | `AddIsLateToSubmissions.ts` | submission_db | submissions.isLate BOOLEAN default false |
| 9 | `AddNicknameToStudyMembers.ts` | identity_db | study_members.nickname VARCHAR(50) NOT NULL |
| 10 | `CreateReviewTables.ts` | submission_db | review_comments + review_replies (soft-delete, 인덱스 4개) |
| 11 | `CreateStudyNotes.ts` | submission_db | study_notes (problem_id + study_id unique, content TEXT) |

---

## 6. 신규/변경 API 목록

### 신규 API

| # | 메서드 | 경로 | 서비스 | Sprint |
|---|---|---|---|---|
| 1 | GET | `/api/analysis/quota` | AI Analysis | UI-2 |
| 2 | PATCH | `/api/studies/:id/ground-rules` | Gateway | UI-2 |
| 3 | POST | `/api/users/avatar` | Gateway → MinIO | UI-2 |
| 4 | POST | `/api/submissions/:id/reviews` | Submission | UI-5 |
| 5 | GET | `/api/submissions/:id/reviews` | Submission | UI-5 |
| 6 | PATCH | `/api/reviews/:id` | Submission | UI-5 |
| 7 | DELETE | `/api/reviews/:id` | Submission | UI-5 |
| 8 | POST | `/api/reviews/:id/replies` | Submission | UI-5 |
| 9 | DELETE | `/api/replies/:id` | Submission | UI-5 |
| 10 | GET | `/api/studies/:sid/problems/:pid/notes` | Gateway | UI-5 |
| 11 | PUT | `/api/studies/:sid/problems/:pid/notes` | Gateway | UI-5 |
| 12 | POST | `/api/notifications/read-all` | Gateway | UI-2 |

### 변경 API (UUID 전환)

- 모든 기존 API의 경로 파라미터: auto-increment ID → UUID publicId
- 예: `/api/studies/1` → `/api/studies/{uuid}`
- 서버측 `publicId` → 내부 PK 변환 레이어 추가

---

## 7. 리스크 & 주의사항

### HIGH

| # | 리스크 | 완화 방안 |
|---|---|---|
| R1 | UUID 전환 시 기존 API 호환성 깨짐 | 전환 기간 동안 ID/UUID 양쪽 수용하는 파이프 도입, 프론트 전체 전환 후 ID 제거 |
| R2 | httpOnly Cookie 전환 시 기존 인증 플로우 중단 | Gatekeeper 전담, Identity+Gateway+Frontend 동시 전환. 롤백 계획 수립 |
| R3 | 디자인 시스템 변경으로 전 페이지 회귀 | Palette 디자인 시스템 구축 → 페이지별 순차 적용. 각 페이지 완료 후 스크린샷 검증 |

### MEDIUM

| # | 리스크 | 완화 방안 |
|---|---|---|
| R4 | Monaco Editor 번들 사이즈 | dynamic import + 언어별 worker lazy load |
| R5 | MinIO 운영 안정성 | PVC 백업 + health check + 모니터링 메트릭 |
| R6 | 9종 알림 이벤트 누락 가능성 | Herald 전담 + 이벤트 매트릭스 체크리스트 |

---

## 8. 의존 관계 상세

```
Sprint 3-1 Contract
  └─→ Sprint UI-1 (#1 UUID 마이그레이션)
        ├─→ Sprint UI-1 (#2 httpOnly, #3 CORS, #4~9 나머지)
        ├─→ Sprint 3-2 Submission DB (병렬, Architect/Librarian)
        └─→ Sprint UI-2 (전체)
              ├─→ Sprint 3-3 Identity DB (병렬, Architect/Librarian)
              └─→ Sprint UI-3 (전체)
                    └─→ Sprint UI-4 (전체)
                          └─→ Sprint UI-5 (전체)
                                └─→ Sprint UI-6 (전체)
```

**핵심 의존**:
- UI-1 #1(UUID) → 모든 후속 Sprint의 API 경로 기반
- UI-1 #2(httpOnly) → UI-3 Login/Dashboard의 인증 플로우
- UI-2 #4(Monaco) → UI-4 Problems 에디터
- UI-2 #5(프로필) → UI-4 Study/Profile 3탭
- UI-5 전체 → UI-3 Dashboard 스터디룸 카드 (카드 자체는 UI-3에서 빈 상태로 구현, UI-5에서 연동)

---

## 9. 성공 기준

| 항목 | 기준 |
|---|---|
| 페이지 리빌드 | 9개 전 페이지 v2 디자인 적용 |
| 디자인 시스템 | 47개 컬러 토큰 + 듀얼 테마 + 3개 폰트 |
| 공통 컴포넌트 | 13종 + 2 hooks |
| 보안 | httpOnly Cookie + UUID + CORS + CSP + IDOR + Route Guard |
| 알림 | 9종 이벤트 + DEADLINE_REMINDER + Toast + Panel |
| AI | 5카테고리 highlights + 일일 5회 + 과거문제 미차감 |
| 코드 리뷰 | Review API 6개 + 스터디룸 UI + 스터디 노트 |
| 테스트 | 커버리지 70% + E2E 주요 시나리오 |
| 배포 | k3d 검증 + k3s 운영 배포 |
| SLO | 가용성 99.5%, 에러율 <5%, P95 <1s |
