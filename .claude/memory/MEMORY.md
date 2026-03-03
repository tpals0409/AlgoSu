# Claude Memory

## Oracle 역할
- 나는 AlgoSu TF의 **Oracle(심판관)** — 최종 기획 결정자
- 상세 역할: `algosu.md` 참조

## 환경 설정
- 언어: 한국어
- `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: 1` 활성화
- Claude Code settings: `~/.claude/settings.json`
- 구독 플랜: **Claude Max** (확인 완료)

## 프로젝트: AlgoSu
- 루트 경로: `/root/AlgoSu/`
- 기획 문서: `/root/AlgoSu/plan/`
- GitHub: `tpals0409/AlgoSu` (private) — 구 모놀리식은 `tpals0409/AlgoSuProto` (public)
- 상태: **UI v2 전면 교체 + k3d 배포 검증 완료** (2026-03-02, HEAD: 026b469)
- 상세 내용: `algosu-session.md`, `algosu-deploy.md` 참조

## Oracle 권한 정의
- 자율 결정: Agent 간 충돌 중재, ADR 범위 내 기술 판단, 작업 순서 조율
- PM 허락 필요: 아키텍처 v3.1 변경, Phase 순서/범위 변경, 기능 축소/제거, 예산 결정, 보안 사고, 4시간 이상 미해소 블로커

## Oracle 운영 프로토콜 (PM 위임)
- **PM 전용 채널**: Oracle만 PM과 직접 대화. 하위 Agent의 PM 직접 응답 엄격 금지
- **중앙 집중식 통제**: Agent는 Oracle 명시적 승인 없이 자원 접근/독자 작업 불가
- **동적 권한 관리 (JIT)**: 최소 권한 부여 → 작업 종료 즉시 회수
- **전수 모니터링**: 위험 발견 시 즉시 작업 중단 또는 격리 → PM Discord 보고

## Oracle 상시 지시사항 (모든 코드 작업 착수 전 필수)
- **보안 체크 의무화**: JWT(none 금지, 만료 검증), 인가(IDOR 차단), 세션(Redis TTL), Secrets(Sealed Secrets), 입력값(SQL 바인딩)
- **보고 체계**: Agent → Oracle → PM. Oracle만 PM 직접 소통.

## 운영 규칙
- 서브 Agent에 Write/Bash 권한 차단됨 → Oracle이 직접 파일 생성
- Agent 작업 결과물은 Oracle이 취합 후 파일화

## Agent 투입 규칙 (PM 지시, 2026-02-28)
- **TF 외 Agent 투입 절대 금지**: 범용 Task Agent로 코드 작업 불가
- **Skill 기반 지시 필수**: 작업 투입 시 해당 Agent의 skill 로드 후 작업 (페르소나+규칙 적용 보장)
- **메모리 기반 감시**: MEMORY.md + 토픽별 메모리로 작업 이력/컨텍스트 관리, Oracle이 산출물 직접 검증
- **TF 정원 11명**: Sensei, Conductor, Gatekeeper, Herald, Palette, Curator, Architect, Librarian, Postman, Scout, **Scribe(서기관, 신설 2026-03-02)**
- **Scribe 역할**: 메모리/Skill/문서/문맥정리 전담 (Oracle 문서 작업 오프로드)

## Discord ↔ Oracle 양방향 통신 (완성, 2026-02-28)
- 스크립트: `~/.claude/discord-send.sh <type> <content>` (oracle/report/approval/emergency)
- 수신 봇: `~/.claude/discord-receiver.sh` (pm2: `discord-receiver`, 5초 폴링)
- 자동 응답: `~/.claude/oracle-respond.sh` → `env -u CLAUDECODE` + bypassPermissions
- 전송 규칙: content 첫 줄 태그 필수, 토큰/키/PW 포함 절대 금지

## 개발/운영 환경
- **개발 서버**: Mac Mini (k3d 클러스터) — 쿠버네티스 환경 테스트/검증
- **운영 서버**: Oracle Cloud ARM 프리티어 (k3s + ArgoCD) — 안정된 결과물 서빙
- Docker 빌드: `platforms: linux/arm64`, Trivy: `--platform linux/arm64`
- 흐름: Mac Mini(k3d) 검증 → CI/CD → aether-gitops 태그 업데이트 → ArgoCD(OCI) 자동 배포

## k3d 클러스터 현황 (2026-03-02, 026b469)
- 클러스터: `k3d-algosu` (단일 노드, traefik disabled, 포트 80/443)
- 네임스페이스: `algosu`
- **16 Pod Running**: 6 백엔드 + 1 프론트 + 5 인프라(PG/PG-Problem/Redis/RMQ/MinIO) + 4 모니터링
- Sealed Secrets Controller: kube-system (v0.26.2)
- initContainer: `node ./node_modules/typeorm/cli.js migration:run` (npm 제거 호환)
- 모든 /health 엔드포인트 검증 완료

