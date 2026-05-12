# Runbook: 정규식 강건성 검증 체크리스트

> **적용 범위**: Prometheus metric 이름 selector, Grafana dashboard expr 작성, PromQL quantifier, panel title regex
> **도입**: Sprint 148 (Sprint 145~147 Critic R1 P2 패턴 3 스프린트 연속 누적 대응)
> **관련 스크립트**: `scripts/check-grafana-metrics.mjs` (line 378~518)
> **관련 Critic 규칙**: `.claude/commands/agents/critic.md`

---

## 1. 개요

Sprint 145~147 회고에서 **정규식 강건성 P2**가 3 스프린트 연속으로 Critic에게 적발되었다.

| Sprint | PR | 적발 항목 | 라운드 |
|--------|----|-----------|--------|
| 145 | #208 | `[a-z_]+` character class에 digit 미포함 → future false positive | R2 P2 |
| 146 | #209 | quoted regex quantifier `{2}` inner brace → selector 추출 끊김 | R1 P2 |
| 147 | #218 | `\|` 연산자 우선순위 미명시 → false negative | R1 P2-2 |
| 147 | #219 | `${var:format}` Grafana 포맷 미인식 → variable usage false positive | R1 P2 |

4건 모두 **동종 결함**: 정규식 작성 시 엣지 케이스 미고려. 이 RUNBOOK은 미래 동종 결함의 사전 차단을 목표로 한다.

---

## 2. 4가지 강건성 체크리스트

> 정규식을 신규 작성하거나 수정하기 전에 아래 4개 항목을 self-review 하라.

### 2.1 `|` 연산자 우선순위 (Sprint 147 PR #218 사례)

**결함 패턴**:
```js
// ❌ 위험: (algosu:...availability) | (success_rate) 로 파싱
/algosu:[a-z_:]*availability|success_rate/
```

`|`는 가장 낮은 우선순위 연산자다. prefix가 없는 얼터너티브는 전혀 다른 도메인까지 매칭한다.

**안전 대안**:
```js
// ✅ 명시적 그룹화
/(?:algosu:[a-z_:]*availability|algosu[_:][a-z_:]*success_rate)/

// ✅ prefix anchoring — 각 얼터너티브에 prefix 독립 명시
/(?:algosu:[a-z_:]*(?:availability|success_rate))/
```

**체크 항목**:
- [ ] `|` 사용 시 전체 표현식 또는 괄호로 범위 명시
- [ ] algosu prefix가 모든 얼터너티브에 적용되는지 확인

*Critic 인용: PR #218 R1 P2-2*

---

### 2.2 Character class 일관성 (Sprint 145 PR #208 사례)

**결함 패턴**:
```js
// ❌ 위험: digit 미허용 → algosu_gateway_http_2xx_total 같은 metric 미매치
const metricNamePattern = /[a-z_]+/;
```

Prometheus metric 이름은 `[a-zA-Z_][a-zA-Z0-9_]*` 명세다. `2xx`, `4xx`, `5xx` 같은 숫자 포함 이름이 실제 존재한다.

**안전 대안**:
```js
// ✅ Prometheus metric 이름 명세 준수
const metricNamePattern = /[a-zA-Z_][a-zA-Z0-9_]*/;

// ✅ 양쪽(source 코드 side / dashboard side) 동일 character class 사용
```

**체크 항목**:
- [ ] source side 정규식과 dashboard side 정규식이 동일한 character class 사용 여부
- [ ] 숫자 포함 metric 이름(2xx, 4xx, 5xx, v2, p95 등)이 매칭되는지 확인

*Critic 인용: PR #208 R2 P2*

---

### 2.3 Quantifier 처리 (Sprint 146 PR #209 사례)

**결함 패턴**:
```js
// ❌ 위험: inner brace {2} 가 selector wrapper 정규식 [^{}]* 를 끊음
// 입력: {__name__=~"5[0-9]{2}"}  →  [^{}]* 가 {2} 에서 멈춤
const selectorPattern = /\{([^{}]*)\}/g;
```

Grafana expr에는 두 종류의 중괄호가 혼재한다:
1. PromQL label selector `{__name__=~"..."}`
2. Regex quantifier `{2}`, `{1,3}`

