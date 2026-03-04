# AlgoSu UI ver2 — 전면 교체 디자인

## 원본 경로
*(원본: Mac `/Users/leokim/Desktop/UI ver2/`, 10개 JSX, 253KB)*

## 파일 목록 & 페이지 매핑

| 파일 | 페이지 | 핵심 기능 | 라인 수 |
|---|---|---|---|
| `algosu-landing.jsx` | 랜딩 | Hero, 핵심기능 3종, AI 프리뷰, CTA, Footer | 241 |
| `algosu-login.jsx` | 로그인 | OAuth 3종 (Google/Naver/Kakao), 약관 동의 | 134 |
| `algosu-logos.jsx` | 로고 시안 | A(코드 브래킷), B(노드 그래프), C(경로 탐색), D(레이어 스택) | 252 |
| `algosu-dashboard.jsx` | 대시보드 | 3개 KPI, 주차별 바 차트, 최근 제출, 마감 임박 | 273 |
| `algosu-problems.jsx` | 문제 | 목록(검색/필터/페이지네이션) + 상세(에디터) + 생성(BOJ 검색) | 583 |
| `algosu-submissions.jsx` | 제출 내역 | 목록(필터/테이블) + AI 분석 결과 (통합 뷰) | 487 |
| `algosu-ai-result.jsx` | AI 분석 (독립) | 점수 게이지, 5개 카테고리 바, AI 총평, 코드 비교(원본/최적화) | 429 |
| `algosu-code-review.jsx` | 피어 리뷰 | 문제 목록 → 멤버 → 2칸 코드 리뷰(라인 댓글/AI 하이라이트/피드백/스터디 노트) | 537 |
| `algosu-notifications.jsx` | 알림 | Toast 컴포넌트(7유형, 프로그레스바, 자동 dismiss) + NotifPanel(드롭다운) | 357 |
| `algosu-study-profile.jsx` | 스터디/프로필 | 3탭(스터디 관리/통계/프로필) — 멤버 관리, 주차별 차트, 난이도 분포, 최근 활동 | 454 |

## 디자인 시스템 (v2)

### 컬러 토큰
| 용도 | Light | Dark |
|---|---|---|
| bg | `#FAFAF8` | `#0F0F12` |
| bgAlt | `#F3F1EE` | `#17171C` |
| bgCard | `#FFFFFF` | `#1C1C22` |
| border | `#E8E5E0` | `#2A2A32` |
| borderHover | `#D0CCC5` | `#3A3A44` |
| text | `#1A1917` | `#EDEDEB` |
| text2 | `#5C5A55` | `#A5A5A0` |
| text3 | `#9C9A95` | `#6C6C68` |
| primary | `#7C6AAE` | `#A08CD6` |
| primaryLight | `#9B8BC8` | `#B9A6E8` |
| primarySoft | `rgba(124,106,174,0.08)` | `rgba(160,140,214,0.10)` |
| primarySoft2 | `rgba(124,106,174,0.15)` | `rgba(160,140,214,0.18)` |
| accent | `#C4A6FF` | `#C4A6FF` |
| success | `#3DAA6D` | `#4EC87A` |
| warning | `#D49A20` / `#E8A830` | `#F0B840` |
| error | `#E05448` | `#F06458` |
| info | `#3B82CE` | `#5B9FE8` |
| muted | `#9C9A95` | `#6C6C68` |
| navBg | `rgba(250,250,248,0.85~0.88)` | `rgba(15,15,18,0.85~0.88)` |
| codeBg | `#F7F5F2` | `#14141A` |
| inputBg | `#F3F1EE` | `#17171C` / `#1C1C22` |

### 난이도 컬러 (solved.ac 기반)
| 레벨 | bg | color | border |
|---|---|---|---|
| 브론즈 | `rgba(173,86,0,.12)` | `#C06800` | `rgba(173,86,0,.25)` |
| 실버 | `rgba(67,95,122,.12)` | `#5A7B99` | `rgba(67,95,122,.25)` |
| 골드 | `rgba(236,144,3,.12)` | `#D48A00` | `rgba(236,144,3,.25)` |
| 플래티넘 | `rgba(39,226,164,.12)` | `#20C490` | `rgba(39,226,164,.25)` |
| 다이아 | `rgba(0,180,252,.12)` | `#00A8E8` | `rgba(0,180,252,.25)` |
| 루비 | `rgba(232,60,60,.12)` | `#E83C3C` | `rgba(232,60,60,.25)` |

