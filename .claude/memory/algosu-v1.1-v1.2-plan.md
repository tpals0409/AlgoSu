# AlgoSu v1.1 + v1.2 적용 계획서

## 근거 문서
- `AlgoSu_Oracle_Decisions_Update_v1.1.md` — 다중 스터디 서비스화 *(원본: Mac `/Users/leokim/Desktop/추가사항 문서/`)*
- `AlgoSu_Oracle_Decisions_Update_v1.2.md` — OAuth 인증 도입
- `AlgoSu_TF_Kickoff_Plan_v2.1.md` — Palette 합류
- `AlgoSu_Code_Conventions_Update_v1.1.md` — 디자인 토큰 규칙

---

## 변경점 총괄 (9개 결정)

| 결정 | 유형 | 핵심 |
|------|------|------|
| C-02 | 전면 재결정 | study_id=1 고정 → 다중 스터디 완전 지원 (studies 테이블 신설) |
| C-03 | 재결정 | 단일 레포 → 스터디별 GitHub 레포 (studies.github_repo) + SKIPPED |
| H-03 | 재재결정(v1.2) | Custom Auth (Supabase Auth 미사용) — Google/Naver/Kakao OAuth 직접 연동 + JWT 자체 발급 + role 제거 |
| H-05 | 스키마 수정 | study_id UUID FK 변경 + users 테이블 신설 (oauth_provider, github_connected) |
| M-02 | 수정 | 멱등성 키 유지 + 비멤버 403 차단 |
| M-11 | 재결정 | X-User-Role 폐기 → study_members 캐시 기반 권한 |
| NEW-01 | 신규 | 스터디 생성/가입/초대 플로우 (study_invites 테이블) |
| NEW-02 | 신규 | 다중 스터디 동시 소속 + X-Study-ID 헤더 + 프론트 전역 상태 |
| NEW-04 | 신규(v1.2) | GitHub 2단계 연동 (1차 소셜 → 2차 GitHub 필수) |

---

## 실행 계획 — 5단계

### Phase A — DB 기반 (Librarian)

| 작업 | 파일 | 내용 |
|------|------|------|
| 신규 마이그레이션 | 새 파일 | studies, study_members, study_invites 테이블 |
| 신규 마이그레이션 | 새 파일 | users 테이블 (oauth_provider_enum, github_connected) |
| 수정 | CreateSubmissionsAndDrafts | study_id UUID FK 추가, drafts UNIQUE 3중, github_sync_status SKIPPED |
| 수정 | CreateProblemsTable | study_group_id varchar → study_id UUID FK |
| 수정 | CreateProfilesTable | study_group_id 제거 (study_members로 대체) |
| 수정 | infra SQL | 01-create-databases.sql, 02-grant-permissions.sql |

**예상 파일: 6~7개**

### Phase B — Gateway + 인증 (Gatekeeper)

| 작업 | 파일 | 내용 |
|------|------|------|
| JWT role 제거 | jwt.middleware.ts | payload['role'] 삭제, X-User-Role 주입 삭제 |
| JWT 타입 정리 | jwt.strategy.ts | JwtPayload/ValidatedUser에서 role 제거 |
| X-Study-ID 주입 | jwt.middleware.ts | 클라이언트 헤더에서 X-Study-ID 읽기 + UUID 검증 + 전달 |
| X-User-Role 제거 | proxy.module.ts | X-User-Role 전달 삭제, X-Study-ID 전달 추가 |
| OAuth 직접 연동 | 새 파일 | Google/Naver/Kakao OAuth 직접 연동 (Supabase 미사용) |
| GitHub 연동 API | 새 파일 | GitHub OAuth 2단계 연동 + 해제 + 재연동 |
| Internal API | 새 파일 | GET /internal/users/:user_id/github-status |
| 스터디 API | 새 파일 | 스터디 CRUD + 초대 코드 발급/사용 (NEW-01) |
| 라우팅 추가 | service-keys.config.ts | /api/studies prefix 등록 |

**예상 파일: 12~15개**

### Phase C — 백엔드 서비스 (Conductor + Curator 병렬)

**Conductor (Submission Service)**

