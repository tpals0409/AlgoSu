---
sprint: 223
title: "progress.tsx 래퍼 aria-valuenow 전역 수정 (Sprint 222 후속 — 잠재 a11y 갭 정석화)"
date: "2026-06-06"
status: completed
agents: [Oracle, Herald, Librarian, Critic]
related_adrs: ["sprint-221", "sprint-222"]
related_memory: ["sprint-window", "ui-migration"]
topics: ["frontend", "ui", "quiz", "accessibility"]
tldr: "Sprint 222가 quiz progressbar의 aria-valuenow 누락을 QuizPlay 로컬 명시(aria-valuenow={percent})로 우회하고 근본 원인인 공통 래퍼 수정은 후속으로 이월했던 것을 정석화한 프론트엔드 전용 스프린트. 근본 원인: 공통 progress.tsx 래퍼가 value를 destructure만 하고 ProgressPrimitive.Root에 전달하지 않아(value가 {...props}에서도 빠짐) Radix가 aria-valuenow를 자동 부여하지 못했다 → 래퍼를 쓰는 모든 progressbar가 잠재적으로 aria-valuenow 미노출. (수정) progress.tsx의 <ProgressPrimitive.Root>에 value={value}를 명시 전달({...props} 앞) — Indicator transform은 기존대로 value||0 유지라 시각 완전 무변경. 결과: 래퍼 기반 모든 progressbar가 role=progressbar의 aria-valuenow/valuemin/valuemax를 Radix 자동 부여로 노출. (정석화) QuizPlay에서 Sprint 222가 래퍼 결함을 우회하려 명시했던 중복 aria-valuenow={percent} 한 줄 제거 — Radix 자동 부여로 동일 값 노출, aria-label·aria-valuetext('1 / 3')는 Radix가 대체 불가하므로 유지. (안전망) progress.tsx 자체 단위 테스트가 없던 갭을 +4(value 노출·undefined/null indeterminate 미노출·사용자 aria override)로 보강, QuizPlay.test.tsx는 무수정 회귀 통과(aria-valuenow='33'). ProgressPrimitive 기반 Progress의 유일 소비처는 QuizPlay 1곳이며 ScoreGauge/CategoryBar는 자체 SVG/div 구현이라 범위 밖. 신규 토큰 0·컴포넌트 0. merge≠라이브(별도 운영 이월)."
---
# Sprint 223 — progress.tsx 래퍼 aria-valuenow 전역 수정

## 목표

- Sprint 222에서 **후속, 선택**으로 이월한 공통 `progress.tsx` 래퍼의 a11y 갭을 정석으로 해소한다.
- 래퍼가 `value`를 `ProgressPrimitive.Root`에 전달하도록 전역 수정해, 래퍼 기반 progressbar가 Radix 자동 `aria-valuenow`를 노출하도록 한다(**시각 무변경**).
- 프론트엔드 전용 — 데이터/스키마/백엔드 무변경. 신규 디자인 토큰·컴포넌트 0. `/quiz`는 인증 게이트이므로 라이브 검증은 별도 운영 이월(merge ≠ 라이브).

## 배경

Sprint 222(D2)에서 QuizPlay 진행률 바의 `aria-valuenow`가 비어 있던 문제를 발견하고, **QuizPlay에서 `aria-valuenow={percent}`를 직접 명시**하는 로컬 보정으로 해소했다. 단 근본 원인 — 공통 `progress.tsx` 래퍼가 `value`를 삼켜 Radix에 전달하지 않는 것 — 의 전역 수정은 스코프 규율상 후속으로 이월했다(ADR sprint-222 §이월, 교훈 ⑥).

근본 원인을 코드로 확인하면:

```tsx
function Progress({ className, value, ...props }) {   // value를 destructure → props에서 빠짐
  return (
    <ProgressPrimitive.Root className={...} {...props}> {/* value 미전달 */}
      <ProgressPrimitive.Indicator style={{ transform: `translateX(-${100 - (value || 0)}%)` }} />
    </ProgressPrimitive.Root>
  );
}
```

`value`가 destructure되어 `{...props}`에 포함되지 않으므로 `Root`에 전달되지 않고, Indicator의 `transform` 스타일에만 쓰인다. 결과적으로 Radix는 `value`를 모르므로 `aria-valuenow`를 자동 부여하지 못한다. 래퍼를 쓰는 **모든 progressbar가 잠재적으로 `aria-valuenow` 미노출** 상태였다(이번엔 quiz 1곳만 로컬 보정돼 있었음).