### 타이포그래피
- **Heading**: `Sora` (wght 300~700)
- **Body**: `Noto Sans KR` (wght 300~700)
- **Code/Mono**: `JetBrains Mono` (wght 400~500)
- 이전 v1: DM Mono → v2: JetBrains Mono 변경

### 주요 변경점 (v1 → v2)
| 항목 | v1 | v2 |
|---|---|---|
| Primary color | `#947EB0` | `#7C6AAE` (L) / `#A08CD6` (D) |
| Mono font | DM Mono | JetBrains Mono |
| bg (dark) | `#0d0d10` | `#0F0F12` |
| bgCard (dark) | — | `#1C1C22` |
| Shadow | 단일 | shadow + shadowHover 2단계 |
| Nav | 불투명 | Glassmorphism (backdrop-filter: blur(20px) saturate(180%)) |
| 애니메이션 | 없음 | IntersectionObserver + fade/translateY + useAnimVal |
| Logo | 없음 | SVG 노드 그래프 (gradient fill) |
| Toast | 없음 | 7유형, 프로그레스바, 자동 dismiss |
| 코드 리뷰 | 없음 (Sprint 4-1 예정) | 라인별 댓글, AI 하이라이트, 스터디 노트 |
| 스터디 관리 | 기본 | 3탭 (관리/통계/프로필) |
| 문제 생성 | 기본 폼 | BOJ 검색 + 자동 연동 + 요일 선택 |

### UI 패턴
- **Glassmorphism Nav**: `backdrop-filter: blur(20px) saturate(180%)`, 반투명 배경
- **Card**: `border-radius: 14~16px`, `shadow + shadowHover`, hover시 `translateY(-4px)`
- **Badge**: `border-radius: 6px`, `padding: 4px 9px`, `font-size: 11px`
- **Section Label**: uppercase, letter-spacing: 0.8, primarySoft bg, font-size: 11px
- **Fade-in**: IntersectionObserver 기반, `translateY(16~28px)` + `opacity 0→1`
- **Bar Chart**: CSS width transition, `cubic-bezier(.16,1,.3,1)`, staggered delay
- **Score Gauge**: SVG `conic-gradient` / `stroke-dashoffset` 원형 게이지

### 공통 컴포넌트 (추출 대상)
- `Logo` — SVG 노드 그래프 (size, primary, accent props)
- `DiffBadge` — 난이도 뱃지
- `TimerBadge` — 마감 타이머 (normal/warning/critical/expired)
- `StatusBadge` — 상태 뱃지 (진행 중/종료/분석 완료/분석 중)
- `ScoreBadge` — AI 점수 뱃지 (90+: green, 70+: yellow, <70: red)
- `LangBadge` — 언어 뱃지 (mono font)
- `ScoreGauge` — SVG 원형 점수 게이지 (애니메이션)
- `CategoryBar` — AI 카테고리별 점수 바 (클릭 시 코드 하이라이트)
- `Toast` — 7유형 토스트 알림 (auto-dismiss, progress bar)
- `NotifPanel` — 알림 드롭다운 패널
- `BackBtn` — 뒤로가기 버튼
- `useAnimVal` — IntersectionObserver 기반 숫자 애니메이션 hook
- `useInView` — 뷰포트 진입 감지 hook

### OAuth 로그인 버튼 스타일
| Provider | bg (Light) | bg (Dark) | color |
|---|---|---|---|
| Google | `#FFFFFF` | `#1C1C22` | `#333` / `#EDEDEB` |
| Naver | `#03C75A` | `#03C75A` | `#fff` |
| Kakao | `#FEE500` | `#FEE500` | `#191919` |

### PM 결정 사항 (전체 확정, 2026-03-02)
- [x] 로고: **B (노드 그래프)** — 4개 노드 + 엣지 + 대각선, gradient fill
- [x] 적용 범위: **컴포넌트 리빌드** — v2 목업 기준 구조까지 새로 설계
- [x] 피어 리뷰: **풀스택 구현 + k3d 배포** — 백엔드(review 테이블 + API) 포함
- [x] 작업 순서: **백엔드 먼저 → 프론트 수정 → 프론트-백엔드 매칭** (하위 호환성 유지 핵심)
- [x] 테마 기본값: **시스템 설정 따름** (`prefers-color-scheme`)
- [x] 랜딩 페이지: **적용** — 비로그인 시 랜딩 노출, 로그인 시 대시보드
- [x] 폰트 로딩: **next/font** (빌드 타임 최적화)
- [x] 로고 페이지(`algosu-logos.jsx`): **제외** — 프로덕션 미포함

