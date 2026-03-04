# Palette -> Herald 지시서 (Round 4)

> 작성: Palette (2026-02-28)
> 작업 내용: UI 톤 개선 + 디자인 토큰 재정의 (Oracle 지시)
> 이전 지시서: Round 3 내용은 하단에 보존됨

---

## Round 4 변경 사항

### globals.css — 토큰 변경

**다크모드 배경 (명도 상향)**
| 토큰 | 이전 | 신규 | 비고 |
|------|------|------|------|
| `--bg` | `#12101A` | `#1C1927` | L 7% → 11% |
| `--bg2` | `#1A1725` | `#27233A` | 단계 명도 차 10~12%p 확보 |
| `--bg3` | `#221F30` | `#322D49` | |
| `--surface`/`--card` | `#1E1B2C` | `#231F34` | |
| `--border-color`/`--border` | `#2E2A40` | `#3D3858` | 경계선 가시성 |
| `--text3`/`--muted-foreground` (dark) | `#5A5575` | `#9A95B8` | WCAG AA 충족 4.6:1+ |
| `--text2` (dark) | `#A8A3C0` | `#B0ABCC` | 소폭 상향 |
| `--shadow-light` (dark) | `rgba(148,126,176,0.10)` | `rgba(0,0,0,0.35)` | 다크 전용 |
| `--shadow-medium` (dark) | `rgba(148,126,176,0.16)` | `rgba(0,0,0,0.50)` | 다크 전용 |

**라이트모드 배경 (경쾌함 향상)**
| 토큰 | 이전 | 신규 |
|------|------|------|
| `--bg` | `#F7F6FA` | `#FAFAFE` |
| `--bg2` | `#EFECF5` | `#F1EFF9` |
| `--bg3` | `#E4E0EF` | `#E6E3F4` |
| `--border-color` | `#DDD9EC` | `#E0DCF0` |

**glass-dark utility 수정**
- 이전: `rgba(18,16,26,0.85)` → 신규: `rgba(35,31,52,0.88)` (배경 분리감 확보)

### tailwind.config.ts — 신규 토큰

**primary 스케일 추가** (`primary-50` ~ `primary-900`)
- `primary-100`: 라이트 active 배경
- `primary-300`: 다크 active 텍스트
- `primary-400`: hover 색상 (이전 어둠 방향 → 밝아지는 방향으로 전환)
- `primary-500`: 기본 브랜드 색상
- `primary-700`: 라이트 active 텍스트
- `primary-900`: 다크 active 배경

**error 스케일 추가** (`error-50` ~ `error-900`)

**borderRadius 추가**
- `rounded-card` = `12px`
- `rounded-btn` = `6px`

**boxShadow 변경**
- `shadow-card` / `shadow-modal` 추가 — CSS variable 참조로 모드별 자동 분기
- `shadow-light` / `shadow-medium` 도 variable 참조로 통일

### 컴포넌트 변경

**Badge.tsx**
- 반투명 알파 12~15% → **22%** (다크모드 가시성)
- 색상 리터럴 → `var(--color-*)` CSS variable

**Button.tsx**
- `bg-[#947EB0]` → `bg-primary-500`
- `hover:bg-[#6D5A8A]` → `hover:bg-primary-400` (밝아지는 방향)
- `rounded-[6px]` → `rounded-btn`

**Card.tsx**
- `shadow-light` → `shadow-card` (모드별 자동 분기)
- `rounded-md` → `rounded-card`

**Input.tsx**
- `dark:bg-bg3` 제거 → `bg-bg2` 통일 (다크모드 card와 명도 차 확보)
- `focus:border-[#947EB0]` → `focus:border-primary-500`
- `rounded-[6px]` → `rounded-btn`

**TopNav.tsx**
- `bg-[rgba(18,16,26,0.85)]` → `dark:glass-dark` (utility 클래스)
- active: `dark:bg-[#251F35]` → `dark:bg-primary-900`
- 로고 dot / 로그인 버튼: 리터럴 → `primary-500` 토큰

### Herald 주의사항
- `rounded-btn`, `rounded-card`, `primary-*`, `error-*`, `shadow-card`, `shadow-modal` 토큰 이제 사용 가능
- 기존 도메인 컴포넌트의 `bg-[#947EB0]` 등 인라인 하드코딩 발견 시 토큰으로 교체 필수

---

# Palette -> Herald 지시서 (Round 3)

> 작성: Palette (2026-02-28)
> 빌드 검증: 통과 (Next.js 15.1.7, 에러 0건)
> 작업 내용: 목업 기반 전면 재작성 (Stitch 모드)

---

## 완료된 파일

