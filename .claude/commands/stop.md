스프린트를 종료하고 기억 문서를 갱신합니다. 아래 단계를 순서대로 수행하세요.

## 1단계: 현재 상태 확인

다음을 **병렬로** 수행하세요:
1. `~/.claude/projects/-root-AlgoSu/memory/sprint-window.md` 읽기
2. sprint-window.md [2] 섹션의 `start_commit`을 확인하고 `git log --oneline {start_commit}..HEAD` 실행 (start_commit이 없으면 `git log --oneline -10`)
3. `git -C /root/aether-gitops log @{upstream}..HEAD --oneline` 실행 (`/root/aether-gitops` 디렉토리 존재 시)
   - 미푸시 커밋이 있으면 경고: "⚠️ aether-gitops에 미푸시 커밋 {N}건이 있습니다. push 후 진행하세요."
   - 디렉토리가 없으면 스킵

> **참고**: MEMORY.md는 시스템 자동 주입이므로 별도 읽기 불필요.

### 상태 가드
- `status: active` → 정상, 2단계로 진행.
- `status: idle` → [1] 완료 섹션과 MEMORY.md 테이블/Sprint ADR을 대조하세요:
  - **모두 일치** → "활성 스프린트가 없습니다. `/start`를 먼저 실행하세요." 출력 후 **중단**.
  - **불일치 발견** (ADR 미생성 또는 MEMORY 미갱신) → "이전 /stop이 중단된 것으로 보입니다. 미완료 단계를 이어서 수행합니다." 출력 후 **누락된 단계부터 재개** (ADR 미생성 → 3단계, MEMORY 미갱신 → 5단계).

### 커밋 확인
git log 결과가 비어있으면 (start_commit 이후 커밋 없음):
- "이번 스프린트에 커밋이 없습니다. 스프린트를 취소하시겠습니까?" 질문
- 취소 → sprint-window.md `status`만 `idle`로 변경 후 **종료** (윈도우/ADR/MEMORY 갱신 없음)
- 진행 → 2단계로 계속 (빈 작업 요약으로 최소 기록)

## 2단계: 자동 초안 + 사용자 확인

sprint-window.md [2] 섹션과 git log를 기반으로 **초안을 자동 생성**하여 제시하세요:

```
## 스프린트 종료 초안

- **스프린트**: Sprint {N} — {제목} (sprint-window.md [2]에서 추출)
- **작업 요약**: (git log 커밋 기반 자동 추출)
  - {커밋 메시지 요약 1}
  - {커밋 메시지 요약 2}
- **이월 항목**: 없음 (또는 추정)

수정할 내용이 있으면 알려주세요. 없으면 "확인"이라고 답해주세요.
```

이어서 **다음 스프린트 정보만** 질문하세요:
- 다음 스프린트 번호, 제목, 계획 작업 (또는 "미정")

## 3단계: Sprint ADR 생성

`agents/commands/adr-sprint.md`의 **템플릿(Step 3)**을 따라 `docs/adr/sprints/sprint-{N}.md` 파일을 생성하세요.

> **컨텍스트 안내**: adr-sprint.md의 Step 1(데이터 수집)은 스킵하세요. 이미 1~2단계에서 수집 완료된 정보를 사용합니다. 종료 스프린트 정보는 sprint-window.md **[2] 섹션**(아직 갱신 전)에 있습니다.

결정/패턴/교훈이 모두 없는 경우 "해당 없음"으로 최소 기록합니다.

## 4단계: 슬라이딩 윈도우 갱신

`sprint-window.md`를 아래 규칙으로 갱신하세요:

1. 기존 `[1] 완료` 섹션 → **삭제**
2. 기존 `[2] 다음` 섹션 → 결과를 채워 `[1] 완료`로 승격 (start_commit 필드 제거)
3. 새 `[2] 다음` 섹션 → 사용자 입력 기반 작성 (start_commit: 미정)
4. frontmatter `status`는 아직 **변경하지 않음** (5단계 검증 후 변경)

> **주의**: Sprint ADR 파일(`docs/adr/sprints/sprint-*.md`)은 영구 보존합니다. 삭제하지 마세요.

### 윈도우 포맷

```markdown
---
name: 스프린트 윈도우
description: 최근 2 스프린트만 유지하는 슬라이딩 윈도우 — 완료 결과 + 다음 계획
type: project
status: active
---

# 스프린트 윈도우 (크기 2)

## [1] 완료 — Sprint {N}: {제목}
- **기간**: {시작일} ~ {완료일}
- **상태**: 완료 ✅ | 구현완료(배포전) 📦
- **작업 요약**:
  - {작업-1}: {한줄 설명}
  - {작업-2}: {한줄 설명}
- **주요 산출물**: {ADR, 런북, 신규 API 등 핵심만}
- **이월 항목**: {없으면 "없음"}

## [2] 다음 — Sprint {N+1}: {제목}
- **start_commit**: (미정 — /start 실행 시 기록)
- **목표**: {1~2문장}
- **계획 작업**:
  - [ ] {작업-1}: {한줄 설명}
  - [ ] {작업-2}: {한줄 설명}
- **담당 에이전트**: {주요 에이전트 나열}
```

## 5단계: MEMORY.md 갱신 + 일관성 검증 + 상태 전환

### MEMORY.md 갱신
- 스프린트 테이블에 완료 행 추가 (**6행 초과 시 오래된 행 삭제**)
- "후속 처리 필요" 섹션 점검: 이번 스프린트에서 해결된 항목이 있으면 제거하세요
- 200줄 이내 유지 확인

### 일관성 검증
다음 3개 파일이 일관적인지 확인하세요:
1. `sprint-window.md` [1] 완료 섹션 → 방금 종료한 스프린트 정보 일치
2. `docs/adr/sprints/sprint-{N}.md` → 파일 존재 + 스프린트 번호 일치
3. `MEMORY.md` 테이블 → 최신 행이 방금 종료한 스프린트

불일치 발견 시 수정하세요.

### 상태 전환 (최종)
모든 검증 통과 후 sprint-window.md frontmatter `status`를 `idle`로 변경하세요.

> **핵심**: status → idle은 반드시 모든 갱신이 완료된 후 마지막에 수행합니다. 이렇게 해야 중단 시 복구가 가능합니다.

## 6단계: 완료 보고

```
## 스프린트 종료 완료

| 항목 | 내용 |
|------|------|
| 종료 | Sprint {N} — {제목} ✅ |
| 다음 | Sprint {N+1} — {제목} |
| 윈도우 | sprint-window.md 갱신 완료 (status: idle) |
| Sprint ADR | docs/adr/sprints/sprint-{N}.md 생성 완료 |
| MEMORY | 테이블 갱신 완료 ({현재 행 수}/6) |
| 잔여 정리 | {제거한 항목 또는 "없음"} |
```
