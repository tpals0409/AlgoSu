# 의존성 Major 버전 업그레이드 런북

> 대상: `frontend/` 및 `services/*`의 third-party 의존성 major 버전 변경 시
> 작성 배경: Sprint 139/140 react-day-picker v8→v9 미대응 회귀 5건 (캘린더 className 매핑 8개 + root relative 누락 + locale 영문 표시 + nav 위치 어긋남 + 클릭 불가)

---

## 사전 준비

- [ ] 변경 대상 패키지 명 + 변경 전/후 버전 확인 (`npm outdated` / `pip list --outdated`)
- [ ] 해당 패키지의 CHANGELOG 또는 migration guide 링크 확보
- [ ] 코드베이스 내 사용처 list (`grep -rn "from '<package>'"`)

---

## 1. CHANGELOG 검토

```bash
# npm
npm view <package>@<new-version> | grep -A20 "homepage\|repository"
# 또는 GitHub releases / CHANGELOG.md 직접 열기

# pip
pip install <package>==<new-version> --dry-run
```

- breaking change 항목을 모두 나열
- 각 항목에 대해 코드베이스 사용처가 영향받는지 grep으로 확인

## 2. Wrapper 컴포넌트 영향 분석

> 대부분의 회귀는 wrapper 컴포넌트(예: `frontend/src/components/ui/calendar.tsx`)에서 발생한다.

검증 항목:
- **className API**: v8→v9에서 키 이름 변경된 사례 (`caption → month_caption`, `head_row → weekdays` 등)
- **props 시그니처**: 기존 prop 이름 변경/제거, default 값 변경
- **타입 정의**: `Props` interface가 변경되어 기존 사용처가 type 에러 없이도 런타임 다른 동작
- **CSS positioning**: react-day-picker v9의 nav가 absolute positioned로 바뀜 → 부모 root에 `relative` 필수
- **i18n/locale**: locale prop 시그니처 변경, 기본값 변경

```bash
# 사용처 grep 예시
grep -rn "from 'react-day-picker'" frontend/src
grep -rn "DayPicker\|<Calendar" frontend/src
```

## 3. 시각 검증 (Frontend 의존성)

> tsc/lint clean이어도 className/CSS 회귀는 잡히지 않는다 — 직접 확인 필수.

- 영향받는 페이지를 dev server에서 직접 열어 확인
  - 캘린더: `/problems/create`, `/problems/[id]/edit`, `AddProblemModal`
  - 모달: 모든 페이지의 dialog 트리거
  - 폼: 검증 메시지/포커스 동작
- 영문/한글 locale 모두 검증 (i18n wrapper 사용 시)
- 다크/라이트 모드 모두 검증 (테마 토큰 변경 시)
- 모바일/데스크톱 모두 검증 (responsive 변경 시)

## 4. 회귀 보호 추가

```bash
# 단위 테스트
cd frontend && npx jest <wrapper-component>

# e2e (Playwright)
npx playwright test <영향-page>

# 타입 검증
npx tsc --noEmit
```

- wrapper 컴포넌트의 새 API 호환성을 검증하는 단위 테스트 1건 이상 추가
- 시각 회귀 가능성이 있는 경우 Playwright 스크린샷 또는 e2e 시나리오 추가

## 5. PR Pre-flight Checklist

PR 본문의 의존성 변경 섹션 체크박스 모두 체크:

- [ ] major 버전 변경 시 wrapper 컴포넌트 점검
- [ ] CHANGELOG / migration guide 검토
- [ ] 사용처 시각 검증
- [ ] 단위 테스트 또는 e2e 회귀 보호
- [ ] tsc/lint clean

---

## 과거 사례

### Sprint 139/140 — react-day-picker v8→v9
- **회귀 1**: className 키 8개 변경(`caption → month_caption` 등)으로 default flex layout 폴백 → 영문 월/요일 + 요일 헤더 grid 깨짐 + 모달 좌측 치우침
- **회귀 2**: nav가 absolute positioned로 변경 → 부모 root에 `relative` 누락 시 진입점별 위치 어긋남 + 클릭 불가
- **회귀 3**: locale prop default 미설정 → 영문 표시 (Sprint 139 follow-up에서 ko 강제, Sprint 141에서 useLocale 동적 매핑)
- **교훈**: tsc/lint clean이어도 className 매핑 8개 + CSS positioning + locale 정책 모두 누락 가능. 머지 후 사용자 시각 검증으로만 발견됨.

### 향후 추가 사례 발생 시
- 본 runbook 하단에 "회귀 N — <패키지> v<from>→<to>" 형식으로 사례 추가
- PR pre-flight checklist 보강 항목 도출
