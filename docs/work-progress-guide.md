# AlgoSu 작업 진행 가이드

> **버전**: v1.0
> **최종 갱신**: 2026-03-02
> **목적**: TF Agent의 작업 흐름과 Oracle의 현황 보고 규칙을 정의한다.
> **적용 범위**: 모든 Sprint 작업

---

## 1. 작업 흐름 (Agent)

### 1.1 수령

- Oracle이 `TaskCreate`로 작업 할당
- Agent는 `TaskGet`으로 요구사항·의존성·담당 확인
- `blockedBy`가 비어 있는지 확인 → 비어 있어야 착수 가능

### 1.2 착수

- `TaskUpdate(status: in_progress)` 선언
- 관련 코드 탐색 필수:
  - `@domain {해당도메인}`으로 grep → 관련 파일 전체 파악
  - `@related`로 영향 범위 확인
  - 어노테이션 사전(`docs/annotation-dictionary.md`) 참조

### 1.3 구현

- **클린 코드** + **SOLID** 원칙 준수
- **어노테이션 규칙** 준수:
  - 파일 헤더 (`@file`, `@domain`, `@layer`, `@related`) 필수
  - 함수/컴포넌트 JSDoc 필수
  - 새 이벤트/가드 추가 시 → 어노테이션 사전 먼저 갱신
- **Prometheus + Loki 규칙** 준수 (모니터링 코드 작성 시)
- **기존 v1.0 + v1.1 코드 컨벤션** 준수
- 섹션 구분자 사용 (50줄 이상 파일)

### 1.4 자체 검증

```
□ 빌드 에러 없음 (npm run build / tsc --noEmit)
□ 기존 기능 회귀 없음
□ 어노테이션 누락 없음 (파일 헤더, JSDoc)
□ 인라인 하드코딩 없음 (bg-[#...] 금지)
□ 민감정보 노출 없음
□ @related 연관 파일 함께 수정 완료
```

### 1.5 보고

- Agent → Oracle에 완료 보고:
  - 변경 파일 목록 + 줄 수
  - 자체 검증 결과
  - 발견된 이슈/의존성
- Oracle이 검증 후 `TaskUpdate(status: completed)`

### 1.6 금지 사항

| 금지 항목 | 이유 |
|---|---|
| Agent 독자 판단으로 아키텍처 변경 | Oracle/PM 승인 필수 |
| Oracle 승인 없이 타 Agent 영역 수정 | 충돌·회귀 방지 |
| PM 직접 소통 | Oracle 경유만 허용 (보고 체계) |
| skill 미로드 상태로 코드 작업 | 페르소나+규칙 미적용 위험 |
| 범용 Task Agent로 코드 작업 | TF Agent만 코드 작업 허용 |

---

## 2. Oracle 작업 현황 표시 규칙

### 2.1 Sprint 현황판

Sprint 착수 시, Agent 완료 시, PM 요청 시 표시한다.

```
═══ Sprint {ID} 현황 ═══
📊 진행률: ████████░░ 8/10 (80%)

✅ 완료 (N)
 ├ [{ID}] {작업명}
 └ [{ID}] {작업명}

🔄 진행 중 (N)
 ├ [{ID}] {작업명} → {Agent명} ({진행률}%)
 └ [{ID}] {작업명} → {Agent명} ({진행률}%)

⏳ 대기 (N)
 ├ [{ID}] {작업명} ← {의존 작업ID} 의존
 └ [{ID}] {작업명}

🚫 블로커 (N)
 └ [{ID}] {작업명} — {원인 요약}
```

#### 진행률 바 규칙

```
0%   : ░░░░░░░░░░
10%  : █░░░░░░░░░
20%  : ██░░░░░░░░
...
100% : ██████████
```

#### 작업 ID 네이밍

```
FE-{번호}  : 프론트엔드 작업
BE-{번호}  : 백엔드 작업
DB-{번호}  : DB 마이그레이션
CI-{번호}  : CI/CD 작업
DOC-{번호} : 문서 작업
```

### 2.2 Agent 상태 표시

```
─── Agent 상태 ───
{Agent명}  : {이모지} {작업ID} {작업명} ({진행률}%)
{Agent명}  : ⏸ 대기 (다음: {작업ID})
{Agent명}  : 💤 미투입
```