### PM 결정 사항 — 네비게이션 & 시나리오 (2026-03-02)
- [x] 네비게이션: **대시보드 중심 허브** — Nav에 페이지 탭 없음, 대시보드에서 모든 페이지 진입
- [x] 아바타 드롭다운: **프로필 / 스터디 관리 / 로그아웃**
- [x] AI 결과 페이지: **통합 뷰만 사용** — submissions 내장, 독립 페이지(`algosu-ai-result.jsx`) 미사용
- [x] 코드 리뷰 진입: **대시보드에 독립 카드 섹션 추가**
- [x] 스터디룸 전환 페이지: **코드리뷰 최초 진입 시 1회** 표시
  - 메인 멘트: "스터디룸으로 이동하고 있습니다"
  - Logo B 노드 연결 애니메이션 + 문제 정보 카드 + 프로그레스바
  - 서브 멘트 랜덤 로테이션 (8종):
    - 동기부여: "좋은 코드는 함께 읽을 때 더 빛납니다" / "오늘의 리뷰가 내일의 실력이 됩니다" / "서로의 풀이에서 새로운 관점을 발견하세요"
    - 팁: "라인을 클릭하면 댓글을 남길 수 있어요" / "AI가 찾은 본받을 점도 확인해 보세요" / "스터디 노트에 오늘 배운 점을 기록해 보세요"
    - 유대감: "팀원들이 기다리고 있어요" / "함께 성장하는 시간입니다"
  - 1~1.5초 노출, 실제 데이터 로딩과 겸용
- [x] 스터디룸 포커스 모드: Nav 사라짐 → 전용 미니 헤더 ([← 나가기] [문제명] [난이도·주차] [멤버수] [타이머])
- [x] 스터디룸 나가기: **대시보드로 복귀**
- [x] 스터디룸 내 알림: **토스트만 유지**, 벨 아이콘 숨김
- [x] 스터디룸 카드 (대시보드): **풀폭**, 하단 배치
  - 그라데이션 상단 바 + 멤버 아바타 행 + 리뷰 가능 문제 목록 + "스터디룸 입장하기 →" 버튼
  - 리뷰 가능 문제 없을 때: 비활성 카드 + 다음 마감 예정 시간 안내
  - 서브 멘트 없음 (전환 페이지와 중복 방지)
- [x] 대시보드 "마감 임박" → **"이번주 문제"로 변경**
  - 미제출 문제 상단, 제출 완료 문제 하단 (opacity 낮춤 + success "제출완료" 뱃지)
- [x] 최근 제출 클릭: **제출 내역 페이지** 이동 (분석 완료 시 AI 결과 바로 열림)
- [x] 이번주 문제 클릭: **문제 상세(에디터)** 직행
- [x] 모바일 대시보드 순서: KPI → 이번주 문제 → 차트 → 최근 제출 → 스터디룸
- [x] 모바일 코드리뷰: **탭 전환** ('코드' / '리뷰' 탭, 각각 풀 화면)
- [x] 스터디 셀렉터: **드롭다운으로 스터디 전환** → 대시보드 갱신
- [x] 시간 뱃지 규칙:
  - `< 1h`: `M분` (예: `45분`) — critical (error + pulse 애니메이션)
  - `1h~24h`: `H시간 M분` (예: `2시간 15분`) — warning
  - `≥ 1d`: `Nd` (예: `5d`) — normal (text2)
  - 마감됨: `마감` — muted + 취소선
