---
type: index
domain: docs
---
# AlgoSu 문서 인덱스

알고리즘 스터디 플랫폼(MSA) 운영·설계·결정 기록의 SSOT.

## 카테고리

| 카테고리 | 위치 | 설명 |
|----------|------|------|
| 의사결정 기록 (ADR) | [`docs/adr/`](./adr/README.md) | 영구 ADR + sprint 회고형 ADR + 토픽 ADR |
| 운영 런북 | `docs/runbook-*.md` | 시스템 운영·롤백·로테이션 절차 |
| 컨벤션 / 패턴 | `docs/{conventions,patterns}` (루트 산재 — 추후 통합 예정) | 코드/DB/도메인 패턴 |
| 감사 산출물 | [`docs/audits/`](./audits/README.md) | 전수 감사 자동화 sprint별 산출물 |
| 자산 | `docs/assets/` | 로고 등 정적 자원 |

## 운영 런북 (14개)

운영 단계별 표준 절차 — 사고/롤백 시 즉시 참조.

| 영역 | 런북 |
|------|------|
| **CI / 배포** | [runbook-ci-rebuild-all](./runbook-ci-rebuild-all.md) · [runbook-e2e-pr-label](./runbook-e2e-pr-label.md) · [runbook-gitops-migration](./runbook-gitops-migration.md) · [runbook-dependency-major-upgrade](./runbook-dependency-major-upgrade.md) |
| **DB / 마이그레이션** | [runbook-db-migration](./runbook-db-migration.md) |
| **GitHub / 인증** | [runbook-github-token-relink](./runbook-github-token-relink.md) · [runbook-pat-rotation](./runbook-pat-rotation.md) · [runbook-key-rotation](./runbook-key-rotation.md) · [runbook-admin-emails](./runbook-admin-emails.md) |
| **로컬 개발 환경** | [runbook-git-hooks](./runbook-git-hooks.md) · [runbook-claude-commands](./runbook-claude-commands.md) · [runbook-oracle-tmux-path](./runbook-oracle-tmux-path.md) |
| **도메인 파이프라인** | [runbook-programmers-pipeline](./runbook-programmers-pipeline.md) |
| **품질 자동화** | [runbook-regex-robustness](./runbook-regex-robustness.md) |

## 컨벤션 / 패턴 (6개)

코드/DB 컨벤션과 도메인 패턴.

| 문서 | 한 줄 요약 |
|------|------------|
| [conventions-migration](./conventions-migration.md) | TypeORM Migration 파일명 규칙 |
| [db-connection-pool](./db-connection-pool.md) | DB Connection Pool & DataSource 설정 현황 |
| [gateway-middleware-pipeline](./gateway-middleware-pipeline.md) | Gateway 미들웨어 파이프라인 순서 |
| [oauth-scopes](./oauth-scopes.md) | OAuth Scope 정의 |
| [soft-delete-pattern](./soft-delete-pattern.md) | User Soft Delete 패턴 |
| [token-expiry-policy](./token-expiry-policy.md) | JWT/Refresh 토큰 만료 정책 |

> 추후 마이그레이션 스프린트에서 `docs/conventions/`, `docs/patterns/` 디렉토리로 분리 예정 (Sprint 153 범위 외).

## 의사결정 기록 (ADR)

[`docs/adr/`](./adr/README.md) 참조.

- **영구 ADR** (8개): `ADR-{NNN}-{slug}.md` — 초기 아키텍처 + Sprint 124+ 주요 결정
- **회고형 sprint ADR** (89개): `sprints/sprint-{NN}.md` — Sprint 62 이후 매 sprint 회고
- **토픽 ADR** (1개): `sprint-95-programmers-dataset.md` — sprint별 회고 외 주제 심화

## 감사 산출물

[`docs/audits/`](./audits/README.md) 참조.

- 정리본 `.md`만 영구 보존, 원시 `.jsonl`은 비보존 (Sprint 153 정책 명문화)

## 신규 문서 추가 시

1. **카테고리 결정**: 위 5 카테고리 중 하나 선택 (런북 / 컨벤션 / ADR / 감사 / 자산)
2. **명명 규칙**:
   - 런북: `runbook-{topic}.md` (kebab-case)
   - ADR: `ADR-{NNN}-{topic}.md` 또는 `sprints/sprint-{NN}.md`
   - 컨벤션/패턴: `{topic}-{kind}.md` (예: `soft-delete-pattern.md`)
3. **본 README 갱신** — 카테고리 표에 추가
4. **cross-ref 영향 범위 점검** — 디렉토리 변경 시 `grep -rn "docs/{old-path}" --include="*.md" ...` 필수

## 관련 외부 SSOT

- [CLAUDE.md](../CLAUDE.md) — 프로젝트 코드 컨벤션 / 디자인 토큰 / 보안 규칙
- [.claude/commands/agents/](../.claude/commands/agents/) — Oracle / 12 페르소나 정의
- [blog/](../blog/) — 기술 블로그 (KR/EN 양면)
