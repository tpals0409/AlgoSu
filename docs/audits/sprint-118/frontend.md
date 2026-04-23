---
sprint: 118
service: frontend
audited_at: 2026-04-22
loc_audited: 32320
files_audited: 248
codex_sessions: [019db3db-7e0c-75c2-b4bf-8e3a618f8009, 019db3dd-2608-74b3-9a90-f76e12a73046, 019db3de-e133-7831-b02c-58bb14577e17, 019db3e1-29a4-78b1-82b5-e337cc57723e, 019db3e3-18fb-76a2-901a-0eabe2e2cbbd, 019db3e4-7c39-76b1-9c03-02eff2b1c1f6, 019db3e6-2edc-7741-a6d0-991c8c20303b, 019db3e7-7071-75e0-bac5-fbd172e2ea64, 019db3e8-4246-7771-8e1c-8cfe07a9ed1d, 019db3ea-3349-77e2-9460-2a463d65db2e, 019db3ec-5201-7e40-9ca7-3012690a2e52, 019db3ed-fa40-7581-b661-570167b7d0f0, 019db3ef-4de4-75c2-bef0-c3adb3d13617, 019db3f0-f439-7cb0-8ec8-f0f3cdbe47f6, 019db3f1-e9a3-76a1-ad98-144c8f00a994, 019db3f3-3572-7760-8bcf-3d6b0e848400, 019db3f4-d4da-79c0-b430-a14cb4b6b06c, 019db3f6-6b51-76e1-b8b2-b2b7f7714f48, 019db3f7-b2bd-7693-8040-7bc1ca7808d4, 019db3f8-cf7d-7dd0-beb7-c33554967ff4, 019db3f9-a754-7ea2-8d61-732918aed699, 019db3fa-99aa-70e3-81ea-5a5a9d2edae5, 019db3fc-61c9-7621-9a2e-52fc89419341, 019db3fe-2ad7-7922-b6bf-501176b406ca, 019db3fe-fdbe-7bc0-aebd-412b09154187, 019db3ff-bcb3-7452-bd09-d1fb8a237e8d, 019db401-5616-7c81-8a04-c182fbacfc55, 019db402-0f39-7d43-b323-9da18d824153, 019db403-1664-7333-a069-bd1f2656a005]
severity_counts: { P0: 3, P1: 81, P2: 163, Low: 5 }
---

# Audit — frontend

> 감사 일자: 2026-04-22 | LOC: 32320 | 파일: 248개
> P0: 3 | P1: 81 | P2: 163 | Low: 5

## P0 (머지 차단)

### P0-01 — frontend/src/app/shared/[token]/page.tsx:42
- **category**: correctness
- **message**: 동일 파일에서 `AnalysisView`를 import한 뒤 470행에서 같은 이름의 함수를 다시 선언해 모듈 파싱/타입체크가 실패합니다.
- **suggestion**: 사용하지 않는 `AnalysisView` import를 제거하거나 로컬 컴포넌트 이름을 변경해 중복 바인딩을 없애세요.

### P0-02 — frontend/src/app/studies/[id]/room/SubmissionView.tsx:107
- **category**: security
- **message**: 검증되지 않은 problem.sourceUrl을 href에 그대로 사용해 javascript: 같은 위험한 URL이 저장형 XSS로 이어질 수 있습니다.
- **suggestion**: URL 생성 시 http/https 프로토콜만 허용하고, 유효하지 않은 값은 링크를 렌더링하지 않도록 정규화 함수를 추가하세요.

### P0-03 — frontend/src/components/ui/NotificationToast.tsx:104
- **category**: security
- **message**: 알림 API의 link 값을 검증 없이 router.push에 전달해 javascript: URL 또는 외부 URL 주입 시 클라이언트 XSS/피싱 이동이 발생할 수 있습니다.
- **suggestion**: router.push 전에 link가 허용된 내부 상대 경로인지 검증하고, 프로토콜 포함 URL이나 javascript: 스킴은 거부하세요.

## P1 (재검증 필수)

### P1-01 — frontend/src/app/(auth)/callback/page.tsx:52
- **category**: correctness
- **message**: URLSearchParams가 이미 디코딩한 error 값을 다시 decodeURIComponent로 디코딩해, 조작된 값에 포함된 잘못된 퍼센트 인코딩이 페이지 런타임 예외를 유발할 수 있습니다.
- **suggestion**: 추가 decodeURIComponent 호출을 제거하거나 try/catch로 감싸고 안전한 기본 오류 메시지로 대체하세요.

### P1-02 — frontend/src/app/(auth)/callback/page.tsx:66
- **category**: data-integrity
- **message**: GitHub 연동 상태를 URL fragment 값만 신뢰해 AuthContext에 반영하므로 사용자가 fragment를 조작하면 클라이언트 상태가 서버 실제 상태와 달라질 수 있습니다.
- **suggestion**: 콜백 후 /auth/profile 같은 서버 조회 결과로 GitHub 연동 상태를 확정하고, fragment 값은 화면 분기 힌트로만 사용하세요.

### P1-03 — frontend/src/app/(auth)/callback/page.tsx:82
- **category**: security
- **message**: API가 반환한 url을 검증 없이 window.location.href에 대입해 악성 또는 오염된 응답이 javascript: URL이나 허용되지 않은 외부 URL 리다이렉트로 이어질 수 있습니다.
- **suggestion**: URL 객체로 파싱한 뒤 허용된 GitHub/OAuth 도메인과 https 프로토콜만 통과시키고, 실패 시 오류를 표시하세요.

### P1-04 — frontend/src/app/(auth)/github-link/complete/page.tsx:20
- **category**: data-integrity
- **message**: github_connected와 github_username fragment 값을 검증 없이 클라이언트 GitHub 상태로 저장해 서버 상태와 불일치한 사용자 상태가 만들어질 수 있습니다.
- **suggestion**: 완료 페이지 진입 시 서버 프로필을 다시 조회하거나 전용 완료 API로 연동 결과를 확인한 뒤 updateGitHubStatus를 호출하세요.

### P1-05 — frontend/src/app/(auth)/github-link/page.tsx:27
- **category**: correctness
- **message**: 검색 파라미터 값은 이미 디코딩되어 있는데 decodeURIComponent를 다시 호출해, 조작된 error 값이 URIError를 발생시켜 페이지를 깨뜨릴 수 있습니다.
- **suggestion**: decodeURIComponent를 제거하고 searchParams.get 결과를 그대로 매핑하거나 안전 디코더를 사용하세요.

### P1-06 — frontend/src/app/(auth)/github-link/page.tsx:41
- **category**: security
- **message**: GitHub 연동 URL을 검증 없이 location.href에 대입해 악성 응답에 의한 오픈 리다이렉트 또는 javascript: URL 실행 위험이 있습니다.
- **suggestion**: 리다이렉트 전 URL의 protocol과 hostname을 allowlist로 검증하세요.

### P1-07 — frontend/src/app/(auth)/login/page.tsx:125
- **category**: security
- **message**: demoLogin 응답의 redirect 값을 검증 없이 router.push에 전달해 오염된 응답이 임의 경로 이동 또는 javascript: URL 처리 위험으로 이어질 수 있습니다.
- **suggestion**: redirect가 내부 경로인지 확인하고 허용된 경로만 router.push에 전달하세요.

### P1-08 — frontend/src/app/(auth)/login/page.tsx:138
- **category**: security
- **message**: OAuth URL을 검증 없이 window.location.href에 대입해 API 응답이 오염될 경우 허용되지 않은 외부 리다이렉트나 스크립트 URL 실행 위험이 있습니다.
- **suggestion**: OAuth 제공자별 허용 도메인과 https 프로토콜을 검증한 뒤 이동하세요.

### P1-09 — frontend/src/app/(auth)/register/github/page.tsx:93
- **category**: security
- **message**: GitHub 연동 URL을 검증 없이 window.location.href에 대입해 악성 응답에 의한 오픈 리다이렉트 또는 javascript: URL 실행 위험이 있습니다.
- **suggestion**: GitHub OAuth 허용 도메인과 https 프로토콜을 검증한 뒤 리다이렉트하세요.

### P1-10 — frontend/src/app/(auth)/register/page.tsx:133
- **category**: security
- **message**: OAuth URL을 검증 없이 window.location.href에 대입해 API 응답이 오염될 경우 허용되지 않은 외부 리다이렉트나 스크립트 URL 실행 위험이 있습니다.
- **suggestion**: URL을 파싱해 https 및 허용된 OAuth 제공자 도메인만 허용하세요.

### P1-11 — frontend/src/app/(auth)/register/page.tsx:147
- **category**: security
- **message**: demoLogin 응답의 redirect 값을 검증 없이 router.push에 전달해 오염된 응답이 임의 경로 이동 또는 javascript: URL 처리 위험으로 이어질 수 있습니다.
- **suggestion**: redirect가 /로 시작하는 내부 경로인지 검증하고, 허용되지 않으면 기본 안전 경로로 이동하세요.

### P1-12 — frontend/src/app/admin/layout.tsx:15
- **category**: security
- **message**: 관리자 라우트 접근 제어가 클라이언트 훅에만 의존하며, 이미 authorized=true가 된 뒤 권한이 사라져도 자식 화면이 잠시 계속 렌더링될 수 있습니다.
- **suggestion**: 서버 미들웨어나 서버 컴포넌트에서 관리자 권한을 검증하고, 미인증/비관리자 분기에서 setAuthorized(false)를 먼저 호출하세요.

### P1-13 — frontend/src/app/admin/feedbacks/page.tsx:101
- **category**: correctness
- **message**: 필터 변경 시 이전 page 값으로 먼저 요청한 뒤 page=1 요청을 다시 보내므로, 느린 이전 요청이 나중에 도착하면 다른 페이지의 결과가 화면을 덮어쓸 수 있습니다.
- **suggestion**: 필터 변경 핸들러에서 page를 함께 1로 맞춘 단일 상태로 관리하거나, 요청 ID/AbortController로 오래된 응답을 무시하세요.

### P1-14 — frontend/src/app/admin/feedbacks/page.tsx:518
- **category**: security
- **message**: 사용자가 제공한 screenshot URL을 관리자 브라우저에서 그대로 로드해 외부 추적 URL 또는 내부망 GET 요청을 유발할 수 있습니다.
- **suggestion**: 스크린샷은 업로드 시 서버에서 검증한 저장소/CDN URL만 허용하고, 프론트에서는 허용된 origin 또는 data:image 형식만 렌더링하세요.

### P1-15 — frontend/src/app/analytics/page.tsx:104
- **category**: correctness
- **message**: 스터디 변경 중 이전 loadData 응답이 늦게 도착하면 현재 스터디 화면에 이전 스터디의 통계가 설정될 수 있는 레이스 컨디션이 있습니다.
- **suggestion**: AbortController나 요청 시퀀스 ID를 사용해 최신 currentStudyId에 대한 응답만 setState하도록 보호하세요.

### P1-16 — frontend/src/app/analytics/page.tsx:112
- **category**: data-integrity
- **message**: 통계 API 실패 시 기존 stats/allProblems를 초기화하지 않아 이전 스터디 또는 이전 요청의 통계가 오류 메시지와 함께 계속 표시될 수 있습니다.
- **suggestion**: loadData 시작 시 stats, allProblems, myNickname을 초기화하거나 실패한 응답에 대해 관련 상태를 null/빈 배열로 명시적으로 갱신하세요.

### P1-17 — frontend/src/app/dashboard/page.tsx:273
- **category**: correctness
- **message**: 현재 사용자 ID를 이메일로 멤버 목록에서 역추적해 통계가 0으로 표시될 수 있습니다. 이메일이 비공개/변경/미포함이면 byMember 매칭이 실패합니다.
- **suggestion**: AuthContext의 user.id를 우선 사용하고, 멤버 정보는 표시명 보강 용도로만 사용하세요.

### P1-18 — frontend/src/app/dashboard/page.tsx:285
- **category**: correctness
- **message**: 제출 완료 여부를 최근 제출 5건에서만 계산해 오래된 제출 문제는 미제출로 표시됩니다.
- **suggestion**: stats.solvedProblemIds 같은 전체 완료 문제 집계나 전용 제출 상태 API를 사용해 submittedProblemIds를 구성하세요.

### P1-19 — frontend/src/app/dashboard/page.tsx:200
- **category**: correctness
- **message**: 대시보드 데이터 로딩에 취소/요청 순서 보호가 없어 스터디 전환 중 이전 요청이 늦게 완료되면 다른 스터디 데이터로 화면을 덮어쓸 수 있습니다.
- **suggestion**: AbortController나 requestId 가드를 추가해 최신 currentStudyId에 해당하는 응답만 상태에 반영하세요.

### P1-20 — frontend/src/app/problems/[id]/edit/page.tsx:266
- **category**: correctness
- **message**: 인증/스터디 로딩 상태를 기다리지 않고 currentStudyRole이 null일 때 즉시 관리자 아님 화면을 렌더링하여 정상 관리자도 일시적으로 차단될 수 있습니다.
- **suggestion**: useRequireAuth의 isReady와 useRequireStudy의 isStudyReady를 사용하고, currentStudyRole이 null인 동안은 로딩 상태를 렌더링한 뒤 역할 판정을 수행하세요.

### P1-21 — frontend/src/app/problems/[id]/edit/page.tsx:136
- **category**: security
- **message**: 관리자 전용 수정 페이지가 currentStudyRole 확인 전에 문제 상세 API를 호출하므로 멤버나 stale study 상태에서도 admin-only 화면의 데이터 요청이 발생합니다.
- **suggestion**: load effect 조건에 currentStudyRole === 'ADMIN' 및 스터디 준비 상태를 포함하고, 서버 API에서도 동일한 관리자 권한 검사를 보장하세요.

### P1-22 — frontend/src/app/problems/[id]/page.tsx:324
- **category**: security
- **message**: 서버에서 받은 sourceUrl을 검증 없이 href에 넣어 javascript: 또는 data: URL 클릭 시 XSS가 발생할 수 있습니다.
- **suggestion**: URL 생성/렌더링 전에 URL 객체로 파싱하고 https/http 및 허용 도메인만 통과시키거나, 유효하지 않으면 링크를 렌더링하지 마세요.