## 결정

### D1. `progress.tsx`에서 `value`를 `Root`에 명시 전달 (핵심 1줄)

`<ProgressPrimitive.Root>`에 `value={value}`를 `{...props}`보다 **앞에** 전달한다.

- Indicator `transform`은 기존대로 `value || 0`을 사용 → **시각 완전 무변경**.
- 결과: 래퍼 기반 모든 progressbar가 `role="progressbar"`의 `aria-valuenow`/`aria-valuemin`(0)/`aria-valuemax`(기본 100)을 Radix 자동 부여로 노출 + `data-state`(loading/complete) 정상화.
- 사용자가 넘긴 `aria-*`(예: `aria-label`, 커스텀 `aria-valuetext`)는 뒤의 `{...props}`로 **override 가능**(Radix가 user props를 마지막에 spread — Sprint 222 교훈 ④).

### D2. QuizPlay 중복 로컬 보정 제거 (정석화)

QuizPlay `<Progress>`에서 Sprint 222가 래퍼 결함을 우회하려 명시했던 **`aria-valuenow={percent}` 한 줄을 제거**한다.

- 제거 후에도 Radix가 `value={percent}`로부터 동일 값을 자동 부여 → 노출·동작 동일.
- **`aria-label`(접근 이름)·`aria-valuetext`("1 / 3")는 유지** — Radix는 접근 이름을 자동 생성하지 않고, `aria-valuetext` 기본값은 `"{percent}%"`(예: "33%")라 우리가 원하는 "1 / 3" 진행 텍스트로 대체 불가하므로 사용자 값 유지가 필수다.

### D3. 절제 — 범위 밖 명확화

- `ProgressPrimitive` 기반 `Progress`의 **유일 소비처는 QuizPlay 1곳**이다.
- `ScoreGauge.tsx`·`CategoryBar.tsx`는 자체 SVG/div로 구현된 진행률 시각화라 Radix를 사용하지 않으므로 **이번 전역 수정의 영향·범위 밖**이다(필요 시 별도 스프린트).
- 신규 디자인 토큰 0·신규 컴포넌트 0.

## 구현

### 산출물 (Wave 순서)

총 2 atomic commit (start `33155d7`):

| Wave | 에이전트 | 커밋 | 내용 |
|---|---|---|---|
| W-A | Herald | `1b3dcf4` | `progress.tsx` `<ProgressPrimitive.Root>`에 `value={value}` 명시 전달(`{...props}` 앞) + 함수 JSDoc 보강 / QuizPlay 중복 `aria-valuenow={percent}` 제거(`aria-label`·`aria-valuetext` 유지) |
| W-B | Herald | `001b065` | `progress.test.tsx` 신규 +4 — value 전달 시 `role=progressbar`+`aria-valuenow`/`valuemin`/`valuemax` 노출, `undefined`/`null`(indeterminate) 시 `aria-valuenow` 미노출+크래시 없음, 사용자 `aria-label`/`aria-valuetext` override가 Radix 기본값을 이김 |

### 변경 상세

- **`progress.tsx` (W-A `1b3dcf4`)**: `<ProgressPrimitive.Root>`에 `value={value}`를 `{...props}` 앞에 추가. 함수 JSDoc으로 "Root 전달이 Radix 자동 `aria-valuenow`의 전제이며 사용자 `aria-*`는 뒤의 spread로 override 가능"을 명시. Indicator 스타일은 무변경.
- **QuizPlay.tsx (W-A `1b3dcf4`)**: `<Progress>`에서 `aria-valuenow={percent}` 제거. `value={percent}`·`aria-label={t('play.progressAria')}`·`aria-valuetext={t('play.progress', ...)}`는 유지.
- **테스트 (W-B `001b065`)**: 래퍼 자체 단위 테스트(`src/components/ui/__tests__/progress.test.tsx`) 신규 4건. `QuizPlay.test.tsx`는 무수정 — `aria-valuenow='33'` 단언이 Radix 자동 부여(value=33)로 그대로 통과(회귀 확인).

## 검증