## 인증 정책 (PM 확정, 2026-03-02 갱신)
- **소셜로그인(OAuth) 전용**: Google, Naver, Kakao — 1계정 1OAuth
- **JWT 저장**: httpOnly Cookie (TokenRefreshInterceptor로 서버측 자동 갱신)
- **토큰 구조**: 단일 Access Token (Refresh Token 미사용)
- **동시 로그인**: 제한 없음

## 완료 Sprint 요약

### Phase 1-2 (2026-02-27~28): MSA 기반 구축
- 6 서비스 + 프론트엔드 초기 구현, Saga/SSE/AutoSave/CI/CD 완료
- v1.1+v1.2 전면 적용 (다중 스터디, OAuth, StudyMemberGuard)
- 단위 테스트 122/122 PASS, E2E 20/20 PASS

### Phase 3 Sprint 3-1 (HEAD: 2aa0e8b): Problem DB 분리
- postgres-problem 배포, dual-write expand, reconciliation Cron

### Phase 3 Sprint 3-2 (HEAD: 69f87b5): 기능 완성
- 백엔드 7 + 프론트엔드 8 = 15개 기능 (알림, AI 분석 조회, 페이지네이션, 역할 변경 등)

### UI v2 전면 교체 Sprint UI-1~UI-6 (HEAD: 026b469, 173파일, +14913/-3401)
- **UI-1 Backend Foundation**: publicId UUID 전환, httpOnly Cookie JWT, CORS, GlobalExceptionFilter, CSP, Route Guard, SSE S6 리팩토링
- **UI-2 Backend Features**: 알림 9종 + DeadlineReminder, AI 정책(일일 5회), Claude API 전환(prompt.py), 프로필, 스터디 정책, ReviewComment/Reply API
- **UI-3 Frontend Core**: 디자인 시스템 v2 (47 CSS 변수 듀얼 테마), 공통 컴포넌트 22종, Landing/Login/Dashboard 재작성
- **UI-4 Frontend Pages**: Problems(검색/필터), Submissions(페이지네이션), Study/Profile, Notifications, Error/NotFound
- **UI-5 Code Review**: 2-패널 ReviewPage, StudyNote, CommentThread/Reply, CodePanel
- **UI-6 Integration**: 마이그레이션 12건 idempotent, github-worker 이미지 수정, MinIO 인프라 배포, k3d 16 Pod 전체 검증

## CI/CD 현황 요약
- 파이프라인: `secret-scan → detect → quality → test → build → trivy → aether-gitops 태그 → ArgoCD sync`
- ci.yml: 23개 job
- **GitOps 레포**: `tpals0409/aether-gitops` (private)

## 모니터링 로그 규칙 (확정)
- 규칙 문서: `/root/AlgoSu/docs/monitoring-log-rules.md`
- JSON structured logging 필수, Prometheus: `algosu_{service}_{metric}_{unit}`
- SLO: 가용성 99.5%, 에러율 <5%, P95 <1s

## UX 설계 원칙 (PM 확정)
- **알림 기능**: 토스트 + 네비게이션, NotificationBell 10초 폴링
- **알림 9종**: SUBMISSION_STATUS, AI_COMPLETED, GITHUB_FAILED, ROLE_CHANGED, PROBLEM_CREATED, DEADLINE_REMINDER, MEMBER_JOINED, MEMBER_LEFT, STUDY_CLOSED

## 로컬 테스트 환경 기동법
- `docker compose -f docker-compose.dev.yml up -d` (인프라)
- 각 서비스: `cd services/<name> && npm run build && node dist/src/main.js`
- 포트: Gateway(3000), Frontend(3001), Problem(3002), Submission(3003), Identity(3004)

## k3d 배포 시 발견/수정한 이슈 (7건)
- 상세: `algosu-lessons.md` 참조
- 핵심: Gateway OAuth 환경변수, /health 엔드포인트, Loki WAL, Prometheus 타겟명, Promtail CRI

## 다음 할 일
- **aether-gitops 동기화**: UI v2 변경사항을 GitOps 레포에 반영
- **OCI k3s 배포**: VM 접속 정보 확보 후 k3s 부트스트랩 + ArgoCD sync
- **OAuth 실 연동**: Google/Naver/Kakao Client ID/Secret 설정 후 E2E 검증
- **Grafana SLO 대시보드**: 모니터링 데이터 기반 대시보드 구성
- **테스트 보강**: UI v2 기준 단위 테스트 + E2E 재작성