### P1-23 — frontend/src/app/problems/[id]/page.tsx:204
- **category**: correctness
- **message**: CLOSED 상태 문제도 제출 가능하도록 처리되어 종료된 문제에 새 제출이 생성될 수 있습니다.
- **suggestion**: 제출 가능 조건을 ACTIVE 및 정책상 허용된 지각 제출 상태로 제한하고, CLOSED는 제출 UI를 숨기며 API에서도 동일한 규칙을 검증하세요.

### P1-24 — frontend/src/app/profile/[slug]/page.tsx:107
- **category**: security
- **message**: 공개 API가 내려준 shareLink를 검증 없이 Link href에 사용해 javascript: 또는 의도하지 않은 외부 URL이 렌더링될 수 있습니다.
- **suggestion**: shareLink를 상대 경로 또는 허용된 origin/프로토콜로 검증하고, 실패 시 링크를 렌더링하지 마세요.

### P1-25 — frontend/src/app/reviews/[submissionId]/page.tsx:258
- **category**: correctness
- **message**: 비인증 상태에서 loading이 true로 남아 로그인 리다이렉트 분기까지 도달하지 못하고 무한 로딩됩니다.
- **suggestion**: 인증 로딩이 끝났고 isAuthenticated가 false이면 loading 상태보다 먼저 /login으로 이동시키거나, 인증 실패 시 loading을 false로 전환하세요.

### P1-26 — frontend/src/app/reviews/[submissionId]/error.tsx:19
- **category**: security
- **message**: 에러 경계가 error.message를 그대로 사용자에게 노출해 내부 API 경로, 서버 메시지, 디버그 정보가 유출될 수 있습니다.
- **suggestion**: 사용자에게는 일반화된 오류 문구만 보여주고, 상세 오류는 서버/클라이언트 로깅 시스템에만 기록하세요.

### P1-27 — frontend/src/app/settings/page.tsx:27
- **category**: security
- **message**: useRequireAuth()의 isReady/isAuthenticated 반환값을 사용하지 않아 미인증 상태에서도 리다이렉트가 완료되기 전 설정 폼이 렌더링됩니다.
- **suggestion**: useRequireAuth() 반환값으로 인증 준비 상태를 게이트하고, isReady가 false이면 로딩/null을 반환해 폼과 저장 버튼을 렌더링하지 않도록 수정하세요.

### P1-28 — frontend/src/app/settings/page.tsx:32
- **category**: data-integrity
- **message**: 프로필 설정 조회 에러를 무시해 조회 실패 시 기본값('', false)으로 폼이 열리고 저장 시 기존 설정을 덮어쓸 수 있습니다.
- **suggestion**: useProfileSettings의 error를 처리해 에러 상태에서는 저장을 비활성화하고 재시도 UI를 표시하세요.

### P1-29 — frontend/src/app/settings/page.tsx:48
- **category**: data-integrity
- **message**: initialized 플래그가 최초 1회만 폼을 초기화해 계정 전환이나 SWR 데이터 변경 시 이전 사용자의 slug/isPublic 값이 남을 수 있습니다.
- **suggestion**: settings 식별값이 바뀌면 폼을 다시 동기화하거나 dirty 상태를 따로 추적해 사용자가 수정 중이 아닐 때 최신 settings로 갱신하세요.

### P1-30 — frontend/src/app/studies/[id]/page.tsx:122
- **category**: data-integrity
- **message**: 라우트의 `studyId`와 API 클라이언트의 현재 스터디 컨텍스트를 동기화하지 않고 `problemApi.findAll()`을 호출해 다른 스터디의 문제 목록이 표시될 수 있습니다.
- **suggestion**: `useStudy()`의 `setCurrentStudy(studyId)`로 먼저 컨텍스트를 동기화하거나, 문제 조회 API가 명시적으로 `studyId`를 받도록 변경하세요.

### P1-31 — frontend/src/app/studies/[id]/page.tsx:102
- **category**: correctness
- **message**: 현재 사용자를 이메일로 멤버 목록과 매칭해 `myUserId`를 계산하므로 이메일이 비공개/변경/누락되면 본인 및 관리자 권한 판정이 깨집니다.
- **suggestion**: 인증 컨텍스트의 `user.id`를 기준으로 `members.user_id`와 비교하고, 이메일은 표시 용도로만 사용하세요.

### P1-32 — frontend/src/app/shared/[token]/page.tsx:161
- **category**: correctness
- **message**: 제출 분석 요청에 취소나 최신 요청 검증이 없어 사용자가 빠르게 다른 제출을 선택하면 이전 응답이 현재 선택된 제출의 분석 결과를 덮어쓸 수 있습니다.
- **suggestion**: 요청별 id 또는 `AbortController`를 두고 응답 시점에 현재 선택된 `submission.id`와 일치할 때만 `setAnalysis`와 `setSubLoading(false)`를 실행하세요.

### P1-33 — frontend/src/app/studies/[id]/room/page.tsx:181
- **category**: correctness
- **message**: 사용자별 최신 제출을 고를 때 createdAt 정렬 없이 배열의 첫 항목만 남겨 API 정렬이 바뀌면 오래된 제출이 표시될 수 있습니다.
- **suggestion**: userId별로 createdAt이 가장 큰 제출을 명시적으로 선택하거나 API가 최신순을 보장하도록 계약을 고정하세요.

### P1-34 — frontend/src/app/studies/[id]/room/page.tsx:205
- **category**: correctness
- **message**: 분석 요청에 취소/요청 식별자가 없어 제출을 빠르게 바꾸면 이전 요청 결과가 현재 선택된 제출의 분석으로 덮어써질 수 있습니다.
- **suggestion**: 요청 id 또는 AbortController를 사용해 마지막으로 선택된 submission.id와 일치하는 응답만 setAnalysis 하세요.

### P1-35 — frontend/src/app/studies/[id]/room/page.tsx:287
- **category**: correctness
- **message**: authLoading이 끝난 뒤 미인증 상태를 처리하지 않아 로딩 스켈레톤이 계속 표시되고 사용자가 복구할 수 없습니다.
- **suggestion**: !isAuthenticated 분기에서 로그인 리다이렉트나 접근 안내 UI를 렌더링하세요.

### P1-36 — frontend/src/app/studies/[id]/room/page.tsx:151
- **category**: data-integrity
- **message**: 멤버 조회 실패를 무시해 이전 스터디의 members/nicknameMap/avatarMap이 남을 수 있고 제출률과 이름이 잘못 표시됩니다.
- **suggestion**: 스터디 변경 시 관련 상태를 먼저 초기화하고, 실패 시 빈 상태로 리셋하거나 사용자에게 오류를 표시하세요.

### P1-37 — frontend/src/app/studies/[id]/room/page.tsx:165
- **category**: data-integrity
- **message**: 통계 조회 실패를 무시해 이전 studyStats가 유지될 수 있어 제출 수와 분석 완료 수가 다른 스터디 데이터로 표시됩니다.
- **suggestion**: currentStudyId 변경 시 studyStats를 null로 초기화하고 실패 시 명시적으로 null 또는 오류 상태를 설정하세요.

### P1-38 — frontend/src/app/studies/[id]/room/page.tsx:264
- **category**: correctness
- **message**: 쿼리 파라미터로 바로 제출 현황에 진입한 경우 pushState가 없는데도 뒤로가기를 호출해 앱 밖이나 이전 페이지로 이탈할 수 있습니다.
- **suggestion**: 직접 진입 여부를 추적해 내부 상태만 되돌리거나, 상태 전환 시 항상 대응되는 history state를 먼저 추가하세요.

### P1-39 — frontend/src/app/studies/page.tsx:195
- **category**: correctness
- **message**: handleCreate의 useCallback 의존성에 selectedAvatarKey가 없어 사용자가 선택한 스터디 아바타가 생성 요청에 반영되지 않을 수 있습니다.
- **suggestion**: useCallback 의존성 배열에 selectedAvatarKey를 추가하거나 콜백을 일반 함수로 분리하세요.

### P1-40 — frontend/src/app/submissions/[id]/status/page.tsx:313
- **category**: security
- **message**: API가 반환한 URL을 검증 없이 window.location.href에 대입해 악성 URL 응답 시 오픈 리다이렉트로 이어질 수 있습니다.
- **suggestion**: GitHub OAuth 허용 도메인 또는 동일 출처인지 URL 객체로 검증한 뒤 이동하고, 실패 시 사용자에게 오류를 표시하세요.

### P1-41 — frontend/src/app/submissions/[id]/status/page.tsx:211
- **category**: correctness
- **message**: 제출 정보 로드가 실패해도 initialLoaded가 true가 되어 존재하지 않거나 접근 불가한 submissionId로 SSE 연결을 시작합니다.
- **suggestion**: 로드 성공 시에만 SSE를 활성화하거나, loadError가 있으면 sseSubmissionId를 null로 유지하도록 조건을 추가하세요.

### P1-42 — frontend/src/app/submissions/[id]/analysis/page.tsx:101
- **category**: correctness
- **message**: 폴링 중에도 setIsLoading(true)를 호출해 pending/delayed 화면이 10초마다 스켈레톤으로 깜빡일 수 있습니다.
- **suggestion**: 초기 로딩과 백그라운드 갱신 상태를 분리하고, 폴링 갱신에서는 기존 화면을 유지하세요.

### P1-43 — frontend/src/app/submissions/page.tsx:91
- **category**: correctness
- **message**: 제출 목록을 첫 페이지 100건으로 고정 조회해 100건을 초과한 제출 이력이 화면에서 영구히 누락됩니다.
- **suggestion**: API meta.totalPages를 사용해 페이지네이션 또는 무한 스크롤을 구현하고, 현재 페이지/limit 상태를 UI와 연동하세요.

### P1-44 — frontend/src/app/submissions/page.tsx:132
- **category**: correctness
- **message**: 문제 목록 로딩 또는 실패 시 problemMap이 비어 있어 제출 내역 전체가 필터링되어 사라질 수 있습니다.
- **suggestion**: useProblems의 isLoading/error를 함께 처리하고, 문제 정보가 없더라도 submission.problemTitle이 있으면 제출을 표시하거나 별도 오류 상태를 노출하세요.

### P1-45 — frontend/src/components/dashboard/DashboardWeeklyChart.tsx:88
- **category**: correctness
- **message**: 카드 전체에 Enter/Space 키 핸들러가 있어 내부의 /analytics 링크에서 Enter를 눌러도 이벤트가 버블링되어 이동 대신 뷰 전환이 실행될 수 있습니다.
- **suggestion**: onKeyDown에서 이벤트 대상이 a/button 등 인터랙티브 요소인지 검사해 무시하거나, 카드 전체 클릭 대신 별도 전환 버튼으로 분리하세요.

### P1-46 — frontend/src/components/feedback/BugReportForm.tsx:76
- **category**: performance
- **message**: 이미지 파일의 용량이나 픽셀 크기를 디코딩 전에 제한하지 않아 초대형 이미지 첨부 시 브라우저 메모리/CPU가 급증할 수 있습니다.
- **suggestion**: handleImageFile 초기에 file.size 제한을 두고, createImageBitmap 또는 이미지 메타데이터로 최대 해상도를 검증한 뒤 리사이즈를 수행하세요.

### P1-47 — frontend/src/components/feedback/BugReportForm.tsx:128
- **category**: security
- **message**: window.location.href 전체를 피드백 API로 전송해 쿼리스트링이나 해시의 토큰/개인정보가 유출될 수 있습니다.
- **suggestion**: pageUrl은 origin과 pathname만 보내거나, 허용된 쿼리 파라미터만 선별하고 hash는 제거하세요.

### P1-48 — frontend/src/components/feedback/FeedbackForm.tsx:57
- **category**: security
- **message**: window.location.href 전체를 피드백 API로 전송해 쿼리스트링이나 해시의 토큰/개인정보가 유출될 수 있습니다.
- **suggestion**: pageUrl은 origin과 pathname만 보내거나, 허용된 쿼리 파라미터만 선별하고 hash는 제거하세요.

### P1-49 — frontend/src/components/layout/NotificationBell.tsx:369
- **category**: security
- **message**: 서버에서 받은 notification.link를 검증 없이 router.push에 전달해 javascript: URL 등 비정상 스킴이 실행될 수 있습니다.
- **suggestion**: notification.link는 '/'로 시작하는 내부 경로만 허용하고, URL 파싱으로 origin과 protocol을 검증한 뒤 안전하지 않으면 TYPE_ROUTE fallback을 사용하세요.

### P1-50 — frontend/src/components/review/CommentForm.tsx:39
- **category**: correctness
- **message**: disabled 상태에서도 기존 content가 있으면 제출 가드가 막지 않아 onSubmit이 호출될 수 있습니다.
- **suggestion**: handleSubmit 초기에 disabled 조건을 함께 검사하고, 제출 버튼의 disabled에도 disabled를 포함하세요.

### P1-51 — frontend/src/components/review/CommentForm.tsx:43
- **category**: correctness
- **message**: onSubmit 실패를 catch하지 않아 이벤트 핸들러에서 거부된 Promise가 미처리되고 사용자에게 실패 상태가 표시되지 않습니다.
- **suggestion**: catch 블록에서 오류 상태를 설정하거나 부모에 실패를 전파하는 명확한 오류 처리 경로를 추가하세요.

### P1-52 — frontend/src/components/review/CodePanel.tsx:70
- **category**: performance
- **message**: highlight 범위를 검증하지 않고 startLine부터 endLine까지 순회해 비정상적으로 큰 범위가 들어오면 렌더링이 멈출 수 있습니다.
- **suggestion**: startLine/endLine을 1..lines.length로 클램프하고 startLine > endLine인 항목은 무시하세요.

### P1-53 — frontend/src/components/review/CommentThread.tsx:91
- **category**: correctness
- **message**: 삭제된 댓글이면 즉시 반환해 해당 댓글에 달린 대댓글까지 모두 화면에서 사라집니다.
- **suggestion**: 삭제 표시를 본문만 대체하고 replies 렌더링과 답글 토글은 유지하세요.

