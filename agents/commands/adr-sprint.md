AlgoSu Sprint ADR 자동 생성 도우미

## 역할
스프린트 종료 시 Agent용 의사결정 기록(Sprint ADR)을 자동 생성합니다.
모든 Agent가 작업 착수 전 최근 Sprint ADR을 참조하여 기존 결정/패턴/교훈을 활용합니다.

## 생성 절차

### Step 1: 데이터 수집 (병렬)
다음을 **병렬로** 수행하세요:
1. `~/.claude/projects/-root-AlgoSu/memory/sprint-window.md` 읽기 — 완료 스프린트 정보
2. `~/.claude/projects/-root-AlgoSu/memory/MEMORY.md` 읽기 — 최근 변경사항
3. `git log --oneline -20` 실행 — 스프린트 커밋 확인
4. `git diff --stat HEAD~{커밋수}` 실행 — 변경 파일 통계

### Step 2: 사용자 입력
수집 데이터 기반으로 초안을 제시하고 사용자에게 확인하세요:
- 스프린트 번호 및 제목
- 주요 의사결정 (자동 추출 + 수동 보충)
- 새로 도입한 패턴
- 발견한 Gotcha/교훈
- 참여 Agent 목록

### Step 3: Sprint ADR 파일 생성
`docs/adr/sprints/sprint-{N}.md` 파일을 아래 템플릿으로 생성하세요.

## 템플릿

```markdown
---
sprint: {N}
title: "{Sprint Title}"
date: "{YYYY-MM-DD}"
status: completed
agents: [{참여 agent 목록}]
related_adrs: [{관련 ADR 번호 목록, 없으면 빈 배열}]
---

# Sprint {N}: {Title}

## Decisions
### D1: {결정 제목}
- **Context**: {이 결정이 필요했던 배경}
- **Choice**: {결정 내용}
- **Alternatives**: {기각된 대안, 없으면 "없음"}
- **Code Paths**: `{관련 파일 경로}`

{추가 결정이 있으면 D2, D3... 반복}

## Patterns
### P1: {패턴명}
- **Where**: `{적용 파일 경로}`
- **When to Reuse**: {이 패턴을 재사용해야 하는 조건}

{추가 패턴이 있으면 P2, P3... 반복. 없으면 "해당 없음"}

## Gotchas
### G1: {교훈 제목}
- **Symptom**: {발생한 증상}
- **Root Cause**: {원인}
- **Fix**: {해결 방법}

{추가 교훈이 있으면 G2, G3... 반복. 없으면 "해당 없음"}

## Metrics
- Commits: {N}건, Files changed: {N}개
```

### Step 4: 검증
- 파일이 `docs/adr/sprints/` 에 정상 생성되었는지 확인
- YAML frontmatter 파싱 가능 여부 확인
- 관련 ADR 번호가 실제 `docs/adr/` 에 존재하는지 확인

## 참조
- 기존 ADR: `docs/adr/ADR-*.md`
- 기존 Sprint ADR 예시: `docs/adr/sprints/sprint-*.md`

## 주의사항
- 결정(Decisions)이 없는 스프린트도 Patterns 또는 Gotchas만으로 기록 가능
- 코드 경로는 반드시 실제 파일을 확인하여 기재
- 날짜는 스프린트 완료일 기준 절대 날짜 사용

$ARGUMENTS
