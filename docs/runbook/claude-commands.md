# Runbook: .claude/commands tracked 정책

> **적용 범위**: `.claude/commands/` 하위 모든 에이전트/명령 정의 파일
> **도입**: Sprint 150 시드 #16 (Sprint 147 ADR cross-ref 다중 머신 동기화 부재 문제 해소)
> **관련 파일**: `.gitignore`, `CLAUDE.md` "Agent 워크플로우" 섹션

---

## 1. 개요

Sprint 147 회고에서 `.claude/commands/agents/critic.md` + `architect.md`에 추가한 RUNBOOK cross-ref가 **gitignored 상태**라 다른 머신에서 동기화 불가하다는 한계가 드러났다. 본 RUNBOOK은 `.claude/commands/`의 tracked / untracked 경계를 명시한다.

| 디렉토리 / 파일 | 상태 | 이유 |
|-----------------|------|------|
| `.claude/commands/**` | **tracked** | 팀 공유 에이전트 워크플로우 — Oracle/Librarian/Scribe 등 12 에이전트 정의 SSOT |
| `.claude/settings.local.json` | untracked | 로컬 세팅 (사용자별 설정 차이) |
| `.claude/scheduled_tasks.lock` | untracked | 일시적 락 파일 |
| `.claude/cache/`, `.claude/logs/` | untracked | 로컬 캐시/로그 |
| `.claude-tools/` | untracked | Oracle 디스패치 도구 (별도 정리 예정) |

---

## 2. tracked 파일 목록 (Sprint 150 초기 18개)

### 2.1 Root commands (5)
- `sprint-open.md` — 새 대화 시작 / 스프린트 활성화
- `sprint-close.md` — 스프린트 종료 / 기억 문서 갱신
- `algosu-oracle.md` — Oracle 심판관 (작업 위임)
- `algosu-review.md` — 코드 리뷰 체크리스트
- `algosu-adr-blog.md` — ADR → 기술 블로그 변환

### 2.2 Agents (13)
- `agents/_base.md` — Oracle 프로토콜 (전 에이전트 공통)
- `agents/architect.md` — 기반설계자
- `agents/conductor.md` — 지휘자
- `agents/critic.md` — 비평가 (Codex gpt-5 2차 리뷰)
- `agents/curator.md` — 출제자
- `agents/gatekeeper.md` — 관문지기
- `agents/herald.md` — 전령
- `agents/librarian.md` — 기록관리자
- `agents/palette.md` — 팔레트
- `agents/postman.md` — 배달부
- `agents/scout.md` — 정찰병
- `agents/scribe.md` — 서기관
- `agents/sensei.md` — 분석가

---

## 3. 신규 agent / command 추가 시 등록 의무

1. **파일 작성**: `.claude/commands/{name}.md` 또는 `.claude/commands/agents/{name}.md`
2. **자동 tracked**: `.gitignore` 의 `!.claude/commands/` negation 으로 자동 포함
3. **본 RUNBOOK §2 갱신**: 신규 파일을 §2.1 또는 §2.2 목록에 추가
4. **CLAUDE.md "Agent 워크플로우" 섹션 점검**: 신규 에이전트라면 12 에이전트 나열 부분 갱신
5. **보안 grep**: §4 체크리스트 실행 후 커밋

---

## 4. 보안 grep 체크리스트 (커밋 전 필수)

`.claude/commands/` 내 파일에 시크릿/PII가 포함되지 않았는지 확인.

```bash
grep -r -E 'JWT|TOKEN|SECRET|PASSWORD|api[_-]?key|postgresql://|mysql://|redis://|aws_access|AKIA[0-9A-Z]{16}|ghp_|gho_' .claude/commands/

grep -r -E 'X-Internal-Key|JWT_SECRET|DATABASE_URL|tpals0409|leo\.kim@' .claude/commands/
```

**판정 기준**:
- ✅ 정책 키워드만 매치 (예: "민감정보 노출 없음 (JWT, 토큰, 키, PII)" — 체크리스트 본문) → 안전
- ❌ 실제 시크릿 값 매치 (예: `JWT_SECRET=xxxxx`, `Bearer eyJxxx`, `postgresql://user:pass@host/db`) → **즉시 제거 + Oracle 보고**

---

## 5. 로컬 / 공유 경계 결정 기준

| 항목 | tracked | untracked | 판단 |
|------|---------|-----------|------|
| 사용자 머신마다 다른 설정 | ❌ | ✅ | settings.local.json |
| 일시적 / 자동 생성 | ❌ | ✅ | lock, cache, logs |
| 12 에이전트 페르소나 정의 | ✅ | ❌ | 팀 SSOT |
| Oracle 디스패치 스크립트 | ❌ | ✅ | .claude-tools/ — 별도 시드 |
| RUNBOOK / ADR cross-ref | ✅ | ❌ | 다중 머신 동기화 필수 |

**원칙**: "팀원 간 동일해야 하는 워크플로우 SSOT" → tracked / "로컬 환경 / 세션 / 캐시" → untracked.

---

## 6. 이력

- **2026-05-13** — Sprint 150 시드 #16: 초기 18개 파일 tracked 전환 + 본 RUNBOOK 신설
