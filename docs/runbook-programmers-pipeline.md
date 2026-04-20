# 프로그래머스 파이프라인 운영 런북

> 대상: 프로그래머스 문제 생성 → 제출 → GitHub 커밋 → AI 피드백 전 구간
> 작성일: 2026-04-20 (Sprint 97)

---

## 개요

프로그래머스 문제의 생명주기는 다음 서비스 체인으로 구성된다:

```
frontend (문제 검색/등록)
  → gateway (programmersApi 외부 엔드포인트)
    → problem (문제 CRUD, sourcePlatform='PROGRAMMERS')
      → submission (풀이 제출, MQ 발행)
        → github-worker (GitHub 커밋, PROGRAMMERS_{id}_{title}.{ext})
        → ai-analysis (플랫폼 맥락 주입 프롬프트로 AI 분석)
```

- **데이터 소스**: `services/gateway/data/programmers-problems.json` (사전 큐레이션 JSON 번들)
- **tags 크롤러**: `services/gateway/scripts/fetch-programmers-tags.ts` (2차 패스, 분기별 재실행)
- **파일명 규칙**: `{weekFolder}/{PLATFORM}_{problemNumber}_{title}.{ext}` (예: `week1/PROGRAMMERS_1845_폰켓몬.py`)

---

## tags 크롤러 실행법

### 실행 명령

```bash
# 전수 373건 실행 (curator 담당)
pnpm --filter @algosu/gateway run fetch-programmers-tags

# 드라이런 — 샘플 5건만 검증 (사전 확인용)
pnpm --filter @algosu/gateway run fetch-programmers-tags -- --dry-run
```

### 사전 준비

```bash
# Playwright chromium 브라우저 설치 (최초 1회)
npx playwright install chromium
```

### 재실행 주기

- **권장**: 분기별 1회 (신규 문제 추가 빈도 낮음)
- **트리거**: 프로그래머스에서 신규 문제가 대량 추가되었을 때
- 실행 전 기존 JSON을 `.bak` 확장자로 자동 백업 (스크립트 내장)

### SKIP_KEYWORDS 추가 절차

breadcrumb 셀렉터가 UI 라벨 노이즈를 수집하는 경우:

1. 수집 결과에서 노이즈 태그 식별 (예: `'도움말'`, `'컴파일 옵션'`)
2. `services/gateway/scripts/fetch-programmers-tags.ts`의 `SKIP_KEYWORDS` 배열에 추가
3. 드라이런으로 필터링 확인 → 전수 재실행
4. 정제된 JSON 커밋

```typescript
// services/gateway/scripts/fetch-programmers-tags.ts (L98-113)
const SKIP_KEYWORDS: readonly string[] = [
  // 최상위 네비게이션
  '코딩테스트 연습',
  '코딩테스트',
  'programmers',
  '프로그래머스',
  'home',
  '홈',
  // UI 라벨 노이즈 (B1-refix) — 여기에 추가
  '도움말',
  '컴파일 옵션',
  // ...
];
```

### 백업 위치

스크립트 실행 시 기존 JSON이 같은 디렉토리에 `.bak` 파일로 복사된다:

```
services/gateway/data/programmers-problems.json       ← 갱신
services/gateway/data/programmers-problems.json.bak   ← 직전 백업
```

---

## formatPlatform() 맵 확장

새 플랫폼(예: LeetCode) 추가 시 파일명 규칙을 등록한다.

### 파일 위치

`services/github-worker/src/github-push.service.ts` (L254-266)

### 대문자 풀네임 컨벤션

모든 플랫폼은 **대문자 풀네임**으로 통일한다. GitHub 커밋 파일명에 그대로 사용되므로 일관성이 중요하다.

```typescript
private formatPlatform(platform: string): string {
  const map: Record<string, string> = {
    '백준': 'BOJ',
    'baekjoon': 'BOJ',
    'boj': 'BOJ',
    '프로그래머스': 'PROGRAMMERS',
    'programmers': 'PROGRAMMERS',
    'leetcode': 'LEETCODE',       // ← 신규 플랫폼 추가 위치
    'softeer': 'SOFTEER',
    'swea': 'SWEA',
  };
  return map[platform.toLowerCase()] ?? platform;
}
```

### 새 플랫폼 추가 절차

1. `formatPlatform()` map에 **소문자 키 → 대문자 풀네임 값** 추가
2. 한국어 alias가 있으면 동일 값으로 별도 키 등록 (예: `'백준': 'BOJ'`)
3. 파일명 규칙 확인: `{weekFolder}/{PLATFORM}_{problemNumber}_{title}.{ext}`
4. `extractProblemNumber()` (L272-276) — URL 패턴이 다르면 분기 추가
5. 단위 테스트 추가: `github-push.service.spec.ts`에 신규 플랫폼 케이스