- [x] GitHub 연동 규칙:
  - 유도 시점: **대시보드 온보딩 배너**(dismiss 가능) + **제출 시점 C1 가드**(hard block)
  - 레포 방식: **개인 레포** — 사용자 본인 GitHub 계정에 생성 (팀 레포 X, 초대 불필요)
  - 다중 스터디: **스터디별 레포 분리** (`algosu-스터디A`, `algosu-스터디B`)
  - 공개 설정: **Public 기본** (포트폴리오 활용, 사용자가 Private 변경 가능)
  - 탈퇴/종료: **레포 유지 + 동기화만 중단** (기존 커밋 보존, 삭제는 사용자 직접)
  - 재가입: **기존 레포 재연결** (레포 존재 시 자동 감지 → 동기화 재개, 없으면 새 생성)
  - 연동 모달 선택지:
    - "새로 시작해요" → 개인 레포 자동 생성 (`algosu-{스터디명}`)
    - "기존 스터디에서 넘어왔어요" → 개인 레포 자동 생성(동일) + 문제별 "기존 풀이 업로드" UI 활성화
  - 기존 풀이 업로드: 문제 생성 포맷(BOJ 번호 검색 → 자동 연동) 참고하여 매칭
  - 기존 레포 자동 분석/마이그레이션 없음 (사용자 직접 매칭)
  - 프로필 설정에서 언제든 연동/변경/해제 가능
  - 해제 시: 이후 제출만 동기화 중단, 기존 커밋 유지, C1 가드 재활성화
  - 동기화 실패: error 토스트 + 알림패널 기록 + "재시도" 액션. 제출 자체는 성공 유지
  - 커밋 메시지: `[AlgoSu] BOJ {번호} {문제명} ({언어})` — body에 난이도·주차·스터디명
  - 폴더 구조: `BOJ/{번호}_{문제명}/solution.{ext}`
  - 재제출: **덮어쓰기** (git history로 버전 보존)
  - README 자동 생성: **2단계** — 루트 README(개인 풀이 통계) + 문제별 README(문제 정보)
  - 루트 README 갱신: **제출마다 자동 업데이트** (코드 커밋과 함께 1회 커밋)
  - AI 분석 결과: **레포 미저장** — 웹 UI에서만 확인
  - 플랫폼: **BOJ 전용** (향후 확장은 나중에 결정)
  - 지원 언어 7개: Python(`.py`), Java(`.java`), C++(`.cpp`), C(`.c`), JavaScript(`.js`), Kotlin(`.kt`), Swift(`.swift`)

### 코드 규칙 (v2 추가, PM 확정)
- **클린 코드 기반**: 의미 있는 네이밍, 함수 단일 책임, 작은 함수(20줄 이내), DRY, 에러 핸들링 분리, 일관된 추상화 수준
- **SOLID 원칙 적용**: SRP, OCP, LSP, ISP, DIP
- **Prometheus + Loki 통합 규칙**: `.claude/commands/algosu-monitor.md`
  - Prometheus: `snake_case`, 단위 접미사 필수(`_seconds`, `_bytes`, `_total`), 카디널리티 ≤100, Summary 금지→Histogram
  - Loki: JSON 구조화 로깅 필수, 데이터는 extra 필드 분리, 고유값 라벨 금지→본문 JSON
  - 공통: user_id/request_id 라벨 금지, 민감정보 마스킹, trace_id로 메트릭↔로그 연동
  - 메트릭 정의: 모듈 상단(전역), 비즈니스 메트릭은 서비스 레이어
  - 로그 레벨: DEBUG(개발만)/INFO(비즈니스)/WARN(잠재 문제)/ERROR(실패)/FATAL(서비스 불가)
- **주석 필수** + 어노테이션 체계:
  - **사전 문서**: `.claude/commands/algosu-annotate.md` (상시 갱신)
  - 파일 헤더 필수: `@file`, `@domain`, `@layer`, `@related`
  - 함수/컴포넌트 JSDoc 필수: `@domain`, `@param`, `@returns`
  - 태그 7종: `@domain`(도메인), `@layer`(계층), `@related`(연관 참조), `@event`(이벤트 핸들러), `@guard`(접근 제어), `@api`(엔드포인트), `@todo(Agent)`(미완료)
  - 섹션 구분자: `// ─── HOOKS/HANDLERS/RENDER ───`
  - domain 값: submission, problem, review, study, identity, github, ai, dashboard, notification, common
  - layer 값: page, component, hook, context, api, controller, service, repository, entity, dto, guard, middleware, migration, config, util, test
  - 새 태그/이벤트/가드 추가 시 사전 문서 먼저 갱신 후 코드 적용

### 작업 진행 가이드 (PM 확정)
- **작업 흐름**: 수령(TaskGet) → 착수(in_progress) → 구현(규칙 준수) → 자체 검증 → Oracle 보고 → 검증 후 completed
- **Oracle 현황 표시 규칙**:
  - Sprint 현황판: 진행률 바 + 완료/진행/대기/블로커 4분류
  - Agent 상태: 이모지 + 작업ID + 진행률%
  - 단건 보고: 작업ID + 담당 + 변경파일(줄수) + 검증결과
  - 블로커 알림: 작업 + 원인 + 영향 범위 + 조치 즉시 표시
  - 표시 시점: Sprint 착수, Agent 완료, 블로커 발생, PM 요청, Sprint 종료
