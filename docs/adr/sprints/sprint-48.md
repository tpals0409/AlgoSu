# Sprint 48 — 게스트 모드 & 퍼블릭 프로필

## Oracle Verdict: APPROVED
- Date: 2026-03-10
- Priority: 서비스 안정성 > 개발 속도 > 기능 완성도
- Scope: 공유 링크 + 게스트 스터디룸 + 퍼블릭 프로필 + Settings 확장
- Duration: 3주 (W1 Backend → W2 Frontend → W3 QA+Deploy)

---

## Executive Summary

| 항목 | 현재 상태 | 목표 | 갭 |
|------|-----------|------|-----|
| 스터디룸 접근 | 멤버 전용 (StudyMemberGuard) | 공유 링크로 게스트 읽기 접근 | Guard 우회 + 토큰 시스템 신규 |
| 프로필 공개 | 없음 | `/profile/{slug}` 퍼블릭 페이지 | 엔티티+API+페이지 신규 |
| Settings | 미구현 | 프로필 공개 + slug 설정 | Settings 페이지 신규 |
| 익명화 | 없음 | 게스트 뷰에서 타 멤버 익명화 | 프론트엔드 로직 신규 |

**예상 영향도**: ~45-55 파일 (신규 ~25, 수정 ~20, 테스트 ~15)

---

## PM 확정 사항

### 기능 요구사항
1. **공유 링크**: 토큰 기반 URL (`/shared/{token}`), 로그인 불필요
2. **게스트 접근 범위**: 문제 목록 + 제출 현황 + AI 분석 + 코드 원문 (전체 읽기 전용)
3. **유효 기간**: 무기한(기본) + 선택적 만료 설정
4. **생성 권한**: 스터디 멤버 누구나
5. **익명화**: 프로필 소유자 외 타 멤버는 랜덤 닉네임 (형용사+명사, 예: `용감한 탐험가`)
6. **퍼블릭 프로필**: 기본 비공개, Settings에서 활성화
7. **프로필 URL**: `/profile/{slug}` (유저가 직접 설정, 영문소문자+숫자+하이픈, 3~20자, 자유 변경)
8. **프로필 표시 정보**: 이름, 아바타, 참여 스터디 목록, 총 제출 수, AI 평균 점수, 스터디별 공유 링크
9. **게스트 액션**: 완전한 읽기 전용 (쓰기/인터랙션 일체 차단)
10. **방문 통계**: 불필요 (MVP)
11. **공유 링크 관리 UI**: 개인 프로필 페이지에 배치
12. **퍼블릭 프로필 설정 UI**: Settings 페이지에 배치

---

## 의존성 그래프

```
W1-1 DB 마이그레이션 (share_links 테이블 + users 컬럼)
  |
  +---> W1-2 ShareLink CRUD API (Gateway)
  |       |
  |       +---> W1-3 게스트 Guard + 공개 엔드포인트
  |
  +---> W1-4 퍼블릭 프로필 API (slug 조회, 통계 집계)
  |
  +---> W1-5 Settings API (slug 설정, 프로필 공개 토글)
  |
  v
W2-1 게스트 스터디룸 뷰 (읽기 전용 + 익명화)
  |
W2-2 퍼블릭 프로필 페이지
  |
W2-3 Settings 페이지 (프로필 공개 + slug)
  |
W2-4 공유 링크 관리 UI (프로필 페이지 내)
  |
  v
W3-1 백엔드 테스트
  |
W3-2 프론트엔드 테스트
  |
W3-3 통합 QA + 보안 점검
  |
W3-4 CI/CD 배포
```

---

## 상세 태스크 분해

### Wave 1: Backend Foundation (Week 1)

#### W1-1: DB 마이그레이션
- **Agent**: Architect
- **Risk**: LOW
- **Files**:
  - `services/gateway/src/database/migrations/XXXXXX-CreateShareLinksTable.ts`
  - `services/gateway/src/database/migrations/XXXXXX-AddProfileFieldsToUsers.ts`