**안전 대안**:
```js
// ✅ 입력 normalize 단계에서 quantifier placeholder 치환 후 selector 정규식 적용
function normalizeExprForSelectorParse(expr) {
  // Grafana 변수 ${var} 치환
  let normalized = expr.replace(/\$\{[^}]+\}/g, '__GRAFANA_VAR__');
  // 숫자 quantifier {N} / {N,M} 치환
  normalized = normalized.replace(/\{(\d+(?:,\d*)?)\}/g, '__QUANTIFIER__');
  return normalized;
}
```

**체크 항목**:
- [ ] selector 추출 정규식이 inner quantifier `{N}` 에 의해 끊기는지 확인
- [ ] Grafana variable `${var}`, `${var:format}` 양쪽 포맷 모두 치환 여부 확인

*Critic 인용: PR #209 R1 P2*

---

### 2.4 Prefix anchoring (Sprint 147 PR #218/#219 사례)

**결함 패턴**:
```js
// ❌ 위험: ${var:format} Grafana 포맷 미인식 → format suffix 포함 variable 미검출
const varPattern = /\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

// ❌ 위험: wildcard .+ 사용 시 known prefix 없이 오탐 가능
/algosu_.+_total/  // known service prefix가 없으면 1건도 매칭 안 될 수 있음
```

**안전 대안**:
```js
// ✅ Grafana variable format suffix optional capture
const varPattern = /\$\{([a-zA-Z_][a-zA-Z0-9_]*)(?::[^}]*)?\}/g;
//                                                 ^^^^^^^^^^^ format suffix 허용

// ✅ wildcard 사용 시 KNOWN_SERVICE_PREFIXES expansion + least-one match 검증
const KNOWN_SERVICE_PREFIXES = ['gateway', 'submission', 'problem', 'github_worker', 'ai_analysis', 'default'];
// known prefix 중 1+ 가 정의되면 OK (dashboard "있는 service만 보여줘" 의도)
```

**체크 항목**:
- [ ] Grafana variable 정규식이 `${var:format}` 포맷 구문 포함 여부
- [ ] wildcard `.+` 패턴 사용 시 `KNOWN_SERVICE_PREFIXES` expansion + least-one match 검증 여부
- [ ] `|` 각 얼터너티브에 prefix 독립 anchoring 여부

*Critic 인용: PR #219 R1 P2 / PR #218 R1 P2-2*

---

## 3. 코딩 전 사전 점검

정규식을 포함하는 코드를 작성하거나 수정할 때 아래 순서를 따른다.

### 3.1 Self-review 체크리스트

```
□ 2.1 — | 연산자 우선순위: 모든 | 에 명시적 그룹화 또는 prefix anchoring 적용
□ 2.2 — Character class 일관성: 같은 도메인의 source/dashboard side 동일 class
□ 2.3 — Quantifier 처리: inner {N} quantifier 분리 또는 normalize 적용
□ 2.4 — Prefix anchoring: ${var:format} optional capture / wildcard expansion
```

### 3.2 로컬 검증

```bash
# 1. 정상 케이스 통과 확인
node scripts/check-grafana-metrics.mjs

# 2. 회귀 시나리오 1건 주입 후 exit(1) 확인
# 예: check-grafana-metrics.mjs의 KNOWN_METRICS에서 실제 dashboard metric 1건 제거 후 실행
node scripts/check-grafana-metrics.mjs  # exit code 1 기대

# 3. 원상복구 후 재실행
node scripts/check-grafana-metrics.mjs  # exit code 0 기대
```

---

## 4. Critic R1 P2 적발 시 대응 흐름

```
R1 P2 적발
    │
    ▼
즉시 fix commit (체크리스트 2.1~2.4 재점검)
    │
    ▼
R2 호출
    │
    ├── P2 없음 → ✅ 머지 가능
    │
    └── P2 적발 → fix 누적 + R3 호출
            │
            ├── R3 클린 → ✅ 머지 가능
            │
            └── R3 임계값 미달 → R4+ (Sprint 142 5라운드 패턴 참조)
```

**R3 클린 임계값**: "discrete introduced bug 없음" + 단순 character class 변경 + 새 결함 가능성 정의역적으로 0에 가까울 때

