# AlgoSu

알고리즘 스터디 플랫폼 — MSA 기반 코드 제출·AI 분석·피어 리뷰 서비스.

## 디렉토리 구조

```
frontend/          Next.js 14 App Router (UI)
services/
  gateway/         NestJS API Gateway (인증/라우팅)
  submission/      NestJS 제출 관리 + Saga
  problem/         NestJS 문제 관리
  github-worker/   NestJS GitHub 동기화
  ai-feedback/     FastAPI AI 분석
infra/             k3d/k3s 매니페스트, ArgoCD
docs/              ADR, 런북, 규칙 문서
blog/              기술 블로그
```

## 코드 컨벤션

### 네이밍
- **변수/함수**: camelCase
- **클래스/타입/인터페이스**: PascalCase
- **상수/ENUM 값**: UPPER_SNAKE_CASE
- **파일명**: kebab-case (컴포넌트 PascalCase)
- **디자인 토큰**: `{semantic}-{scale}` (예: `primary-500`, `error-100`)

### 커밋 & 브랜치
- Conventional Commits: `feat/fix/chore(scope): subject`
- 브랜치: `<type>/<scope>-<description>`, main 직접 push 금지
- PR: Squash merge, 필수 체크리스트 (테스트/타입체크/lint/보안/DB)
- CODEOWNERS 자동 리뷰어

### 함수 규칙
- 단일 책임, 20줄 이내
- DRY, 에러 핸들링 분리
- SOLID 원칙 준수

### 주석
- 파일 헤더: `@file`, `@domain`, `@layer`, `@related`
- 함수: JSDoc 필수

### 금지 사항
- `bg-[#...]` 인라인 하드코딩 → Tailwind 토큰 클래스 사용
- `console.log` 문자열 → JSON structured logging
- `components/ui/` Palette 가이드 없이 생성
- `tailwind.config.ts` 토큰: Palette 확정 → Herald 등록 순서 필수
- `synchronize: true` 프로덕션 적용

### 품질
- ESLint `no-console:'error'`, `tsc --noEmit`
- Python: Ruff `T20`
- 테스트 커버리지:
  - **글로벌 게이트**: lines/branches 모두 70%+ (`scripts/check-coverage.mjs`)
  - **서비스별 threshold**: 각 서비스 `jest.config.ts` / `pyproject.toml`에 개별 설정 유지 (Node 92~100%, Python 98%, Frontend lines 83%/branches 71%)
  - 신규 코드 추가 시 서비스별 threshold를 낮추지 말 것

## 디자인 토큰 (UI v2)

### 색상
- **Primary**: `#715DA8` (Light) / `#A08CD6` (Dark)
- **Accent**: `#C4A6FF`
- **bg**: `#FAFAF8` (L) / `#0F0F12` (D)
- **bgCard**: `#FFFFFF` (L) / `#1C1C22` (D)

### 난이도 컬러
- 브론즈: `#C06800` / 실버: `#5A7B99` / 골드: `#D48A00` / 플래티넘: `#20C490` / 다이아: `#00A8E8`

### 타이포그래피
- **Heading**: Sora
- **Body**: Noto Sans KR
- **Mono**: JetBrains Mono

### 시각 요소
- **Nav**: Glassmorphism — `backdrop-filter: blur(20px) saturate(180%)`
- **Card radius**: 14~16px
- **Shadow**: 2단계 (shadow + shadowHover)
- **토큰 네이밍**: 간격 Tailwind 확장, `text-{role}`, `rounded-{size}`, `shadow-{level}`

### 적용 규칙
- 인라인 style → Tailwind CSS 변환 필수
- THEMES 객체 → `tailwind.config.ts` CSS 변수 매핑
- Google Fonts → `next/font` 변환
- WCAG AA 텍스트 대비비 4.5:1+ 필수

## 보안 규칙

- 민감 정보 로그 절대 금지 (JWT, 토큰, 키, PII, DB 연결문자열)
- Secrets: SealedSecret 사용 (평문 Secret 금지)
- X-Internal-Key: `timingSafeEqual` 비교
- CI: `permissions:{}`, gitleaks, Trivy, `.env` 커밋 방지
- JWT: `none` 알고리즘 금지, 만료 검증 필수
- 입력값: SQL 바인딩 (raw query 금지)

## Agent 워크플로우

모든 작업은 `/algosu-oracle`을 통해 요청합니다.
Oracle이 전문 에이전트에게 위임: `/agents:{name}` (conductor, gatekeeper, librarian, architect, scribe, postman, curator, herald, palette, scout, sensei)