- **Key Changes**:
  - `share_links` 테이블 신규 생성:
    ```
    id: UUID (PK)
    token: VARCHAR(64) (unique, index) — crypto.randomBytes(32).toString('hex')
    study_id: UUID (FK → studies.id)
    created_by: UUID (FK → users.id) — 링크 생성자
    expires_at: TIMESTAMP | NULL — NULL이면 무기한
    is_active: BOOLEAN (default: true)
    created_at: TIMESTAMP
    updated_at: TIMESTAMP
    ```
  - `users` 테이블 컬럼 추가:
    ```
    profile_slug: VARCHAR(20) | NULL (unique, index) — 커스텀 프로필 URL
    is_profile_public: BOOLEAN (default: false) — 프로필 공개 여부
    ```
- **Acceptance Criteria**:
  - 마이그레이션 up/down 정상 동작
  - 인덱스: `token` unique, `profile_slug` unique, `study_id` 일반
  - NULL 허용 필드 명확 구분
- **Rollback**: 마이그레이션 revert

#### W1-2: ShareLink CRUD API
- **Agent**: Postman
- **Risk**: MEDIUM
- **Files**:
  - `services/gateway/src/share/share-link.entity.ts`
  - `services/gateway/src/share/share-link.service.ts`
  - `services/gateway/src/share/share-link.controller.ts`
  - `services/gateway/src/share/share-link.module.ts`
  - `services/gateway/src/share/dto/*.ts`
- **Key Changes**:
  - ShareLink 엔티티 + 리포지토리
  - CRUD 엔드포인트 (인증 필수, StudyMemberGuard 적용):
    ```
    POST   /api/studies/:studyId/share-links          — 생성 (멤버)
    GET    /api/studies/:studyId/share-links           — 목록 조회 (멤버)
    DELETE /api/studies/:studyId/share-links/:linkId   — 비활성화 (생성자 본인 또는 관리자)
    ```
  - 생성 시 옵션: `{ expiresAt?: ISO8601 }`
  - 토큰 생성: `crypto.randomBytes(32).toString('hex')`
- **Acceptance Criteria**:
  - 멤버만 CRUD 가능
  - 만료된 링크 조회 시 자동 필터링
  - 삭제는 soft delete (is_active = false)
- **Rollback**: 모듈 제거 + 마이그레이션 revert

#### W1-3: 게스트 Guard + 공개 엔드포인트
- **Agent**: Gatekeeper
- **Risk**: HIGH
- **Files**:
  - `services/gateway/src/common/guards/share-link.guard.ts`
  - `services/gateway/src/share/public-share.controller.ts`
  - `services/gateway/src/auth/jwt.middleware.ts` (수정 — 공개 경로 제외)
  - `services/problem/src/common/guards/share-link.guard.ts`
  - `services/submission/src/common/guards/share-link.guard.ts`
- **Key Changes**:
  - `ShareLinkGuard`: 토큰 유효성 + 만료 + 활성 상태 검증
  - JWT 미들웨어 `ignoreTokenUrl`에 공개 경로 추가:
    ```
    /api/public/shared/:token          — 공유 링크 메타 (스터디 정보)
    /api/public/shared/:token/problems — 문제 목록
    /api/public/shared/:token/submissions — 제출 목록
    /api/public/shared/:token/analysis/:submissionId — AI 분석 결과
    /api/public/profile/:slug          — 퍼블릭 프로필
    ```
  - 공개 엔드포인트는 쓰기 API 일체 없음 (GET only)
  - 하위 서비스(Problem, Submission)에도 ShareLinkGuard 추가 또는 Gateway 프록시로 처리
- **Acceptance Criteria**:
  - 유효 토큰: 200 + 데이터 반환
  - 만료/비활성/존재하지 않는 토큰: 404 (정보 누출 방지, 403 아님)
  - 공개 엔드포인트에서 쓰기 불가능 확인
  - 기존 인증 경로에 영향 없음