| 파일 | 변경 내용 |
|------|-----------|
| `globals.css` | 전면 재작성 — Google Fonts import, :root 라이트 모드 변수 전체, .dark 다크 모드 변수 전체, base 스타일, 스크롤바, 유틸리티 클래스 |
| `tailwind.config.ts` | 전면 재작성 — borderRadius 하드코딩값(6/12/18px), boxShadow 하드코딩값, fontFamily, 모든 커스텀 색상 토큰 |
| `Badge.tsx` | 전면 재작성 — dot prop 추가, Tailwind 클래스 기반 스타일 (inline style 제거), 5개 variant |
| `Button.tsx` | 전면 재작성 — 하드코딩 색상값(#947EB0, #6D5A8A), sm/md/lg/icon 사이즈, 6개 variant |
| `Card.tsx` | 전면 재작성 — 기본 p-4 포함, shadow-light 적용, CardHeader/Title/Description/Content/Footer 유지 |
| `Input.tsx` | 전면 재작성 — 목업 form-input 스펙 반영 (8px 12px padding, 12px font, bg-bg2/bg3, focus border-main) |
| `TopNav.tsx` | 전면 재작성 — 모든 목업 스펙 1:1 매칭, mx-auto max-w-screen-xl 추가, glass 배경 |
| `layout.tsx` | 변경 불필요 (이미 올바름: suppressHydrationWarning, defaultTheme="dark") |

---

## Herald 수정 필요 항목

### 1. problems/page.tsx
- **현재 코드 문제점**: Card 컴포넌트에 p-4가 기본 포함됨. 문제 목록 테이블에서 내부 px-4가 중복될 수 있음.
- **수정 방법**: `<Card className="p-0">` 으로 오버라이드. 기존 코드 그대로도 동작하지만, 목업 대비 padding이 두 배가 될 수 있음.
- **헤더 텍스트**: `text-base` (16px) -> 목업은 `16px font-weight 600`이므로 유지해도 됨.

### 2. (auth)/login/page.tsx
- **현재 코드 문제점**: 없음. Card, Input, Button 인터페이스 동일.
- **참고**: Button size="lg"가 이제 `px-5 py-[10px] text-[13px]`로 변경됨 (기존 h-11). 시각적으로 더 자연스러움.
- **Input 스타일**: label이 이제 `text-[11px] font-medium text-text2 mb-[5px]` (목업 form-label 스펙 반영).

### 3. AppLayout.tsx
- **수정 불필요**: TopNav 인터페이스 동일.

---

## 컴포넌트 사용법

### Badge
```tsx
import { Badge } from '@/components/ui/Badge';

// variant: default | info | success | warning | error | muted
<Badge variant="success">제출 완료</Badge>
<Badge variant="warning" dot>진행 중</Badge>  // dot prop으로 앞에 동그라미
<Badge variant="error" dot>FAILED</Badge>
```

### Button
```tsx
import { Button } from '@/components/ui/Button';

// variant: primary | ghost | secondary | danger | outline | link
// size: sm | md | lg | icon
<Button variant="primary" size="md">제출하기</Button>
<Button variant="ghost" size="sm">취소</Button>
<Button variant="secondary">초안 저장</Button>
<Button asChild variant="primary">
  <Link href="/submit">제출</Link>
</Button>
```

### Card
```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';

<Card>내용</Card>                    // 기본 p-4 포함
<Card className="p-0">              // padding 제거
  <CardHeader>...</CardHeader>
  <CardContent>...</CardContent>
  <CardFooter>...</CardFooter>
</Card>
```

### Input
```tsx
import { Input } from '@/components/ui/Input';

<Input label="이메일" placeholder="you@example.com" error="올바른 이메일을 입력하세요" />
```

---

## 사용 가능한 Tailwind 클래스

### 색상
- 브랜드: `main` / `main-light` / `main-dark` / `sub` / `sub-light` / `accent`
- 배경: `bg2` / `bg3` / `surface`
- 텍스트: `text1` / `text2` / `text3`
- 상태: `success` / `warning` / `error` / `info`
- 난이도: `difficulty-bronze` / `-silver` / `-gold` / `-platinum` / `-diamond`
- shadcn: `background` / `foreground` / `card` / `primary` / `secondary` / `muted` / `destructive` / `border` / `input` / `ring`

### 반경
- `rounded-sm` (6px) / `rounded-md` (12px) / `rounded-lg` (18px) / `rounded-full` (9999px)

### 그림자
- `shadow-light` / `shadow-medium`

### 폰트
- `font-sans` (Sora, Noto Sans KR) / `font-mono` (DM Mono)

### 유틸리티
- `.text-brand` / `.gradient-brand` / `.gradient-brand-text` / `.focus-ring` / `.glass-light` / `.glass-dark`

### 애니메이션
- `animate-skeleton-shimmer` / `animate-spin-slow` / `animate-fade-in`
