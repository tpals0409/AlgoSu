AlgoSu UI 디자인 시스템 파일을 참조하여 UI/UX 관련 작업을 수행합니다.

## UI ver2 (현행, 2026-03-02 PM 제공)
원본 경로: /root/AlgoSu/plan/UI ver2/ *(원본: Mac `/Users/leokim/Desktop/UI ver2/`)*
상세 분석: /root/.claude/projects/-root/memory/algosu-ui-v2.md

### 파일 목록
| 파일 | 페이지 |
|---|---|
| `algosu-landing.jsx` | 랜딩 (Hero, 기능소개, AI 프리뷰, CTA) |
| `algosu-login.jsx` | 로그인 (OAuth: Google/Naver/Kakao) |
| `algosu-logos.jsx` | 로고 시안 (A~D 4종) |
| `algosu-dashboard.jsx` | 대시보드 (KPI, 주차 차트, 최근 제출, 마감) |
| `algosu-problems.jsx` | 문제 (목록/상세/생성) |
| `algosu-submissions.jsx` | 제출 내역 + AI 분석 결과 (통합) |
| `algosu-ai-result.jsx` | AI 분석 (독립 뷰) |
| `algosu-code-review.jsx` | 피어 코드 리뷰 (문제→멤버→라인 리뷰) |
| `algosu-notifications.jsx` | 토스트 알림 + 알림 패널 |
| `algosu-study-profile.jsx` | 스터디 관리/통계/프로필 (3탭) |

### 디자인 토큰 (v2)
- **Primary**: `#7C6AAE` (Light) / `#A08CD6` (Dark)
- **Accent**: `#C4A6FF`
- **bg**: `#FAFAF8` (L) / `#0F0F12` (D)
- **bgCard**: `#FFFFFF` (L) / `#1C1C22` (D)
- **Heading font**: Sora
- **Body font**: Noto Sans KR
- **Mono font**: JetBrains Mono (v1의 DM Mono에서 변경)
- **Nav**: Glassmorphism — `backdrop-filter: blur(20px) saturate(180%)`
- **Card radius**: 14~16px
- **Shadow**: 2단계 (shadow + shadowHover)

### 난이도 컬러
- 브론즈: `#C06800` / 실버: `#5A7B99` / 골드: `#D48A00` / 플래티넘: `#20C490` / 다이아: `#00A8E8`

### v1 → v2 변경점
- Primary: `#947EB0` → `#7C6AAE` / `#A08CD6`
- Mono font: DM Mono → JetBrains Mono
- Nav: 불투명 → Glassmorphism
- 애니메이션: 없음 → IntersectionObserver fade-in + useAnimVal
- Logo: 없음 → SVG 노드 그래프 (gradient)
- Toast: 없음 → 7유형 (success/error/warning/info/ai/submit/deadline)
- 피어 리뷰: 없음 → 라인별 댓글 + AI 하이라이트 + 스터디 노트
- 스터디 관리: 기본 → 3탭 (관리/통계/프로필)

### 적용 규칙
- **인라인 하드코딩 금지** — `bg-[#...]` 사용 금지, Tailwind 토큰 클래스 사용
- inline style JSX → Tailwind CSS 변환 필수
- THEMES 객체 → `tailwind.config.ts` CSS 변수로 매핑
- 공통 컴포넌트 추출: Logo, DiffBadge, TimerBadge, StatusBadge, ScoreBadge, ScoreGauge, Toast, NotifPanel
- Google Fonts → `next/font` 변환
- 더미 데이터 → API 연동 코드 교체

## UI ver1 (구 버전, 참고용)
파일 경로: /root/AlgoSu/plan/UI Mockup/algosu-ui-design.html
코드 규칙 v1.1: /root/AlgoSu/plan/Code Rules/AlgoSu_Code_Conventions_Update_v1.1.md

### 디자인 토큰 네이밍 규칙 (v1.1, 유지)
- 컬러: `{semantic}-{scale}` (예: `primary-500`, `error-100`)
- 간격: Tailwind 기본 스케일 확장
- 타이포: `text-{role}` (예: `text-heading-1`)
- 반경: `rounded-{size}` (예: `rounded-card`)
- 그림자: `shadow-{level}` (예: `shadow-card`)

### 참조
- 모니터링 로그 규칙: `/root/AlgoSu/docs/monitoring-log-rules.md`

사용자의 요청: $ARGUMENTS
