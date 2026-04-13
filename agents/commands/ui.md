AlgoSu UI 디자인 시스템 파일을 참조하여 UI/UX 관련 작업을 수행합니다.

## 디자인 토큰
- **Primary**: `#7C6AAE` (Light) / `#A08CD6` (Dark)
- **Accent**: `#C4A6FF`
- **bg**: `#FAFAF8` (L) / `#0F0F12` (D)
- **bgCard**: `#FFFFFF` (L) / `#1C1C22` (D)
- **Heading font**: Sora
- **Body font**: Noto Sans KR
- **Mono font**: JetBrains Mono
- **Nav**: Glassmorphism — `backdrop-filter: blur(20px) saturate(180%)`
- **Card radius**: 14~16px
- **Shadow**: 2단계 (shadow + shadowHover)

### 난이도 컬러
- 브론즈: `#C06800` / 실버: `#5A7B99` / 골드: `#D48A00` / 플래티넘: `#20C490` / 다이아: `#00A8E8`

## 적용 규칙
- **인라인 하드코딩 금지** — `bg-[#...]` 사용 금지, Tailwind 토큰 클래스 사용
- inline style JSX → Tailwind CSS 변환 필수
- THEMES 객체 → `tailwind.config.ts` CSS 변수로 매핑
- Google Fonts → `next/font` 변환
- 더미 데이터 → API 연동 코드 교체

### 금지 토큰 (shadcn/ui 레거시)
사용 절대 금지:
- `destructive`, `muted-foreground`, `text-foreground`, `bg-background`, `ring-ring`
- `bg-bg2`, `bg-bg3`, `primary-500`, `primary-400`, `primary-foreground`

### 컴포넌트 패턴
- **DifficultyBadge**: `diff-bronze` 등 diff-* 프리픽스 (difficulty-* 금지)
- **h1**: `text-[22px] font-bold tracking-tight text-text` — 모든 페이지 h1 통일
- **필수 표시**: `text-[11px]` 고정 (text-[10px] 금지)
- **rounded**: `rounded-btn` (버튼), `rounded-card` (카드) — `rounded-lg` 직접 사용 금지
- **button type**: `type="button"` 또는 `type="submit"` 항상 명시
- **focus ring**: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary` 필수
- **장식 아이콘**: `aria-hidden` 추가 필수

### 코드 에디터 UX
- **자동완성**: BOJ 알고리즘 스니펫 29개 (LANG_COMPLETIONS builtins/keywords 전부 제거)
  - `wordBasedSuggestions: 'currentDocument'` — 변수명/키워드는 Monaco 내장 자동완성
  - CompletionProvider 중복 등록 방지: 모듈 레벨 `snippetsRegistered` guard
- **레이아웃**: 데스크톱 split-view (`lg:flex`, 좌측 420px sticky + 우측 flex-1)
  - 에디터 높이: `editorHeight` prop, 기본 `calc(100vh - 16rem)`
- **풀스크린**: `Maximize2`/`Minimize2` 토글, `fixed inset-0 z-[100]`
  - Escape 해제: `suggest-widget.visible` DOM 체크로 자동완성 충돌 방지
- **접근성**: sr-only 언어 선택 라벨, Ctrl+Enter 단축키 안내
- **진단**: JS/TS 문법 오류 빨간 밑줄 (`setDiagnosticsOptions`)

### 토큰 네이밍 규칙
- 컬러: `{semantic}-{scale}` (예: `primary-500`, `error-100`)
- 간격: Tailwind 기본 스케일 확장
- 타이포: `text-{role}` (예: `text-heading-1`)
- 반경: `rounded-{size}` (예: `rounded-card`)
- 그림자: `shadow-{level}` (예: `shadow-card`)

사용자의 요청: $ARGUMENTS