- **PM 보고 규칙** (Discord MD):
  - 채널: `report`(작업완료/현황) / `approval`(판단요청) / `emergency`(블로커/보안) / `oracle`(일반)
  - 포맷: 테이블 금지→목록, 2000자 이내(초과 시 분할), `##` 헤더 + `**bold**` + `` `code` ``
  - 톤: 결론 먼저, 선택지+추천, 30초 내 파악 가능
  - 미보고: Agent 내부 조율, P3 자체 해소, 기술 세부사항, 재시도 성공
- **Agent 기억 저장**: `memory/agent/{agent명}.md` — Oracle만 작성, Agent 자체 수정 금지
  - 저장: 작업 이력, 발견 패턴/교훈, 전문 영역 기술 결정
  - 비저장: 코드 상세, 일시 에러, 조율 대화
- **Skill 업데이트**: Oracle만 수정 권한. 트리거: PM 결정/규칙 변경/Sprint 종료/문서 갱신
  - 현재 미반영: 클린코드+SOLID, 어노테이션, Prometheus+Loki, UI v2 결정, 작업가이드
- **페르소나 프롬프트 최적화 규칙**:
  - 7섹션 구조 표준: 공통규칙/역할/규칙참조/Sprint컨텍스트/주의사항/기술스택/$ARGUMENTS
  - 100줄 상한, 구현 현황 미포함(→agent기억), 규칙 본문 복붙 금지(→경로참조)
  - 공통 섹션: `~/.claude/commands/algosu-common.md` (1파일로 전 Agent 반영)
  - 모델 기준: Tier1+복잡판단=Opus, 나머지=Sonnet
  - 갱신 담당: **Scribe** (Oracle 지시), Sprint 전환 시 컨텍스트 일괄 교체
- **Scribe(서기관) 신설**: Tier 2, Sonnet — 메모리/Skill/문서/문맥정리 전담, TF 11명
- **문맥 제거**: Sprint 종료 시 전수 점검
  - MEMORY.md 200줄 이내 유지 (완료 Sprint → 토픽 파일 이동)
  - session.md: 현행+직전만 상세, 2 Sprint 이전 삭제
  - Agent 기록: 10KB 상한, 2 Sprint 이전 요약만
  - Skill: 폐기 지시 삭제 (주석처리 금지)
  - archive/: 3 Sprint 경과 시 삭제
- **상세 문서**: `.claude/commands/algosu-common.md`

### 시나리오 결정 사항 (PM 확정, 2026-03-02)

#### 1. 문제 생성/관리
- 등록 권한: **ADMIN만** (MEMBER는 풀이만)
- 마감 설정: **요일 선택 + 23:59 고정** (시간 선택 없음)
- 마감 변경: **ADMIN 가능** (변경 시 알림 발송)
- 문제 삭제: **제출 0건일 때만** 가능
- 주차별 문제 수: **제한 없음**

#### 2. 알림 세부 규칙
- 9개 이벤트 매핑 확정 (SUBMISSION_STATUS, AI_COMPLETED, GITHUB_FAILED, ROLE_CHANGED, PROBLEM_CREATED 등)
- 마감 알림: **24시간 전 + 1시간 전** 2회
- 마감 알림 대상: **미제출자만**

#### 3. 스터디 생성/초대
- 생성 폼: **스터디명(필수) + 설명(선택)**
- 생성자 역할: **자동 ADMIN**
- 초대 방식: **초대코드** (UUID)
- 초대코드 유효기간: **24시간** (ADMIN 재발급 가능)

#### 4. 로그인 플로우
- 약관 동의: **로그인 버튼 하단 안내문** ("로그인 시 이용약관 및 개인정보처리방침에 동의합니다" + 링크)
- 별도 체크박스/동의 페이지 없음 (OAuth 진행 = 동의)
- 온보딩: **구분 없음** — 최초 가입/재로그인 모두 대시보드 직행
- 대시보드 빈 상태(C2 dual CTA + GitHub 배너)가 온보딩 역할

#### 5. 제출 내역 페이지
- 필터 3개: **문제별 / 상태별(전체·분석중·완료·실패) / 언어별**
- 정렬: **최신순 고정**
- AI 결과 뷰: **아코디언 펼침** — 제출 행 클릭 시 아래로 확장 (목록 유지, 스크롤 보존)
- 아코디언 내용: 점수 게이지 + 5개 카테고리 바 + AI 총평 + [코드 비교 보기] + [GitHub 커밋 보기]
- 코드 비교(원본/최적화): 아코디언 내 탭 전환, "크게 보기" 링크로 전체 화면 가능