- **Rollback**: Guard + Controller 제거, ignoreTokenUrl 원복

#### W1-4: 퍼블릭 프로필 API
- **Agent**: Postman
- **Risk**: MEDIUM
- **Files**:
  - `services/gateway/src/share/public-profile.controller.ts`
  - `services/gateway/src/share/public-profile.service.ts`
- **Key Changes**:
  - 공개 엔드포인트 (인증 불필요):
    ```
    GET /api/public/profile/:slug
    ```
  - 반환 데이터:
    ```json
    {
      "name": "사용자 이름",
      "avatarUrl": "preset:tree",
      "studies": [
        {
          "studyName": "알고리즘 스터디",
          "memberCount": 5,
          "shareLink": "/shared/{token}" | null,
          "totalSubmissions": 42,
          "averageAiScore": 78.5
        }
      ],
      "totalSubmissions": 120,
      "averageAiScore": 82.3
    }
    ```
  - 스터디별 통계: 해당 유저의 제출만 집계 (타 멤버 데이터 미포함)
  - `is_profile_public = false`인 유저: 404
  - 스터디별 공유 링크: 해당 유저가 생성한 링크 중 활성+유효한 것 1개
- **Acceptance Criteria**:
  - slug 미존재 또는 비공개: 404
  - 통계 쿼리 성능: 인덱스 활용 확인
  - 민감 정보(email, github_token 등) 미노출
- **Rollback**: Controller + Service 제거

#### W1-5: Settings API (프로필 공개 + slug)
- **Agent**: Postman
- **Risk**: LOW
- **Files**:
  - `services/gateway/src/auth/oauth/user.entity.ts` (수정 — 컬럼 추가)
  - `services/gateway/src/user/user.controller.ts` (수정 또는 신규)
  - `services/gateway/src/user/dto/update-profile-settings.dto.ts`
- **Key Changes**:
  - 인증 필수 엔드포인트:
    ```
    GET  /api/users/me/settings          — 현재 설정 조회
    PUT  /api/users/me/settings/profile  — 프로필 공개 + slug 업데이트
    ```
  - slug 유효성 검증:
    - 정규식: `/^[a-z0-9][a-z0-9-]{1,18}[a-z0-9]$/` (3~20자, 영문소문자+숫자+하이픈, 시작/끝 하이픈 불가)
    - 중복 체크: unique constraint + 서비스 레벨 검증
    - 예약어 차단: `admin`, `api`, `public`, `shared`, `login`, `settings`, `profile` 등
  - `is_profile_public` 토글: true/false
  - slug 설정 없이 공개 불가 (slug 필수 선행)
- **Acceptance Criteria**:
  - slug 중복 시 409 Conflict
  - 유효하지 않은 slug 형식: 400 Bad Request
  - 예약어 사용 시: 400
  - slug 없이 is_profile_public=true 시도: 400
- **Rollback**: 엔드포인트 제거, 엔티티 컬럼은 마이그레이션에서 관리

---

### Wave 2: Frontend (Week 2)

#### W2-1: 게스트 스터디룸 뷰
- **Agent**: Palette
- **Risk**: HIGH
- **Files**:
  - `frontend/src/app/shared/[token]/page.tsx` (신규)
  - `frontend/src/app/shared/[token]/layout.tsx` (신규)
  - `frontend/src/contexts/GuestContext.tsx` (신규)
  - `frontend/src/lib/api.ts` (수정 — public API 함수 추가)
  - `frontend/src/lib/anonymize.ts` (신규)
