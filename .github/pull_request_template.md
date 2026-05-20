## 변경 내용

<!-- 변경 사항을 간결하게 설명해주세요 -->

## 변경 유형

- [ ] feat: 새 기능
- [ ] fix: 버그 수정
- [ ] refactor: 구조 변경
- [ ] chore: 빌드/의존성
- [ ] ci/infra: CI/CD 또는 인프라 변경
- [ ] docs: 문서
- [ ] test: 테스트

## Dependabot Auto-merge 조건 (자동 처리, 수동 변경 금지)

> 이 PR이 Dependabot이 생성한 경우 아래 조건을 모두 만족할 때 자동 merge됩니다.

- [ ] PR 작성자: `dependabot[bot]`
- [ ] 업데이트 타입: `patch` 또는 `minor` (major 제외)
- [ ] CI 전체 체크 통과 (ci.yml required checks)
- [ ] Branch Protection required checks 통과

> ⚠️ major 버전 업데이트는 자동 merge 대상이 아닙니다. 계획된 Sprint에서 수동 검토 후 merge 하세요.

## 필수 체크리스트

- [ ] 단위 테스트 통과
- [ ] 타입 체크 통과 (`tsc --noEmit`)
- [ ] lint 통과
- [ ] 커밋 메시지 Conventional Commits 준수

## 보안 체크리스트

- [ ] 민감 정보 커밋 없음 (.env, 토큰, 키)
- [ ] JWT 변경 시: `none` 알고리즘 차단, 만료 검증 확인
- [ ] 신규 엔드포인트에 X-Internal-Key 또는 JWT 가드 적용
- [ ] 로그 출력에 토큰/키/이메일/DB 연결문자열 미포함
- [ ] SQL: 파라미터 바인딩 사용 확인
- [ ] 사용자 입력 로그 기록 시 Log Injection 방지

## DB 변경 (해당 시)

- [ ] 마이그레이션 `down()` 구현
- [ ] Expand-Contract 패턴 준수 (파괴적 변경 없음)

## 인프라 변경 (해당 시)

- [ ] Kustomize overlay 렌더링 확인
- [ ] Sealed Secrets 적용 확인
- [ ] CI 인프라 변경 PR인 경우 `workflow_dispatch(rebuild_all=true)` 실행 계획 포함 ([docs/runbook/ci-rebuild-all.md](../docs/runbook/ci-rebuild-all.md) 참조)

## 의존성 변경 (해당 시 — 특히 major 버전)

> Sprint 139/140에서 react-day-picker v8→v9 미대응으로 캘린더 회귀 5건 발생 → 본 체크리스트로 재발 차단

- [ ] **major 버전 변경 시**: 직접 사용하는 wrapper 컴포넌트 점검 (className/props/API breaking change 매핑)
- [ ] CHANGELOG / migration guide 검토 (breaking change 항목 vs 코드베이스 사용처 grep 비교)
- [ ] wrapper 컴포넌트 사용처 시각 검증 (영향받는 페이지 1곳 이상 직접 확인)
- [ ] 동적/runtime API 변경 시 — 단위 테스트 또는 e2e로 회귀 보호 확인
- [ ] 타입 정의 변경 — `tsc --noEmit` clean 후에도 사용처 별 직접 확인
- [ ] 상세 가이드: [docs/runbook/dependency-major-upgrade.md](../docs/runbook/dependency-major-upgrade.md)

## 문서/ADR 변경 (해당 시)

> Sprint 157 #24: ADR/sprint 문서는 KR+EN 양면 SSOT. en-coverage CI(`scripts/check-adr-en-coverage.mjs --strict`)가 누락을 차단한다.
> Sprint 157 #23: rebase/머지 과정에서 누적 카운트가 어긋나 README 인덱스가 실제 파일 수와 불일치하는 사례 방지.

- [ ] ADR/sprint 문서 변경 시 `docs/adr/`(KR) + `docs/adr-en/`(EN) 양면 갱신
- [ ] rebase/머지 후 README 누적 카운트(ADR count 등)가 실제 파일 수와 일치하는지 재확인

## 신규 산출물 (해당 시 — 채택 ≠ 소비)

> Sprint 171 교훈: zstd OCI export를 채택했으나 어디서도 소비하지 않아 제거. 신규 산출물은 반드시 소비처가 있어야 한다.

- [ ] 신규 스크립트/헬퍼/설정/아티팩트 추가 시 **소비처(호출·사용 지점)** 를 동시에 명시
- [ ] 소비처가 아직 없으면 추가를 보류하거나, 후속 PR 계획을 본문에 기재
