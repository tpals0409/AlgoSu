---
sprint: 118
service: github-worker
audited_at: 2026-04-22
loc_audited: 1611
files_audited: 8
codex_sessions: [019db3b9-4b95-73a1-b2cd-e0853e70b93e]
severity_counts: { P0: 1, P1: 13, P2: 4, Low: 0 }
---

# Audit — github-worker

> 감사 일자: 2026-04-22 | LOC: 1611 | 파일: 8개
> P0: 1 | P1: 13 | P2: 4 | Low: 0

## P0 (머지 차단)

### P0-01 — services/github-worker/src/github-push.service.ts:295
- **category**: security
- **message**: 자동 생성 레포가 private:false로 생성되어 사용자의 제출 코드가 공개 저장소에 노출될 수 있습니다.
- **suggestion**: createForAuthenticatedUser 호출에서 private:true로 변경하고, 기존 공개 레포 처리 정책을 별도로 검증하세요.

## P1 (재검증 필수)

### P1-01 — services/github-worker/src/github-push.service.ts:114
- **category**: correctness
- **message**: 기존 파일 조회 실패를 모두 무시해 401/403/500/429 같은 오류도 파일 없음처럼 처리됩니다.
- **suggestion**: Octokit RequestError의 status를 확인해 404만 무시하고, 나머지 오류는 즉시 throw하거나 429는 Retry-After 기반으로 재시도하세요.

### P1-02 — services/github-worker/src/github-push.service.ts:185
- **category**: correctness
- **message**: Octokit은 429 응답을 성공 응답으로 반환하지 않고 예외로 던지므로 inspectRateLimit의 429 분기가 실제로 동작하지 않을 수 있습니다.
- **suggestion**: GitHub API 호출 catch 블록에서 status===429와 retry-after 헤더를 직접 처리해 GitHubRateLimitError로 변환하세요.

### P1-03 — services/github-worker/src/github-push.service.ts:92
- **category**: data-integrity
- **message**: weekNumber를 파일 경로 세그먼트로 그대로 사용해 슬래시나 제어 문자가 포함되면 의도하지 않은 경로에 파일이 생성될 수 있습니다.
- **suggestion**: weekFolder, platform, problemNumber, title을 모두 동일한 경로 세그먼트 sanitizer로 정규화하고 허용 문자 목록을 적용하세요.

### P1-04 — services/github-worker/src/github-push.service.ts:96
- **category**: data-integrity
- **message**: sourcePlatform과 sourceUrl에서 추출한 problemNumber가 sanitize되지 않아 파일명 규칙을 깨거나 잘못된 경로를 만들 수 있습니다.
- **suggestion**: fileName 조합 전에 platform과 problemNumber에도 sanitizeFileName 또는 더 엄격한 allowlist 검증을 적용하세요.

### P1-05 — services/github-worker/src/worker.ts:144
- **category**: data-integrity
- **message**: MQ 메시지를 JSON.parse 후 타입 단언만 하고 필수 필드 검증을 하지 않아 undefined submissionId/studyId가 내부 API 호출과 멱등성 키에 사용될 수 있습니다.
- **suggestion**: submissionId, studyId, timestamp를 스키마로 검증하고 실패 시 parse_error와 동일하게 DLQ 처리하세요.

### P1-06 — services/github-worker/src/worker.ts:165
- **category**: data-integrity
- **message**: 멱등성 처리가 get 후 처리 완료 뒤 set으로 분리되어 prefetch 동시 처리 시 같은 submissionId 메시지가 중복 push될 수 있습니다.
- **suggestion**: Redis SET key value NX EX로 처리 시작 잠금을 원자적으로 잡고, 실패 시 잠금 해제 또는 상태별 키를 분리하세요.

### P1-07 — services/github-worker/src/token-manager.ts:135
- **category**: performance
- **message**: 주기적 토큰 갱신에서 Redis KEYS를 사용해 키 수가 많아지면 Redis 이벤트 루프를 블로킹할 수 있습니다.
- **suggestion**: SCAN 기반 반복으로 교체하고 배치 크기와 갱신 동시성을 제한하세요.