- **Key Changes**:
  - `/shared/{token}` 라우트: 인증 없이 접근 가능한 별도 레이아웃
  - `GuestContext`: 토큰 기반 데이터 패칭, 읽기 전용 플래그
  - 기존 스터디룸 컴포넌트 재사용 (읽기 전용 모드):
    - 문제 추가/수정/삭제 버튼 숨김
    - 제출 버튼 숨김
    - 멤버 관리 UI 숨김
    - 스터디 설정 접근 차단
  - **익명화 로직** (`anonymize.ts`):
    ```typescript
    const ADJECTIVES = ['용감한', '빠른', '조용한', '밝은', '슬기로운', '든든한', '재빠른', '꼼꼼한', '활기찬', '차분한']
    const NOUNS = ['탐험가', '항해사', '설계자', '개척자', '발명가', '분석가', '관찰자', '수호자', '모험가', '연구자']
    ```
    - 같은 토큰 내에서 동일 유저는 항상 같은 닉네임 (userId 기반 해시 → 인덱스 결정)
    - 프로필 소유자(공유 링크 생성자)만 실명+아바타 표시
    - 타 멤버: 익명 닉네임 + 기본 아바타
  - public API 함수 추가 (api.ts):
    ```typescript
    export const publicApi = {
      getSharedStudy(token: string): Promise<SharedStudyData>
      getSharedProblems(token: string): Promise<Problem[]>
      getSharedSubmissions(token: string): Promise<Submission[]>
      getSharedAnalysis(token: string, submissionId: string): Promise<Analysis>
      getPublicProfile(slug: string): Promise<PublicProfile>
    }
    ```
- **Acceptance Criteria**:
  - 로그인 없이 `/shared/{token}` 접근 가능
  - 쓰기 UI 요소 일체 숨김
  - 프로필 소유자 외 모든 멤버 익명화
  - 동일 토큰 내 같은 유저는 항상 같은 익명 닉네임
  - 만료/무효 토큰: 에러 페이지 표시
  - 기존 스터디룸 기능에 영향 없음
- **Rollback**: `/shared` 라우트 + GuestContext + anonymize.ts 제거

#### W2-2: 퍼블릭 프로필 페이지
- **Agent**: Palette
- **Risk**: MEDIUM
- **Files**:
  - `frontend/src/app/profile/[slug]/page.tsx` (신규)
  - `frontend/src/components/profile/PublicProfileCard.tsx` (신규)
  - `frontend/src/components/profile/StudyStatsCard.tsx` (신규)
- **Key Changes**:
  - `/profile/{slug}` 라우트: 인증 불필요
  - 레이아웃:
    - 상단: 유저 이름 + 아바타 (프로필 카드)
    - 중단: 전체 통계 (총 제출 수, AI 평균 점수)
    - 하단: 참여 스터디 카드 리스트
      - 스터디명, 멤버 수, 본인 제출 수, AI 평균 점수
      - 공유 링크가 있으면 "스터디룸 보기" 버튼 → `/shared/{token}`으로 이동
  - 비공개 프로필 접근 시: 404 페이지
  - 반응형: 모바일/데스크탑 대응
- **Acceptance Criteria**:
  - slug로 프로필 조회 + 렌더링
  - 공유 링크 연결 동작
  - 민감 정보 미표시 (email 등)
  - 비공개 프로필: 404
- **Rollback**: `/profile/[slug]` 라우트 + 컴포넌트 제거

#### W2-3: Settings 페이지 확장
- **Agent**: Palette
- **Risk**: LOW
- **Files**:
  - `frontend/src/app/settings/page.tsx` (신규 또는 기존 profile 페이지 확장)
  - `frontend/src/components/settings/ProfileVisibilitySettings.tsx` (신규)
- **Key Changes**:
  - Settings 페이지에 "퍼블릭 프로필" 섹션 추가:
    - 프로필 공개 토글 (Switch)
    - slug 입력 필드 + 실시간 중복 체크
    - 미리보기 URL 표시: `algosu.com/profile/{slug}`
    - slug 유효성 검증 (클라이언트 사이드)
  - 토글 OFF 시 slug 입력 비활성화 (readOnly)
  - slug 미설정 상태에서 토글 ON 시도: 경고 메시지