#### 이모지 규칙

| 이모지 | 상태 |
|---|---|
| 🔄 | 작업 진행 중 |
| ⏸ | 대기 (할당 작업 있으나 의존성 대기) |
| 💤 | 미투입 (현 Sprint 작업 없음) |
| ✅ | 작업 완료 후 대기 |
| 🚫 | 블로커로 작업 중단 |

### 2.3 단건 작업 보고

Agent가 작업을 완료하면 Oracle이 아래 형식으로 PM에게 보고한다.

```
── [{작업ID}] {작업명} 완료 ──
담당: {Agent명}
변경: {파일수}파일 (+{추가줄} / -{삭제줄})
 ├ {파일경로} ({신규/수정/삭제})
 ├ {파일경로} ({신규/수정/삭제})
 └ {파일경로} ({신규/수정/삭제})
검증: 빌드 {✓/✗} | 기존 기능 {✓/✗}
비고: {특이사항 있으면 기재}
```

### 2.4 블로커 알림

블로커 발생 시 즉시 표시한다.

```
⚠️ 블로커 발생 ─────────────
작업: [{작업ID}] {작업명}
담당: {Agent명}
원인: {원인 설명}
영향: {영향받는 작업ID 목록}
조치: {현재 진행 중인 조치}
에스컬레이션: {PM 판단 필요 여부}
```

#### 블로커 등급

| 등급 | 기준 | 대응 |
|---|---|---|
| **P1 — Critical** | Sprint 전체 차단, 다수 작업 영향 | PM 즉시 보고 |
| **P2 — High** | 2개 이상 작업 차단 | Oracle 자체 해소 시도 → 1시간 미해소 시 PM 보고 |
| **P3 — Medium** | 단일 작업 차단, 우회 가능 | Oracle 자체 해소, 우회 후 진행 |

### 2.5 표시 시점 규칙

| 시점 | 표시 내용 |
|---|---|
| Sprint 착수 | 전체 현황판 + Agent 상태 |
| Agent 작업 완료 | 단건 보고 + 현황판 갱신 |
| 블로커 발생 | 블로커 알림 즉시 |
| PM 요청 시 | 최신 현황판 + Agent 상태 |
| Sprint 종료 | 최종 현황판 + 통계 요약 |

### 2.6 Sprint 종료 통계

```
═══ Sprint {ID} 완료 ═══
기간: {시작} ~ {종료}
작업: {완료}/{전체} ({비율}%)

📈 통계
 ├ 변경 파일: {총 파일수}
 ├ 코드 변경: +{추가줄} / -{삭제줄}
 ├ Agent 투입: {투입 Agent 수}/{TF 정원}
 └ 블로커: {발생 수} (해소 {해소수} / 미해소 {미해소수})

📋 완료 작업 목록
 ├ [{ID}] {작업명} — {Agent명}
 └ ...

⏭ 다음 Sprint 예정
 ├ [{ID}] {작업명}
 └ ...
```

---

## 3. 작업 우선순위 규칙

### 의존성 기반 순서

```
1. 블로커 해소 작업 (최우선)
2. 다른 작업이 의존하는 작업 (blockedBy 해소)
3. 백엔드 작업 (프론트엔드가 의존)
4. 프론트엔드 작업
5. 문서/CI 작업
```

### Agent 할당 원칙

- 각 Agent의 전문 영역(skill) 기반 할당
- 한 Agent에 동시 2개 이상 작업 할당 금지
- 작업 완료 후 `TaskList`로 다음 unblocked 작업 확인 → Oracle 할당

---

## 4. PM 보고 규칙 (Discord)

### 4.1 채널 매핑

Oracle은 `~/.claude/discord-send.sh`를 통해 보고한다.

```
discord-send.sh report    → #work-report      (작업 완료, Sprint 현황)
discord-send.sh approval  → #work-approval    (PM 판단 요청)
discord-send.sh emergency → #emergency-alert  (P1~P2 블로커, 보안 이슈)
discord-send.sh oracle    → #oracle-chat      (일반 소통, PM 질문 응답)
```

### 4.2 보고 시점

