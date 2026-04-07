# ADR-003: Redis/RabbitMQ ACL 분리 설계

- **상태**: 보류 (Deferred)
- **날짜**: 2026-03-16
- **최종 검토**: 2026-04-07
- **의사결정자**: Oracle (심판관)

## 컨텍스트

현재 모든 서비스가 동일한 Redis/RabbitMQ 자격증명으로 접속한다.
서비스 간 격리가 없어, 한 서비스의 버그나 보안 침해가 다른 서비스의 데이터에 영향을 줄 수 있다.

**현재 상태:**

| 서비스 | Redis 사용 | RabbitMQ 사용 |
|--------|-----------|--------------|
| Gateway | rate-limit, session | - |
| Submission | saga 상태, 캐시 | publish (분석/푸시 요청) |
| Problem | 캐시 | - |
| GitHub-Worker | 상태 보고 | consume (푸시 요청) |
| AI-Analysis | 상태 보고 | consume (분석 요청) |
| Identity | - | - |

**위험:**
- 서비스 A가 서비스 B의 Redis 키를 덮어쓸 수 있음
- RabbitMQ 큐를 잘못 소비/삭제할 수 있음

## 설계안

### Redis: 키 프리픽스 네임스페이스

서비스별 키 프리픽스를 강제하여 논리적 격리를 달성한다.
Redis ACL(6.0+)로 프리픽스 기반 접근 제어를 적용한다.

**프리픽스 규칙:**

| 서비스 | 프리픽스 | 예시 키 |
|--------|---------|---------|
| Gateway | `gw:` | `gw:rate:192.168.1.1`, `gw:sess:<token>` |
| Submission | `sub:` | `sub:saga:<id>`, `sub:cache:<key>` |
| Problem | `prob:` | `prob:cache:<id>` |
| GitHub-Worker | `ghw:` | `ghw:status:<id>` |
| AI-Analysis | `ai:` | `ai:status:<id>`, `ai:cb:<circuit>` |

**Redis ACL 설정 (redis.conf):**

```
# 서비스별 사용자 생성
user gw-user on >gw-password ~gw:* &* +@all -@admin
user sub-user on >sub-password ~sub:* &* +@all -@admin
user prob-user on >prob-password ~prob:* &* +@all -@admin
user ghw-user on >ghw-password ~ghw:* &* +@all -@admin
user ai-user on >ai-password ~ai:* &* +@all -@admin

# 기본 사용자 비활성화
user default off
```

**적용 방법:**
1. 각 서비스의 Redis 클라이언트 초기화 시 `keyPrefix` 옵션 추가 (ioredis)
2. k8s ConfigMap으로 redis.conf 마운트
3. 서비스별 Secret에 개별 Redis URL 설정

**코드 변경 예시 (ioredis):**
```typescript
const redis = new Redis(redisUrl, {
  keyPrefix: 'gw:', // 서비스별 프리픽스
});
```

### RabbitMQ: vhost 분리 vs 사용자 권한 분리

**옵션 A: 사용자별 권한 분리 (권장)**

현재 단일 vhost(`algosu`)를 유지하면서 사용자별 큐/exchange 접근 권한을 분리한다.

| 사용자 | configure | write | read |
|--------|-----------|-------|------|
| sub-user | `^(submission\..*)$` | `^(submission\.\|analysis\.\|github\..*)$` | `^(submission\..*)$` |
| ghw-user | `^(github\..*)$` | `^(github\..*)$` | `^(github\..*)$` |
| ai-user | `^(analysis\..*)$` | `^(analysis\..*)$` | `^(analysis\..*)$` |

```bash
# 사용자 생성 및 권한 설정
rabbitmqctl add_user sub-user <password>
rabbitmqctl set_permissions -p algosu sub-user \
  "^(submission\..*)" "^(submission\.|analysis\.|github\..*)" "^(submission\..*)"
```

**옵션 B: vhost 분리**

서비스별 vhost를 생성한다. 서비스 간 메시지 전달에 Shovel 플러그인이 필요해져
OCI ARM 환경에서 리소스 오버헤드가 크다. 비권장.

## OCI ARM 리소스 영향 분석

| 항목 | 추가 리소스 | 비고 |
|------|-----------|------|
| Redis ACL | 0 (설정만) | redis.conf ConfigMap 추가 |
| Redis 사용자 5개 | 무시 가능 | 메모리 수 KB |
| RabbitMQ 사용자 3개 | 무시 가능 | 메타데이터 수 KB |
| Secret 추가 (5개) | 무시 가능 | etcd 저장 |

총 추가 리소스: 사실상 0. 기존 4 OCPU / 24GB 환경에서 문제 없음.

## 마이그레이션 계획

### Phase 1: 키 프리픽스 도입 (무중단)
1. 각 서비스 코드에 `keyPrefix` 추가
2. 기존 키가 있는 경우 마이그레이션 스크립트로 프리픽스 추가
3. 배포 후 기존 프리픽스 없는 키 정리

### Phase 2: Redis ACL 활성화
1. redis.conf ConfigMap 배포
2. 서비스별 Secret에 개별 Redis URL(사용자 포함) 설정
3. 순차 배포 (Gateway → Problem → Submission → Workers)

### Phase 3: RabbitMQ 사용자 분리
1. 큐/exchange 네이밍 규칙 적용 확인
2. 서비스별 RabbitMQ 사용자 생성
3. 서비스별 Secret에 개별 RABBITMQ_URL 설정
4. 순차 배포

## 결정

**보류 (Deferred)** — 즉시 적용하지 않는다.

Sprint 50 보안 감사(2026-03-16)에서 제안됨. 현재 서비스 수가 6개이고 단일 팀이 운영하므로 긴급도는 낮다.
다음 조건 충족 시 Phase 1부터 순차 적용한다:

- 멀티 테넌시 도입 시
- 외부 개발자 참여 시
- 보안 감사 요구 시

## 참고

- Redis ACL 문서: https://redis.io/docs/management/security/acl/
- RabbitMQ Access Control: https://www.rabbitmq.com/access-control.html
- 현재 Redis 사용 서비스: Gateway, Submission, Problem, GitHub-Worker, AI-Analysis
- 현재 RabbitMQ 사용 서비스: Submission, GitHub-Worker, AI-Analysis
