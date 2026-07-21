---
sprint: 253
title: "Hermes 이전 후속 운영 안정화 — 텔레그램 보고 포맷·Critic 자동수신·자동머지 모니터링"
date: "2026-07-21"
status: completed
agents: [Oracle]
related_adrs: ["sprint-246", "sprint-247", "sprint-250"]
related_memory: ["sprint-window"]
topics: ["hermes", "oracle", "ops", "telegram", "critic-gate", "auto-merge"]
tldr: "Hermes Agent 이전(Sprint 246) 이후 누적된 3건의 운영 갭을 해소. ①텔레그램 보고 포맷 — SOUL.md·lifecycle stop/start 스킬 보고 템플릿의 대형 표를 폰 가독성 우선 불릿으로 전환(대형 표 금지·3줄 요약 우선 규칙 소스 박제). ②Critic 게이트 자동수신 — 더미 .done 마커로 watch-critic.sh 감지→크론 딜리버리→텔레그램 실도착까지 end-to-end 스모크 테스트 실증. ③CI green 자동머지 + 머지 모니터링 상시화 — enable-automerge.sh(squash --auto + 감시 마커) + watch-merge.sh + merge-watch 크론(2분 상시) 신설, MERGED/CI실패/WAIT 3경로 스모크 테스트 통과. AlgoSu 레포 코드 변경 없음(Hermes 프로필 = git 미추적 운영 설정, Sprint 250 동일 패턴)."
---
# Sprint 253 — Hermes 이전 후속 운영 안정화

_날짜: 2026-07-21_

## 목표

Hermes Agent 이전(Sprint 246) 이후 실사용 중 드러난 운영 갭 3건을 해소한다. 사용자(세민 김)가 직접 리스트업한 문제:

1. **보고 포맷이 텔레그램에 최적화되지 않음** — 넓은 터미널 기준 대형 표·다단 리포트가 폰 화면에서 가독성이 떨어짐.
2. **Critic 게이트 결과 자동수신 여부 미검증** — watchdog 크론은 등록돼 있으나 실전 텔레그램 도착이 최근 미검증.
3. **CI green 자동머지·머지 그린 모니터링 미자동화** — 시스템프롬프트에 패턴만 기술, 상시 인프라 부재로 매번 수동 개입.

## 결정 사항

### D1. 텔레그램 보고 포맷 — 소스 3곳 표→불릿 전환

메모리에 Sprint 252 피드백(폰 가독성 우선)은 있었으나, **실제 보고를 생성하는 소스(SOUL.md·lifecycle 스킬 템플릿)가 여전히 대형 표**였다(자기모순). 소스를 직접 수정:

- **SOUL.md `## Communication`**: 텔레그램 우선 규칙 박제 — 대형 표 금지, 3줄 요약 우선, 한 메시지=핵심 하나, 코드/SHA/명령어만 인라인 코드.
- **algosu-lifecycle-stop 6단계 완료보고**: 8행 대형 표 → 불릿 (Sprint 252 위반 실사례 제거).
- **algosu-lifecycle-start 5단계 대시보드**: 표 → 불릿 (텔레그램 원칙 섹션과의 자기모순 해소).

### D2. Critic 게이트 자동수신 — end-to-end 스모크 테스트 실증

`critic-gate-watchdog` 크론(every 2m, no_agent)은 활성이었으나 Sprint 251 이후 실전 Critic 미실행으로 텔레그램 실도착이 미검증 상태였다. 더미 `.done` 마커로 파이프라인 전 구간 검증:

- 더미 `/tmp/critic-pr477.done` 생성 → `watch-critic.sh` 감지 → 로그 tail 보고 stdout 생성 확인.
- 크론 `run`으로 딜리버리 계층 실행 → 텔레그램 실도착 확인 → 마커 소비(`.sent`) 확인.
- Sprint 252 강화판 스크립트(trap `.done` 보장 + 비정상종료 감지) 로직 재확인.

### D3. CI green 자동머지 + 머지 모니터링 상시화

기존엔 시스템프롬프트에 `gh pr merge --squash --auto` 패턴만 기술돼 매 PR마다 Oracle 기억에 의존. 상시 인프라 신설:

- **`enable-automerge.sh <PR>`**: `gh pr merge --squash --auto` 설정 + 감시 마커 생성 한 줄 헬퍼.
- **`watch-merge.sh`**: PR 상태 폴링 — MERGED(머지완료 보고)·CI실패(즉시 알림)·WAIT(열림+CI그린 미머지, 조용)·타임아웃 3+1경로. `statusCheckRollup`의 CheckRun(`status`+`conclusion`)·StatusContext(`state`) 구조로 실패 감지.
- **`merge-watch` 크론**: 2분 상시(critic-gate-watchdog 패턴 재사용), no_agent, telegram 딜리버리.
- MERGED·CI실패·WAIT 3경로 스모크 테스트 통과, 딜리버리 실증(PR #477 머지 완료 메시지 텔레그램 도착).

### D4. 키/토큰 재로테이션 후속 항목 폐기

사용자 지시로 🔴 ANTHROPIC 키·`setup-token` 장기토큰 **재로테이션 추적 항목 폐기**. 진행 대기 목록(MEMORY.md `## 후속 처리 필요`·`(인프라)`, sprint-window 이월)에서만 제거하고, 이력 기록(완료 `[x]` 항목·기술 메모 파일)은 사실 보존. 실제 키/토큰은 유효 동작 중이며 재발급 절차는 `hermes-launchd-keychain-blocked.md`에 보존.

## 완료 항목

- #1 텔레그램 포맷: SOUL.md·algosu-lifecycle-stop·algosu-lifecycle-start 표→불릿 전환
- #2 Critic 자동수신: 더미 마커 end-to-end 스모크 테스트 실증(텔레그램 실도착)
- #3 자동머지+모니터링: `enable-automerge.sh`·`watch-merge.sh`+`merge-watch` 크론 신설, 3경로 스모크 통과
- #4 키/토큰 재로테이션 추적 항목 폐기(이력 보존)

**커밋**: 없음 — 산출물 전부 Hermes 프로필(`~/.hermes/profiles/algosu-oracle/`)로 git 미추적 운영 설정(Sprint 250 동일 패턴). ADR(KR+EN)만 AlgoSu 레포에 기록.

**Critic 결과**: 해당 없음 — AlgoSu 레포 코드 변경 없음(Hermes 운영 설정 변경).

## 이월

- [ ] GA4 admin Enhanced Measurement OFF / 프로덕션 UAT / 데이터 스트림 URL 정합 (사용자 직접)
- [ ] 서버 재배포 + 라이브 SEO 검증 (운영, Sprint 212/213 산출물)
- [ ] 하네스 체크업 `--full` CI 정기 실행 자동화(cron 월 1회) 검토 (Sprint 209 후속)

## 교훈

- **메모리 피드백 ≠ 소스 반영**: 사용자 선호를 memory에 저장해도 실제 보고를 생성하는 소스(SOUL.md·스킬 템플릿)를 고치지 않으면 재발한다. 선호 규칙은 생성 지점(소스)에 박제해야 항구적.
- **크론 활성 ≠ 딜리버리 검증**: watchdog가 `scheduled`·`last ok`여도 실전 도착은 별개. 더미 마커로 end-to-end(감지→딜리버리→도착→소비)를 주기적으로 실증해야 무음 실패를 예방한다.
- **패턴 기술 ≠ 상시 자동화**: 시스템프롬프트의 절차 기술은 매 실행 기억 의존. 반복 운영은 스크립트+크론으로 상시화해야 사람 개입 없이 재현된다.
