AlgoSu ADR → 기술 블로그 변환 도우미

## 역할
정식 ADR(`docs/adr/ADR-*.md`) 또는 Sprint ADR(`docs/adr/sprints/sprint-*.md`)을
기술 블로그 MDX 포스트(`blog/content/`)로 변환합니다.

## 사용법
- 정식 ADR 변환: `/algosu-adr-blog docs/adr/ADR-004-some-title.md`
- Sprint ADR 변환: `/algosu-adr-blog sprint 60`
- 전체 목록 확인: `/algosu-adr-blog list`

## 변환 절차

### Step 1: 소스 읽기
- `$ARGUMENTS`에서 소스 ADR 경로 또는 스프린트 번호 파싱
- 해당 파일 Read

### Step 2: 블로그 MDX 변환
소스의 기술적 내용을 **내러티브 스타일**로 변환하세요:
1. 기술 보고서 → 읽기 쉬운 블로그 글 톤으로 변환
2. YAML frontmatter 추가 (아래 형식)
3. 코드 블록, 테이블, 다이어그램은 유지
4. 지나치게 내부적인 정보(파일 경로 등)는 일반화

### Step 3: 파일 저장
- 정식 ADR → `blog/content/adr/{slug}.mdx`
- Sprint ADR → `blog/content/sprints/sprint-{N}.mdx`

### Step 4: 검증
- MDX frontmatter 파싱 가능 여부 확인
- 기존 콘텐츠 파일과 slug 중복 없는지 확인

## MDX Frontmatter 형식

### 정식 ADR
```yaml
---
title: "{한글 제목 — 블로그 친화적으로}"
date: "{YYYY-MM-DD}"
excerpt: "{1~2문장 요약}"
tags: ["{태그1}", "{태그2}"]
source: "{원본 ADR 경로}"
---
```

### Sprint ADR
```yaml
---
sprint: {N}
title: "{Sprint Title}"
date: "{YYYY-MM-DD}"
status: "{completed/in-progress}"
excerpt: "{1~2문장 요약}"
tags: ["{태그1}", "{태그2}"]
source: "{원본 Sprint ADR 경로}"
---
```

## 참조
- 블로그 앱: `blog/`
- 콘텐츠 로딩: `blog/src/lib/posts.ts`
- 기존 변환 예시: `blog/content/adr/adr-001-*.mdx`

## 주의사항
- 원본 ADR 파일은 수정하지 않음 (블로그는 변환 복사본)
- 보류(Deferred) 상태 ADR도 변환 가능 — "아직은 때가 아니다" 류 블로그 서사 활용
- 블로그 톤: 기술적이되 친근하게, 왜 그 결정을 했는지 서사 중심

$ARGUMENTS