### P1-54 — frontend/src/components/review/CommentThread.tsx:199
- **category**: correctness
- **message**: 답글 토글 버튼이 replies.length > 0일 때만 표시되어 답글이 없는 댓글에는 첫 답글을 작성할 방법이 없습니다.
- **suggestion**: 답글 수와 무관하게 답글 작성/토글 버튼을 제공하거나 별도의 답글 버튼으로 showReplies를 열 수 있게 하세요.

### P1-55 — frontend/src/components/review/StudyNoteEditor.tsx:47
- **category**: correctness
- **message**: 노트 로드 실패 시 content만 비우고 note를 초기화하지 않아 이전 problemId의 노트가 새 문제 화면에 남을 수 있습니다.
- **suggestion**: catch 경로와 problemId 변경 시작 시 setNote(null)을 호출하고 오류 상태를 별도로 표시하세요.

### P1-56 — frontend/src/components/ui/AddProblemModal.tsx:576
- **category**: security
- **message**: 외부 API가 제공한 sourceUrl을 검증 없이 href에 사용해 javascript: 또는 비허용 도메인 URL이 링크로 렌더링될 수 있습니다.
- **suggestion**: sourceUrl을 URL로 파싱해 https/http 및 허용 도메인만 통과시키고, 실패 시 플랫폼별 공식 URL로 대체하세요.

### P1-57 — frontend/src/components/ui/AddProblemModal.tsx:738
- **category**: data-integrity
- **message**: 검증되지 않은 외부 sourceUrl을 그대로 문제 생성 payload에 저장해 오염된 링크가 DB와 다른 화면으로 전파될 수 있습니다.
- **suggestion**: 저장 전 sourceUrl 스킴과 호스트를 검증하고, 서버에서도 동일한 allowlist 검증을 강제하세요.

### P1-58 — frontend/src/components/submission/CodeEditor.tsx:213
- **category**: data-integrity
- **message**: handleSubmit이 isSubmitting 상태를 확인하지 않아 Ctrl+Enter 또는 빠른 조작으로 중복 제출 확인 흐름이 열릴 수 있습니다.
- **suggestion**: handleSubmit 시작 시 isSubmitting이면 즉시 return하고, confirmSubmit에도 로컬 submitting 가드를 추가하세요.

### P1-59 — frontend/src/components/submission/CodeEditor.tsx:292
- **category**: data-integrity
- **message**: 제출 확인 버튼이 비활성화되지 않아 더블클릭 시 onSubmit이 중복 호출될 수 있습니다.
- **suggestion**: confirmSubmit 실행 중 로컬 상태를 두고 확인 버튼을 disabled 처리하며 중복 호출을 차단하세요.

### P1-60 — frontend/src/components/submission/CodeEditor.tsx:231
- **category**: correctness
- **message**: catch 블록에서 err를 Error로 단언한 뒤 message에 접근해 null 또는 undefined가 throw되면 에러 처리 중 다시 런타임 오류가 발생합니다.
- **suggestion**: err instanceof Error ? err.message : '제출 중 오류가 발생했습니다.' 형태로 안전하게 분기하세요.

### P1-61 — frontend/src/components/ui/BackBtn.tsx:30
- **category**: security
- **message**: href 값을 검증하지 않고 router.push에 전달해 외부 입력이 연결될 경우 javascript: URL 실행 등 XSS 경로가 될 수 있습니다.
- **suggestion**: href를 내부 경로로 제한하거나 URL 파싱 후 origin/protocol allowlist를 통과한 값만 router.push에 전달하세요.

### P1-62 — frontend/src/components/ui/Button.tsx:90
- **category**: correctness
- **message**: button의 기본 type이 없어 form 내부에서 사용할 때 의도치 않게 submit이 발생할 수 있습니다.
- **suggestion**: asChild가 아닐 때 기본 type을 'button'으로 설정하고, 명시적으로 전달된 type만 덮어쓰도록 처리하세요.

### P1-63 — frontend/src/components/ui/calendar.tsx:43
- **category**: correctness
- **message**: buttonVariants를 day 셀에 적용하고 있어 실제 클릭 버튼(day_button)이 버튼 크기와 포커스 스타일을 받지 못할 수 있습니다.
- **suggestion**: day에는 셀 전용 스타일만 두고 buttonVariants와 size/padding 스타일은 day_button 키에 적용하세요.

### P1-64 — frontend/src/components/ui/chart.tsx:85
- **category**: security
- **message**: config의 key/color/id 값을 검증하지 않은 채 style 태그에 dangerouslySetInnerHTML로 삽입해 CSS 인젝션이 가능합니다.
- **suggestion**: CSS.escape로 selector와 custom property 이름을 이스케이프하고, color 값은 허용된 색상 형식만 통과시키거나 React style/CSS variables API로 주입하세요.

### P1-65 — frontend/src/components/ui/navigation-menu.tsx:1
- **category**: correctness
- **message**: Radix NavigationMenu는 클라이언트 상호작용 컴포넌트인데 파일 상단에 'use client'가 없어 Next App Router에서 서버 컴포넌트로 해석되어 빌드/런타임 오류가 날 수 있습니다.
- **suggestion**: 파일 최상단에 'use client'; 지시문을 추가해 클라이언트 컴포넌트 경계를 명시하세요.

### P1-66 — frontend/src/components/ui/progress.tsx:20
- **category**: correctness
- **message**: value를 구조분해한 뒤 Radix Progress Root에 전달하지 않아 progressbar의 aria-valuenow와 data-state가 실제 진행률과 동기화되지 않습니다.
- **suggestion**: ProgressPrimitive.Root에 value={value}를 전달하고 필요한 경우 max도 함께 전달하세요.

### P1-67 — frontend/src/components/ui/select.tsx:81
- **category**: correctness
- **message**: SelectContent의 Viewport 높이가 트리거 높이로 고정되어 옵션 목록이 한 줄 높이로 잘리거나 불필요하게 스크롤될 수 있습니다.
- **suggestion**: popper 위치에서는 h-[var(--radix-select-trigger-height)]를 제거하고 max-height는 Content의 available height 제약에 맡기세요.

### P1-68 — frontend/src/components/ui/sidebar.tsx:610
- **category**: correctness
- **message**: 렌더링 중 Math.random()으로 skeleton 너비를 만들면 SSR/하이드레이션 결과가 달라져 hydration mismatch가 발생할 수 있습니다.
- **suggestion**: 랜덤 값을 렌더링 경로에서 제거하고 CSS 클래스 목록, 고정 패턴, 또는 props로 받은 deterministic width를 사용하세요.

### P1-69 — frontend/src/contexts/AuthContext.tsx:152
- **category**: correctness
- **message**: OAuth 콜백 후 프로필 로드가 실패해도 빈 사용자 객체를 설정해 isAuthenticated가 true가 됩니다. 인증 실패 상태에서 인증 UI가 노출되고 후속 로직이 잘못 실행될 수 있습니다.
- **suggestion**: catch 블록에서 setUser(null)로 명확히 미인증 처리하고, 필요하면 로그인 페이지로 이동하거나 재시도 상태를 별도로 노출하세요.

### P1-70 — frontend/src/contexts/GuestContext.tsx:57
- **category**: data-integrity
- **message**: token이 변경될 때 기존 studyData를 지우거나 loading을 true로 되돌리지 않아 새 공유 링크 로딩 중 이전 공유 데이터가 계속 노출될 수 있습니다.
- **suggestion**: useEffect 시작 시 setLoading(true), setStudyData(null), setError(null)을 호출해 토큰별 상태를 초기화하세요.

### P1-71 — frontend/src/contexts/GuestContext.tsx:67
- **category**: data-integrity
- **message**: 공유 링크 조회 실패 시 기존 studyData를 유지하므로, 유효하지 않은 토큰으로 전환해도 이전 공유 데이터가 화면에 남을 수 있습니다.
- **suggestion**: catch 블록에서 setStudyData(null)을 함께 호출해 실패한 토큰의 데이터가 이전 성공 결과를 재사용하지 않게 하세요.

### P1-72 — frontend/src/contexts/StudyContext.tsx:66
- **category**: correctness
- **message**: localStorage의 currentStudyId를 멤버십 검증 전에 API 모듈에 즉시 반영합니다. 오래되었거나 조작된 스터디 ID로 자식 컴포넌트의 초기 API 요청이 먼저 나갈 수 있습니다.
- **suggestion**: 스터디 목록 로드 후 해당 ID가 studies에 존재할 때만 setCurrentStudyIdForApi를 호출하고, 검증 전에는 null 상태로 두세요.

### P1-73 — frontend/src/contexts/StudyContext.tsx:93
- **category**: correctness
- **message**: DEV_MOCK 분기가 NODE_ENV 검사를 하지 않아 production 빌드에서도 NEXT_PUBLIC_DEV_MOCK=true이면 가짜 스터디가 선택됩니다.
- **suggestion**: AuthContext와 동일하게 process.env.NODE_ENV !== 'production' 조건을 추가해 프로덕션에서 mock 분기가 절대 실행되지 않게 하세요.

### P1-74 — frontend/src/hooks/use-problems.ts:25
- **category**: correctness
- **message**: studyId를 SWR 키에만 넣고 실제 fetcher는 배열 키의 첫 번째 경로만 사용하므로, 전역 currentStudyId가 지연되거나 불일치하면 다른 스터디의 문제 목록을 조회할 수 있습니다.
- **suggestion**: 요청 경로 또는 fetcher 옵션에 studyId를 명시적으로 전달해 X-Study-ID 헤더가 훅 인자와 일치하도록 보장하세요.

### P1-75 — frontend/src/hooks/use-submissions.ts:34
- **category**: correctness
- **message**: studyId가 캐시 분리 용도로만 쓰이고 실제 API 요청에는 반영되지 않아, 전역 스터디 상태와 어긋나는 순간 잘못된 제출 목록을 가져올 수 있습니다.
- **suggestion**: useSWR 키의 studyId를 fetcher에서 헤더로 사용하거나, studyId를 포함한 명시적 API 함수로 조회하도록 변경하세요.

### P1-76 — frontend/src/hooks/useAutoSave.ts:134
- **category**: data-integrity
- **message**: setInterval 콜백이 async 저장 완료 전에 다음 주기를 시작할 수 있어 서버 저장 요청이 겹치고, 늦게 끝난 오래된 저장이 최신 드래프트를 덮어쓸 수 있습니다.
- **suggestion**: inFlight 플래그나 AbortController로 동시 서버 저장을 막고, 저장 시작 시점이 아니라 성공한 최신 버전 기준으로만 lastServerSaveRef를 갱신하세요.

### P1-77 — frontend/src/hooks/useBojSearch.ts:56
- **category**: correctness
- **message**: 연속 검색 시 이전 요청이 나중에 완료되면 최신 검색 결과와 폼 값을 오래된 문제 정보로 덮어쓸 수 있습니다.
- **suggestion**: 요청 ID ref 또는 AbortController를 사용해 마지막으로 시작한 검색의 응답만 상태에 반영하세요.

### P1-78 — frontend/src/hooks/useSessionKeepAlive.ts:84
- **category**: correctness
- **message**: 훅이 비활성 상태로 오래 마운트된 뒤 enabled가 true가 되면 lastHeartbeatRef가 이전 시각 그대로라 세션 만료 콜백이 즉시 호출될 수 있습니다.
- **suggestion**: enabled가 true로 전환될 때 lastActivityRef와 lastHeartbeatRef를 Date.now()로 초기화한 뒤 타이머를 시작하세요.

### P1-79 — frontend/src/hooks/useSubmissionSSE.ts:181
- **category**: correctness
- **message**: SSE 연결이 일시적인 5xx/네트워크 게이트웨이 응답으로 실패해도 재연결하지 않고 즉시 error 상태로 고정됩니다.
- **suggestion**: response.ok가 아니거나 body가 없을 때도 종료 상태가 아니라면 scheduleReconnect()를 호출하고, 401/403처럼 재시도해도 의미 없는 상태만 별도로 error 처리하세요.

### P1-80 — frontend/src/lib/api/client.ts:91
- **category**: security
- **message**: 쿠키 기반 인증 요청에 credentials: 'include'를 사용하면서 상태 변경 요청에 CSRF 토큰 헤더를 추가하지 않아 CSRF 방어가 클라이언트 레이어에 없다.
- **suggestion**: POST/PATCH/PUT/DELETE 요청에는 서버가 검증하는 CSRF 토큰을 읽어 X-CSRF-Token 같은 헤더로 포함하고, 서버 측 SameSite 설정과 함께 검증하라.

### P1-81 — frontend/src/lib/api/client.ts:121
- **category**: correctness
- **message**: 성공 응답에서 204가 아닌 빈 본문을 항상 res.json()으로 파싱해 200/201/202 빈 응답에서 런타임 예외가 발생한다.
- **suggestion**: 응답 text를 먼저 읽고 빈 문자열이면 undefined를 반환하거나 Content-Type이 application/json일 때만 JSON 파싱을 수행하라.

## P2 (비차단)

### P2-01 — frontend/src/app/(auth)/callback/page.tsx:36
- **category**: maintainability
- **message**: CallbackContent 함수가 20줄을 크게 초과해 OAuth 오류 처리, 상태 동기화, GitHub 연동 UI가 한 함수에 섞여 있습니다.
- **suggestion**: 콜백 파라미터 처리, GitHub 연동 프롬프트, 로딩/오류 화면을 별도 훅이나 컴포넌트로 분리하세요.

### P2-02 — frontend/src/app/(auth)/github-link/page.tsx:19
- **category**: maintainability
- **message**: GitHubLinkContent 함수가 20줄을 초과하고 오류 파라미터 처리, API 호출, 전체 UI 렌더링을 모두 포함합니다.
- **suggestion**: 오류 파라미터 처리와 연동 시작 로직을 훅으로 분리하고, 안내 목록/푸터를 작은 컴포넌트로 나누세요.

### P2-03 — frontend/src/app/(auth)/login/page.tsx:60
- **category**: maintainability
- **message**: LoginContent 함수가 20줄을 크게 초과하고 인증 리다이렉트, URL 파라미터 처리, 데모 로그인, OAuth, 모달, 전체 화면 UI를 모두 담당합니다.
- **suggestion**: 인증 상태 처리와 액션 핸들러를 훅으로 분리하고, 모달/푸터/OAuth 버튼 목록을 별도 컴포넌트로 추출하세요.