- **Acceptance Criteria**:
  - slug 설정 + 공개 토글 동작
  - 중복 slug 실시간 피드백
  - 유효하지 않은 slug 형식: 즉시 에러 표시
  - 저장 성공 후 프로필 URL 링크 표시 (클릭→새 탭)
- **Rollback**: Settings 섹션 제거

#### W2-4: 공유 링크 관리 UI
- **Agent**: Palette
- **Risk**: LOW
- **Files**:
  - `frontend/src/app/profile/page.tsx` (수정 — 공유 링크 섹션 추가)
  - `frontend/src/components/profile/ShareLinkManager.tsx` (신규)
- **Key Changes**:
  - 기존 프로필 페이지에 "내 공유 링크" 섹션 추가:
    - 스터디별 공유 링크 목록
    - 링크 생성 버튼 (만료 기간 선택: 무기한 / 7일 / 30일 / 90일 / 커스텀)
    - 링크 복사 버튼
    - 링크 비활성화 버튼 (확인 다이얼로그)
    - 상태 표시: 활성 / 만료됨
  - 링크 생성 시 즉시 클립보드 복사
- **Acceptance Criteria**:
  - 링크 생성/복사/비활성화 동작
  - 만료된 링크 시각적 구분
  - 빈 상태 (공유 링크 없음) 처리
- **Rollback**: 섹션 + 컴포넌트 제거

---

### Wave 3: QA + Deploy (Week 3)

#### W3-1: 백엔드 테스트
- **Agent**: Gatekeeper
- **Risk**: MEDIUM
- **Files**:
  - `services/gateway/src/share/__tests__/share-link.service.spec.ts`
  - `services/gateway/src/share/__tests__/share-link.controller.spec.ts`
  - `services/gateway/src/share/__tests__/public-share.controller.spec.ts`
  - `services/gateway/src/share/__tests__/public-profile.controller.spec.ts`
  - `services/gateway/src/share/__tests__/public-profile.service.spec.ts`
  - `services/gateway/src/common/guards/__tests__/share-link.guard.spec.ts`
  - `services/gateway/src/user/__tests__/settings.spec.ts`
- **Key Changes**:
  - ShareLink CRUD: 생성, 조회, 비활성화, 만료 처리
  - ShareLinkGuard: 유효/만료/비활성/미존재 토큰 분기
  - 공개 엔드포인트: 인증 없이 접근, 쓰기 차단
  - 퍼블릭 프로필: slug 조회, 비공개 404, 통계 집계
  - Settings: slug 유효성, 중복, 예약어, 토글 연동
  - **보안 테스트**:
    - 공개 엔드포인트에서 다른 스터디 데이터 접근 불가
    - 토큰 열거 공격(token enumeration) 방어: 일관된 404 응답
    - slug를 통한 유저 정보 열거 방어
- **Acceptance Criteria**:
  - 커버리지: lines ≥ 90%, branches ≥ 85%
  - 보안 시나리오 전수 테스트
- **Rollback**: 테스트 파일 제거

#### W3-2: 프론트엔드 테스트
- **Agent**: Gatekeeper
- **Risk**: MEDIUM
- **Files**:
  - `frontend/src/app/shared/__tests__/page.test.tsx`
  - `frontend/src/app/profile/__tests__/[slug].test.tsx`
  - `frontend/src/components/profile/__tests__/ShareLinkManager.test.tsx`
  - `frontend/src/components/settings/__tests__/ProfileVisibilitySettings.test.tsx`
  - `frontend/src/lib/__tests__/anonymize.test.ts`
- **Key Changes**:
  - 게스트 스터디룸: 렌더링, 읽기 전용 UI, 익명화 표시
  - 퍼블릭 프로필: 데이터 표시, 공유 링크 연결, 404 처리
  - 익명화: 해시 일관성, 닉네임 범위, 소유자 제외
  - Settings: slug 입력, 유효성 검증, 토글 연동
  - 공유 링크 관리: 생성, 복사, 비활성화
- **Acceptance Criteria**:
  - 모든 신규 컴포넌트 테스트 커버리지 ≥ 90%
  - 기존 테스트 깨지지 않음