**정기 보고:**
- Sprint 착수 → `report`: 목표 + 작업 목록 + Agent 배치
- Sprint 종료 → `report`: 완료 통계 + 미완료 사유 + 다음 Sprint

**수시 보고:**
- 작업 완료 → `report`: 단건 보고
- PM 판단 필요 → `approval`: 선택지 2~3개 + Oracle 추천안
- P1~P2 블로커 → `emergency`: 즉시 (원인 + 영향 + 조치안)
- 보안 이슈 → `emergency`: 즉시 (심각도 + 영향 + 긴급 조치)

**보고하지 않는 것:**
- Agent 간 내부 조율 (Oracle 자율 처리)
- P3 블로커 자체 해소 (해소 결과만 Sprint 현황에 포함)
- 코드 수준 기술 세부사항 (요약만)
- Agent 실패 → 재시도 성공 (결과만 보고)

### 4.3 Discord 마크다운 포맷 규칙

Discord 마크다운 제약에 맞춘 규칙:

```
✅ 사용 가능:
- ## 헤더 (##, ### 사용. # 미지원)
- **bold**, *italic*
- `인라인 코드`, ```코드 블록```
- - 목록 (bullet list)
- > 인용
- 이모지

❌ 사용 금지:
- 테이블 (|---|) → 목록으로 대체
- 체크박스 (- [ ]) → 이모지로 대체
- HTML 태그
```

### 4.4 메시지 길이 규칙

- Discord 메시지 한도: **2000자**
- 모든 보고는 2000자 이내 작성
- 초과 시 `[1/2]` `[2/2]`로 분할 전송
- 분할 시 각 메시지에 `## {제목} [N/M]` 헤더 포함

### 4.5 보고 톤

- **결론 먼저**: 첫 줄에 "완료 / 블로커 / 판단 필요" 명시
- **선택지 제시**: 판단 요청 시 반드시 2~3개 옵션 + Oracle 추천
- **간결하게**: PM이 30초 내 파악 가능
- **기술 용어 최소화**: 비개발자도 상황 파악 가능한 수준

### 4.6 PM 질문 응대

- PM 질문에 최우선 즉시 응답
- "모르겠습니다" 금지 → 조사 후 답변 또는 "확인 중, N분 내 보고"
- PM 결정 사항은 즉시:
  1. 메모리 저장
  2. 관련 Agent에 전파
  3. 필요 시 문서 갱신

### 4.7 보고 템플릿

#### Sprint 현황판 (`report`)

```markdown
## ═══ Sprint {ID} 현황 ═══
📊 **진행률**: ████████░░ 8/10 (80%)

### ✅ 완료 (N)
- `[FE-01]` Monaco Editor 통합
- `[BE-01]` ExceptionFilter 글로벌 적용

### 🔄 진행 중 (N)
- `[FE-03]` 대시보드 레이아웃 → **Palette** (70%)
- `[BE-04]` SSE S6 해소 → **Conductor** (50%)

### ⏳ 대기 (N)
- `[FE-04]` 스터디룸 전환 ← BE-04 의존

### 🚫 블로커 (N)
> 없음
```

#### 단건 보고 (`report`)

```markdown
## ✅ [FE-01] Monaco Editor 통합 완료

**담당**: Herald
**변경**: 4파일 (+182줄 / -45줄)
- `components/problem/CodeEditor.tsx` (신규)
- `hooks/useMonaco.ts` (신규)
- `app/problems/[id]/page.tsx` (수정)
- `package.json` (의존성 추가)

**검증**: 빌드 ✓ | 기존 기능 ✓
```

#### 블로커 알림 (`emergency`)

```markdown
## ⚠️ 블로커 발생 (P2 — High)

**작업**: `[BE-04]` SSE S6 해소
**담당**: Conductor
**원인**: RabbitMQ 연결 타임아웃 (30s 초과)
**영향**: FE-04, FE-05 착수 불가
**조치**: Oracle 원인 조사 중
> 1시간 내 미해소 시 PM 에스컬레이션
```

#### PM 판단 요청 (`approval`)