### P2-04 — frontend/src/app/(auth)/register/github/page.tsx:57
- **category**: maintainability
- **message**: RegisterGitHubPage 함수가 20줄을 크게 초과하고 인증 가드, 자동 이동 타이머, 연동 API 호출, 전체 UI를 한 곳에서 처리합니다.
- **suggestion**: 인증/리다이렉트 효과와 GitHub 연동 액션을 훅으로 분리하고 화면 상태별 컴포넌트를 추출하세요.

### P2-05 — frontend/src/app/(auth)/register/page.tsx:86
- **category**: maintainability
- **message**: RegisterContent 함수가 20줄을 크게 초과하고 인증 상태 처리, URL 오류 처리, OAuth/데모 액션, 온보딩 UI를 모두 포함합니다.
- **suggestion**: 공통 로그인/가입 OAuth 로직을 재사용 가능한 훅이나 컴포넌트로 추출하고 RegisterContent는 조립만 담당하게 하세요.

### P2-06 — frontend/src/app/admin/feedbacks/page.tsx:113
- **category**: correctness
- **message**: 피드백 상태 변경 후 현재 상태 필터와 맞지 않는 항목도 목록에 남고 상단 counts도 갱신되지 않아 관리 화면 통계와 목록이 불일치합니다.
- **suggestion**: 상태 변경 성공 후 현재 필터 기준으로 항목을 제거하거나 목록을 재조회하고 counts도 함께 갱신하세요.

### P2-07 — frontend/src/app/analytics/page.tsx:143
- **category**: maintainability
- **message**: problemsVersion 효과가 의존성 검사를 비활성화해 isAuthenticated, studiesLoaded, currentStudyId, loadData 변경을 놓칠 수 있습니다.
- **suggestion**: 의존성 배열에 참조 값을 모두 포함하고, 중복 호출은 loadData 내부의 최신 요청 무시 로직으로 제어하세요.

### P2-08 — frontend/src/app/(auth)/register/profile/page.tsx:51
- **category**: maintainability
- **message**: RegisterProfilePage가 렌더링, 인증 가드, 저장 로직, 애니메이션, 푸터까지 한 함수에 포함되어 20라인 기준을 크게 초과합니다.
- **suggestion**: 아바타 선택 그리드, 온보딩 레이아웃, 저장 액션 영역을 별도 컴포넌트나 훅으로 분리하세요.

### P2-09 — frontend/src/app/admin/feedbacks/page.tsx:69
- **category**: maintainability
- **message**: AdminFeedbacksPage가 조회, 필터, 검색, 테이블, 페이지네이션, 상세 모달 상태를 모두 포함해 과도하게 커졌습니다.
- **suggestion**: 필터/검색 바, 피드백 테이블, 페이지네이션, 상태 변경 훅으로 책임을 분리하세요.

### P2-10 — frontend/src/app/analytics/page.tsx:70
- **category**: maintainability
- **message**: AnalyticsPage가 데이터 로딩과 통계 가공, 렌더링을 한 컴포넌트에서 처리해 변경 영향 범위가 큽니다.
- **suggestion**: 데이터 조회 훅과 통계 파생값 계산 훅을 분리하고, 카드/빈 상태/차트 섹션을 하위 컴포넌트로 나누세요.

### P2-11 — frontend/src/app/dashboard/page.tsx:209
- **category**: performance
- **message**: 대시보드 진입과 문제 변경마다 전체 문제 목록을 제한 없이 조회해 문제 수가 많아지면 초기 로딩과 렌더링 비용이 커집니다.
- **suggestion**: 대시보드에 필요한 필드만 반환하는 요약 API를 만들거나 주차/상태 기준 필터와 캐시(SWR 등)를 적용하세요.

### P2-12 — frontend/src/app/dashboard/page.tsx:162
- **category**: maintainability
- **message**: DashboardPage가 데이터 조회, 파생 통계, 애니메이션, 렌더링을 모두 포함한 거대 컴포넌트라 변경 영향 범위가 큽니다.
- **suggestion**: 데이터 로딩은 useDashboardData 훅으로, 주차/통계 계산은 순수 유틸로, 화면 섹션은 독립 컴포넌트로 분리하세요.

### P2-13 — frontend/src/app/problems/[id]/edit/page.tsx:162
- **category**: correctness
- **message**: catch의 unknown 값을 Error로 단언해 message에 접근하므로 null 또는 비-객체 rejection이면 에러 처리 중 다시 런타임 예외가 발생할 수 있습니다.
- **suggestion**: err instanceof Error ? err.message : '문제를 불러오는 데 실패했습니다.' 형태로 안전하게 분기하세요.

### P2-14 — frontend/src/app/problems/[id]/edit/page.tsx:239
- **category**: data-integrity
- **message**: 변경된 필드가 없어도 빈 PATCH 요청을 전송하여 updatedAt 갱신이나 백엔드 검증 오류 같은 불필요한 부작용이 생길 수 있습니다.
- **suggestion**: Object.keys(data).length === 0이면 API 호출 없이 상세 페이지로 이동하거나 사용자에게 변경 사항이 없음을 표시하세요.

### P2-15 — frontend/src/app/problems/[id]/edit/page.tsx:251
- **category**: data-integrity
- **message**: 제출 기록까지 삭제되는 파괴적 작업이 단순 confirm 한 번으로 실행되어 오클릭 시 복구 어려운 데이터 손실 위험이 큽니다.
- **suggestion**: 문제 제목 입력 확인, 별도 확인 모달, 또는 삭제 대신 보관/비활성화 흐름을 도입하세요.

### P2-16 — frontend/src/app/problems/[id]/edit/page.tsx:61
- **category**: maintainability
- **message**: ProblemEditPage가 수백 줄의 단일 컴포넌트로 데이터 로딩, 권한 검사, 검색 UI, 폼 diff, 삭제 처리를 모두 담당해 변경 영향 범위가 큽니다.
- **suggestion**: 검색 섹션, 기본 정보 폼, 상태/삭제 액션, 폼 diff 생성 로직을 별도 컴포넌트와 훅으로 분리하세요.

### P2-17 — frontend/src/app/problems/[id]/edit/page.tsx:198
- **category**: maintainability
- **message**: handleSubmit이 20줄을 크게 넘고 검증, 상태 전이 확인, diff 생성, API 호출, 라우팅을 모두 포함해 테스트와 수정이 어렵습니다.
- **suggestion**: buildUpdateProblemData 같은 순수 함수와 confirmStatusTransition 같은 보조 함수로 분리해 단위 테스트 가능하게 만드세요.

### P2-18 — frontend/src/app/page.tsx:57
- **category**: maintainability
- **message**: LandingPage가 긴 단일 컴포넌트로 내비게이션, 히어로, 후기, CTA, 광고, 푸터를 모두 렌더링해 구조 변경 시 충돌 가능성이 높습니다.
- **suggestion**: NavBar, TestimonialsSection, FinalCtaSection, LandingFooter 등 섹션 컴포넌트로 분리하세요.

### P2-19 — frontend/src/app/privacy/page.tsx:25
- **category**: maintainability
- **message**: 개인정보처리방침 전문이 페이지 컴포넌트에 하드코딩되어 법무 문구 변경과 UI 변경이 강하게 결합되어 있습니다.
- **suggestion**: 약관/정책 본문을 MDX, CMS, 또는 섹션 데이터 배열로 분리하고 페이지는 렌더링만 담당하게 하세요.

### P2-20 — frontend/src/app/problems/[id]/page.tsx:107
- **category**: correctness
- **message**: 제출 목록 조회 실패를 빈 배열로 삼켜 사용자가 오류를 제출 데이터 없음으로 오인합니다.
- **suggestion**: 제출 목록 조회 실패를 별도 에러 상태로 표시하거나 재시도 UI를 제공하고, 문제 상세 조회 실패와 구분해 처리하세요.

### P2-21 — frontend/src/app/problems/[id]/page.tsx:115
- **category**: correctness
- **message**: catch 값이 Error 객체가 아니면 err.message 접근으로 예외 처리 중 다시 런타임 오류가 날 수 있습니다.
- **suggestion**: err instanceof Error ? err.message : 기본 메시지 형태의 공통 오류 메시지 추출 헬퍼를 사용하세요.

### P2-22 — frontend/src/app/problems/[id]/page.tsx:158
- **category**: correctness
- **message**: 제출 실패 처리에서 unknown 값을 Error로 단언해 non-Error rejection 시 런타임 오류가 날 수 있습니다.
- **suggestion**: Error 인스턴스 여부를 확인한 뒤 message를 읽고, 문자열 또는 null rejection에는 기본 메시지를 사용하세요.

### P2-23 — frontend/src/app/problems/[id]/page.tsx:170
- **category**: correctness
- **message**: 삭제 실패 처리에서 unknown 값을 Error로 단언해 non-Error rejection 시 런타임 오류가 날 수 있습니다.
- **suggestion**: 공통 오류 정규화 함수를 사용해 Error가 아닌 값도 안전하게 사용자 메시지로 변환하세요.

### P2-24 — frontend/src/app/problems/[id]/status/page.tsx:23
- **category**: correctness
- **message**: 쿼리스트링의 submissionId를 경로 세그먼트에 인코딩 없이 삽입해 슬래시나 물음표가 포함되면 의도하지 않은 라우트로 이동할 수 있습니다.
- **suggestion**: submissionId를 형식 검증한 뒤 encodeURIComponent로 경로 세그먼트를 인코딩해서 router.replace에 전달하세요.

### P2-25 — frontend/src/app/problems/[id]/page.tsx:49
- **category**: maintainability
- **message**: ProblemDetailPage가 데이터 로딩, 제출, 삭제 모달, 상세 렌더링, 제출 목록 렌더링을 모두 포함해 함수가 과도하게 길고 변경 위험이 큽니다.
- **suggestion**: 문제 정보 카드, 제출 패널, 삭제 확인 모달, 제출 목록을 별도 컴포넌트와 훅으로 분리해 책임을 나누세요.

### P2-26 — frontend/src/app/problems/create/page.tsx:232
- **category**: correctness
- **message**: useRequireStudy()의 준비 상태를 무시해 스터디/역할 로딩 중 currentStudyRole이 null이면 관리자에게도 권한 오류 화면이 먼저 표시될 수 있습니다.
- **suggestion**: useRequireStudy()의 isStudyReady를 받아 인증 준비 상태와 함께 로딩 가드에 포함한 뒤 역할 검사를 수행하세요.

### P2-27 — frontend/src/app/problems/create/page.tsx:185
- **category**: correctness
- **message**: deadline 스키마는 빈 문자열만 막고 유효한 날짜 형식을 보장하지 않아 잘못된 값이 들어오면 toISOString()에서 RangeError가 발생할 수 있습니다.
- **suggestion**: Zod 스키마에서 datetime/ISO 형식을 검증하거나 변환 전에 Number.isNaN(new Date(value).getTime()) 검사를 추가하세요.

### P2-28 — frontend/src/app/problems/create/page.tsx:186
- **category**: data-integrity
- **message**: 허용 언어를 모두 해제하면 allowedLanguages를 전송하지 않아 서버 기본값으로 대체되어 사용자가 선택한 제한이 보존되지 않을 수 있습니다.
- **suggestion**: 최소 1개 언어를 요구하거나, 빈 배열도 명시적으로 전송해 서버가 의도한 상태를 처리하도록 하세요.

### P2-29 — frontend/src/app/problems/create/page.tsx:50
- **category**: maintainability
- **message**: ProblemCreatePage가 검색, 폼 상태, 권한 가드, 제출, 성공 화면까지 모두 포함한 대형 컴포넌트라 변경 영향 범위가 큽니다.
- **suggestion**: 플랫폼 검색 섹션, 기본 정보 폼, 제출 로직을 별도 컴포넌트/훅으로 분리하고 페이지는 조합만 담당하게 하세요.

### P2-30 — frontend/src/app/problems/page.tsx:79
- **category**: performance
- **message**: 문제 목록을 페이지네이션 없이 전체 로드한 뒤 클라이언트에서 검색/정렬해 스터디 문제 수가 늘면 초기 로딩과 렌더링 비용이 커집니다.
- **suggestion**: API에 limit/cursor 또는 page 파라미터를 추가하고 검색/상태/난이도 필터와 정렬을 서버 쿼리로 위임하세요.

### P2-31 — frontend/src/app/problems/page.tsx:139
- **category**: correctness
- **message**: createdAt이 잘못된 날짜 문자열이면 comparator가 NaN을 반환해 정렬 순서가 불안정해질 수 있습니다.
- **suggestion**: Date.parse 결과를 검사해 유효하지 않은 날짜는 0 또는 명시적 fallback으로 정규화한 뒤 비교하세요.

### P2-32 — frontend/src/app/problems/page.tsx:69
- **category**: maintainability
- **message**: ProblemsPage가 데이터 로딩, 필터 상태, 애니메이션, 목록 렌더링, 관리자 액션까지 한 함수에 몰려 있어 유지보수가 어렵습니다.
- **suggestion**: 필터 바, 문제 리스트, 관리자 추가 버튼/모달을 분리하고 필터링 로직은 별도 훅으로 추출하세요.

### P2-33 — frontend/src/app/profile/[slug]/page.tsx:27
- **category**: correctness
- **message**: slug 변경 시 loading을 다시 true로 만들지 않고 이전 요청도 취소하지 않아 빠른 라우팅에서 이전 프로필 응답이 새 slug 화면을 덮어쓸 수 있습니다.
- **suggestion**: effect 시작 시 loading/profile/notFound를 초기화하고 AbortController 또는 active 플래그로 최신 slug 요청만 상태를 갱신하게 하세요.

### P2-34 — frontend/src/app/profile/page.tsx:105
- **category**: correctness
- **message**: 프로필 조회 effect가 인증 준비 상태와 무관하게 한 번만 실행되어, 초기 인증 로딩 중 실패하면 이름과 로그인 방식이 다시 로드되지 않습니다.
- **suggestion**: isReady 또는 인증 상태가 true가 된 뒤 getProfile을 호출하도록 의존성 배열과 조건을 조정하세요.