- **Rollback**: 테스트 파일 제거

#### W3-3: 통합 QA + 보안 점검
- **Agent**: Gatekeeper + Scout
- **Risk**: MEDIUM
- **Key Changes**:
  - E2E 시나리오:
    1. 멤버가 공유 링크 생성 → 비로그인 유저가 링크로 접근 → 데이터 확인
    2. 만료 링크 접근 → 에러 페이지
    3. slug 설정 → 프로필 공개 → 외부 접근 → 스터디 카드 → 공유 링크 클릭
    4. 공유 링크에서 쓰기 시도 → 차단 확인
  - 보안 점검:
    - JWT 미들웨어 우회 경로 한정 확인
    - 공개 API에서 민감 정보 미노출
    - 토큰/slug brute force 방어 (rate limit 고려)
  - 반응형 UI 테스트 (모바일/데스크탑)
- **Acceptance Criteria**:
  - E2E 시나리오 전수 통과
  - 보안 체크리스트 전항 통과
  - 기존 기능 회귀 없음

#### W3-4: CI/CD 배포
- **Agent**: Conductor
- **Risk**: LOW
- **Key Changes**:
  - DB 마이그레이션 운영 적용
  - CI 전체 통과 확인
  - ghcr 이미지 빌드 → aether-gitops 태그 업데이트 → ArgoCD 자동 sync
  - 배포 후 스모크 테스트
- **Acceptance Criteria**:
  - CI 15 jobs 전체 통과
  - ArgoCD 정상 sync
  - 운영 환경에서 공유 링크 + 프로필 동작 확인
- **Rollback**: 마이그레이션 revert + 이전 이미지 태그 복원

---

## Agent 배정 매트릭스

| Agent | Tasks | Estimated Files | 예상 시간 |
|-------|-------|-----------------|-----------|
| Architect | W1-1 | ~3 | 2-3h |
| Postman | W1-2, W1-4, W1-5 | ~12 | 8-10h |
| Gatekeeper | W1-3, W3-1, W3-2, W3-3 | ~18 | 14-18h |
| Palette | W2-1, W2-2, W2-3, W2-4 | ~12 | 12-16h |
| Scout | W3-3 (보안 점검) | - | 2-3h |
| Conductor | W3-4 | - | 2-3h |

---

## 실행 일정

### Week 1: Backend Foundation
| Day | Tasks | 병렬 | Agent |
|-----|-------|------|-------|
| D1 | W1-1 DB 마이그레이션 | - | Architect |
| D2 | W1-2 ShareLink CRUD | - | Postman |
| D2 | W1-5 Settings API | 병렬 | Postman |
| D3 | W1-3 게스트 Guard + 공개 엔드포인트 | - | Gatekeeper |
| D3 | W1-4 퍼블릭 프로필 API | 병렬 | Postman |

### Week 2: Frontend
| Day | Tasks | 병렬 | Agent |
|-----|-------|------|-------|
| D1 | W2-1 게스트 스터디룸 뷰 | - | Palette |
| D2 | W2-2 퍼블릭 프로필 페이지 | - | Palette |
| D3 | W2-3 Settings 페이지 | - | Palette |
| D3 | W2-4 공유 링크 관리 UI | 병렬 | Palette |

### Week 3: QA + Deploy
| Day | Tasks | 병렬 | Agent |
|-----|-------|------|-------|
| D1-2 | W3-1 백엔드 테스트 | - | Gatekeeper |
| D1-2 | W3-2 프론트엔드 테스트 | 병렬 | Gatekeeper |
| D3 | W3-3 통합 QA + 보안 점검 | - | Gatekeeper + Scout |
| D4 | W3-4 CI/CD 배포 | - | Conductor |

---

