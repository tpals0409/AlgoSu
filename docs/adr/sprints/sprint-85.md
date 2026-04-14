---
sprint: 85
title: "solved.ac 403 장애 복구 — Referer + Cloudflare JA3 이중 차단 우회"
date: "2026-04-14"
status: completed
agents: [Oracle, Conductor, Palette, Gatekeeper]
related_adrs: []
---

# Sprint 85: solved.ac 403 장애 복구

## Context

사용자 리포트: 문제 검색 기능에서 `solved.ac API error: 403` 발생.

조사 결과 **같은 날 Cloudflare(solved.ac 앞단)가 봇 방어 규칙을 동시 강화**한 것으로 확인:

1. **Referer 기반 차단** — `Referer: https://algo-su.com/` 전달 시 403, 미전달 시 200
2. **Node.js TLS JA3 fingerprint 차단** — `fetch`/`https`/undici/custom ciphers 모두 403, `wget`(BusyBox OpenSSL)만 200

기존 경로: 브라우저 → Next.js rewrite(`/solved-ac/*`) → solved.ac 서버사이드 프록시. Referer 전달 + Node TLS 사용 → 두 조건 동시에 걸려 전면 503.

## Decisions

### D1: solved.ac 호출을 Gateway 프록시로 일원화
- **Context**: Next.js rewrite는 브라우저 Referer를 그대로 흘려보냄. 제거 옵션 없음.
- **Decision**: `/solved-ac/*` rewrite 제거, `AddProblemModal`이 Gateway의 `/api/external/solvedac/search` 경유하도록 변경. Gateway 내부 호출은 Referer를 설정하지 않음.
- **Alternatives**: Next.js middleware로 Referer 제거 — 별도 복잡도 + 동일 서비스에서 외부 API 중개는 아키텍처 정합성 떨어짐. 기존 `SolvedacService`(show 엔드포인트)와 일관되게 Gateway로 통합하는 쪽을 선택.

### D2: Gateway `searchProblem` 엔드포인트 신설
- `GET /api/external/solvedac/search?query=&page=` 추가 (`solvedac.controller.ts`, `solvedac.service.ts`).
- 응답 스키마: `{ count, items: [{ problemId, titleKo, level, difficulty, sourceUrl, tags: string[] }] }`. 기존 `fetchProblem`과 동일하게 태그는 한국어명으로 평탄화.

### D3: Gateway 외부 호출을 `wget` subprocess로 전환
- **Context**: Gateway를 경유해도 Node fetch가 Cloudflare JA3 차단에 걸려 503. undici `Agent`, 커스텀 ciphers, `https` 모듈 전환 모두 실패. 오직 BusyBox wget만 통과.
- **Decision**: `solvedac.service.ts`의 `fetch`를 `child_process.execFile('wget', ['-q','-O','-','--timeout=5', url])`로 교체. stderr 파싱(`server returned error: HTTP/1.1 NNN`)으로 404/기타 상태 분기. `fetchProblem`·`searchProblem` 양쪽 모두 적용.
- **Alternatives**: curl-impersonate — Node 바인딩 없음·Alpine 추가 바이너리 부담. 공식 API 키 — solved.ac는 공식 API 미공개. 외부 프록시 서비스 — 운영 비용/의존성.
- **위험**: base 이미지 변경 시 wget 출력 포맷(BusyBox vs GNU) 재검증 필요. Dockerfile에 `node:22-alpine` 고정 + 테스트에 stderr 포맷 케이스 포함.

### D4: Trivy HIGH 취약점 병행 패치
- CI 실행 중 기존에 누적되어 있던 보안 이슈 동시 정리:
  - **CVE-2026-28390** (OpenSSL HIGH) — Gateway/Frontend Dockerfile에 `ARG APK_CACHE_BUST` + `apk upgrade libcrypto3 libssl3` 추가 (blog 744f95d 패턴 재사용). `ci.yml`의 해당 build-push-action에 `build-args: APK_CACHE_BUST=${{ github.run_id }}` 주입.
  - **GHSA-q4gf-8mx6-v5v3** (Next.js Server Components DoS HIGH) — `next` 15.5.14 → 15.5.15 업그레이드.

## Outcome

- 실 호출 검증: 새 Gateway pod에서 `wget` 경유 solved.ac 호출 성공 (`count: 5, first: "A+B"`).
- 503 에러 소실.
- 배포 경로: main(`4fa9753`) → aether-gitops(`42f5851`) → ArgoCD Synced/Healthy.

## 교훈

- **외부 API가 Cloudflare 뒤에 있으면 Bot Management 정책 변경이 공지 없이 브레이킹 체인지로 작용**한다. Node TLS JA3는 기본 차단 대상.
- **Next.js rewrite의 destination이 외부 도메인이면 Referer 유출에 취약**. 외부 API는 반드시 백엔드 서비스 프록시 경유로 일원화.
- 긴급 우회로 subprocess(`wget`)는 유효하지만, 장기적으로 solved.ac 의존 자체의 대안(캐시·공식 파트너십) 검토 필요.