- **tsc**: 0 errors.
- **ESLint**(실제 바이너리): 신규 error 0.
- **jest**: 전 suite PASS — progress 신규 4 + QuizPlay 회귀 5 통과. 글로벌 커버리지 lines/branches 게이트(83/71) 유지.
- **next build**: ✓. `/[locale]/quiz` 번들 사실상 무변경(속성/전달만, 신규 코드 없음).
- **ADR 게이트**: index count(sprint **161**, --strict) / adr-en coverage(sprint-223 EN, --strict) / adr-links 0 broken / doc-refs no broken.

## 교훈

1. **래퍼 추상화의 a11y 갭은 소비처 보정이 아니라 래퍼에서 고쳐야 전역 해소된다** — Sprint 222는 QuizPlay 로컬 명시로 즉시 해소했지만, 같은 래퍼를 쓰는 다른 progressbar는 여전히 갭이 남는다. 근본 원인(래퍼가 prop을 삼킴)을 래퍼에서 고치면 모든 소비처가 한 번에 해소되고, 소비처의 우회 보정 코드도 제거할 수 있다.
2. **헤드리스 래퍼는 자신이 소비(destructure)한 prop을 Root에 다시 전달할 책임이 있다** — `value`를 스타일 계산에만 쓰고 `Root`에 안 넘기면 Radix가 그 prop 기반 ARIA를 부여하지 못한다. 래퍼를 만들 때 "소비한 prop이 라이브러리의 접근성 자동 동작에 필요한가"를 점검해야 한다.
3. **자동 동작 prop(value)과 보강 prop(aria-label/valuetext)은 역할이 다르다** — `value`는 Radix가 `role`/`valuenow`/`valuemin`/`valuemax`를 자동 부여하는 입력이고, `aria-label`(접근 이름)·커스텀 `aria-valuetext`(진행 텍스트)는 라이브러리가 대체 못 하는 보강이라 소비처에서 명시 유지해야 한다. 전역 수정 후 전자(중복 `aria-valuenow`)는 제거하되 후자는 유지하는 것이 정석.
4. **시각 무변경 a11y 수정은 회귀 안전망으로 굳혀야 한다** — 래퍼 자체 단위 테스트가 없으면 "value를 Root에 안 넘기는" 회귀가 조용히 재발할 수 있다. `progress.test.tsx`로 value→aria-valuenow 노출을 단언해 전역 갭의 재발을 차단한다.

신규패턴: 해당 없음(기존 헤드리스 래퍼/Radix prop 전달 패턴의 전역 정석화).

## Sprint 224+ 이월

- radiogroup 격상(선택) — 분야·난이도 pill을 radiogroup + roving tabindex로 격상(Sprint 222 이월 유지).
- quiz 모션 심화·통계 분야별 시각화(선택).
- **(운영 실행) SP217 컷오버 — `sp217-quiz-records-cutover.md` 따라 identity → gateway → frontend 롤아웃 + 라이브 `/quiz` E2E 6항목 검증** (사용자/운영, 중요).
- 라이브 `/quiz` UI 개편(Sprint 221)·a11y(Sprint 222)·진행률 스크린리더 낭독(Sprint 223) 육안/스크린리더 확인 — 재배포 후, 같은 frontend 롤아웃으로 일괄 처리 가능.
- GA4 admin(스트림 URL·history page_view OFF·프로덕션 UAT) — 사용자 직접.
- 운영 Sprint 196 `problem_db` 마이그레이션 실행 + 재배포 — 사용자/운영.
- 하네스 체크업 `--full` CI 정기 실행 자동화(월 1회 cron) 검토 — Sprint 209 이월.

## Critic 교차 리뷰

- **도구**: Codex codex-cli 0.130.0, `codex review --base 33155d7 -c model=gpt-5.5`
- **라운드**: 1

**R1 — CLEAN** (Critical/High/Medium/Low 0건): *"The change correctly forwards the destructured Progress value to the Radix root, allowing Radix to emit progressbar ARIA attributes, and the removed QuizPlay aria-valuenow is covered by that forwarding. The added tests align with the intended behavior and no regressions are evident from the diff."*

**종합 판정**: ✅ 머지 가능 — 래퍼의 `value`→`Root` 전달이 Radix progressbar ARIA를 정확히 emit하고, QuizPlay에서 제거한 `aria-valuenow`는 그 전달로 커버되며, 추가 테스트가 의도 동작과 정합한다. 단일 라운드 CLEAN, 수정 0.
