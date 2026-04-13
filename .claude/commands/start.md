새 대화를 시작합니다. 아래 단계를 순서대로 수행하세요.

## 1단계: 컨텍스트 로딩

`~/.claude/projects/-root-AlgoSu/memory/sprint-window.md`를 읽으세요.

> **참고**: MEMORY.md는 시스템이 자동 주입하고, git status/log는 gitStatus로 이미 제공됩니다. 별도 로딩 불필요.

## 2단계: 상태 검증

sprint-window.md의 frontmatter `status` 필드를 확인하세요:
- `idle` → 정상. 3단계로 진행.
- `active` → **경고**: "이전 스프린트가 정상 종료되지 않았습니다. `/stop`을 먼저 실행하거나, 이어서 작업할지 알려주세요." 출력 후 사용자 응답 대기.
  - "이어서" → 3~4단계 스킵, 바로 **5단계(대시보드)** 출력. start_commit/제목 변경하지 않음.
  - "/stop 먼저" → 사용자에게 `/stop` 실행을 안내하고 종료.
- 필드 없음 → idle로 간주하고 진행.

## 3단계: 스프린트 제목 결정

[2] 섹션의 제목을 아래 우선순위로 결정하세요:

1. **$ARGUMENTS가 있으면** → 인자를 스프린트 제목으로 사용, [2] 섹션의 제목/목표 갱신
2. **[2] 제목이 이미 설정되어 있으면** (≠ "미정") → 기존 제목 유지
3. **[2]가 "미정"이고 인자 없음** → 사용자에게 질문:
   "이번 스프린트 주제를 알려주세요. (미정으로 시작하려면 Enter)"
   응답이 있으면 [2] 갱신, 없으면 "미정"으로 진행.

## 4단계: 스프린트 활성화

sprint-window.md를 갱신하세요:
1. frontmatter `status`를 `active`로 변경
2. [2] 섹션의 `start_commit`에 현재 HEAD hash 기록 (`git rev-parse --short HEAD`)
3. 3단계에서 제목이 결정되었으면 [2] 섹션의 제목/목표도 함께 갱신

## 5단계: 대시보드 출력

```
## AlgoSu 대시보드

| 항목 | 상태 |
|------|------|
| 현재 스프린트 | Sprint {N} — {제목} ({idle → 신규 시작 / active → 이어서}) |
| 이전 스프린트 | Sprint {N-1} — {제목} (완료 ✅) |

### 잔여 항목
MEMORY.md "후속 처리 필요" 섹션에서 미완료 항목만 나열하세요.

### 작업 안내
모든 작업은 `/algosu-oracle`을 통해 요청하세요.
Oracle이 12개 전문 에이전트(Architect, Conductor, Gatekeeper, Postman, Palette, Curator, Scribe, Sensei, Herald, Scout, Librarian)에게 적절히 위임합니다.
```

마지막에 "무엇을 도와드릴까요?" 로 마무리하세요.