### P2-35 — frontend/src/app/profile/page.tsx:129
- **category**: security
- **message**: GitHub 연동 URL을 검증 없이 window.location.href에 대입해 백엔드 응답이 오염될 경우 임의 외부 URL로 이동할 수 있습니다.
- **suggestion**: 응답 URL의 origin/경로가 허용된 GitHub OAuth 또는 자체 콜백 도메인인지 검증한 뒤 이동하세요.

### P2-36 — frontend/src/app/profile/page.tsx:163
- **category**: security
- **message**: GitHub 재연동 URL을 검증 없이 window.location.href에 대입해 임의 외부 URL 리다이렉트 위험이 있습니다.
- **suggestion**: 허용 목록 기반으로 URL을 검증하고, 실패 시 오류를 표시하도록 처리하세요.

### P2-37 — frontend/src/app/reviews/[submissionId]/page.tsx:196
- **category**: convention
- **message**: 프로덕션 코드에서 console.error를 직접 사용하고 있어 구조화된 로깅/모니터링 정책과 맞지 않습니다.
- **suggestion**: 공통 logger 또는 관측성 유틸리티를 사용해 컨텍스트와 함께 기록하세요.

### P2-38 — frontend/src/app/reviews/[submissionId]/page.tsx:236
- **category**: correctness
- **message**: 댓글 수정 요청 실패를 catch하지 않아 실패 시 사용자에게 알림이 없고 미처리 Promise rejection이 발생할 수 있습니다.
- **suggestion**: await/try-catch로 실패를 처리하고 오류 상태 또는 토스트를 통해 사용자에게 알려주세요.

### P2-39 — frontend/src/app/reviews/[submissionId]/page.tsx:243
- **category**: correctness
- **message**: 댓글 삭제 요청 실패를 catch하지 않아 실패 시 사용자에게 알림이 없고 미처리 Promise rejection이 발생할 수 있습니다.
- **suggestion**: 삭제 API와 후속 목록 갱신을 try-catch로 감싸고 실패 시 기존 댓글 상태를 유지하며 오류를 표시하세요.

### P2-40 — frontend/src/app/reviews/[submissionId]/page.tsx:274
- **category**: correctness
- **message**: 렌더링 중 router.push를 호출해 React 렌더 사이드 이펙트가 발생할 수 있습니다.
- **suggestion**: 비인증 리다이렉트는 useEffect에서 수행하거나 Next.js redirect 패턴으로 분리하세요.

### P2-41 — frontend/src/app/reviews/[submissionId]/page.tsx:313
- **category**: correctness
- **message**: currentStudyId와 problemId를 URL에 직접 보간해 특수문자가 포함되면 경로 또는 쿼리가 깨질 수 있습니다.
- **suggestion**: 경로/쿼리 값은 encodeURIComponent로 인코딩하거나 URLSearchParams를 사용하세요.

### P2-42 — frontend/src/app/reviews/[submissionId]/page.tsx:469
- **category**: correctness
- **message**: CategoryBar key로 category 문자열만 사용해 중복 카테고리가 있으면 React 재조정이 잘못될 수 있습니다.
- **suggestion**: 카테고리 id가 없다면 category와 idx를 결합하는 등 렌더 목록 내에서 유일한 key를 사용하세요.

### P2-43 — frontend/src/app/settings/page.tsx:188
- **category**: correctness
- **message**: saveMessage.includes('저장')로 성공 여부를 판단해 '저장 실패' 같은 에러 메시지도 성공 색상과 체크 아이콘으로 표시됩니다.
- **suggestion**: saveStatus를 'success' | 'error'처럼 별도 상태로 저장하고 표시 조건을 메시지 문자열이 아닌 상태값으로 분기하세요.

### P2-44 — frontend/src/app/robots.ts:10
- **category**: correctness
- **message**: sitemap URL에 NEXT_PUBLIC_API_BASE_URL을 사용해 API 도메인이 설정된 환경에서는 robots.txt가 프론트엔드가 아닌 API 도메인의 sitemap을 가리킬 수 있습니다.
- **suggestion**: NEXT_PUBLIC_SITE_URL 같은 프론트엔드 공개 URL 환경변수를 별도로 사용하고 기본값도 실제 서비스 도메인과 일치시키세요.

### P2-45 — frontend/src/app/sitemap.ts:4
- **category**: correctness
- **message**: 사이트맵의 base URL에 `NEXT_PUBLIC_API_BASE_URL`을 사용해 API 도메인이 설정된 환경에서는 잘못된 페이지 URL이 생성됩니다.
- **suggestion**: 프론트엔드 공개 주소용 `NEXT_PUBLIC_SITE_URL`을 별도로 사용하고, 없을 때만 `https://algosu.kr`로 fallback하세요.

### P2-46 — frontend/src/app/studies/[id]/room/page.tsx:129
- **category**: performance
- **message**: 스터디룸 진입 시 문제 전체를 페이지네이션 없이 가져와 문제가 많아질수록 초기 렌더링과 네트워크 비용이 커집니다.
- **suggestion**: 주차별/페이지별 조회 API를 사용하거나 필요한 주차만 점진적으로 로드하세요.

### P2-47 — frontend/src/app/studies/[id]/room/page.tsx:179
- **category**: performance
- **message**: 문제별 제출 전체를 가져온 뒤 클라이언트에서 사용자별로 중복 제거해 제출 이력이 많으면 불필요한 데이터 전송과 렌더링 비용이 발생합니다.
- **suggestion**: 서버에서 사용자별 최신 제출만 반환하는 엔드포인트를 사용하거나 limit/정렬 조건을 추가하세요.

### P2-48 — frontend/src/app/studies/[id]/room/page.tsx:171
- **category**: correctness
- **message**: useEffect에서 searchParams와 loadSubmissions를 사용하지만 의존성 배열에 없어 problemId 쿼리 변경이 같은 스터디 내에서 반영되지 않을 수 있습니다.
- **suggestion**: 의존성 배열에 searchParams와 loadSubmissions를 포함하거나 problemId 값을 별도 memo로 추출해 의존성을 명확히 하세요.

### P2-49 — frontend/src/app/studies/[id]/room/page.tsx:133
- **category**: correctness
- **message**: setBarsAnimated 타이머를 정리하지 않아 컴포넌트 언마운트 또는 스터디 전환 후에도 상태 업데이트가 실행될 수 있습니다.
- **suggestion**: 타이머 id를 저장하고 effect cleanup에서 clearTimeout을 호출하세요.

### P2-50 — frontend/src/app/studies/[id]/room/SubmissionView.tsx:57
- **category**: correctness
- **message**: 제출률 pct를 100으로 제한하지 않아 통계 불일치나 중복 데이터가 있으면 진행 바 width가 100%를 초과할 수 있습니다.
- **suggestion**: Math.min(100, Math.max(0, pct))로 진행률을 클램프하세요.

### P2-51 — frontend/src/app/studies/[id]/room/WeekSection.tsx:72
- **category**: correctness
- **message**: 문제 카드 제출률 pct를 100으로 제한하지 않아 submittedCount가 totalMembers보다 크면 진행 바가 컨테이너를 넘을 수 있습니다.
- **suggestion**: 계산된 pct를 0~100 범위로 클램프한 값을 width에 사용하세요.

### P2-52 — frontend/src/app/studies/[id]/room/page.tsx:54
- **category**: maintainability
- **message**: StudyRoomPage가 데이터 로딩, 히스토리 제어, 상태 전환, 렌더링을 모두 포함한 300줄 이상의 거대 컴포넌트입니다.
- **suggestion**: 데이터 로딩 훅, 히스토리 상태 훅, 메인/제출/분석 뷰 컨테이너로 분리해 책임을 나누세요.

### P2-53 — frontend/src/app/studies/[id]/room/SubmissionView.tsx:48
- **category**: maintainability
- **message**: SubmissionView 함수가 20줄을 크게 초과하며 헤더, 통계, 상태별 빈 화면, 제출 카드 렌더링을 모두 담당합니다.
- **suggestion**: 헤더, 문제 요약, 상태 패널, 제출 카드 리스트를 별도 컴포넌트로 분리하세요.

### P2-54 — frontend/src/app/studies/[id]/room/WeekSection.tsx:68
- **category**: maintainability
- **message**: ProblemTimelineCard 함수가 20줄을 초과하고 상태 배지, 태그, 진행률, 레이아웃을 한곳에서 처리합니다.
- **suggestion**: 상태 배지와 진행률 표시를 작은 하위 컴포넌트로 분리하세요.

### P2-55 — frontend/src/app/studies/[id]/room/page.tsx:366
- **category**: convention
- **message**: 인라인 스타일 값에 하드코딩된 색상 #3B82CE가 포함되어 디자인 토큰 일관성을 깨뜨립니다.
- **suggestion**: CSS 변수나 Tailwind 디자인 토큰으로 색상 fallback을 대체하세요.

### P2-56 — frontend/src/app/studies/page.tsx:145
- **category**: correctness
- **message**: 초대 코드 검증 API 응답의 valid 필드를 확인하지 않고 항상 닉네임 모달을 엽니다.
- **suggestion**: result.valid가 true일 때만 모달을 열고, false이면 joinError를 설정하도록 분기하세요.

### P2-57 — frontend/src/app/studies/[id]/settings/page.tsx:275
- **category**: correctness
- **message**: 클립보드 복사 실패를 처리하지 않아 권한 거부나 비보안 컨텍스트에서 미처리 Promise rejection이 발생합니다.
- **suggestion**: navigator.clipboard.writeText를 try/catch로 감싸고 실패 시 사용자에게 오류 메시지를 표시하세요.

### P2-58 — frontend/src/app/studies/[id]/settings/page.tsx:64
- **category**: maintainability
- **message**: StudySettingsPage 컴포넌트가 설정 폼, 멤버 관리, 초대 코드, 삭제 모달까지 모두 포함해 과도하게 커졌습니다.
- **suggestion**: 기본 정보, 그라운드룰, 멤버 관리, 초대 코드, 위험 구역, 확인 모달을 별도 컴포넌트와 훅으로 분리하세요.

### P2-59 — frontend/src/app/studies/page.tsx:50
- **category**: maintainability
- **message**: StudiesPage 컴포넌트가 목록 조회, 생성, 가입, 탭 UI, 모달을 모두 처리해 함수 크기와 책임이 과도합니다.
- **suggestion**: 스터디 목록, 초대 가입, 생성 모달을 별도 컴포넌트로 분리하고 API 상태 로직은 커스텀 훅으로 이동하세요.

### P2-60 — frontend/src/app/submissions/[id]/analysis/page.tsx:297
- **category**: correctness
- **message**: submission만 확인하고 problemId 존재 여부를 확인하지 않아 problemId가 없으면 /problems/undefined 같은 잘못된 링크가 렌더링됩니다.
- **suggestion**: 문제 보기 링크는 submission?.problemId가 있을 때만 렌더링하세요.

### P2-61 — frontend/src/app/submissions/[id]/analysis/page.tsx:114
- **category**: performance
- **message**: loadData가 폴링마다 문제 메타데이터까지 다시 조회해 동일한 problemId에 대해 불필요한 API 호출이 반복됩니다.
- **suggestion**: problemId가 바뀐 경우에만 문제 메타데이터를 조회하거나 별도 effect/cache로 분리하세요.

### P2-62 — frontend/src/app/submissions/[id]/analysis/page.tsx:127
- **category**: security
- **message**: API 예외 메시지를 그대로 사용자에게 노출해 서버 내부 오류나 민감한 세부 정보가 표시될 수 있습니다.
- **suggestion**: 사용자에게는 일반화된 오류 문구를 보여주고 상세 메시지는 로깅/모니터링으로만 남기세요.

### P2-63 — frontend/src/app/submissions/[id]/status/page.tsx:209
- **category**: security
- **message**: 제출 조회 실패 시 API 예외 메시지를 그대로 화면에 표시해 내부 오류 세부 정보가 노출될 수 있습니다.
- **suggestion**: 프론트에서는 고정된 사용자용 오류 메시지를 표시하고 상세 원인은 서버 로그에서 확인하세요.

### P2-64 — frontend/src/app/submissions/[id]/analysis/page.tsx:54
- **category**: maintainability
- **message**: AnalysisPage가 400줄 이상이며 데이터 로딩, 폴링, 문서 제목, 복사, 렌더링을 모두 포함해 변경 영향 범위가 큽니다.
- **suggestion**: 데이터/폴링 로직은 커스텀 훅으로, 코드 뷰어와 분석 결과 패널은 별도 컴포넌트로 분리하세요.

### P2-65 — frontend/src/app/submissions/[id]/status/page.tsx:168
- **category**: maintainability
- **message**: SubmissionStatusPage가 상태 조회, SSE 연결, GitHub 재연동, 전체 UI 렌더링을 한 함수에 포함해 유지보수가 어렵습니다.
- **suggestion**: SSE 상태 관리와 재연동 액션을 훅으로 분리하고 상태 카드/액션 영역을 컴포넌트로 나누세요.

### P2-66 — frontend/src/app/submit/[problemId]/page.tsx:27
- **category**: security
- **message**: URL 파라미터를 인코딩하지 않고 redirect 경로에 직접 삽입해 특수문자가 경로/쿼리 구조를 바꿀 수 있습니다.
- **suggestion**: redirect(`/problems/${encodeURIComponent(problemId)}`)처럼 동적 세그먼트를 인코딩하세요.

### P2-67 — frontend/src/components/analytics/AnalyticsCharts.tsx:258
- **category**: correctness
- **message**: AI 점수 차트 Y축을 60~100으로 고정해 60점 미만 점수가 차트에서 잘리거나 오해를 유발합니다.
- **suggestion**: 점수 범위가 0~100이라면 domain을 [0, 100]으로 바꾸거나 데이터 최솟값을 포함하도록 동적으로 계산하세요.

### P2-68 — frontend/src/components/dashboard/DashboardTwoColumn.tsx:87
- **category**: correctness
- **message**: recentSubmissions 길이로 빈 상태를 판단한 뒤 problemMap에 없는 항목을 필터링해, 필터 결과가 0건이면 카드 본문이 빈 화면으로 렌더링됩니다.
- **suggestion**: 필터링된 recentSubmissions를 먼저 계산하고 그 배열의 길이로 빈 상태와 목록 렌더링을 분기하세요.