## 위험 관리

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| R1 | JWT 미들웨어 우회로 기존 인증 경로 노출 | HIGH | ignoreTokenUrl 화이트리스트 방식, 패턴 최소화, 테스트 전수 커버 |
| R2 | 익명화 해시 충돌 (두 유저가 같은 닉네임) | LOW | 형용사 10 × 명사 10 = 100가지 조합, 스터디 규모 대비 충분. 충돌 시에도 기능 문제 없음 |
| R3 | 공개 API rate limit 미적용 시 brute force | MEDIUM | 토큰 64자 hex (256bit) → 열거 불가. 추후 rate limit 도입 가능 |
| R4 | 기존 스터디룸 컴포넌트 재사용 시 읽기 전용 분기 누락 | HIGH | GuestContext.isGuest 플래그 기반, Gatekeeper 전수 점검 |
| R5 | slug 예약어 누락으로 라우팅 충돌 | MEDIUM | Next.js 라우트 구조 기반 예약어 목록 사전 정의, 테스트 커버 |

---

## Go/No-Go 기준

### Go (다음 Wave 진행):
- `next build` 성공
- TypeScript strict: 0 errors
- 테스트: ≥ 95% 통과율
- 기존 기능 회귀 없음
- 보안 체크리스트 전항 통과

### No-Go (롤백):
- 빌드 실패 2시간 내 해결 불가
- 기존 인증 경로 보안 이슈 발견
- > 10% 테스트 실패율
- PM이 UX 거부

---

## 기술 결정 사항

### TD-1: 공개 API 구조
- **결정**: 별도 `/api/public/` 프리픽스로 분리 (기존 API와 혼재 방지)
- **근거**: JWT 미들웨어 우회 범위 최소화, 보안 경계 명확화

### TD-2: 익명화 방식
- **결정**: 클라이언트 사이드 익명화 (서버는 실제 데이터 반환, 프론트에서 치환)
- **근거**: 서버 로직 단순화, 프로필 소유자 판별이 프론트에서 자연스러움
- **주의**: 공개 API 응답에서 타 멤버의 email 등 민감 정보는 서버에서 제거 필수

### TD-3: 토큰 저장 위치
- **결정**: Gateway DB (share_links 테이블)
- **근거**: Identity 서비스와 분리, Gateway가 인증/인가 SSoT

### TD-4: Settings 페이지 위치
- **결정**: `/settings` 신규 라우트 (기존 `/profile`은 프로필 관리 유지)
- **근거**: 프로필 관리(아바타, GitHub)와 시스템 설정(공개 여부, slug)의 관심사 분리

---

## 파일 영향도 요약

- **신규 파일** (~25개): 엔티티, 서비스, 컨트롤러, Guard, DTO, 페이지, 컴포넌트, 유틸
- **수정 파일** (~15개): jwt.middleware.ts, api.ts, user.entity.ts, profile/page.tsx, AppModule 등
- **테스트 파일** (~15개): 백엔드 7, 프론트엔드 5, 통합 3
- **전체 영향도**: ~55 파일

---

## Sprint 49 백로그 (감사 이월)

Sprint 48 W3-3 보안 점검(Scout + Gatekeeper) 결과, 아래 미해결 항목을 Sprint 49로 이월합니다.

### Critical (1건)

| ID | 항목 | 설명 | 작업량 |
|----|------|------|--------|
| C-3 | Gateway → Identity DB 직접 접근 분리 | Gateway가 identity_db에 직접 연결하여 User/Study/StudyMember/Notification/ShareLink 5개 엔티티를 직접 관리 중. DB per Service 원칙 위반(ADR-001). Identity API를 확장하고 Gateway의 TypeORM 직접 접근을 제거해야 함. ADR-002 작성 필요. | **L** |

### High (1건)

| ID | 항목 | 설명 | 작업량 |
|----|------|------|--------|
| H-8 | GitHub App Private Key 정기 로테이션 프로세스 수립 | Base64 인코딩은 암호화가 아님. 분기별 로테이션 계획 수립 필요. 노출 시 즉시 재발급 + 전 서비스 재배포 절차를 문서화해야 함. | **M** |

