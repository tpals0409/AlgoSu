---
sprint: 78
title: "CI deprecation 대응"
date: "2026-04-10"
status: completed
agents: [Oracle, Herald, Gatekeeper]
related_adrs: []
---

# Sprint 78: CI deprecation 대응

## Decisions
### D1: 11개 액션 일괄 버전 업그레이드 (Node.js 24 대응)
- **Context**: GitHub Actions runner가 2026-06-02부터 Node.js 24를 기본으로 전환, 2026-09-16에 Node 20 완전 제거 예정. CI 15 jobs가 Node 20 기반 액션에 의존 중
- **Choice**: 11개 액션을 Node 24 지원 최신 major 버전으로 일괄 bump. 단일 커밋으로 처리하여 CI 전체 검증
- **Alternatives**: 개별 액션씩 점진적 업그레이드 → 기각 (변경 범위가 `uses:` 태그뿐이라 일괄 처리가 효율적)
- **Code Paths**: `.github/workflows/ci.yml`

### D2: docker/build-push-action v5 → v7 (2 major 점프)
- **Context**: v6은 Node 20 기반, v7이 Node 24 + ESM 전환. v6을 거치지 않고 직접 v7로 업그레이드
- **Choice**: v7 직행. 기존 파라미터(context, platforms, push, tags, cache-from, cache-to) 모두 호환 확인
- **Alternatives**: v5 → v6 → v7 단계적 전환 → 기각 (v6도 곧 deprecated 예정)
- **Code Paths**: `.github/workflows/ci.yml` (build-services, build-frontend, build-blog jobs)

## Patterns
### P1: GitHub Actions 버전 업그레이드 일괄 처리
- **Where**: `.github/workflows/ci.yml`
- **When to Reuse**: 다음 major deprecation cycle (Node 24 → Node 26 등)에 동일 패턴 적용. `uses:` 라인만 grep으로 추출 → 최신 버전 조사 → replace_all로 일괄 변경 → CI 전체 검증

## Gotchas
### G1: wagoid/commitlint-github-action은 Docker 컨테이너 기반
- **Symptom**: Node.js 20 deprecation 대상으로 오인할 수 있음
- **Root Cause**: Docker 컨테이너 액션은 자체 런타임을 사용하므로 runner의 Node.js 버전과 무관
- **Fix**: Docker 기반 액션(`wagoid/commitlint-github-action@v6`)은 Node.js deprecation 대응 불필요. `action.yml`의 `runs.using` 필드로 JavaScript vs Docker 구분 가능

### G2: actions/checkout v4 → v6은 2 major 점프
- **Symptom**: v5를 건너뛰면 breaking change 누적 우려
- **Root Cause**: v5는 Node 20 → Node 22 전환, v6이 Node 24 전환. 실제 사용 파라미터(fetch-depth, sparse-checkout 등)에는 호환성 문제 없음
- **Fix**: 사용 중인 파라미터 목록을 사전 확인 후 업그레이드. 이번 케이스에서는 `fetch-depth: 0`, `sparse-checkout`, `sparse-checkout-cone-mode` 모두 정상 동작 확인

## Metrics
- Commits: 1건, Files changed: 1개 (42개 uses 라인 변경, +48/-48)