### P2-69 — frontend/src/components/dashboard/DashboardThisWeek.tsx:23
- **category**: correctness
- **message**: deadline이 유효하지 않은 날짜 문자열이면 D-NaN 같은 잘못된 마감 라벨이 표시됩니다.
- **suggestion**: Date.parse 결과가 NaN인지 검증하고 유효하지 않으면 마감 라벨을 숨기거나 기본 오류 라벨을 표시하세요.

### P2-70 — frontend/src/components/ad/AdBanner.tsx:59
- **category**: correctness
- **message**: 2초 뒤 ins의 childElementCount가 0이면 광고를 숨기는데, AdSense 로딩 지연이나 iframe 삽입 방식에 따라 정상 광고도 숨겨질 수 있습니다.
- **suggestion**: AdSense 상태 속성(data-ad-status 등)이나 명시적 오류 신호를 기준으로 판단하고, 고정 시간 childElementCount 검사는 제거하거나 더 긴 재시도 로직으로 바꾸세요.

### P2-71 — frontend/src/app/submissions/page.tsx:82
- **category**: maintainability
- **message**: SubmissionsPage가 단일 함수에 조회, 필터, 애니메이션, 목록 렌더링을 모두 포함해 20라인 기준을 크게 초과합니다.
- **suggestion**: 필터 바, 난이도 필터, 제출 카드 목록, 상태 표시 헬퍼를 별도 컴포넌트 또는 훅으로 분리하세요.

### P2-72 — frontend/src/components/analytics/AnalyticsCharts.tsx:107
- **category**: maintainability
- **message**: AnalyticsCharts가 여러 차트와 통계 카드 렌더링을 한 함수에 모두 담아 20라인 기준을 크게 초과합니다.
- **suggestion**: StatCards, WeeklySubmissionChart, AIScoreChart, DifficultyDistribution, TagDistribution 컴포넌트로 분리하세요.

### P2-73 — frontend/src/components/dashboard/DashboardTwoColumn.tsx:57
- **category**: maintainability
- **message**: DashboardTwoColumn이 최근 제출과 마감 임박 목록을 한 함수에서 처리해 20라인 기준을 크게 초과합니다.
- **suggestion**: RecentSubmissionsCard와 UpcomingDeadlinesCard로 분리하고 공통 시간 포맷 로직은 헬퍼로 유지하세요.

### P2-74 — frontend/src/components/dashboard/DashboardThisWeek.tsx:52
- **category**: maintainability
- **message**: DashboardThisWeek가 목록 아이템 생성과 카드 렌더링을 한 함수에 포함해 20라인 기준을 초과합니다.
- **suggestion**: ProblemListItem 컴포넌트를 분리하고 useMemo 내부 JSX를 줄이세요.

### P2-75 — frontend/src/components/dashboard/DashboardTwoColumn.tsx:66
- **category**: performance
- **message**: 렌더링마다 allProblems 전체로 새 Map을 생성해 부모 리렌더마다 불필요한 O(n) 작업이 발생합니다.
- **suggestion**: useMemo(() => new Map(...), [allProblems])로 problemMap 생성을 메모이즈하세요.

### P2-76 — frontend/src/app/submissions/page.tsx:41
- **category**: convention
- **message**: 언어 색상을 HEX 값으로 하드코딩해 디자인 토큰 관리 규칙과 일관성이 떨어집니다.
- **suggestion**: 색상 값을 CSS 변수나 Tailwind/theme 토큰으로 옮기고 컴포넌트에서는 토큰만 참조하세요.

### P2-77 — frontend/src/components/feedback/BugReportForm.tsx:121
- **category**: data-integrity
- **message**: 제출 중 상태를 설정하지만 onSubmit 진입부에서 중복 호출을 차단하지 않아 빠른 더블클릭/Enter 반복으로 동일 버그 리포트가 여러 번 생성될 수 있습니다.
- **suggestion**: onSubmit 시작 시 submitting이면 즉시 return 하거나 react-hook-form의 isSubmitting/ref 기반 잠금으로 API 호출을 단일화하세요.

### P2-78 — frontend/src/components/feedback/FeedbackForm.tsx:51
- **category**: data-integrity
- **message**: 제출 중 상태를 설정하지만 onSubmit 진입부에서 중복 호출을 차단하지 않아 빠른 더블클릭/Enter 반복으로 동일 피드백이 여러 번 생성될 수 있습니다.
- **suggestion**: onSubmit 시작 시 submitting이면 즉시 return 하거나 react-hook-form의 isSubmitting/ref 기반 잠금으로 API 호출을 단일화하세요.

### P2-79 — frontend/src/components/feedback/FeedbackWidget.tsx:38
- **category**: correctness
- **message**: 성공 후 닫기 타이머를 정리하지 않아 컴포넌트 언마운트 후 setOpen이 실행되거나 사용자가 다시 연 패널이 이전 타이머로 닫힐 수 있습니다.
- **suggestion**: timeout id를 ref에 저장하고 open 변경/언마운트 시 clearTimeout 하며, 새 성공 처리 전에 기존 타이머를 취소하세요.

### P2-80 — frontend/src/components/layout/NotificationBell.tsx:139
- **category**: performance
- **message**: displayedToastIds Set이 세션 동안 계속 증가해 장시간 SSE 사용 시 메모리가 누적됩니다.
- **suggestion**: 최근 N개 ID만 보관하도록 큐를 함께 두거나 알림 목록 갱신 시 오래된 ID를 제거하세요.

### P2-81 — frontend/src/components/profile/ShareLinkManager.tsx:46
- **category**: correctness
- **message**: 스터디를 빠르게 전환하면 이전 list 요청 응답이 늦게 도착해 현재 선택과 다른 공유 링크 목록으로 덮어쓸 수 있습니다.
- **suggestion**: 요청 시점의 selectedStudyId를 캡처하고 응답 적용 전에 현재 선택값과 일치하는지 확인하거나 AbortController로 이전 요청을 취소하세요.

### P2-82 — frontend/src/components/profile/ShareLinkManager.tsx:80
- **category**: data-integrity
- **message**: 공유 링크 생성 후 클립보드 복사가 실패하면 링크는 이미 생성됐는데 전체 작업 실패처럼 표시되어 사용자가 재시도하며 중복 링크를 만들 수 있습니다.
- **suggestion**: 링크 생성과 클립보드 복사 오류를 분리 처리하고, 복사 실패 시에도 생성 성공 메시지와 수동 복사 안내를 표시하세요.

### P2-83 — frontend/src/components/profile/ShareLinkManager.tsx:93
- **category**: correctness
- **message**: 클립보드 복사 실패를 처리하지 않아 권한 거부나 비보안 컨텍스트에서 미처리 Promise rejection이 발생합니다.
- **suggestion**: navigator.clipboard.writeText를 try/catch로 감싸고 실패 메시지를 error 상태에 표시하세요.

### P2-84 — frontend/src/components/review/CommentForm.tsx:67
- **category**: correctness
- **message**: textarea KeyboardEvent를 FormEvent용 handleSubmit에 전달해 이벤트 타입이 맞지 않고 타입 검사 실패 가능성이 있습니다.
- **suggestion**: 제출 로직을 이벤트와 분리한 submitContent 함수로 빼고 form submit과 Enter 키 처리에서 각각 호출하세요.

### P2-85 — frontend/src/components/review/CodePanel.tsx:106
- **category**: performance
- **message**: 각 코드 라인마다 commentLines.includes를 호출해 라인 수와 댓글 수가 커질수록 O(n*m) 렌더링 비용이 발생합니다.
- **suggestion**: commentLines를 useMemo로 Set으로 변환한 뒤 has(lineNum)으로 조회하세요.

### P2-86 — frontend/src/components/review/CodePanel.tsx:114
- **category**: correctness
- **message**: role="button" 요소가 tabIndex={-1}이라 키보드 포커스를 받을 수 없어 onKeyDown 접근성이 사실상 동작하지 않습니다.
- **suggestion**: 실제 button 요소를 사용하거나 tabIndex={0}으로 변경하고 포커스 스타일을 제공하세요.

### P2-87 — frontend/src/components/review/CodePanel.tsx:55
- **category**: maintainability
- **message**: CodePanel 함수가 20줄을 크게 초과해 하이라이트 계산, 스크롤, 라인 렌더링 책임이 한 곳에 섞여 있습니다.
- **suggestion**: 라인 렌더링 컴포넌트와 highlight/comment Set 계산 훅으로 분리하세요.

### P2-88 — frontend/src/components/review/CommentThread.tsx:84
- **category**: correctness
- **message**: 댓글 수정 요청 결과를 기다리거나 실패를 처리하지 않아 저장 실패 시 편집 UI가 닫히고 사용자는 실패를 알 수 없습니다.
- **suggestion**: onEdit을 Promise 반환으로 바꾸고 await/catch로 저장 중 상태와 오류 메시지를 처리하세요.

### P2-89 — frontend/src/components/review/CommentThread.tsx:68
- **category**: maintainability
- **message**: CommentItem 함수가 20줄을 크게 초과해 표시, 편집, 삭제, 답글 렌더링 책임이 과도하게 결합되어 있습니다.
- **suggestion**: CommentHeader, CommentActions, ReplyList, EditForm 같은 작은 컴포넌트로 분리하세요.

### P2-90 — frontend/src/components/review/StudyNoteEditor.tsx:56
- **category**: data-integrity
- **message**: handleSave 시작 부분에 saving 가드가 없어 빠른 연속 클릭이나 중복 호출 시 저장 요청이 중복 전송될 수 있습니다.
- **suggestion**: handleSave 초기에 if (saving) return 가드를 추가하고 저장 중에는 입력도 필요하면 비활성화하세요.

### P2-91 — frontend/src/components/review/StudyNoteEditor.tsx:47
- **category**: correctness
- **message**: 노트 조회 실패를 모두 무시해 네트워크 오류와 빈 노트 상태를 구분할 수 없습니다.
- **suggestion**: 404/null과 실제 오류를 구분하고 실제 오류는 사용자에게 재시도 가능한 오류 상태로 표시하세요.

### P2-92 — frontend/src/components/review/StudyNoteEditor.tsx:30
- **category**: maintainability
- **message**: StudyNoteEditor 함수가 20줄을 크게 초과해 로딩, 조회, 편집, 저장 UI가 한 함수에 집중되어 있습니다.
- **suggestion**: 데이터 로딩 훅과 보기/편집 폼 컴포넌트로 분리하세요.

### P2-93 — frontend/src/components/providers/WebVitalsReporter.tsx:26
- **category**: convention
- **message**: structured logging을 사용한다고 주석에 적혀 있지만 개발 환경에서 console.log를 직접 사용합니다.
- **suggestion**: 프로젝트의 구조화 로깅 유틸을 사용하거나 개발 전용 로깅 래퍼로 교체하세요.

### P2-94 — frontend/src/components/ui/AddProblemModal.tsx:223
- **category**: correctness
- **message**: 검색 요청의 응답 순서를 보장하지 않아 이전 query 또는 이전 플랫폼의 늦은 응답이 최신 검색 결과를 덮어쓸 수 있습니다.
- **suggestion**: 요청 시퀀스 id 또는 AbortController를 사용해 최신 요청 응답만 setResults/setError에 반영하세요.

### P2-95 — frontend/src/components/submission/AiSatisfactionButton.tsx:26
- **category**: correctness
- **message**: submissionId 변경 또는 언마운트 후 이전 만족도 조회 응답이 도착하면 현재 컴포넌트 상태를 오래된 값으로 덮어쓸 수 있습니다.
- **suggestion**: useEffect 내부에 취소 플래그 또는 AbortController를 두고 최신 submissionId의 응답만 상태에 반영하세요.

### P2-96 — frontend/src/components/submission/AiSatisfactionButton.tsx:50
- **category**: correctness
- **message**: 평가 후 통계 갱신 요청을 취소하지 않아 submissionId가 바뀐 뒤 이전 통계가 새 제출 화면에 표시될 수 있습니다.
- **suggestion**: 통계 갱신도 현재 submissionId 검증 또는 취소 처리를 거친 뒤 setStats를 호출하세요.

### P2-97 — frontend/src/components/settings/ProfileVisibilitySettings.tsx:66
- **category**: data-integrity
- **message**: slug를 비워 저장할 때 profileSlug: undefined를 보내 JSON 직렬화에서 필드가 누락될 수 있어 기존 slug가 삭제되지 않을 수 있습니다.
- **suggestion**: API 계약에 맞춰 slug 삭제를 명시하는 null 또는 빈 문자열을 보내고 서버 동작과 타입을 일치시키세요.

### P2-98 — frontend/src/components/settings/ProfileVisibilitySettings.tsx:156
- **category**: correctness
- **message**: saveMessage.includes('저장')으로 성공 여부를 판단해 '저장 실패' 같은 오류 메시지도 성공 색상과 체크 아이콘으로 표시될 수 있습니다.
- **suggestion**: 메시지 문자열 대신 saveStatus: 'success' | 'error' 같은 별도 상태로 표시 스타일을 결정하세요.

### P2-99 — frontend/src/components/submission/SubmissionStatus.tsx:47
- **category**: correctness
- **message**: React key로 step.label만 사용해 동일 라벨 단계가 들어오면 상태 재사용과 렌더링 불일치가 발생할 수 있습니다.
- **suggestion**: 단계 id를 props에 포함하거나 `${idx}-${step.label}`처럼 중복되지 않는 key를 사용하세요.

### P2-100 — frontend/src/components/ui/alert-dialog.tsx:126
- **category**: correctness
- **message**: AlertDialogAction이 type을 지정하지 않아 폼 내부에서 사용될 때 기본 submit 버튼으로 동작할 수 있습니다.
- **suggestion**: Action/Cancel 래퍼에서 type='button'을 기본값으로 주고, 필요한 경우 호출자가 명시적으로 override하도록 하세요.

### P2-101 — frontend/src/components/ui/alert-dialog.tsx:138
- **category**: correctness
- **message**: AlertDialogCancel이 type을 지정하지 않아 폼 내부에서 취소 클릭이 의도치 않은 submit을 발생시킬 수 있습니다.
- **suggestion**: Cancel 컴포넌트에도 type='button' 기본값을 설정하세요.