### Medium (9건)

| ID | 항목 | 설명 | 작업량 |
|----|------|------|--------|
| M-1 | JWT 쿠키 maxAge와 토큰 expiresIn 하드코딩 동기화 | 쿠키 maxAge와 JWT expiresIn이 별도 하드코딩되어 불일치 위험. 상수 SSoT로 통합. | **S** |
| M-2 | CORS origin 프로덕션 설정 | kustomize overlay별(dev/staging/prod) CORS origin을 분리 설정. 현재 와일드카드 또는 단일 값. | **S** |
| M-3 | Redis/RabbitMQ 사용자별 권한 분리 (ACL) | 현재 단일 계정으로 전 서비스 접근. 서비스별 ACL 분리로 최소 권한 원칙 적용. | **M** |
| M-4 | PostgreSQL statement_timeout 마이그레이션 시 비활성화 고려 | 장시간 마이그레이션 실행 시 statement_timeout에 의해 중단될 수 있음. 마이그레이션 전용 설정 필요. | **S** |
| M-7 | PublicShareController 프록시 에러 상세 로깅 | 프록시 에러 발생 시 URL, duration, response body 등 디버깅 정보가 부족. StructuredLogger 활용. | **S** |
| M-8 | StudyMemberGuard Redis 실패 Prometheus 메트릭 추가 | Redis 장애 시 Guard fallback 동작을 모니터링할 수 있도록 Prometheus counter/histogram 추가. | **S** |
| M-9 | Identity 서비스 .env.example 작성 | Identity 서비스에 .env.example이 없어 신규 개발자 온보딩 시 환경 변수 파악이 어려움. | **S** |
| M-10 | Jest/TypeScript 테스트 의존성 버전 통일 | 서비스별 Jest, ts-jest, @types/jest 버전이 상이. 모노레포 전체 버전 통일. | **S** |
| M-11 | API 라우팅 테이블 ↔ 실제 엔드포인트 정합성 자동 검증 | 라우팅 테이블 문서와 실제 등록된 엔드포인트 간 불일치를 CI에서 자동 감지하는 스크립트 필요. | **M** |
| M-12 | any 타입 153개 제거 (Gateway) | Gateway 서비스에 any 타입이 153개 존재. TypeScript strict 강화를 위해 순차 제거. | **L** |

### Low / Info (15건)

| ID | 항목 | 작업량 |
|----|------|--------|
| L-1 | DB 연결 풀 기본값 확인 (TypeORM pool size) | **S** |
| L-2 | 마이그레이션 파일명에 이슈번호 포함 규칙 수립 | **S** |
| L-3 | djb2 해시 충돌율 모니터링 (익명화 닉네임) | **S** |
| L-4 | OAuth scope 문서화 (Google/Naver/Kakao별 요청 범위) | **S** |
| L-5 | 미들웨어 실행 순서 문서화 (Gateway 파이프라인) | **S** |
| L-6 | Frontend 환경변수 정리 (.env.local 템플릿) | **S** |
| L-7 | DataSource 기본값 확인 (synchronize, logging 등) | **S** |
| L-8 | StructuredLoggerService DI 전환 (submission 외 나머지 서비스) | **M** |
| L-9 | 프론트엔드 컴포넌트 분리 (PublicProfileCard, StudyStatsCard, ProfileVisibilitySettings) | **M** |
| L-10 | Gateway branches 커버리지 96% 복원 | **S** |
| L-11 | Ingress /internal 외부 접근 실 테스트 | **S** |
| L-12 | Share 공개 API 응답 포맷 표준화 (envelope 통일) | **S** |
| L-13 | 토큰 만료 정책 정의 (share link 기본 만료 기간 등) | **S** |
| L-14 | 보안 헤더 Traefik middleware 이전 검토 (CSP, HSTS 등) | **M** |
| L-15 | Rate limit 임계값 프로덕션 모니터링 (공개 API 대상) | **S** |