#### 6. 스터디/프로필 3탭
- **탭 1: 스터디 관리** (ADMIN 전용, MEMBER는 읽기)
  - 스터디 정보 수정 (이름·설명)
  - 멤버 목록 (역할 변경 ADMIN↔MEMBER · 강퇴)
  - 초대코드 발급 (UUID, 24시간 만료, 재발급)
  - 그라운드 룰: 자유 텍스트(500자), ADMIN 작성·수정, MEMBER 읽기
    - 노출: 관리 탭 상단 + 대시보드 셀렉터 옆 아이콘 팝오버
    - 최초 가입 시 그라운드 룰 있으면 1회 표시 (dismiss)
  - 스터디 종료 (스터디명 재입력 확인)
- **탭 2: 통계**
  - 주차별 제출 차트 (바 차트)
  - 난이도 분포 (브론즈~루비, 6티어)
  - 언어 분포
  - 멤버별 제출 현황 (아바타 + 이번주/총 제출 수)
  - 알고리즘 태그 분포 (태그 칩 그리드)
- **탭 3: 프로필 설정**
  - 프로필 이미지: 직접 업로드 또는 프리셋 아바타 선택 (OAuth 사진 미사용)
    - 프리셋: **알고리즘 테마** (그래프노드·이진트리·스택큐·정렬바·미로경로·해시·재귀나선·링크드리스트)
    - primary 컬러 변형(보라 그라데이션) 통일, 가입 시 랜덤 배정
  - 닉네임: **스터디 생성/가입 시 필수 기입**, 프로필에서 변경 가능
  - GitHub 연동 관리 (연동/변경/해제 + 스터디별 레포 목록)
  - 테마 전환 (라이트/다크/시스템)
  - 알림 설정 (유형별 ON/OFF 토글)
  - 회원 탈퇴 ("회원 탈퇴" 텍스트 입력 확인)

#### 7. 에러/빈 상태 UX
- **4가지 통일 패턴**: 중앙 정렬, 일러스트(알고리즘 테마 SVG, 보라 그라데이션) + 멘트(text2) + CTA(primary)
- **빈 상태** (데이터 없음): 친근한 톤 + 행동 유도 CTA
  - 스터디 없음: "아직 참여 중인 스터디가 없어요" → 스터디 만들기/초대코드 입력
  - 문제 0건: "아직 등록된 문제가 없어요" → 문제 등록하기 (ADMIN)
  - 제출 0건: "아직 제출한 풀이가 없어요" → 문제 풀러 가기
  - 리뷰 없음: "리뷰할 수 있는 풀이가 없어요"
  - 알림 0건: "새로운 알림이 없어요"
- **에러 상태** (API 실패): "데이터를 불러오지 못했어요" + HTTP_ERROR_MESSAGES 매핑 + [다시 시도]
- **404**: "페이지를 찾을 수 없어요" + [대시보드로 가기]
- **네트워크 오류**: "네트워크 연결을 확인해 주세요" + [다시 시도]

#### 8. 보안 사항 (PM 확정)
- **JWT 토큰 저장**: httpOnly Cookie (XSS 탈취 불가, CSRF는 OAuth state로 대응)
- **프로필 이미지 업로드**: 파일 타입 제한(jpg/png/webp) + 크기 2MB + 서버측 리사이징(200x200) + Magic Byte 검증
- **회원 탈퇴**: 개인정보 즉시 삭제, 제출 데이터 익명화 보존 (30일 후 완전 삭제)
- **초대코드 brute force**: 5회 실패 시 15분 잠금 + Rate Limit (UUID 추측 난이도 + 이중 방어)
- **코드 입력 보안**: 사이즈 100KB 제한 + DB 파라미터 바인딩 + 프론트 실행 없음 (Monaco 디스플레이 전용)
- **Monaco Editor 설정**:
  - 자동완성: **사용자 선택** (기본값 ON, 설정에서 토글)
  - BOJ 제출 템플릿: **언어 선택 시 자동 삽입** (빠른 입출력 패턴 포함)
    - Python: sys.stdin.readline / Java: BufferedReader+Main / C++: ios::sync_with_stdio
    - C: stdio.h / JS: readline / Kotlin: BufferedReader / Swift: Foundation
    - 사용자 자유 수정·삭제 가능
- **CSP**: 배포 시 적용 (script-src 'self', style-src 'self' 'unsafe-inline', img-src 'self' blob:, font-src 'self') — next/font 셀프 호스팅으로 외부 font-src 불필요