```markdown
## 🔔 PM 판단 요청

**건명**: GitHub 레포 이름 규칙
**배경**: 스터디명에 특수문자 포함 시 레포 생성 실패

**선택지**:
1. 특수문자 자동 제거 후 생성 ⬅️ Oracle 추천
2. 사용자에게 레포명 직접 입력 요청
3. 스터디 생성 시 영문 이름 필수화

> Oracle 추천: 1번 — 사용자 경험 최소 마찰
```

---

## 5. Agent 기억 저장 규칙

### 5.1 기억 계층 구조

```
~/.claude/projects/-Users-leokim/memory/
├── MEMORY.md                    ← Oracle 전체 기억 (200줄 제한, 컨텍스트 자동 로드)
├── algosu-{토픽}.md             ← 토픽별 상세 기억 (MEMORY.md에서 참조)
└── agent/                       ← Agent별 작업 기록 (신규)
    ├── palette.md
    ├── herald.md
    ├── conductor.md
    ├── gatekeeper.md
    ├── architect.md
    ├── librarian.md
    ├── postman.md
    ├── curator.md
    ├── sensei.md
    └── scout.md
```

### 5.2 Oracle 기억 (`MEMORY.md`)

- **200줄 제한** (초과 시 자동 잘림)
- 저장 내용: 프로젝트 상태, PM 결정, 환경설정, 다음 할 일
- 상세 내용은 토픽 파일에 위임하고 링크만 기재
- Sprint 종료 시 완료된 Sprint 정보 → 토픽 파일로 이동, 요약만 잔류

### 5.3 토픽 메모리 (`algosu-{토픽}.md`)

- 각 토픽별 상세 정보 저장
- Oracle만 작성/수정 권한
- 현행 토픽: `session`, `ui-v2`, `deploy`, `lessons`, `cicd-history` 등
- 폐기된 결정/계획: 삭제 또는 `[폐기]` 마킹

### 5.4 Agent 작업 기록 (`agent/{agent명}.md`)

Agent가 작업을 완료하면 Oracle이 취합하여 기록한다.
**Agent가 직접 기억 파일을 수정하는 것은 금지.**

#### 저장 내용

```markdown
# {Agent명} 작업 기록

## 현행 Sprint
### [FE-03] 대시보드 레이아웃
- 상태: 완료 (2026-03-03)
- 변경: 6파일 (+320줄 / -80줄)
- 발견: 차트 라이브러리 CSS 충돌 → z-index 조정
- 교훈: Glassmorphism + 차트 결합 시 backdrop-filter 순서 주의

## 이전 Sprint 요약
- Sprint 3-2: Toast 리빌드, 난이도 뱃지 컬러 시스템 (3건 완료)
```

#### 저장 규칙

| 항목 | 저장 | 비저장 |
|---|---|---|
| 작업 이력 (ID, 결과, 변경 파일) | O | |
| 발견한 패턴·교훈 | O | |
| Agent 전문 영역 기술 결정 | O | |
| 코드 상세 내용 | | X (파일 경로만) |
| 일시적 에러·재시도 | | X |
| Agent 간 조율 세부 대화 | | X |

---

## 6. Skill 업데이트 규칙

### 6.1 Skill 파일 위치

```
~/.claude/commands/algosu-{agent명}.md
```

### 6.2 수정 권한

**Oracle만 skill 파일 수정 권한.** Agent 자체 수정 절대 금지.

### 6.3 업데이트 트리거

| 트리거 | 업데이트 내용 | 영향 범위 |
|---|---|---|
| PM 결정 확정 | 결정 사항 반영 | 해당 Agent 또는 전체 |
| 새 코드 규칙 추가 | 규칙 참조 추가 | 코드 작업 Agent 전체 |
| Sprint 종료 | 교훈·패턴 반영 | 해당 Agent |
| 문서 신규/갱신 | 참조 경로 갱신 | 관련 Agent |
| Agent 역할 변경 | 책임 범위 수정 | 해당 Agent |

### 6.4 업데이트 절차

```
1. Oracle이 변경 필요성 판단
2. Skill 파일 수정 (추가/변경/삭제)
3. 변경 내역을 Agent 작업 기록에 기재
4. PM 보고 대상인 경우 Discord report
```

### 6.5 현재 미반영 사항 (즉시 업데이트 필요)

