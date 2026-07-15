# Sprint 250 — Oracle 프로토콜 통신 안정화

_날짜: 2026-07-16_

## 목표

Hermes 이전(Sprint 246) 후 발견된 Oracle 프로토콜 통신 문제 해결:
1. 세션 단절 시 진행 중 작업 상태 유실 → 복구 패턴 부재
2. Wave 완료 후 자동 Telegram 보고 없음 → PM이 수동으로 현황 요청
3. delegate_task 비내구성 인식 부족 → 장기 작업 결과 유실 위험

## 결정 사항

### D1. Wave 완료 즉시 보고 원칙
- 모든 Wave/delegate_task 완료 시 즉시 Telegram 보고: `[Wave X 완료] 요약. Wave Y 착수합니다.`
- 질문 금지 — 선언 형식 의무화
- SOUL.md 알림 규칙 테이블에 "Wave 완료", "세션 재진입" 이벤트 추가

### D2. 세션 단절 복구 패턴
- 스프린트 시작 시 `~/.hermes/profiles/algosu-oracle/sprint-progress/sprint-{N}-progress.json` 상태 파일 생성
- Wave 완료 시 상태 파일 업데이트 (Wave 번호, SHA, 완료 시각 기록)
- 재진입 시 상태 파일 기반 복구 → 중단 지점부터 자동 재개
- SOUL.md "세션 단절 복구 패턴" 섹션 신설
- **경로 결정**: `/tmp/`는 재부팅 시 유실 → `~/.hermes/` 하위로 영구 경로 확정

### D3. delegate_task 내구성 제약 명문화
- delegate_task는 세션 단절 시 결과 유실 (tool 스펙 근거)
- 장기(>10분) 작업은 `terminal(background=True, notify_on_complete=True)` 또는 `cronjob`으로 래핑 필수
- SOUL.md "Wave 완료 즉시 보고 원칙"에 내구성 제약 경고 추가

### D4. 하위 에이전트 페르소나 보고 표준화
- Architect·Curator·Herald·Postman: 구현 전 [3.5 추론 검증] 누락 → 전원 추가
- 코드 변경 에이전트 9개: 커밋 SHA + exit code(tsc/eslint/jest) 의무화 추가
- 착수/완료 상태 파일 기록 표준 절차 전 에이전트 공통화
- Palette 제외: 디자인 역할상 코드 추론 검증보다 WCAG AA 검증이 적합

## 완료 항목

- `~/.hermes/profiles/algosu-oracle/SOUL.md` — 알림 규칙 테이블 Wave 완료/세션 재진입 추가, Wave 완료 즉시 보고 원칙 섹션 신설, 세션 단절 복구 패턴 섹션 신설
- `algosu-lifecycle-start/SKILL.md` — 4단계 상태 파일 초기화 추가, 7단계 Wave 완료 보고 표준 형식 + 세션 단절 후 재진입 절차 추가
- `algosu-lifecycle-stop/SKILL.md` — 5단계 상태 전환 시 progress.json 정리 추가
- 하위 에이전트 페르소나 12개 — D4 보고 표준화 적용 (3.5 추론 검증 5개 추가, SHA+exit 8개 추가, progress.json 착/완 기록 전 에이전트)
- `sprint-window.md` — Sprint 250 목표 및 계획 작업 기록
- progress.json 경로 `/tmp/` → `~/.hermes/profiles/algosu-oracle/sprint-progress/` 전 파일 일괄 이전 (SOUL.md + 12 스킬)

## 이월

- [ ] SSOT 드리프트 (B) 문서 개정: CLAUDE.md Sprint 239 Q-5 → `<SERVICE>_SERVICE_KEY` 패턴으로 수정 (Scribe 위임)
- [ ] 🔴 보안: ANTHROPIC_API_KEY 재로테이션 (사용자 보류)
- [ ] GA4 admin Enhanced Measurement OFF (사용자 직접)
- [ ] GA4 프로덕션 동작 UAT (사용자 직접)
- [ ] 서버 재배포 + 라이브 SEO 검증 (운영)
- [ ] GA4 admin 데이터 스트림 URL `algo-su.com` 정합 (사용자 직접)

## 교훈

- Hermes 세션 비내구성: `delegate_task`는 세션 단절 시 결과 유실 → 장기 작업은 반드시 background terminal 또는 cronjob 활용
- 자동 보고 없이는 PM이 맹인 비행 중 → Wave 완료 즉시 선언 형식 보고가 협업 신뢰 기반
- 복구 패턴 부재 = 재작업 리스크 → 상태 파일로 멱등 재개 가능하게 설계