### P1-08 — services/github-worker/src/logger.ts:24
- **category**: security
- **message**: 운영 여부를 ENV만으로 판단해 NODE_ENV=production만 설정된 배포에서는 debug 로그와 stack trace가 출력될 수 있습니다.
- **suggestion**: ENV와 NODE_ENV를 함께 정규화해 production 판정을 통일하고, 기본값은 보수적으로 info 이상으로 설정하세요.

### P1-09 — services/github-worker/src/status-reporter.ts:46
- **category**: security
- **message**: submissionId를 URL 경로에 인코딩 없이 삽입해 조작된 MQ 메시지가 내부 엔드포인트 경로를 변형할 수 있습니다.
- **suggestion**: submissionId 형식을 검증하고 URL 경로에 넣을 때 encodeURIComponent를 사용하세요.

### P1-10 — services/github-worker/src/worker.ts:236
- **category**: security
- **message**: userId를 내부 API URL 경로에 인코딩 없이 삽입해 잘못된 값이 경로를 변형할 수 있습니다.
- **suggestion**: userId를 UUID 등 기대 형식으로 검증하고 encodeURIComponent로 경로 세그먼트를 구성하세요.

### P1-11 — services/github-worker/src/worker.ts:263
- **category**: security
- **message**: problemId를 내부 API URL 경로에 인코딩 없이 삽입해 슬래시나 쿼리 문자가 포함될 경우 다른 내부 경로로 요청될 수 있습니다.
- **suggestion**: problemId를 검증하고 URL 경로 세그먼트는 encodeURIComponent로 인코딩하세요.

### P1-12 — services/github-worker/src/token-manager.ts:160
- **category**: correctness
- **message**: GITHUB_TOKEN_ENCRYPTION_KEY가 32바이트 hex인지 시작 시 검증하지 않아 복호화 시점에 런타임 오류가 발생합니다.
- **suggestion**: config 로딩 단계에서 hex 형식과 32바이트 길이를 검증해 잘못된 설정이면 즉시 기동 실패 처리하세요.

### P1-13 — services/github-worker/src/status-reporter.ts:58
- **category**: correctness
- **message**: Submission Service 응답 body.data 구조를 검증하지 않아 null 또는 필드 누락 시 이후 처리에서 런타임 오류가 발생할 수 있습니다.
- **suggestion**: 응답 스키마를 검증하고 필수 필드가 없으면 명확한 오류로 실패 처리하세요.

## P2 (비차단)

### P2-01 — services/github-worker/src/metrics.ts:93
- **category**: correctness
- **message**: metrics 서버 listen 오류 핸들러가 없어 포트 충돌 등 서버 오류가 프로세스 비정상 종료로 이어질 수 있습니다.
- **suggestion**: server.on('error')에서 구조화 로그를 남기고 기동 실패 정책에 맞게 명시적으로 처리하세요.

### P2-02 — services/github-worker/src/github-push.service.ts:85
- **category**: maintainability
- **message**: push 함수가 경로 생성, 조회, 재시도, 생성/업데이트를 모두 처리해 20라인을 크게 초과하고 변경 위험이 큽니다.
- **suggestion**: 파일 경로 생성, 기존 SHA 조회, GitHub 오류 변환, 재시도 로직을 작은 private 함수로 분리하세요.

### P2-03 — services/github-worker/src/worker.ts:107
- **category**: maintainability
- **message**: start 함수가 연결 설정, 큐 선언, 메시지 파싱, 처리, ACK/NACK까지 담당해 함수가 과도하게 큽니다.
- **suggestion**: MQ 연결 초기화와 메시지 핸들러를 별도 메서드로 분리해 오류 처리 경계를 명확히 하세요.

### P2-04 — services/github-worker/src/worker.ts:299
- **category**: maintainability
- **message**: processWithRetry 함수가 데이터 조회, 토큰 선택, push 재시도, 상태 보고를 모두 포함해 유지보수가 어렵습니다.
- **suggestion**: 토큰 선택, push 재시도, 상태 전이를 별도 함수로 분리하고 각 단계의 반환 상태를 명확히 정의하세요.

## Low (선택적 개선)

(없음)

