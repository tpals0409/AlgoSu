# AlgoSu CI/CD 상세 이력

## 코드 품질 + 배포 안전성 (완료, HEAD: a14a670)
- identity ESLint 설치 완료
- 전 서비스 .eslintrc.js 표준화 (no-console:warn, no-control-regex:off, no-explicit-any:warn)
- CI identity has_eslint: true 활성화
- ruff requirements-dev.txt 추가 (ruff==0.3.0)
- enableShutdownHooks 완료: gateway/identity/submission/problem (github-worker: 자체 SIGTERM)
- RollingUpdate 전략: 7개 매니페스트 전체 적용
- ai-analysis 미사용 import 정리, Trivy CVE 3건 해결
- CI 전 파이프라인 녹색화

## CI/CD P2 완료 (HEAD: 8be0669)
- Discord 배포 알림, Dependabot, CODEOWNERS, Grafana Annotation

## GitOps 전환 완료 (HEAD: 8baf1c9)
- aether-gitops 레포, ci.yml deploy job SSH→GitOps 교체, GITOPS_TOKEN 등록

## CircuitBreaker + RabbitMQ 완료 (HEAD: 7307071)
- CB 싱글턴 통합, 상태 콜백 + Prometheus gauge, RabbitMQ Prometheus 플러그인

## k3s 배포 준비 완료 (aether-gitops: dee1616)
- prod overlay 버그 수정, ArgoCD Application, k3s-bootstrap.sh

## Phase 3 Sprint 3-1 CI 녹색 확인 (HEAD: 2aa0e8b, CI Run: 22521496994)
- 19개 job 전체 성공: secret-scan → quality(5) → test(1) → build(1) → trivy(7) → gitops → notify
- Problem DB 분리 코드 + initContainer 수정 + SealedSecret + prod overlay 포함
- aether-gitops 자동 태그 업데이트 완료 (HEAD: 8eb9186)

## Phase 3 Sprint 3-2 기능 구현 (HEAD: bddbf98)
- 36파일 변경, +4220줄
- 백엔드 7 + 프론트엔드 8 = 15개 기능
- CI 실행 대기 중 (push 전)

## Trivy npm 번들 취약점 해결
- 근본 원인: node:20-alpine npm 자체 내부 의존성 (tar, glob, minimatch, cross-spawn)
- 해결: runner 스테이지에서 npm/npx 삭제
- initContainer: npm→node 직접 호출로 변경 (3서비스)
- 학습: npm overrides는 프로젝트 node_modules만 영향, npm 자체 번들은 별개