**DIRTY mergeStateStatus 동시 발생 시**: Critic fix + `git rebase origin/main` 단일 dispatch로 묶어 cycle time 단축 (Sprint 147 PR #219 패턴)

*참조: Sprint 142 ADR — Critic 5 라운드 패턴 / Sprint 145~147 ADR — 다중 라운드 P2 누적 해소*

---

## 5. CI 자동화 — 책임 매트릭스

| 검증 차원 | CI job | SSOT | 담당 Agent |
|-----------|--------|------|------------|
| Prometheus rules 문법 | `quality-monitoring` (promtool) | `infra/k3s/monitoring/prometheus-rules.yaml` | Architect |
| Dashboard metric 정합 | `quality-monitoring` (check-grafana-metrics.mjs) | `scripts/check-grafana-metrics.mjs` | Architect |
| Panel title ↔ metric 정합 | `quality-monitoring` | `PANEL_TITLE_KEYWORD_MAP` in mjs | Architect |
| Dashboard variable 미사용 | `quality-monitoring` | mjs variable collector | Architect |

### SSOT 확장 의무

- 신규 panel 추가 시 → `PANEL_TITLE_KEYWORD_MAP`에 keyword 등록 필수 (미등록 panel은 silent skip)
- 신규 service 추가 시 → `KNOWN_SERVICE_PREFIXES` 배열 확장 필수
- 신규 recording rule 추가 시 → `prometheus-rules.yaml` SSOT 자동 포함 (별도 작업 불필요)

> **Sprint 147 P2-3 사례**: `request rate` keyword 미등록으로 SLO "Claude API Request Rate" panel 검증 누락.
> 신규 panel 추가 시 SSOT 명시적 확장 의무를 해당 코드 JSDoc에 명문화되어 있음 — 반드시 준수.

---

## 6. 참고 자료

### 스크립트 라인 범위

| 함수 | 파일 | 역할 |
|------|------|------|
| `normalizeExprForSelectorParse` | `scripts/check-grafana-metrics.mjs` ~378 | Grafana 변수/quantifier placeholder 치환 |
| `collectNameSelectorMetrics` | `scripts/check-grafana-metrics.mjs` ~420 | `__name__` selector metric 수집 |
| `expandRegexMetricPattern` | `scripts/check-grafana-metrics.mjs` ~460 | wildcard `.+` → prefix expansion |
| `extractVariableReferences` | `scripts/check-grafana-metrics.mjs` ~780 | `${var:format}` 포함 variable 참조 추출 |

### ADR 기록

- `docs/adr/sprints/sprint-145.md` — character class P2 + SSOT 가정 검증 패턴
- `docs/adr/sprints/sprint-146.md` — quantifier placeholder P2 + Critic 3 라운드 패턴
- `docs/adr/sprints/sprint-147.md` — `|` 우선순위 + prefix anchoring P2 + DIRTY 동시 해소

---

## 7. FAQ

**Q: wildcard `__name__=~"algosu_.+_xxx"` 패턴이 정상이지만 CI가 fail 하는 경우?**
A: `KNOWN_SERVICE_PREFIXES` expansion 후 1건 이상의 defined metric이 있어야 OK.
미등록 service prefix가 있으면 0건 매치로 fail. `KNOWN_SERVICE_PREFIXES` 배열 확장 필요.

**Q: 신규 panel keyword 매핑은 누가 하는가?**
A: panel을 추가하는 **Architect**가 `PANEL_TITLE_KEYWORD_MAP` 동시 확장 의무.
스크립트 상단 JSDoc에 등록 의무가 명문화되어 있음.

**Q: Loki panel은 검증 제외인가?**
A: datasource type/uid 일관성 검증에서 Loki(uid=loki)는 면제. Prometheus datasource만 metric 검증 대상.

**Q: 체크리스트 항목 중 하나라도 불명확하면?**
A: 진행보다 Oracle 보고 우선. Plan 가정 깨짐은 즉시 상위에 알린다 (Sprint 146 직접 적용 원칙).

**Q: 향후 regex 강건성 lint 룰 자동화 시 이 RUNBOOK은?**
A: lint 룰이 도입되면 섹션 5 매트릭스에 `eslint-plugin-regex-robustness` 항목 추가.
현재는 수동 체크리스트 + Critic R1 검증으로 차단. Sprint 148 시드 #13 후보 트래킹 중.
