---
type: index
domain: docs/adr
---
# ADR (Architecture Decision Records)

AlgoSu의 아키텍처/도메인 결정과 sprint 회고를 보관한다.

## 디렉토리 구조

```
docs/adr/
├─ README.md                              ← 본 문서
├─ ADR-{NNN}-{slug}.md                    ← 영구 ADR (8개)
├─ topics/
│  └─ {topic-slug}.md                     ← 토픽 ADR (1개)
└─ sprints/
   └─ sprint-{NN}.md                      ← 회고형 sprint ADR (127개, Sprint 62~188)
```

> **카운트 정합 (Sprint 176)**: 위 "(N개)" 표기는 실제 파일 수와 일치해야 한다. CI(`scripts/check-adr-index-count.mjs --strict`, quality-docs 잡)가 rebase/머지 중 발생하는 누적 카운트 드리프트를 차단하므로, ADR 추가/삭제 시 본 인덱스의 모든 "(N개)" 표기를 함께 갱신할 것.

## 분류 기준

| 유형 | 명명 | 위치 | 용도 |
|------|------|------|------|
| **영구 ADR** | `ADR-{NNN}-{slug}.md` | `docs/adr/` | 아키텍처/플랫폼 차원 결정 — sprint 단위 회고 외 |
| **토픽 ADR** | `{topic-slug}.md` | `docs/adr/topics/` | 주제별 심화 문서 — sprint 회고와 별도 보존 |
| **회고형 sprint ADR** | `sprint-{NN}.md` | `docs/adr/sprints/` | sprint 단위 결정/구현/검증/교훈 회고 |

> **단발 sprint 노트의 통합 (Sprint 153)**: 과거 `docs/sprint-{40,48,51}-*.md`로 떠 있던 단발 노트는 `docs/adr/sprints/sprint-{40,48,51}.md`로 이전됨. Sprint 62부터는 매 sprint 회고형 ADR을 동일 컨벤션(`sprint`/`title`/`date`/`status` frontmatter)으로 작성.

## 영구 ADR (8개)

| ADR | 제목 | 상태 | 도입 sprint |
|-----|------|------|-------------|
| [ADR-001](./ADR-001-gateway-identity-db-separation.md) | Gateway → Identity DB 분리 | 구현 완료 | Sprint 51 |
| [ADR-002](./ADR-002-outbox-pattern.md) | Outbox 패턴 도입 | 구현 완료 | — |
| [ADR-003](./ADR-003-redis-rabbitmq-acl.md) | Redis / RabbitMQ ACL | 구현 완료 | — |
| [ADR-024](./ADR-024-admin-server-guard.md) | Admin 서버사이드 권한 가드 — CSR → Server Component 전환 | 수락 | Sprint 124 |
| [ADR-025](./ADR-025-gateway-oauth-error-normalization.md) | Gateway OAuth 에러 정규화 | 수락 | Sprint 125+ |
| [ADR-026](./ADR-026-sprint-130-incident-stuck-rollouts-and-sealed-secrets-debt.md) | Stuck Rollouts & Sealed Secrets 부채 (Sprint 130 인시던트) | 수락 | Sprint 130 |
| [ADR-027](./ADR-027-aether-gitops-branch-discipline.md) | Aether GitOps 브랜치 규율 | 수락 | Sprint 130+ |
| [ADR-028](./ADR-028-dev-cluster-separation.md) | Dev 클러스터 분리 | 수락 | Sprint 130+ |

> ADR-004 ~ 023은 미작성 (sprint별 회고형 ADR로 통합되었거나 본 형식으로 승격 예정). 새로 영구 ADR을 작성할 때는 **다음 빈 번호(ADR-029)** 부터 사용.

## 토픽 ADR (1개)

| 문서 | 한 줄 요약 |
|------|------------|
| [topics/sprint-95-programmers-dataset](./topics/sprint-95-programmers-dataset.md) | 프로그래머스 데이터셋 번들링 + Gateway 외부 연동 (Sprint 95 심화 — `sprints/sprint-95.md`와 별개) |

## 회고형 sprint ADR (127개)

`sprints/sprint-{NN}.md` — Sprint 62 ~ 188 매 sprint 회고. 신규 sprint 종료 시 `/stop` 워크플로우가 자동 생성/갱신 (KR + EN 동시 작성).

각 sprint ADR의 표준 구조:
- frontmatter: `sprint`, `title`, `date`, `status` (+ 선택: `agents`, `related_adrs`, `related_memory`)
- 본문: 목표 / 결정 / 구현 / 검증 / 교훈 / 다음 sprint 이월 시드

빠른 검색:
```bash
ls docs/adr/sprints/                          # 전체 목록
ls docs/adr/sprints/ | sort -V | tail -5      # 최근 5개
grep -l "{keyword}" docs/adr/sprints/*.md     # 키워드 검색
```

## 신규 ADR 추가 시

| 결정 유형 | 작성 위치 | 명명 |
|-----------|-----------|------|
| sprint 회고 (매 sprint 종료) | `sprints/sprint-{NN}.md` | `/stop` 자동 생성 |
| 영구 아키텍처 결정 | `ADR-{다음 빈 번호}-{slug}.md` | 의식적 명명 (영구 보존 대상) |
| 주제별 심화 | `{topic}-{slug}.md` | sprint 회고와 별도 보존 시 |

본 README의 영구/토픽 ADR 표를 함께 갱신할 것.

## 관련 외부 SSOT

- [docs/README.md](../README.md) — 전체 문서 인덱스
- [CLAUDE.md](../../CLAUDE.md) — 프로젝트 컨벤션
- [memory/](../../../.claude/projects/-Users-leokim-Desktop-leo-kim-AlgoSu/memory/) — Sprint 메모리 (개인 슬라이딩 윈도우)

## 사람용 HTML 사이트

- 한국어: `https://blog.algosu.dev/adr/`
- English: `https://blog.algosu.dev/en/adr/` — 영문판이 있는 ADR은 영문 본문 / 없는 ADR은 한국어 본문 + "Content in Korean" 배너 fallback

## 영문 ADR 디렉토리

- 영문판 SSOT: [`../adr-en/`](../adr-en/) — Sprint 157 P10에서 도입. blog `content/posts-en/` 패턴 계승.
- 자동 번역기: `node scripts/translate-adr.mjs --target <kr-path>` (ANTHROPIC_API_KEY 필요)
- 누락 점검: `node scripts/check-adr-en-coverage.mjs --lint`
- 신규 ADR 작성 시 KR + EN 동시 작성 의무 — `.claude/commands/stop.md` 3단계 + `.claude/commands/agents/scribe.md` 참조
