---
sprint: 98
title: "프로그래머스 검색 장애 수정 — Dockerfile data/ 번들 누락"
date: "2026-04-20"
status: completed
---

# Sprint 98 — 프로그래머스 검색 장애 수정

## 배경

Sprint 95~97에서 프로그래머스 전환을 완료하였으나, 운영 환경에서 프로그래머스 문제 검색이 전면
NotFoundException 을 반환하는 장애가 발생했다. 서비스 자체 로직은 정상이었고, 원인은 인프라
(Dockerfile) 계층의 파일 번들 누락이었다.

## 증상

- `GET /external/programmers/search?q=모의고사` → `404 NotFoundException`
- Gateway 서비스 로그: `프로그래머스 JSON 로드 실패 (빈 캐시로 기동): Error: ENOENT: no such file or directory`
- 부팅 시 `cache.size = 0` → 모든 검색/조회 불가

## 근본 원인 분석

### 경로 추적

```
CMD: node dist/src/main.js
컴파일 위치: src/external/programmers.service.ts → dist/src/external/programmers.service.js
__dirname @ runtime: /app/dist/src/external/

join(__dirname, '..', '..', 'data', 'programmers-problems.json')
= /app/dist/src/external/../../data/programmers-problems.json
= /app/dist/data/programmers-problems.json   ← 컨테이너 내 기대 경로
```

### Dockerfile 분석

```dockerfile
# production stage (수정 전)
COPY --from=builder /app/dist ./dist      # dist/ 복사
# data/ 미포함 → /app/dist/data/ 존재하지 않음
```

- Builder 단계: `COPY . .` 로 `data/programmers-problems.json` 존재 (`/app/data/`)
- `npm run build` (nest build): `data/` → `dist/` 자동 복사 없음
- Production stage: `dist/` 만 복사, `data/` 누락
- 결과: `/app/dist/data/programmers-problems.json` 미존재 → ENOENT → 빈 캐시

### ts-node 환경과의 차이

로컬 개발(`nest start:dev`, ts-node) 환경에서는 `__dirname = /app/src/external/` 이므로
`join('..', '..', 'data')` = `/app/data/` (프로젝트 루트) → 파일 존재하여 정상 작동.
컴파일 환경에서만 경로가 `dist/` 기준으로 이동하므로 개발 중 재현 불가했던 이유다.

## 수정 내용

### 1. nest-cli.json — assets 자동 번들 (NestJS 관례)

```json
"compilerOptions": {
  "deleteOutDir": true,
  "assets": [
    {
      "include": "../data/**",
      "outDir": "./dist/data",
      "watchAssets": false
    }
  ]
}
```

`npm run build` 실행 시 `data/` → `dist/data/` 자동 복사. 로컬 컴파일 빌드에서도 재현 방지.

### 2. Dockerfile — 명시적 COPY (안전망)

```dockerfile
COPY --from=builder /app/data ./dist/data
```

nest-cli assets 경로 해석의 버전 의존성과 무관하게, 반드시 `/app/dist/data/`에 파일이 존재함을
보장하는 안전망. CI 빌드 시 이 레이어가 없으면 이미지 빌드 실패로 조기 발견 가능.

### 수정된 파일

| 파일 | 작업 | 설명 |
|------|------|------|
| `services/gateway/Dockerfile` | 수정 | production stage에 `COPY --from=builder /app/data ./dist/data` 추가 |
| `services/gateway/nest-cli.json` | 수정 | `compilerOptions.assets` 추가로 nest build 시 자동 복사 |

## 검증 결과

### 단위 테스트

```
Test Suites: 50 passed, 50 total
Tests:       754 passed, 754 total  (programmers 관련 43건 포함)
```

- `programmers.service.spec.ts`: 기존 `loadFromFile` → `fetchProblem` 성공 검증으로 충분
- `cache.size > 0` 검증은 `fetchProblem(42840)` 성공으로 동치 → 신규 테스트 불필요

### 타입/린트

```
tsc --noEmit: PASS (오류 없음)
eslint: 기존 pre-existing 경고 6건 (programmers 수정과 무관)
```

## 회귀 방지

- **Dockerfile 안전망**: `COPY --from=builder /app/data ./dist/data` 레이어로 빌드 시 data/ 존재 보장
- **nest-cli.json assets**: `npm run build` 로컬 환경에서도 `dist/data/` 자동 생성
- **CI 검증 권장 (이월)**: `.github/workflows/` 에 `dist/data/programmers-problems.json` 존재 검증 step 추가

## 이월 항목

| # | 항목 | 우선순위 |
|---|------|----------|
| 1 | CI workflow에 `dist/data/` 파일 존재 검증 step 추가 | 보통 |
| 2 | H5 UX 개선 — 키워드 검색 연동 (프론트 검색창 → Gateway API 호출) | 낮음 |
| 3 | ESLint pre-existing 경고 6건 정리 (structured-logger, public-profile/share spec) | 낮음 |

## 커밋

| SHA | 메시지 |
|-----|--------|
| `79b6dbb` | `fix(gateway): Dockerfile에 programmers JSON 데이터 번들 추가` |
