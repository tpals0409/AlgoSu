# AlgoSu 작업 시 핵심 학습

## CI/CD 작업 시 핵심 학습
- **gitleaks-action vs CLI**: `gitleaks/gitleaks-action@v2`는 private repo에 유료 라이선스 필요 → CLI 직접 설치로 우회
- **gitleaks false positive**: localhost AMQP, 테스트 픽스처(test-jwt-secret 등) → `.gitleaks.toml` allowlist paths + regexes로 해결
- **GHA matrix + detect-changes 조합**: job-level `if`로 matrix변수 참조 불가 → step-level `if` + skip check 패턴 사용
- **ESLint no-control-regex**: 로그 sanitize 코드에서 제어문자 정규식 의도적 사용 → `.eslintrc.js`에서 off 필수
- **identity npm ci 실패**: package.json에 devDeps 추가 후 package-lock.json 미갱신 → `npm install --package-lock-only` 필수
- **ruff F401 threading**: worker.py에서 미사용 import — threading은 main.py에서만 사용. noqa 주석이나 future annotations 조작 불필요, 단순 제거로 해결
- **Trivy arm64**: Oracle ARM 프리티어 대상 → `--platform linux/arm64` 필수, 미지정 시 GHA(amd64)에서 이미지 찾기 실패
- **FastAPI 메이저 업그레이드 시 의존성 체인**: fastapi ↔ starlette ↔ pydantic 버전 호환 주의. fastapi 0.128.8은 pydantic>=2.7.0 필요

## k3d 배포 시 핵심 학습
- **Gateway CatchAllController** (`@All('*')`)가 `/metrics` 선점 → NestJS import 순서 중요 (MetricsModule → ProxyModule)
- **Promtail kubernetes_sd**: `__path__` relabel 필수, 없으면 타겟 발견해도 파일 tailing 안 함
- **CRI 로그 포맷**: k8s는 `<ts> <stream> <flags> <json>` 형태로 감싸므로 `- cri: {}` stage 필수
- **Prometheus PVC**: RollingUpdate 시 TSDB lock 충돌 → 0→1 스케일링 또는 Recreate 전략 필요
- **Docker build prod_node_modules**: tsconfig.json에 `"exclude": ["prod_node_modules"]` 필수

## Trivy + Docker + npm 학습 (2026-02-28)
- **npm `--only=production` deprecated**: npm 9+/Node 20+에서 무시됨 → `--omit=dev` 사용 필수
- **Trivy가 npm 번들 deps 검출**: node:20-alpine 내 `/usr/local/lib/node_modules/npm/node_modules/`에 tar, glob, minimatch, cross-spawn 등 취약 버전 포함 → 프로젝트 deps가 아닌 npm 자체 문제
- **해결법**: runner 스테이지에서 `rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx` — 프로덕션 런타임에 npm 불필요
- **npm overrides 범위**: 글로벌 override는 dev deps까지 영향 → Jest test-exclude 등과 충돌 가능. scoped override (`"typeorm": {"glob": "^10.5.0"}`)로 범위 제한 가능
- **Gateway Dockerfile 구조 차이**: Gateway는 production 스테이지에서 npm ci 실행 (다른 서비스는 builder에서 prod_node_modules 복사). npm 삭제는 npm ci 이후에 위치해야 함
- **Docker GHA cache**: `cache-from: type=gha` 사용 시 BuildKit 레이어 캐시 주의. lockfile 변경 시 COPY 레이어 해시 변경으로 npm ci 재실행됨 (정상 동작)

## Agent Team 운영 학습 (2026-02-28)
- **worktree 코드 유실**: `isolation: "worktree"`로 Agent 투입 후 TeamDelete 호출 시, merge 안 된 worktree 브랜치까지 삭제됨 → 모든 코드 유실
- **교훈**: worktree Agent 작업 완료 후 반드시 main에 merge → 그 다음 TeamDelete
- **PM 지시**: TF 외 범용 Agent 투입 금지. 반드시 skill 로드하여 페르소나+규칙 적용 상태로 작업
- **범용 Agent 문제**: skill 없이 투입하면 보안 체크, 모니터링 로그 규칙, 코드 컨벤션 보장 불가

## Phase 3 Dual Write 학습
- **TypeORM 다중 연결**: `@InjectRepository(Entity, CONNECTION_NAME)` + `TypeOrmModule.forFeature([Entity], CONNECTION_NAME)` 패턴
- **DualWriteService 패턴**: 모드별 read/write 라우팅, 신 DB 쓰기 실패는 로그만 (구 DB 트랜잭션 영향 안줌)
- **Reconciliation**: md5(row_to_json) checksum 비교, @Cron('0 * * * *') 매시간 실행