| 작업 | 파일 | 내용 |
|------|------|------|
| Entity 수정 | submission.entity.ts | studyId 컬럼 추가, GitHubSyncStatus에 SKIPPED |
| Service 수정 | submission.service.ts | create(dto, userId, studyId), findByStudyAndUser() |
| Controller 수정 | submission.controller.ts | @Headers('x-study-id') 전 핸들러 추가 |
| 가드 신규 | study-member.guard.ts | study_members 캐시 기반 멤버십 검증 |
| GitHub 검증 | submission.service.ts | github_connected 사전 확인 (Internal API 호출) |
| Saga 확장 | saga-orchestrator.service.ts | MQ 메시지에 studyId 포함, SKIPPED 분기 |
| MQ 타입 | mq-publisher.service.ts | SubmissionEvent에 studyId 추가 |

**예상 파일: 8~9개**

**Curator (Problem Service)**

| 작업 | 파일 | 내용 |
|------|------|------|
| Entity 수정 | problem.entity.ts | studyGroupId → studyId UUID |
| Service 수정 | problem.service.ts | findByWeekAndStudy(), findActiveByStudy() |
| Controller 수정 | problem.controller.ts | X-User-Role 제거, @Headers('x-study-id'), study_member.guard |
| 가드 신규 | study-member.guard.ts | 동일 공통 가드 |
| DTO 정리 | create-problem.dto.ts | studyGroupId 제거 |

**예상 파일: 5~6개**

### Phase P — UI 톤 개선 (Palette, Phase C와 병렬)

