---
sprint: 252
title: "문제 상세 페이지 문제 본문(description) 노출 제거 — 출처 링크 유도"
date: "2026-07-20"
status: completed
agents: [Oracle]
related_adrs: ["sprint-248", "sprint-249"]
related_memory: ["sprint-window"]
topics: ["frontend", "problem-detail", "ux", "copyright"]
tldr: "문제 상세 페이지(`/problems/[id]`)에서 문제 본문 텍스트(`description`) 렌더 블록을 제거하고, 프로그래머스/BOJ 출처 링크로 문제 접근을 유도. 화면 렌더 로직만 삭제(DB 데이터·AI 분석 프롬프트는 무영향)라 신규/기존 모든 문제에 즉시 공통 적용. 출처 링크·난이도·태그·마감 메타는 유지. PR #475 `b5b83e2`, `page.tsx` +1/−8. 소규모 프론트 표시 제거로 Critic 게이트 해당 없음."
---
# Sprint 252 — 문제 상세 페이지 문제 본문 노출 제거

_날짜: 2026-07-20_

## 목표

문제 상세 페이지(`frontend/src/app/[locale]/problems/[id]/page.tsx`)에서 문제 본문(`description`) 텍스트를 화면에 직접 렌더하지 않는다. 사용자는 프로그래머스/BOJ **출처 링크**를 통해 원문 문제로 접근하도록 유도한다.

**배경**: 문제 본문을 자체 페이지에 그대로 노출하는 것은 출처(프로그래머스/BOJ) 저작권 측면에서 바람직하지 않다. 문제 접근은 출처 링크로 위임하고, 플랫폼은 난이도·태그·마감 등 **메타 정보와 스터디 흐름**에 집중한다.

## 결정 사항

### D1. 문제 본문 렌더 블록만 제거 (표시 로직 삭제, 데이터 보존)

`page.tsx`의 문제 본문 렌더 블록을 삭제:

```diff
-              {/* 설명 */}
-              {problem.description && (
-                <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-2)' }}>
-                  {problem.description}
-                </p>
-              )}
-
-              {/* 출처 링크 */}
+              {/* 출처 링크 (문제 본문은 노출하지 않음 — Sprint 252: 프로그래머스/BOJ 링크로 접근) */}
                 {problem.sourceUrl && ( ... )}
```

- **화면 렌더 로직만 제거** — `description` 필드 값(DB·API 응답)은 그대로 존재. 데이터 삭제·마이그레이션 없음.
- 문제 생성 시점과 무관하게 **신규·기존 모든 문제 상세 페이지**에 즉시 공통 적용(렌더 분기 제거이므로).
- **원복 비용 최소**: 렌더 블록 복구만으로 원상 회복(마이그레이션 불필요).

### D2. 유지 항목 명시

본문 대신 다음 요소는 그대로 유지:
- **출처 링크**(`problem.sourceUrl` — 프로그래머스/BOJ)
- 난이도·태그·마감 등 문제 메타
- AI 분석 흐름 — `ai-analysis` worker.py `_get_problem`은 DB에서 직접 `description`을 읽으므로 **프롬프트 컨텍스트 주입에 무영향**(Sprint 248/249 문제 컨텍스트 풍부화 경로 보존).

## 완료 항목

| 커밋 | PR | 내용 |
|------|----|------|
| `b5b83e2` | #475 | 문제 상세 페이지 본문 렌더 블록 제거 (`page.tsx` +1/−8) |

**Critic 결과**: 해당 없음 — 단일 파일 소규모 프론트 표시 제거(렌더 블록 삭제, 로직·데이터·API 무변경)로 별도 교차 리뷰 게이트 미실행.

## 이월

- [ ] 🔴 보안: ANTHROPIC_API_KEY 재로테이션 (사용자 보류 — Anthropic Console 키 폐기 후 신규 발급 + SealedSecret 재봉인)
- [ ] 🔴 보안: `claude setup-token` 장기 토큰 트랜스크립트 평문 노출 — 외부 공유 우려 시 폐기 후 재발급
- [ ] GA4 admin Enhanced Measurement OFF / 프로덕션 UAT / 데이터 스트림 URL 정합 (사용자 직접)
- [ ] 서버 재배포 + 라이브 SEO 검증 (운영, Sprint 212/213 산출물)
- [ ] 하네스 체크업 `--full` CI 정기 실행 자동화(cron 월 1회) 검토 (Sprint 209 후속)

## 교훈

- **표시 제거 ≠ 데이터 삭제**: 저작권·노출 정책 변경은 화면 렌더 분기 제거로 충분한 경우가 많다. DB/마이그레이션에 손대지 않으면 원복 비용이 낮고 AI 분석 등 데이터 소비 경로에 부작용이 없다.
- **렌더 분기 제거는 소급 적용**: 조건부 렌더(`problem.description && ...`) 블록을 제거하면 데이터 존재 여부와 무관하게 전 레코드에 즉시 공통 적용된다 — 기존 문제 개별 처리 불필요.
- **데이터 소비 경로 무영향 확인**: 표시 제거가 다른 소비자(여기서는 AI 분석 프롬프트)에 영향 없는지 확인 후 진행 — `worker.py _get_problem`은 DB 직접 조회라 UI 렌더와 독립.
