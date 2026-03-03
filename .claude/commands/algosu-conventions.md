AlgoSu 코드 규칙 문서를 읽고 관련 질문에 답하거나 코드 작성 시 규칙을 적용합니다.

기본 문서: /root/AlgoSu/plan/Code Rules/AlgoSu_Code_Conventions.md
업데이트 v1.1: /root/AlgoSu/plan/추가사항 문서/AlgoSu_Code_Conventions_Update_v1.1.md

이 문서를 참조하여 다음 내용을 도와주세요:
- 네이밍 컨벤션 (camelCase, PascalCase, UPPER_SNAKE_CASE 등)
- 폴더/파일 구조 (모노레포, NestJS, FastAPI, Next.js)
- Git 커밋/브랜치 규칙 (Conventional Commits)
- TypeScript ESLint/Prettier 설정
- Python 코드 스타일 (FastAPI)
- 공통 금지 사항

### v1.1 추가 규칙 (Palette 합류)
- 디자인 토큰 네이밍: `{semantic}-{scale}` (예: `primary-500`, `error-100`)
- `tailwind.config.ts` 커스텀 토큰: **Palette 확정 → Herald 등록** 순서 필수
- `bg-[#...]` 인라인 색상/크기 하드코딩 **금지** → 디자인 토큰 클래스 사용
- `components/ui/` 컴포넌트: **Palette 협의 없이 단독 생성 금지**

### 모니터링 로그 규칙 (2026-02-28 추가)
- 규칙 문서: `/root/AlgoSu/docs/monitoring-log-rules.md`
- JSON structured logging 필수, `console.log` 문자열 금지
- Prometheus 네이밍: `algosu_{service}_{metric}_{unit}`
- 민감 정보 로그 절대 금지, Log Injection 방지

### CI/CD 규칙 (2026-02-28 추가)
- 규칙 문서: `/root/AlgoSu/docs/ci-cd-rules.md`
- 커밋: Conventional Commits (`feat/fix/chore(scope): subject`), commitlint CI 강제
- 브랜치: `<type>/<scope>-<description>`, main 직접 push 금지, Squash merge
- PR: 필수 체크리스트 (테스트/타입체크/lint/보안/DB), CODEOWNERS 자동 리뷰어
- 품질: ESLint `no-console:'error'`, `tsc --noEmit`, Ruff `T20`, 커버리지 60%+
- 보안: `permissions:{}`, gitleaks, Trivy, .env 커밋 방지

코드 작성 또는 리뷰 시 이 규칙을 자동으로 적용합니다.

사용자의 요청: $ARGUMENTS