#### 9. 트랜잭션 설정 (PM 확정)
- **로컬 TX**: CUD 작업에 TypeORM QueryRunner 적용, 읽기 전용은 TX 없음, Isolation: READ COMMITTED
- **분산 TX**: Saga + 보상 트랜잭션 패턴 (RabbitMQ 이벤트 기반)
  - 예: 제출 성공 → GitHub 동기화 실패 → 제출 유지, 동기화만 재시도
  - 각 서비스 로컬 TX 보장 + 실패 시 보상 TX로 롤백
- **재시도**: RabbitMQ 메시지 최대 3회 (exponential backoff: 1s→2s→4s) → 실패 시 DLQ 이동. DB TX는 즉시 롤백

#### 10. AI 비용 정책 (PM 확정)
- **AI 트리거**: 제출 시 자동 실행 (한도 이내일 때)
- **한도**: 일일 5회/유저만 (스터디 한도 폐기 — 개인 한도로 충분)
- **한도 초과 시**: 제출 허용, AI 분석만 차단 + 토스트 안내 (D2 유지)
- **재제출**: 매번 AI 분석 1회 차감 (코드 개선 후 재분석 동기 부여)
- **기존 스터디 가입**: 가입 시점 이전 문제 제출 시 AI 한도 미차감 (따라잡기 혜택). 가입 이후 문제는 일일 5회 정상 차감. 제출 UI는 기존 플로우 동일 (문제별 개별 제출)
- **한도 정보 표시**: 제출 버튼 근처에 개인 한도 노출 ("오늘 N/5회"), 소진 시 안내 메시지

#### 11. AI 프롬프트 규칙 (PM 확정)
- **카테고리 5개**: 정확성(Correctness) / 효율성(Efficiency) / 가독성(Readability) / 구조(Structure) / 베스트 프랙티스(Best Practice)
- **응답 언어**: 한국어 (코드는 원문), 최대 1000토큰
- **모델**: Claude Sonnet
- **출력 구조**: 카테고리별 score(0~100) + comment + highlights[]
- **코드 매칭(highlights)**:
  - 각 카테고리별 최대 3개 하이라이트
  - `startLine`/`endLine`으로 정확한 라인 범위 지정
  - type 3종: `issue`(⚠ 주황, 개선 필요) / `suggestion`(💡 파랑, 대안 제안) / `good`(✅ 초록, 잘 작성)
  - Monaco Editor에서 해당 라인 구간 시각적 강조
  - 원본 코드 + 최적화 코드 양쪽 동일 구조 매칭
- **총평**: 전체 요약 + 핵심 개선점 (한국어)
- **최적화 코드**: 원본 대비 개선된 전체 코드 제공

#### 12. 보완점 결정 (PM 확정, 20개)
- **A1 코드리뷰 열람**: 마감 후에만 타인 코드 열람 + 코드리뷰 가능 (베끼기 방지)
- **A2 ADMIN 탈퇴**: 위임 필수. 다른 멤버에게 ADMIN 위임 후에만 탈퇴 가능
- **A3 마감 후 제출**: 가능 + "지각" 배지 표시. AI 분석 정상 작동. 통계에서 구분
- **A4 AI 실패 시**: 한도 미차감 + 서버측 자동 재시도(3회) + 토스트 + 수동 재시도 버튼
- **A5 탈퇴자 표시**: "탈퇴한 사용자" 닉네임 + 기본 아바타. 제출/리뷰 데이터 유지
- **A6 이미지 저장소**: MinIO (S3 호환, k3d/k3s 자체 배포)
- **A7 다중 스터디 대시보드**: 선택 스터디 기준. 셀렉터 전환 시 전체 갱신
- **B1 스터디 최대 인원**: 50명
- **B2 주차 할당**: 마감일 기준 `N월N주차` 자동 계산 (수동 입력 없음)
- **B3 KPI 3개**: 이번주 제출률(N/M) + 평균 AI 점수(0~100) + 연속 제출 스트릭(N주)
- **B4 로딩 상태**: 스켈레턴 UI 통일
- **B5 페이지네이션**: 페이지 번호 방식
- **B6 소셜 계정**: 1계정 1OAuth. 최초 가입 프로바이더로만 로그인
- **B7 동시 로그인**: 제한 없음 (다중 기기 허용)
- **B8 스터디 노트**: 스터디 공유. 문제별 1개. 멤버 전체 열람
- **B9 리뷰 댓글**: 작성자 본인만 수정·삭제. 삭제 시 "삭제된 댓글입니다" 표시
- **B10 알림**: 읽은 알림은 패널에서 미표시 (미읽음만 노출). 30일 후 자동 삭제. 전체 읽음 버튼. 개별 삭제 불가
- **B11 CLOSED 스터디**: 읽기 전용 (제출·리뷰·통계 열람 가능, 새 작업 불가)
- **B12 문제 수정**: 불가 (BOJ 자동 연동). 마감일만 ADMIN 변경 가능
- **B13 문제 검색**: 통합 검색(BOJ 번호 + 제목) + 필터(난이도별 + 주차별)
- **난이도 배지 형식**: `[티어 + 레벨]` (예: 골드 3, 플래티넘 1). 6티어: 브론즈~루비, 각 5~1레벨. Unrated = "Unrated" + muted 컬러

