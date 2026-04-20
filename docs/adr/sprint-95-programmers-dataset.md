---
sprint: 95
title: "프로그래머스 데이터셋 번들링 + Gateway 외부 연동"
date: "2026-04-20"
status: proposed
agents: [Oracle, Scout, Architect, Postman, Curator, Gatekeeper, Librarian]
related_adrs: ["sprint-83"]
related_memory: ["project-programmers-migration"]
---

# Sprint 95 — 프로그래머스 데이터셋 번들링 + Gateway 외부 연동

## 배경

백준(BOJ) 서비스 종료에 따라 AlgoSu의 문제 제공처를 프로그래머스로 전환해야 한다. Sprint 95~97 로드맵의 1단계로, 프로그래머스 문제 메타데이터를 사전 큐레이션된 JSON으로 번들링하고 Gateway에 BOJ(Solved.ac)와 대칭 구조의 외부 엔드포인트를 구축한다. UI/제출 경로는 이번 스프린트에서 건드리지 않는다.

### 핵심 전제
- 기존 BOJ 레코드·UI 플로우 **보존** — 신규 등록만 프로그래머스
- `sourcePlatform` 컬럼은 이미 `VARCHAR(50)` — **DB 마이그레이션 불필요**
- Sprint 95 병합만으로는 유저 가시 변화 0 (백엔드 인프라만 선행 배포)

## 결정 1: 메타데이터 전략 — 사전 큐레이션 JSON 번들링

### 선택
프로그래머스 문제 메타데이터를 **1회성 크롤러 스크립트로 수집**하여 `services/gateway/data/programmers-problems.json`에 정적 JSON으로 번들링한다. 서비스 기동 시 JSON을 메모리에 로드하여 `Map<problemId, info>`로 캐시한다.

### 대안 비교

| 기준 | A: 사전 JSON 번들링 (선택) | B: 실시간 HTML 파싱 | C: 비공식 API 직접 호출 |
|------|--------------------------|-------------------|-----------------------|
| **안정성** | ✅ 파일 기반, 외부 의존 0 | ❌ HTML 구조 변경 시 즉시 파손 | ❌ Cloudflare 차단, rate limit |
| **응답 속도** | ✅ 메모리 조회 O(1) | ❌ 매 요청 네트워크 RTT + 파싱 | ⚠️ 네트워크 RTT |
| **데이터 신선도** | ⚠️ 수동 갱신 (분기별 스크립트 재실행) | ✅ 항상 최신 | ✅ 항상 최신 |
| **유지보수** | ✅ zod 스키마 검증, 갱신 런북 | ❌ 선택자 변경 추적 필요 | ❌ API 변경/차단 대응 필요 |
| **Cloudflare 대응** | ✅ 1회만 우회 (wget subprocess) | ❌ 매 요청 JA3 우회 필요 | ❌ fingerprint 차단 (Sprint 83 사례) |

### 근거
- 프로그래머스에 공식 API가 존재하지 않는다
- Sprint 83에서 Cloudflare가 Node.js TLS JA3 fingerprint를 전면 차단한 전례가 있다
- 코딩테스트 연습 문제 풀은 유한(~800건)하며 갱신 빈도가 낮다 (신규 문제 월 2~5건)
- 검색·조회 UX는 메모리 캐시 기반이 가장 빠르다

### 갱신 정책
- **주기**: 분기별 1회 수동 실행 (`pnpm --filter @algosu/gateway run fetch-programmers`)
- **런북**: `docs/runbook/programmers-dataset-refresh.md` (Sprint 97에서 작성)
- **자동화**: 후속 Backlog (크론 파이프라인은 이 스프린트 스코프 외)

## 결정 2: Gateway 외부 모듈 대칭 구조

### 선택
`ProgrammersService` / `ProgrammersController`를 기존 `SolvedacService` / `SolvedacController`와 **동일한 인터페이스 계약**으로 구현하여 `external.module.ts`에 병치 등록한다.

### 아키텍처

```
services/gateway/src/external/
├── external.module.ts              [수정: Programmers* 등록]
├── solvedac.service.ts             [기존 유지]
├── solvedac.controller.ts          [기존 유지]
├── programmers.service.ts          [신규]
├── programmers.controller.ts       [신규]
├── programmers.service.spec.ts     [신규]
└── programmers.controller.spec.ts  [신규]
```

### 엔드포인트 대칭

| BOJ (기존) | 프로그래머스 (신규) |
|------------|-------------------|
| `GET /api/external/solvedac/problem/:problemId` | `GET /api/external/programmers/problem/:problemId` |
| `GET /api/external/solvedac/search?query=&page=` | `GET /api/external/programmers/search?query=&page=` |

### 응답 인터페이스

```typescript
/** ProgrammersProblemInfo — SolvedacProblemInfo 와 대칭 */
interface ProgrammersProblemInfo {
  problemId: number;
  title: string;
  difficulty: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND' | null;
  level: number;       // 프로그래머스 Lv.1~5
  sourceUrl: string;   // https://school.programmers.co.kr/learn/courses/30/lessons/{id}
  tags: string[];
}
```

### 설계 원칙
1. **인터페이스 대칭**: Sprint 96 프런트가 플랫폼 토글만으로 API를 교체할 수 있도록 응답 구조 동일
2. **데이터 소스 분리**: SolvedacService는 wget subprocess(실시간), ProgrammersService는 JSON 파일(정적) — 내부 구현만 다름
3. **Swagger 태그 분리**: `External — Solved.ac` / `External — Programmers`