현재 대부분 skill이 02/28에 마지막 수정됨. 이후 확정된 규칙이 미반영 상태:

- 클린 코드 + SOLID 원칙
- 어노테이션 체계 (`docs/annotation-dictionary.md` 참조)
- Prometheus + Loki 통합 규칙
- UI v2 PM 결정 사항 (네비게이션, 스터디룸, GitHub 연동 등)
- 작업 진행 가이드 + PM 보고 규칙

---

## 7. 문맥 제거 규칙

### 7.1 제거 주기

**Sprint 종료 시** Oracle이 전체 기억 파일을 전수 점검한다.

### 7.2 대상별 제거 규칙

#### `MEMORY.md` (200줄 제한)

```
현재: 180/200줄

제거 대상:
- 완료된 Sprint 상세 → 토픽 파일로 이동, 1줄 요약만 잔류
- 해소된 블로커/이슈 → 삭제 (교훈만 lessons에 보존)
- 폐기된 계획/결정 → 삭제

잔류 대상:
- 프로젝트 현재 상태 (항상 최신)
- PM 역할/권한/규칙 (상시 참조)
- 환경 설정 (변경 전까지 유지)
- 다음 할 일 (항상 최신)
```

#### 토픽 메모리 (`algosu-{토픽}.md`)

```
algosu-session.md (36KB → 정리 필요):
- 2 Sprint 이전 세션 → 삭제 (요약만 잔류)
- 현행 + 직전 Sprint만 상세 유지

algosu-v1.1-v1.2-plan.md:
- 완료된 계획 → [완료] 마킹, 미참조 시 삭제

일반 규칙:
- 토픽 파일당 50KB 상한 (초과 시 분할 또는 아카이브)
```

#### Agent 작업 기록 (`agent/{agent명}.md`)

```
- 현행 Sprint: 전체 상세 유지
- 직전 Sprint: 상세 유지
- 2 Sprint 이전: 요약만 남기고 상세 삭제
  예: "Sprint 3-2: Toast 리빌드 외 3건 완료"
- Agent당 파일 크기 10KB 상한
```

#### Skill 파일 (`algosu-{agent명}.md`)

```
- 더 이상 유효하지 않은 지시사항 → 삭제 (주석 처리 금지)
- 완료된 1회성 지시 → 삭제
- 항상 최신 상태 유지 (과거 버전 보관 안 함)
```

### 7.3 아카이브 정책

즉시 삭제가 아닌, 보존이 필요한 경우:

```
~/.claude/projects/-Users-leokim/memory/archive/
└── sprint-3-2-session.md      ← 종료 Sprint 세션 백업
```

- `archive/` 디렉토리에 보관
- 컨텍스트 자동 로드 대상 아님 (필요 시 수동 Read)
- 3 Sprint 이상 경과 시 삭제

### 7.4 문맥 제거 체크리스트 (Sprint 종료 시)

```
□ MEMORY.md 200줄 이내인가?
□ 완료 Sprint 정보가 토픽 파일로 이동되었는가?
□ algosu-session.md에 2 Sprint 이전 상세가 남아 있지 않은가?
□ Agent 작업 기록이 10KB 이내인가?
□ Skill 파일에 폐기된 지시가 없는가?
□ 폐기된 결정/계획에 [폐기] 마킹 또는 삭제되었는가?
□ 토픽 파일이 50KB 이내인가?
```

---

## 8. 페르소나 프롬프트 최적화 규칙

### 8.1 프롬프트 구조 표준 (7섹션)

```markdown
---
model: {opus/sonnet}
---

# {Agent명} ({한글명}) — [Tier {N}]

## 공통 규칙
참조: ~/.claude/commands/algosu-common.md (착수 전 필수 Read)

## 역할 & 핵심 책임
(불변 섹션, 역할 변경 시만 수정. 30줄 이내)

## 현행 규칙 참조
(경로 링크만, 본문 복붙 금지. 10줄 이내)

## Sprint 컨텍스트
(Sprint마다 교체. 15줄 이내)

## 주의사항 & 금지사항
(Agent별 특수 규칙. 15줄 이내)

## 기술 스택
(1~2줄)

$ARGUMENTS
```