### P2-102 — frontend/src/components/submission/CodeEditor.tsx:62
- **category**: convention
- **message**: Monaco 테마 색상이 하드코딩된 hex 값으로 정의되어 디자인 토큰 변경을 따라가지 못합니다.
- **suggestion**: 가능한 색상은 CSS 변수 또는 중앙 theme token에서 가져오고, Monaco에 주입하는 변환 레이어를 분리하세요.

### P2-103 — frontend/src/components/submission/CodeEditor.tsx:107
- **category**: maintainability
- **message**: CodeEditor 컴포넌트가 상태, 모달, 단축키, 마감 경고, Monaco 설정을 모두 포함해 20라인을 크게 초과하는 거대 컴포넌트입니다.
- **suggestion**: 제출 확인 모달, 언어 변경 모달, 에디터 툴바, 마감 경고 로직을 하위 컴포넌트나 커스텀 훅으로 분리하세요.

### P2-104 — frontend/src/components/ui/Button.tsx:86
- **category**: correctness
- **message**: asChild=true일 때 Slot이 a 등 다른 요소를 렌더링할 수 있는데 ref와 props 타입은 HTMLButtonElement로 고정되어 타입 안전성이 깨집니다.
- **suggestion**: 다형성 컴포넌트 타입을 적용하거나 asChild 사용 시 ref 타입을 Element로 넓히고 버튼 전용 props가 비버튼 요소에 전달되지 않게 분리하세요.

### P2-105 — frontend/src/components/ui/calendar.tsx:26
- **category**: maintainability
- **message**: react-day-picker 9.14.0에서 nav_button, nav_button_previous, table, head_row 등 다수 classNames 키가 deprecated/removed라 스타일 적용이 불안정합니다.
- **suggestion**: button_previous, button_next, month_grid, weekdays, weekday, week, day_button 등 v9의 현재 ClassNames 키로 교체하세요.

### P2-106 — frontend/src/components/ui/calendar.tsx:63
- **category**: correctness
- **message**: Chevron 컴포넌트가 orientation이 left가 아니면 모두 오른쪽 화살표를 렌더링해 dropdown 사용 시 up/down 방향 아이콘이 잘못 표시됩니다.
- **suggestion**: orientation의 left/right/up/down 값을 모두 분기하거나 기본 DayPicker Chevron 구현과 동일한 방향 매핑을 사용하세요.

### P2-107 — frontend/src/components/ui/carousel.tsx:99
- **category**: performance
- **message**: reInit 이벤트 리스너를 등록하지만 cleanup에서 해제하지 않아 재마운트 또는 api 변경 시 리스너가 누적될 수 있습니다.
- **suggestion**: cleanup에서 api.off("reInit", onSelect)도 함께 호출하세요.

### P2-108 — frontend/src/components/ui/carousel.tsx:196
- **category**: correctness
- **message**: CarouselPrevious에서 {...props}가 onClick과 disabled 뒤에 있어 외부 props가 내부 스크롤 동작이나 비활성 상태를 덮어쓸 수 있습니다.
- **suggestion**: props를 먼저 펼치고 내부 disabled를 마지막에 적용하며, onClick은 외부 핸들러 호출 후 scrollPrev를 호출하도록 병합하세요.

### P2-109 — frontend/src/components/ui/carousel.tsx:226
- **category**: correctness
- **message**: CarouselNext에서 {...props}가 onClick과 disabled 뒤에 있어 외부 props가 내부 스크롤 동작이나 비활성 상태를 덮어쓸 수 있습니다.
- **suggestion**: props를 먼저 펼치고 내부 disabled를 마지막에 적용하며, onClick은 외부 핸들러 호출 후 scrollNext를 호출하도록 병합하세요.

### P2-110 — frontend/src/components/ui/CategoryBar.tsx:45
- **category**: correctness
- **message**: item.color가 런타임에 허용 목록 밖의 값이면 colors가 undefined가 되어 렌더링 중 크래시가 발생합니다.
- **suggestion**: 외부 데이터 경계에서 color를 검증하거나 COLOR_MAP[item.color] 실패 시 기본 색상으로 폴백하세요.

### P2-111 — frontend/src/components/ui/CategoryBar.tsx:85
- **category**: data-integrity
- **message**: score 값을 0~100으로 제한하지 않아 음수나 100 초과 값이 progressbar와 width에 그대로 반영됩니다.
- **suggestion**: 렌더링 전에 score를 Math.min(100, Math.max(0, item.score))로 정규화하고 aria-valuenow에도 동일한 값을 사용하세요.

### P2-112 — frontend/src/components/ui/chart.tsx:2
- **category**: maintainability
- **message**: 파일 전체에 @ts-nocheck가 적용되어 props와 Recharts payload 타입 오류를 컴파일 단계에서 잡을 수 없습니다.
- **suggestion**: 필요한 위치에 명시적 타입을 선언하고 @ts-nocheck를 제거하세요.

### P2-113 — frontend/src/components/ui/chart.tsx:188
- **category**: correctness
- **message**: item.payload.fill에 직접 접근해 payload가 없는 tooltip 항목에서 런타임 오류가 발생할 수 있습니다.
- **suggestion**: item.payload?.fill처럼 optional chaining을 사용하고 color 폴백 순서를 안전하게 처리하세요.

### P2-114 — frontend/src/components/ui/chart.tsx:238
- **category**: correctness
- **message**: item.value가 0이면 falsy로 처리되어 툴팁에 값이 표시되지 않습니다.
- **suggestion**: item.value !== undefined && item.value !== null 조건으로 0도 렌더링되게 하세요.

### P2-115 — frontend/src/components/ui/chart.tsx:287
- **category**: correctness
- **message**: legend item의 key로 item.value만 사용해 동일 값이 여러 개일 때 React key 충돌이 발생할 수 있습니다.
- **suggestion**: item.dataKey, item.value, index를 조합한 안정적인 고유 key를 사용하세요.

### P2-116 — frontend/src/components/ui/form.tsx:28
- **category**: correctness
- **message**: FormFieldContext 기본값이 빈 객체라 useFormField의 컨텍스트 누락 검사가 항상 실패하지 않습니다. FormField 밖에서 사용하면 name이 undefined인 상태로 useFormState/getFieldState가 호출됩니다.
- **suggestion**: FormFieldContext 기본값을 null로 두고 useFormContext/useFormState 호출 전에 null 여부를 검사해 명확한 에러를 발생시키세요.

### P2-117 — frontend/src/components/ui/form.tsx:72
- **category**: correctness
- **message**: FormItemContext도 빈 객체를 기본값으로 사용해 FormItem 없이 FormLabel/FormControl을 렌더링하면 id가 undefined-form-item으로 생성되어 라벨 연결과 aria 속성이 깨질 수 있습니다.
- **suggestion**: FormItemContext를 null 가능 타입으로 만들고 useFormField에서 FormItem 누락을 별도로 검사하세요.

### P2-118 — frontend/src/components/ui/DifficultyBadge.tsx:62
- **category**: correctness
- **message**: PROGRAMMERS 레벨이 매핑 테이블에 없으면 실제 level 값을 무시하고 Lv.0으로 표시해 난이도 정보가 잘못 노출될 수 있습니다.
- **suggestion**: level 범위를 검증하고, 미지원 레벨은 중립 스타일의 `Lv.${level}`로 표시하거나 명시적으로 렌더링을 생략하세요.

### P2-119 — frontend/src/components/ui/dialog.tsx:60
- **category**: correctness
- **message**: DialogContent에 max-height와 overflow-y 처리가 없어 긴 콘텐츠가 뷰포트 밖으로 밀려 일부 내용을 볼 수 없을 수 있습니다.
- **suggestion**: 콘텐츠 컨테이너에 `max-h-[calc(100vh-2rem)] overflow-y-auto` 같은 제한과 스크롤 처리를 추가하세요.

### P2-120 — frontend/src/components/ui/drawer.tsx:60
- **category**: correctness
- **message**: 상하 방향 DrawerContent는 max-h만 있고 overflow-y 처리가 없어 내용이 길면 드로어 영역 밖으로 넘치거나 접근하기 어려울 수 있습니다.
- **suggestion**: DrawerContent 또는 내부 본문 영역에 `overflow-y-auto`를 적용해 긴 콘텐츠를 스크롤 가능하게 만드세요.

### P2-121 — frontend/src/components/ui/Input.tsx:27
- **category**: correctness
- **message**: id가 없을 때 label 문자열로 DOM id를 생성해 같은 label을 가진 입력이 여러 개 렌더링되면 중복 id가 발생하고, label도 없으면 error/hint id가 undefined 기반으로 생성될 수 있습니다.
- **suggestion**: React.useId()를 기본 id로 사용하고, 전달된 id가 있으면 우선 사용하도록 변경하세요.

### P2-122 — frontend/src/components/ui/Logo.tsx:25
- **category**: correctness
- **message**: SVG gradient id가 size만으로 결정되어 같은 크기의 Logo를 서로 다른 색상으로 여러 개 렌더링하면 문서 전역 id 충돌로 잘못된 gradient가 적용될 수 있습니다.
- **suggestion**: React.useId()로 인스턴스별 고유 gradient id를 생성하거나 외부에서 id suffix를 주입받도록 변경하세요.

### P2-123 — frontend/src/components/ui/NotificationToast.tsx:96
- **category**: correctness
- **message**: setToast updater 내부에서 onRead 호출과 타이머 등록 같은 부수효과를 실행합니다. React가 updater를 재실행하면 읽음 처리나 닫기/이동이 중복 실행될 수 있습니다.
- **suggestion**: 이전 toast 값을 먼저 캡처한 뒤 setState는 상태 변경만 수행하고, onRead 및 타이머/라우팅은 updater 밖에서 실행하세요.

### P2-124 — frontend/src/components/ui/NotificationToast.tsx:83
- **category**: correctness
- **message**: 자동 닫기 내부 setTimeout과 클릭/닫기 setTimeout을 정리하지 않아 언마운트 후 setState, onDismiss, router.push가 늦게 실행될 수 있습니다.
- **suggestion**: 모든 timeout id를 ref에 저장하고 effect cleanup 및 언마운트 시 clearTimeout으로 정리하세요.

### P2-125 — frontend/src/components/ui/NotificationToast.tsx:128
- **category**: correctness
- **message**: role="button" 컨테이너 안에 실제 button을 중첩해 인터랙티브 요소 중첩 구조가 됩니다. 보조기기와 키보드 이벤트 처리에서 오작동할 수 있습니다.
- **suggestion**: 토스트 본문 클릭 영역과 닫기 버튼을 형제 인터랙티브 요소로 분리하거나 컨테이너를 button이 아닌 레이아웃 요소로 유지하세요.

### P2-126 — frontend/src/components/ui/NotificationToast.tsx:132
- **category**: correctness
- **message**: 커스텀 role="button"이 Enter만 처리하고 Space 키를 처리하지 않아 표준 버튼 키보드 동작과 다릅니다.
- **suggestion**: Space 키도 활성화하도록 처리하거나 실제 button 요소를 사용하세요.

### P2-127 — frontend/src/components/ui/progress.tsx:25
- **category**: data-integrity
- **message**: value 범위를 0~100으로 보정하지 않아 음수나 100 초과 값에서 진행 막대가 역방향/초과 렌더링될 수 있습니다.
- **suggestion**: const safeValue = Math.min(100, Math.max(0, value ?? 0))처럼 보정한 값을 렌더링과 Radix Root에 사용하세요.

### P2-128 — frontend/src/components/ui/ScoreGauge.tsx:44
- **category**: data-integrity
- **message**: score를 0~100으로 보정하지 않아 범위 밖 값에서 SVG dash offset과 aria-valuenow가 잘못된 진행률을 표시합니다.
- **suggestion**: score를 계산 전에 0~100으로 clamp하고 표시값, 색상, 라벨, aria-valuenow에 동일한 보정값을 사용하세요.

### P2-129 — frontend/src/components/ui/ScoreGauge.tsx:42
- **category**: correctness
- **message**: size가 strokeWidth 이하로 전달되면 radius가 0 이하가 되어 SVG circle이 유효하게 렌더링되지 않을 수 있습니다.
- **suggestion**: size의 최소값을 strokeWidth보다 크게 제한하거나 잘못된 size 입력에 대한 fallback 값을 적용하세요.

### P2-130 — frontend/src/components/ui/ScoreGauge.tsx:56
- **category**: correctness
- **message**: label prop으로 화면 라벨을 바꿔도 aria-label은 기본 getLabel(score)를 사용해 시각 정보와 접근성 이름이 불일치합니다.
- **suggestion**: aria-label에서도 label ?? getLabel(score)를 사용해 화면 라벨과 동일한 의미를 제공하세요.

### P2-131 — frontend/src/components/ui/slider.tsx:22
- **category**: correctness
- **message**: value/defaultValue가 없을 때 [min, max]로 두 개의 Thumb을 렌더링해 단일 값 슬라이더가 의도치 않게 범위 슬라이더처럼 동작할 수 있습니다.
- **suggestion**: 기본값은 [min]으로 두거나, 범위 슬라이더가 필요할 때만 명시적으로 두 값의 defaultValue/value를 전달하도록 분리하세요.

### P2-132 — frontend/src/components/ui/Skeleton.tsx:17
- **category**: correctness
- **message**: SkeletonBlock이 className과 style만 받고 나머지 HTML 속성을 버려 Skeleton에서 전달한 aria-busy, aria-label 및 외부 props가 실제 DOM에 적용되지 않습니다.
- **suggestion**: SkeletonBlock이 React.HTMLAttributes<HTMLDivElement>를 받도록 하고 ...props를 div에 spread하세요. aria-hidden도 로딩 상태를 알리는 경우에는 강제하지 마세요.

### P2-133 — frontend/src/components/ui/Skeleton.tsx:54
- **category**: correctness
- **message**: variant='text'이고 lines > 1일 때 width/height/style로 계산한 baseStyle이 사용되지 않아 호출자가 지정한 크기가 무시됩니다.
- **suggestion**: 멀티라인 분기에서도 baseStyle을 컨테이너나 각 SkeletonBlock에 병합하고, 마지막 줄 너비만 필요한 경우 호출자 width와 충돌하지 않게 처리하세요.