| # | 작업 | 파일 | 내용 |
|---|------|------|------|
| P-0 | 디자인 토큰 체계 재정의 | globals.css, tailwind.config.ts | {semantic}-{scale} 네이밍 전환 |
| P-1 | 다크모드 배경 톤 상향 | globals.css | --bg L7%→L10~12%, 레이어간 명도차 10~12%p 확보 |
| P-2 | 라이트모드 경쾌함 | globals.css | 보라회색 → 더 밝고 깨끗한 톤 |
| P-3 | 텍스트 가독성 | globals.css | --text3/--muted-foreground WCAG AA (4.5:1+) |
| P-4 | Badge 가시성 | Badge.tsx | 반투명 12~15% → 20~25% |
| P-5 | Button hover | Button.tsx | 어두워지는 방향 → 밝아지는/채도 증가 방향 |
| P-6 | Card depth | Card.tsx, tailwind.config.ts | 다크모드 그림자 별도, 배경-카드 경계 |
| P-7 | TopNav 분리감 | TopNav.tsx | 다크모드 glass 명도↑, 경계선 보강 |
| P-8 | Input 구분 | Input.tsx | 다크모드 카드 배경과 입력 필드 명도차 |
| P-9 | 하드코딩 제거 | 전 UI 파일 | bg-[#...] → 토큰 변수 전환 |

**예상 파일: 8~10개**

**Palette 디자인 원칙:**
- 미니멀 + 세련된 톤 유지 (색상 늘리지 않고 명도/채도 조율)
- 다크모드 ≠ 검정 (L10~12% 수준)
- WCAG AA 전 텍스트 대비비 4.5:1+
- 코드 규칙 v1.1 준수: 인라인 하드코딩 금지, 토큰 네이밍 {semantic}-{scale}

### Phase D — GitHub Worker (Postman)

| 작업 | 파일 | 내용 |
|------|------|------|
| 레포 동적 조회 | github-push.service.ts | 환경변수 하드코딩 → studies.github_repo 조회 |
| SKIPPED 분기 | worker.ts | github_repo 미연결 → SKIPPED 즉시 리턴 |
| 토큰 확장 | token-manager.ts | 스터디별 Installation Token 관리 |
| 상태 보고 | status-reporter.ts | reportSkipped() 메서드 추가 |
| 이벤트 타입 | worker.ts | GitHubPushEvent에 studyId 추가 |

**예상 파일: 4~5개**

### Phase E — Frontend 통합 (Herald + Palette↔Herald 협업)

**Herald 단독**

| 작업 | 파일 | 내용 |
|------|------|------|
| OAuth 로그인 UI | 새 파일 | Google/Naver/Kakao 버튼 |
| GitHub 연동 화면 | 새 파일 | 강제 연동 + 기능 잠금 (github_connected=FALSE) |
| TOKEN_INVALID 재연동 | 새 파일 | 재연동 버튼 → GitHub OAuth 재실행 |
| 스터디 선택 페이지 | 새 파일 | 스터디 목록 + 전환 |
| X-Study-ID 전역 상태 | api.ts + 새 Context | fetchApi 자동 첨부 |
| localStorage 키 변경 | useAutoSave.ts | algoso:draft:{studyId}:{problemId} |
| SSE SKIPPED | useSubmissionSSE.ts | github_skipped 상태 추가 |

**Palette ↔ Herald 협업**

| 항목 | Palette | Herald |
|------|---------|--------|
| 스터디 선택/전환 | StudyCard, StudySelector 디자인 | 페이지 로직 + API 연동 |
| OAuth 로그인 버튼 | 스타일 가이드 | 구현 |
| GitHub 연동 유도 | 화면 디자인 | 플로우 로직 |
| 에러/실패 상태 | TOKEN_INVALID, 403 안내 디자인 | 조건부 렌더링 |
| Empty State | "스터디 없음" 디자인 | 렌더링 |

**예상 파일: 8~10개**

---

## 의존관계

```
A (DB/Librarian) ─blocks→ B (Gateway/Gatekeeper)
                            │
                            ├─blocks→ C (Conductor + Curator)
                            │           └─blocks→ D (Postman)
                            │
                            └─blocks→ E (Herald)
                                        ↑
                  P (Palette) ─blocks→ E (Palette↔Herald 협업)

Phase C와 Phase P는 병렬 수행 가능 (독립적)
```

## Agent 배분 최종

| Agent | Phase | 예상 파일 | 모델 |
|-------|-------|----------|------|
| Librarian | A | 6~7 | Opus |
| Gatekeeper | B | 12~15 | Opus |
| Conductor | C | 8~9 | Opus |
| Curator | C | 5~6 | Sonnet |
| Palette | P (C 병렬) | 8~10 | Sonnet |
| Postman | D | 4~5 | Sonnet |
| Herald | E | 8~10 | Sonnet |

**총 예상 작업량: ~55~65개 파일 (수정+신규)**

## 코드 규칙 (v1.1 — 전 Agent 적용)

- 디자인 토큰: `{semantic}-{scale}` (primary-500, error-100)
- `bg-[#...]` 인라인 하드코딩 금지 → 토큰 클래스 사용
- `components/ui/` 신규 생성: Palette 가이드 필수
- `tailwind.config.ts` 토큰 추가: Palette 확정 → Herald 등록 순서

## 보안 체크포인트

| 항목 | 확인 |
|------|------|
| JWT | role 제거 후에도 none 차단, exp 검증 유지 |
| OAuth | Custom Auth — state/PKCE CSRF 방지, 토큰 교환 서버사이드 처리 |
| IDOR | X-Study-ID + X-User-ID 조합으로 study_members 확인 |
| GitHub Token | github_user_id/github_username 로그 노출 금지 |
| Internal API | /internal/* 경로 X-Internal-Key 검증 필수 |
| 멤버십 캐시 | TTL 10분, 추방/역할변경 즉시 무효화 |
| 입력값 | X-Study-ID UUID 형식 화이트리스트 검증 (Gateway) |

## 상태 (2026-02-28 완료)

- [x] Phase A (Librarian) — DB 마이그레이션 완료 ✅
- [x] Phase B (Gatekeeper) — Gateway + Custom Auth 완료 ✅
- [x] Phase C-1 (Conductor) — Submission studyId 통합 완료 ✅
- [x] Phase C-2 (Curator) — Problem studyId 통합 완료 ✅
- [x] Phase P (Palette) — UI 톤 개선 + 토큰 체계 완료 ✅
- [x] Phase D (Postman) — GitHub Worker 스터디별 레포 완료 ✅
- [x] Phase E (Herald) — Frontend 스터디+OAuth+SSE 통합 완료 ✅ (빌드 0 에러)