#### 13. 2차 보완점 (PM 확정, 6개)
- **C1 알림 이벤트 9종**: SUBMISSION_STATUS / AI_COMPLETED / GITHUB_FAILED / ROLE_CHANGED / PROBLEM_CREATED / DEADLINE_REMINDER / MEMBER_JOINED / MEMBER_LEFT / STUDY_CLOSED
- **C2 초대코드 입력**: 대시보드 빈 상태 CTA + 스터디 셀렉터 드롭다운 "+참여" 항목
- **C3 기존 스터디 가입**: 별도 일괄 UI 없음. 기존 제출 플로우 동일 (문제별 개별 제출)
- **C4 스터디 탈퇴 vs 회원 탈퇴**: 스터디 탈퇴 = 닉네임·제출·리뷰 유지, 재가입 시 복구. 회원 탈퇴 = "탈퇴한 사용자" 익명화
- **C5 Unrated 문제**: "Unrated" 텍스트 + muted 컬러(회색). 통계에서 별도 구분
- **C6 Footer**: 랜딩 페이지만. 로그인 후 약관/개인정보는 프로필 설정 탭에 배치

#### 14. 기술 설정 (PM 확정, 6개)
- **T1 토큰 갱신**: 서버측 자동 갱신. API 요청 시 만료 임박(5분) 감지 → 응답에 새 토큰 쿠키 자동 발급. 프론트 갱신 로직 불필요
- **T2 토큰 구조**: 단일 Access Token (httpOnly Cookie). Refresh Token 미사용
- **T3 CORS**: 명시적 Origin만 허용 (프론트 도메인) + credentials: true. 와일드카드(*) 불가
- **T4 CSP img-src**: MinIO URL 환경변수 관리 → CSP 헤더에 동적 삽입
- **T5 URL 암호화 (UUID 공개 ID)**:
  - 모든 엔티티에 `publicId` (UUID v4) 컬럼 추가 (unique index)
  - URL/API에는 UUID만 노출, 내부 auto-increment PK는 숨김
  - 서버측에서 `publicId` → 내부 PK 변환 후 처리
  - 기존 IDOR 소유권 검증과 이중 방어
  - URL 예시: `/studies/{uuid}/problems/{uuid}/submissions/{uuid}`
- **T6 URL 직접 접근 라우트 가드 (2단계)**:
  - **1단계 — Next.js Middleware**: httpOnly Cookie 없으면 → `/login?redirect={원래URL}`. 로그인 상태로 `/login` 접근 → `/dashboard`
  - **2단계 — 페이지 컴포넌트 권한 검증**:
    - 비소속 스터디 → `/dashboard` + "접근 권한이 없습니다" 토스트
    - MEMBER가 ADMIN 전용 페이지 → 스터디 메인 리디렉션
    - 마감 전 타인 코드리뷰 → "마감 후 열람 가능합니다" 토스트
    - 존재하지 않는 URL → 404 페이지
  - **로그인 후 복귀**: `redirect` 쿼리 파라미터로 원래 페이지 자동 이동
  - **Open Redirect 방지**: redirect 값 서버측 검증 — 내부 경로만 허용 (`/`로 시작, 프로토콜/`//` 불가)

### 적용 시 주의사항
- 모든 파일이 inline style — Tailwind CSS 토큰으로 변환 필수
- THEMES 객체 → tailwind.config.ts CSS 변수 매핑
- 각 파일에 중복된 Logo, THEMES, badge 등 → 공유 컴포넌트로 추출
- 더미 데이터 → API 연동 코드로 교체
- Google Fonts import → Next.js `next/font` 으로 변환