### P2-134 — frontend/src/components/ui/Skeleton.tsx:89
- **category**: performance
- **message**: rows 값을 검증하지 않고 Array.from length로 사용해 음수/무한대/과도한 값에서 RangeError 또는 대량 렌더링이 발생할 수 있습니다.
- **suggestion**: rows를 0 이상의 합리적인 최대값으로 clamp한 뒤 배열 생성에 사용하세요.

### P2-135 — frontend/src/components/ui/sidebar.tsx:286
- **category**: correctness
- **message**: SidebarRail, SidebarGroupAction, SidebarMenuButton, SidebarMenuAction의 기본 button에 type이 없어 form 내부에서 클릭 시 submit이 발생할 수 있습니다.
- **suggestion**: asChild가 false인 경우 기본 type='button'을 설정하고, submit이 필요한 호출자는 명시적으로 type을 넘기게 하세요.

### P2-136 — frontend/src/components/ui/tooltip.tsx:25
- **category**: correctness
- **message**: Tooltip 컴포넌트가 매번 새 TooltipProvider를 생성해 상위 TooltipProvider의 delayDuration/skipDelayDuration 같은 전역 설정을 덮어쓸 수 있습니다.
- **suggestion**: Tooltip은 TooltipPrimitive.Root만 렌더링하고, Provider는 앱 루트 또는 호출부에서 한 번 감싸도록 분리하세요.

### P2-137 — frontend/src/components/ui/tabs.tsx:29
- **category**: convention
- **message**: TabsList 클래스에 inline-flex와 flex가 함께 선언되어 뒤쪽 flex가 앞쪽 inline-flex를 덮어씁니다.
- **suggestion**: 의도한 display 값 하나만 남기세요. 인라인 크기 동작이 필요하면 flex를 제거하고 inline-flex만 유지하세요.

### P2-138 — frontend/src/components/ui/StatusBadge.tsx:33
- **category**: correctness
- **message**: 모든 StatusBadge에 role="status"를 부여해 정적 목록 렌더링이나 재렌더링 시 스크린 리더가 불필요하게 라이브 영역으로 읽을 수 있습니다.
- **suggestion**: 동적으로 변경되어 공지가 필요한 상태에만 role="status"를 선택적으로 적용하거나, 기본값은 일반 span으로 두세요.

### P2-139 — frontend/src/hooks/useAiQuota.ts:45
- **category**: correctness
- **message**: catch에서 unknown 값을 Error로 단언해 null 같은 비Error throw 값이 들어오면 .message 접근 중 다시 예외가 발생합니다.
- **suggestion**: err instanceof Error 조건으로 메시지를 읽고, 그 외 값은 기본 오류 메시지로 처리하세요.

### P2-140 — frontend/src/hooks/useAnimVal.ts:45
- **category**: correctness
- **message**: duration이 음수이면 progress가 1에 도달하지 않아 requestAnimationFrame 루프가 끝나지 않을 수 있습니다.
- **suggestion**: duration을 0보다 큰 값으로 정규화하거나, 유효하지 않은 duration은 즉시 target 값으로 설정하세요.

### P2-141 — frontend/src/hooks/useAutoSave.ts:87
- **category**: correctness
- **message**: saveToLocal이 onSaveFailed를 사용하지만 의존성 배열에 포함하지 않아 prop 변경 후에도 오래된 실패 콜백을 호출합니다.
- **suggestion**: useCallback 의존성에 onSaveFailed를 추가하세요.

### P2-142 — frontend/src/hooks/useAutoSave.ts:95
- **category**: data-integrity
- **message**: localStorage에서 읽은 JSON을 검증 없이 AutoSaveData로 캐스팅해 손상된 값이나 구버전 스키마가 복원될 수 있습니다.
- **suggestion**: JSON.parse 결과의 code, language, savedAt 타입과 savedAt 날짜 유효성을 확인한 뒤 유효한 경우에만 반환하세요.

### P2-143 — frontend/src/hooks/useBojSearch.ts:46
- **category**: correctness
- **message**: 문제 번호를 Number.isInteger로만 검증해 MAX_SAFE_INTEGER를 넘는 값이 정밀도 손실된 상태로 API에 전달될 수 있습니다.
- **suggestion**: Number.isSafeInteger(id)와 서비스가 허용하는 최대 문제 번호 범위를 함께 검증하세요.

### P2-144 — frontend/src/hooks/useProgrammersSearch.ts:56
- **category**: correctness
- **message**: 동시에 여러 검색 요청이 발생하면 늦게 끝난 이전 요청이 최신 검색 결과와 폼 값을 덮어쓸 수 있습니다.
- **suggestion**: 요청 시퀀스 ref 또는 AbortController를 사용해 최신 요청의 응답만 상태에 반영하세요.

### P2-145 — frontend/src/hooks/useSubmissionSSE.ts:109
- **category**: performance
- **message**: SSE 이벤트를 제한 없이 배열에 누적해 장시간 연결 또는 재전송이 많은 경우 메모리 사용량이 계속 증가합니다.
- **suggestion**: UI에 필요한 최근 N개 이벤트만 보관하거나 터미널 상태 이후 이벤트 저장을 중단하세요.

### P2-146 — frontend/src/hooks/useSessionKeepAlive.ts:94
- **category**: performance
- **message**: heartbeat 요청이 아직 끝나지 않았는데 다음 interval이 실행되면 중복 요청이 병렬로 쌓일 수 있습니다.
- **suggestion**: inFlight ref를 두어 진행 중인 heartbeat가 있으면 새 요청을 건너뛰고, cleanup 시 필요한 경우 AbortController로 취소하세요.

### P2-147 — frontend/src/lib/api/client.ts:80
- **category**: correctness
- **message**: options.headers를 Record로 단순 캐스팅해 전개하므로 Headers 인스턴스나 [key,value] 배열이 전달되면 기존 헤더가 누락될 수 있다.
- **suggestion**: new Headers(options.headers)로 정규화한 뒤 기본 Content-Type과 X-Study-ID를 set/append하는 방식으로 병합하라.

### P2-148 — frontend/src/lib/api/client.ts:79
- **category**: correctness
- **message**: 모든 요청에 Content-Type: application/json을 강제로 넣어 FormData 업로드나 본문 없는 GET 요청의 CORS 동작을 깨뜨릴 수 있다.
- **suggestion**: body가 JSON 문자열일 때만 Content-Type을 설정하고, FormData나 헤더가 이미 지정된 경우에는 브라우저/호출자가 설정하도록 두라.

### P2-149 — frontend/src/lib/api/client.ts:74
- **category**: maintainability
- **message**: fetchApi 함수가 헤더 병합, 스터디 검증, 네트워크 호출, 에러 처리, 리다이렉트, 응답 언래핑을 모두 처리해 20라인을 크게 넘는다.
- **suggestion**: 헤더 생성, 에러 변환, 응답 파싱을 작은 헬퍼로 분리해 책임을 나누고 테스트 단위를 좁혀라.

### P2-150 — frontend/src/lib/api/external.ts:45
- **category**: data-integrity
- **message**: page 값을 검증하지 않고 쿼리 문자열에 직접 삽입해 0, 음수, NaN, 비정상 큰 값이 API로 전달될 수 있다.
- **suggestion**: Number.isSafeInteger와 하한/상한 검사를 적용하고 URLSearchParams로 query와 page를 함께 생성하라.

### P2-151 — frontend/src/lib/api/external.ts:84
- **category**: data-integrity
- **message**: page 값을 검증하지 않고 쿼리 문자열에 직접 삽입해 0, 음수, NaN, 비정상 큰 값이 API로 전달될 수 있다.
- **suggestion**: Number.isSafeInteger와 하한/상한 검사를 적용하고 URLSearchParams로 query와 page를 함께 생성하라.

### P2-152 — frontend/src/lib/api/feedback.ts:61
- **category**: performance
- **message**: 관리자 피드백 목록 limit에 상한이 없어 호출자가 매우 큰 페이지 크기를 요청할 수 있다.
- **suggestion**: 클라이언트에서 허용 범위로 clamp하고 서버에서도 최대 limit을 강제하라.

### P2-153 — frontend/src/lib/api/feedback.ts:70
- **category**: correctness
- **message**: publicId를 경로 세그먼트에 인코딩 없이 삽입해 슬래시나 특수 문자가 포함되면 다른 경로로 해석될 수 있다.
- **suggestion**: 경로 파라미터는 encodeURIComponent(publicId)로 인코딩한 뒤 URL에 삽입하라.

### P2-154 — frontend/src/lib/api/feedback.ts:73
- **category**: correctness
- **message**: publicId를 경로 세그먼트에 인코딩 없이 삽입해 슬래시나 특수 문자가 포함되면 다른 경로로 해석될 수 있다.
- **suggestion**: 경로 파라미터는 encodeURIComponent(publicId)로 인코딩한 뒤 URL에 삽입하라.

### P2-155 — frontend/src/lib/api/notification.ts:39
- **category**: correctness
- **message**: 알림 id를 경로 세그먼트에 인코딩 없이 삽입해 특수 문자가 포함된 id에서 잘못된 엔드포인트를 호출할 수 있다.
- **suggestion**: fetchApi 호출 전에 encodeURIComponent(id)를 적용하라.

### P2-156 — frontend/src/lib/api/public.ts:37
- **category**: security
- **message**: 공유 토큰, submissionId, slug를 경로에 직접 삽입해 '/'나 '?'가 포함된 값이 다른 엔드포인트/쿼리로 해석될 수 있습니다.
- **suggestion**: 모든 경로 파라미터에 encodeURIComponent를 적용한 뒤 URL을 조립하세요.

### P2-157 — frontend/src/lib/api/problem.ts:16
- **category**: correctness
- **message**: problem id를 경로에 직접 삽입해 특수 문자가 포함되면 조회/수정/삭제 요청 경로가 깨질 수 있습니다.
- **suggestion**: findById, update, delete에서 id를 encodeURIComponent(id)로 인코딩하세요.

### P2-158 — frontend/src/lib/api/review.ts:44
- **category**: correctness
- **message**: 댓글 public id를 경로에 직접 삽입해 특수 문자가 포함되면 수정/삭제 요청이 잘못된 경로로 전송될 수 있습니다.
- **suggestion**: updateComment와 deleteComment의 id 경로 세그먼트를 encodeURIComponent로 감싸세요.

### P2-159 — frontend/src/lib/api/study.ts:57
- **category**: correctness
- **message**: studyId, userId, linkId를 경로에 직접 삽입해 특수 문자가 포함되면 스터디/멤버/공유 링크 API 요청 경로가 깨질 수 있습니다.
- **suggestion**: 동적 경로 세그먼트마다 encodeURIComponent를 적용하는 헬퍼를 사용하세요.

### P2-160 — frontend/src/lib/api/submission.ts:16
- **category**: correctness
- **message**: submissionId와 problemId를 경로에 직접 삽입해 특수 문자가 포함되면 제출/분석/드래프트 API 요청 경로가 잘못될 수 있습니다.
- **suggestion**: findById, listByProblemForStudy, getAnalysis, satisfaction, draft find/remove 경로의 id 값을 encodeURIComponent로 인코딩하세요.

### P2-161 — frontend/src/lib/api/types.ts:36
- **category**: correctness
- **message**: UpdateProblemData에 Problem/CreateProblemData에는 있는 level과 tags가 없어 문제 수정 시 메타데이터 갱신을 타입 수준에서 막습니다.
- **suggestion**: 백엔드 수정 API가 지원한다면 level?: number | null 및 tags?: string[] 필드를 추가하고 수정 화면 저장 로직과 맞추세요.

### P2-162 — frontend/src/lib/auth.ts:35
- **category**: correctness
- **message**: localStorage 접근이 try/catch 없이 수행되어 저장소가 차단된 브라우저 환경에서 인증 상태 처리나 로그아웃 흐름이 예외로 중단될 수 있습니다.
- **suggestion**: localStorage get/set/remove를 안전한 헬퍼로 감싸고 SecurityError 발생 시 기본값을 반환하도록 처리하세요.

### P2-163 — frontend/src/lib/avatars.ts:51
- **category**: correctness
- **message**: presetKey를 검증하지 않고 이미지 경로로 변환해 잘못된 DB 값이나 조작된 값이 깨진 이미지 또는 의도하지 않은 경로 요청을 만들 수 있습니다.
- **suggestion**: AVATAR_PRESETS와 STUDY_AVATAR_PRESETS의 허용 키만 반환하고, 알 수 없는 키는 default로 폴백하세요.

## Low (선택적 개선)

### Low-01 — frontend/src/app/problems/[id]/edit/page.tsx:232
- **category**: performance
- **message**: allowedLanguages 비교에 JSON.stringify를 사용해 순서만 다른 동일 집합도 변경으로 판단하고 불필요한 업데이트를 보냅니다.
- **suggestion**: 정렬 후 비교하거나 Set 기반으로 같은 언어 집합인지 비교하세요.

### Low-02 — frontend/src/app/profile/[slug]/page.tsx:93
- **category**: convention
- **message**: 스터디 목록 렌더링에서 배열 index를 key로 사용해 항목 순서 변경 시 React 재사용이 부정확해질 수 있습니다.
- **suggestion**: studyId, shareLink, studyName처럼 안정적인 고유 값을 key로 사용하세요.

### Low-03 — frontend/src/components/ad/AdBanner.tsx:56
- **category**: convention
- **message**: 주석에 깨진 문자열(로��)이 포함되어 코드 가독성이 떨어집니다.
- **suggestion**: 파일 인코딩을 UTF-8로 정리하고 주석을 '광고 로드 실패 감지'처럼 정상 문자열로 수정하세요.

### Low-04 — frontend/src/components/providers/AuthGuard.tsx:27
- **category**: correctness
- **message**: 로그인 리디렉트에 pathname만 저장해 보호 페이지의 query string이 사라집니다.
- **suggestion**: window.location.pathname + window.location.search를 인코딩해 로그인 후 원래 필터, 페이지네이션, 딥링크 상태를 복원하세요.

### Low-05 — frontend/src/components/ui/Logo.tsx:44
- **category**: convention
- **message**: SVG 내부 선과 원 색상에 #fff 하드코딩이 반복되어 디자인 토큰 기반 색상 규칙을 우회합니다.
- **suggestion**: white 계열 디자인 토큰이나 prop 기본값으로 색상을 정의하고 stroke/fill에서 재사용하세요.

