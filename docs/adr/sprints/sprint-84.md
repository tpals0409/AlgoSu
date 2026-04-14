---
sprint: 84
title: "블로그 영문 버전 추가 + solved.ac 403 장애 복구"
date: "2026-04-14"
status: completed
agents: [Oracle, Conductor, Palette, Gatekeeper]
related_adrs: ["sprint-85"]
---

# Sprint 84: 블로그 영문 버전 추가

## Context

기술 블로그(Docusaurus)에 영문 버전을 추가하여 글로벌 접근성 확보. 병행하여 solved.ac Cloudflare 차단 장애가 발생하여 긴급 대응 수행.

## Decisions

### D1: Docusaurus i18n — /en 경로 locale 라우팅
- **Context**: 블로그 콘텐츠를 한국어(기본) + 영문으로 제공 필요.
- **Decision**: Docusaurus built-in i18n 플러그인 사용. `i18n.defaultLocale: 'ko'`, `locales: ['ko', 'en']` 설정. `/en` prefix로 영문 접근.
- **Alternatives**: (a) 별도 사이트 배포 — 이중 관리 비용, 기각. (b) MDX 내 조건부 렌더링 — 작성 복잡도 높음, 기각.
- **Code Paths**: `blog/docusaurus.config.ts`, `blog/i18n/en/`

### D2: trailingSlash 활성화 — 정적 export 403 해결
- **Context**: `/en` 경로가 GitHub Pages에서 403 Forbidden 반환. 정적 export 시 `index.html` 미생성으로 디렉토리 접근 실패.
- **Decision**: `docusaurus.config.ts`에 `trailingSlash: true` 설정. 모든 경로가 `/{path}/index.html`로 생성되어 정적 호스팅 호환.
- **Code Paths**: `blog/docusaurus.config.ts`

### D3: 다크모드 토글 제거 — 라이트 모드 고정
- **Context**: 디자인 토큰이 라이트 모드 기준으로만 정의됨. 다크모드 전환 시 일부 컴포넌트에서 대비비 미충족.
- **Decision**: `colorMode.disableSwitch: true`, `respectPrefersColorScheme: false` 설정. 라이트 모드 단일 테마로 고정.
- **Code Paths**: `blog/docusaurus.config.ts`

### D4: solved.ac 403 장애 복구 (상세: sprint-85.md)
- Gateway 프록시 일원화(Referer 제거) + wget subprocess 전환(Cloudflare JA3 우회).
- 상세 결정 및 교훈은 [Sprint 85 ADR](./sprint-85.md) 참조.

### D5: Trivy HIGH 취약점 병행 패치
- CVE-2026-28390 (OpenSSL) — APK 캐시 버스트 적용.
- GHSA-q4gf-8mx6-v5v3 (Next.js DoS) — 15.5.14 → 15.5.15 업그레이드.

## Patterns

### P1: Docusaurus 정적 export + GitHub Pages는 trailingSlash 필수
- **Where**: `blog/docusaurus.config.ts`
- **When to Reuse**: Docusaurus를 GitHub Pages(정적 호스팅)에 배포할 때. 서브 경로가 403이면 이 설정을 먼저 확인.

## Gotchas

### G1: Docusaurus i18n locale 경로와 정적 호스팅 호환성
- **Symptom**: `/en` 접근 시 403 Forbidden.
- **Root Cause**: `trailingSlash: false`(기본값)일 때 정적 export가 `/en.html`을 생성하지만, GitHub Pages는 디렉토리로 해석하여 `index.html`을 찾음.
- **Fix**: `trailingSlash: true` 설정으로 `/en/index.html` 생성.

## Metrics
- Commits: 11건 (0be3048..641b857)
- Blog i18n: 3 PR (#86, #87, #88)
- solved.ac 복구: 5 커밋 (gateway 프록시 + wget 전환 + 스키마 정렬)
- 보안 패치: 2건 (Trivy + Next.js)
- 이월 항목: 없음