---

## AI 프롬프트 플랫폼 맥락 수정

### 파일 위치

`services/ai-analysis/src/prompt.py`

### 아키텍처 원칙

- `SYSTEM_PROMPT` (L12-85)는 **공통 유지** — 플랫폼별 수정 금지
- 플랫폼 맥락은 `_build_platform_context()` 함수를 통해 **유저 프롬프트 선두에 한 줄 주입**
- Jinja2 등 템플릿 엔진 미도입 (의존성 최소화)

### 확장 절차

새 플랫폼 맥락을 추가하려면:

1. `_build_platform_context()` (L88-106)에 분기 추가:

```python
def _build_platform_context(source_platform: str | None) -> str:
    if source_platform == "BOJ":
        return "이 문제는 백준(BOJ) 플랫폼 문제이며, ..."
    if source_platform == "PROGRAMMERS":
        return "이 문제는 프로그래머스 플랫폼 문제이며, ..."
    if source_platform == "LEETCODE":          # ← 신규 추가
        return "이 문제는 LeetCode 플랫폼 문제이며, ..."
    return ""
```

2. `build_user_prompt()` / `build_group_user_prompt()` — 시그니처 변경 없음 (내부에서 `_build_platform_context()` 호출)
3. 테스트 추가: `tests/test_prompt.py`에 신규 플랫폼 케이스

### 테스트

```bash
cd services/ai-analysis
pytest tests/test_prompt.py -v
```

---

## 트러블슈팅

### 크롤러 429 응답

tags 크롤러에는 exponential backoff가 내장되어 있다 (attempt 1→1s, 2→2s, 3→4s, 최대 3회 재시도).

- 429가 지속되면 `DELAY_MIN_MS`/`DELAY_MAX_MS` 상수를 증가시킨다 (기본 300~500ms)
- 프로그래머스 Cloudflare 보호가 강화된 경우, 시간대를 변경하거나 실행 간격을 늘린다

### tags 미분류 폴백

일부 문제(예: PCCP 2025 12건)는 breadcrumb이 없거나 셀렉터가 매칭되지 않아 tags가 빈 배열로 남을 수 있다.

**확인 절차:**

```bash
# 빈 tags 문제 목록 확인
cat services/gateway/data/programmers-problems.json | \
  node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); \
  (d.items||d).filter(i=>!i.tags||i.tags.length===0).forEach(i=>console.log(i.problemId, i.title))"
```

- 미분류 문제는 `BREADCRUMB_SELECTORS` 배열에 새 셀렉터를 추가해 재시도
- 셀렉터 보강이 어려우면 수동 태깅 후 JSON 직접 편집 (version 갱신)

### E2E 테스트 실패

`tests/e2e/programmers-full-flow.spec.ts`가 실패하는 경우:

1. **MSW 스텁 경로 불일치**: Gateway API 경로가 변경되었는지 확인. 스텁 핸들러의 URL 패턴과 실제 엔드포인트 대조
2. **MQ payload 스키마 변경**: `SubmissionEvent.sourcePlatform` 필드가 Submission 서비스에서 정상 전달되는지 확인
3. **AI 프롬프트 문구 변경**: `_build_platform_context()`의 반환 문자열이 테스트 assertion과 일치하는지 확인
4. **Jest 타임아웃**: E2E는 서비스 기동 시간이 필요하므로 `jest.setTimeout(60_000)` 확인

---

## 관련 파일

| 파일 | 역할 |
|------|------|
| `services/gateway/data/programmers-problems.json` | 프로그래머스 문제 번들 데이터 (373건) |
| `services/gateway/scripts/fetch-programmers-tags.ts` | tags 2차 패스 크롤러 |
| `services/gateway/scripts/fetch-programmers-problems.ts` | 1차 문제 목록 크롤러 |
| `services/gateway/src/external/programmers.service.ts` | Gateway 프로그래머스 서비스 |
| `services/github-worker/src/github-push.service.ts` | `formatPlatform()` + `extractProblemNumber()` |
| `services/submission/src/saga/mq-publisher.service.ts` | MQ event `sourcePlatform` 발행 |
| `services/ai-analysis/src/prompt.py` | 플랫폼 맥락 주입 프롬프트 |
| `services/ai-analysis/tests/test_prompt.py` | 프롬프트 단위 테스트 |
| `tests/e2e/programmers-full-flow.spec.ts` | E2E 전 구간 시나리오 |
| `frontend/scripts/check-wcag.ts` | WCAG AA 대비비 검증 스크립트 |