### 8.2 핵심 원칙

- **구현 완료 현황 프롬프트 미포함** → `memory/agent/` 이동
- **규칙 본문 복붙 금지** → 경로 참조만 (원본 1곳 관리)
- **공통 섹션은 `algosu-common.md`** → 변경 시 1파일만 수정
- **100줄 상한** → 초과 시 Agent 기억 파일로 이동

### 8.3 모델 배정 기준

```
Opus 배정 조건 (하나 이상 해당):
- Tier 1 (Mission Critical)
- 복잡한 분산 트랜잭션 / 보안 판단
- 디자인 시스템 일관성 판단
- 아키텍처 결정이 필요한 분석

Sonnet 배정 (기본):
- Tier 2~3
- 단순 CRUD, 문서 작업, 반복 패턴
- 명확한 지시 실행
```

현재 배정:
- **Opus (4명)**: Conductor, Gatekeeper, Librarian, Palette
- **Sonnet (7명)**: Herald, Architect, Postman, Curator, Sensei, Scout, Scribe

### 8.4 갱신 트리거

| 트리거 | 갱신 범위 | 담당 |
|---|---|---|
| PM 결정 확정 (즉시) | 해당 Agent 또는 전체 | Scribe (Oracle 지시) |
| Sprint 전환 | "Sprint 컨텍스트" 섹션 일괄 교체 | Scribe |
| 역할/모델 변경 (드묾) | "역할 & 핵심 책임" 또는 frontmatter | Scribe (PM 승인 필요) |
| 공통 규칙 변경 | `algosu-common.md` 수정 | Scribe |

### 8.5 갱신 절차

```
1. Oracle이 변경 필요성 판단 + 대상 Agent 식별
2. Scribe에 갱신 지시
3. Scribe가 Skill 수정 (100줄 상한 확인)
4. Scribe가 Agent 작업 기록에 "skill 갱신" 기재
5. Oracle 검증 → PM 보고 (전체 영향 시)
```

### 8.6 갱신 검증 체크리스트

```
□ 수정된 skill이 100줄 이내인가?
□ 경로 참조가 실제 존재하는 파일인가?
□ Sprint 컨텍스트가 현행 Sprint와 일치하는가?
□ 구현 현황이 프롬프트에 남아 있지 않은가?
□ 규칙 본문이 복붙되어 있지 않은가? (경로만 있는가?)
□ 공통 섹션이 algosu-common.md에 위임되어 있는가?
```

---

## 9. TF 구성원 (11명)

| Agent | 한글명 | Tier | 모델 | 전문 영역 |
|---|---|---|---|---|
| Conductor | 지휘자 | 1 | Opus | 제출 생명주기, Saga, MQ |
| Gatekeeper | 관문지기 | 1 | Opus | Gateway, 인증, 보안 |
| Librarian | 기록관리자 | 1 | Opus | DB, 마이그레이션 |
| Postman | 배달부 | 2 | Sonnet | GitHub Worker, 동기화 |
| Curator | 출제자 | 2 | Sonnet | 문제 서비스, BOJ 연동 |
| Architect | 기반설계자 | 2 | Sonnet | k8s, 인프라, CI/CD |
| Scribe | 서기관 | 2 | Sonnet | 메모리, 문서, Skill 관리 |
| Palette | 팔레트 | 3 | Opus | 디자인 시스템, UI 토큰 |
| Herald | 전령 | 3 | Sonnet | 프론트엔드 페이지 로직 |
| Sensei | 분석가 | 3 | Sonnet | AI 분석 서비스 |
| Scout | 정찰병 | 3 | Sonnet | 코드 탐색, 분석 |

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|---|---|---|
| v1.0 | 2026-03-02 | 초안 작성 — 작업 흐름 + Oracle 현황 표시 규칙 |
| v1.1 | 2026-03-02 | PM 보고 규칙 추가 — Discord 채널 매핑, 포맷, 템플릿 |
| v1.2 | 2026-03-02 | Agent 기억 저장 + Skill 업데이트 + 문맥 제거 규칙 추가 |
| v1.3 | 2026-03-02 | 페르소나 최적화 규칙 + Scribe 신설 + TF 구성원 11명 |