## 결정 3: 난이도 매핑 — 기존 토큰 재사용

| 프로그래머스 | Difficulty Enum | 기존 컬러 토큰 |
|-------------|----------------|---------------|
| Lv.1 | `BRONZE` | `#C06800` |
| Lv.2 | `SILVER` | `#5A7B99` |
| Lv.3 | `GOLD` | `#D48A00` |
| Lv.4 | `PLATINUM` | `#20C490` |
| Lv.5 | `DIAMOND` | `#00A8E8` |

- `Difficulty` Enum, 스타일 토큰, 배지 컴포넌트 수정 **0줄**
- 매핑 함수 `programmersLevelToDifficulty(level: 1..5)` 추가 (Sprint 96 프런트에서 사용)

## 결정 4: DTO sourcePlatform 검증 강화

### 변경 전
```typescript
// services/problem/src/problem/dto/create-problem.dto.ts
@IsOptional()
@IsString()
@MaxLength(50)
sourcePlatform?: string;   // 자유 문자열
```

### 변경 후
```typescript
@IsOptional()
@IsIn(['BOJ', 'PROGRAMMERS'])
sourcePlatform?: string;   // 허용값 제한
```

### DB 영향 평가 (Librarian)
- `source_platform` 컬럼은 `VARCHAR(50)` — **ENUM이 아니므로** 값 추가에 마이그레이션 불필요
- 기존 데이터 중 `'BOJ'` 외 값(`'baekjoon'`, `'LeetCode'` 등)이 있을 수 있으나, DTO 검증은 **신규 입력만 제한**하므로 기존 레코드에 영향 없음
- `UpdateProblemDto`도 동일하게 `@IsIn` 적용하여 수정 시에도 허용값 제한
- 향후 플랫폼 추가 시 `@IsIn` 배열에 값만 추가 — Expand-Contract 불필요

## 크롤러 스크립트 설계

### 데이터 소스
프로그래머스 코딩테스트 연습 페이지 (`school.programmers.co.kr/learn/challenges`) 의 공개 문제 목록을 수집한다.

### 수집 필드
```typescript
interface ProgrammersProblemRaw {
  id: number;              // 문제 고유 ID (URL의 lessons/{id})
  title: string;           // 한국어 제목
  level: number;           // 1~5
  partTitle: string;       // 카테고리 (해시, 스택/큐, 정렬 등)
  finishedCount: number;   // 완료 수 (인기도 지표)
}
```

### 산출물
- 경로: `services/gateway/data/programmers-problems.json`
- 크기: 추정 100~300KB (600~800건)
- 검증: zod 스키마 (`z.array(ProgrammersProblemSchema).min(500)`)

### Cloudflare 우회 전략
Sprint 83에서 검증된 **wget subprocess** 패턴을 재사용한다. Alpine 기본 포함 wget(BusyBox)의 TLS fingerprint만 Cloudflare가 허용하므로, `child_process.execFile('wget', ...)` 방식으로 데이터를 수집한다.

## 3-스프린트 로드맵 요약

| 스프린트 | 초점 | 배포 영향 |
|---------|------|----------|
| **95** (현재) | 데이터셋 + Gateway 외부 연동 | 유저 변화 0 — 백엔드만 |
| **96** | 프런트 UX (검색 토글, 기본값 전환) | 신규 등록 프로그래머스 가능 |
| **97** | GitHub Worker `prg_` 접두어, AI 피드백, 문서 | end-to-end 완성 |

### 분할 근거
- **회귀 격리**: 각 스프린트가 독립 병합 가능하므로, 한 단계의 결함이 전체를 차단하지 않음
- **의존성 순방향**: 95(BE) → 96(FE, 95 필요) → 97(Worker, 96 필요)
- **검증 단위 최소화**: 스프린트당 변경 범위가 좁아 테스트·리뷰 부담 감소

## 리스크

| 리스크 | 확률 | 영향 | 대응 |
|--------|------|------|------|
| 프로그래머스 HTML 구조 변경으로 크롤러 파손 | 중 | 중 | JSON 번들링이므로 서비스 즉시 영향 없음. 갱신 시 스크립트 수정 |
| JSON 데이터 누락·오분류 | 중 | 낮 | Curator 품질 검수 + zod 스키마 검증 |
| `@IsIn` 추가로 기존 DTO 호환 깨짐 | 낮 | 중 | 기존 레코드 Read 경로는 DTO 미통과. 수정 시에만 영향 — UpdateProblemDto도 동일 적용 |
| Cloudflare wget 차단 확대 | 낮 | 중 | 이미 번들링 완료 후에는 영향 없음. 차단 시 브라우저 수동 수집 대안 |

## 스코프 외 (Sprint 96~97 이관)

- 프런트 `programmersApi`·훅·모달 변경
- `github-push.service.ts` `formatPlatform()` 확장 (`prg_` 접두어)
- AI 피드백 프롬프트 플랫폼 동적 주입
- 데이터 갱신 자동화 크론 파이프라인

## 검증 계획

1. `pnpm --filter @algosu/gateway run fetch-programmers` → JSON 생성, 600+ 문제 확인
2. `GET /api/external/programmers/search?query=모의고사` → 해당 문제 반환
3. `GET /api/external/programmers/problem/42840` → 단건 반환
4. 존재하지 않는 ID → `404 NotFoundException`
5. `pnpm --filter @algosu/gateway test` 전체 통과
6. `tsc --noEmit` 타입 오류 0
7. **회귀**: `/api/external/solvedac/*` 기존 BOJ 라우트 정상 작동 확인
