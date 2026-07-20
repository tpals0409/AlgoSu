---
sprint: 251
title: "SSOT 이월 항목 해소 — 내부 키 네이밍 개정·Sprint-250 ADR frontmatter·ADR 카운트·c-ares CVE"
date: "2026-07-17"
status: completed
agents: [Oracle, Scribe]
related_adrs: ["sprint-249", "sprint-250", "sprint-248"]
related_memory: ["sprint-window", "sprint-249-ssot-drift"]
topics: ["ssot", "internal-key-naming", "adr", "security", "docs"]
tldr: "Sprint 249~250 이월 문서 개정 3건 처리. ①CLAUDE.md Q-5 내부 키 네이밍 SSOT 개정 — Gateway→MSA(`INTERNAL_KEY_<TARGET>`) / 서비스 간 직접 호출(`<TARGET>_SERVICE_KEY`) 호출 경로별 2패턴 명시(Sprint 249 결정 반영). ②Sprint-250 ADR KR+EN frontmatter 누락 추가(Critic P2 해소). ③docs/adr/README.md ADR 카운트 188개 갱신 + blog/Dockerfile c-ares CVE 해소. 레포 커밋 3건(04b74bb·854c90e·ee4d4fe), Critic CLEAN."
---
# Sprint 251 — SSOT 이월 항목 해소

_날짜: 2026-07-17_

## 목표

Sprint 249~250에서 이월된 문서 개정 항목 완전 해소:
1. CLAUDE.md Q-5 내부 키 네이밍 SSOT가 단일 패턴(`<SERVICE>_SERVICE_KEY`)만 기술 → 실제 코드의 두 패턴(Gateway 아웃바운드·서비스 간 직접 호출) 반영 미흡
2. Sprint-250 ADR KR+EN frontmatter 항목 누락 → Critic P2 미결
3. docs/adr/README.md ADR 카운트 구식 + blog/Dockerfile c-ares CVE 잔존

## 결정 사항

### D1. 내부 키 네이밍 SSOT 2-패턴 분리 (CLAUDE.md Q-5 개정)

**기존**: 단일 패턴 `<SERVICE>_SERVICE_KEY`만 명시  
**변경**: 호출 경로별 2패턴으로 분리

| 방향 | 환경변수 패턴 | 예시 | SSOT 코드 파일 |
|------|-------------|------|---------------|
| **인바운드** (자기 서비스 키 검증) | `INTERNAL_API_KEY` | — | 모든 서비스 공통 |
| **아웃바운드 — Gateway → MSA** | `INTERNAL_KEY_<TARGET>` | `INTERNAL_KEY_PROBLEM` | `services/gateway/src/common/config/service-keys.config.ts` |
| **아웃바운드 — 서비스 간 직접 호출** | `<TARGET>_SERVICE_KEY` | `PROBLEM_SERVICE_KEY` | `services/submission/src/common/problem-service-client/problem-service-client.ts`, `services/github-worker/src/config.ts` |

**근거**: Sprint 248 인시던트 재발 방지 — SealedSecret 봉인 시 CLAUDE.md 예시가 아닌 **실제 코드 config 필드명**을 SSOT로 사용해야 한다는 교훈(Sprint 248)을 SSOT 자체에 명문화.

### D2. Sprint-250 ADR frontmatter 누락 항목 추가

`docs/adr/sprints/sprint-250.md` 및 `docs/adr-en/sprints/sprint-250.md` 모두 `frontmatter` 항목(`related_memory` 등) 누락 → Critic P2 지적 해소.

### D3. 문서·CVE 갱신

- `docs/adr/README.md`: ADR 카운트 188개로 정확화
- `blog/Dockerfile`: c-ares CVE 취약 버전 해소

## 완료 항목

| 커밋 | PR | 내용 |
|------|----|------|
| `04b74bb` | — | docs/adr/README.md ADR 카운트 188개 갱신 + blog c-ares CVE 해소 |
| `854c90e` | #468 | CLAUDE.md Q-5 내부 키 네이밍 SSOT 개정 (2패턴 분리) |
| `ee4d4fe` | #469 | Sprint-250 ADR KR+EN frontmatter 누락 추가 + ADR 카운트 정합 |

**Critic 결과**: Codex gpt-5.5 (`--base 04b74bb`) — 문서 전용 변경 → findings 0건 **CLEAN**.

## 이월

- [ ] 🔴 보안: ANTHROPIC_API_KEY 재로테이션 (사용자 보류 — Anthropic Console 키 폐기 후 신규 발급 + SealedSecret 재봉인)
- [ ] GA4 admin Enhanced Measurement OFF (사용자 직접)
- [ ] GA4 프로덕션 동작 UAT (사용자 직접)
- [ ] 서버 재배포 + 라이브 SEO 검증 (운영, Sprint 212/213 산출물)
- [ ] GA4 admin 데이터 스트림 URL `algo-su.com` 정합 (사용자 직접)

## 교훈

- **SSOT 드리프트는 인시던트가 나기 전에 잡아야 한다**: Sprint 248 `INTERNAL_KEY_PROBLEM` vs `PROBLEM_SERVICE_KEY` 혼선은 잘못된 SSOT 문서에서 시작됐다. 이번 개정으로 코드 2곳을 근거로 삼는 명확한 패턴 분리표가 CLAUDE.md에 박제됐다.
- **Critic P2는 다음 스프린트 착수 전 해소**: frontmatter 누락 같은 Critic P2 지적은 이월돼도 다음 스프린트 시작 전까지 해소해야 ADR 게이트 WARN 없이 종료 가능.
- **CVE는 발견 즉시 해소 루틴화**: blog/Dockerfile c-ares CVE가 이월 상태로 잔존 — 소규모 CVE는 이월 없이 발견 즉시 해소하는 루틴이 기술 부채 최소화에 유효.
