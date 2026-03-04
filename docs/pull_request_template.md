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
