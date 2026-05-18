# ADR-003: Redis/RabbitMQ ACL Separation Design

- **Status**: Deferred
- **Date**: 2026-03-16
- **Last reviewed**: 2026-04-07
- **Decision maker**: Oracle

## Context

Currently all services connect using the same Redis/RabbitMQ credentials.
There is no inter-service isolation, so a bug or security breach in one service can affect another service's data.

**Current state:**

| Service | Redis usage | RabbitMQ usage |
|--------|-----------|--------------|
| Gateway | rate-limit, session | - |
| Submission | saga state, cache | publish (analysis/push requests) |
| Problem | cache | - |
| GitHub-Worker | status reporting | consume (push requests) |
| AI-Analysis | status reporting | consume (analysis requests) |
| Identity | - | - |

**Risks:**
- Service A can overwrite Service B's Redis keys
- RabbitMQ queues can be incorrectly consumed or deleted

## Design Proposal

### Redis: Key Prefix Namespace

Enforce service-specific key prefixes to achieve logical isolation.
Apply prefix-based access control using Redis ACL (6.0+).

**Prefix rules:**

| Service | Prefix | Example keys |
|--------|---------|---------|
| Gateway | `gw:` | `gw:rate:192.168.1.1`, `gw:sess:<token>` |
| Submission | `sub:` | `sub:saga:<id>`, `sub:cache:<key>` |
| Problem | `prob:` | `prob:cache:<id>` |
| GitHub-Worker | `ghw:` | `ghw:status:<id>` |
| AI-Analysis | `ai:` | `ai:status:<id>`, `ai:cb:<circuit>` |

**Redis ACL configuration (redis.conf):**

```
# Create per-service users
user gw-user on >gw-password ~gw:* &* +@all -@admin
user sub-user on >sub-password ~sub:* &* +@all -@admin
user prob-user on >prob-password ~prob:* &* +@all -@admin
user ghw-user on >ghw-password ~ghw:* &* +@all -@admin
user ai-user on >ai-password ~ai:* &* +@all -@admin

# Disable default user
user default off
```

**How to apply:**
1. Add `keyPrefix` option when initializing Redis client in each service (ioredis)
2. Mount redis.conf via k8s ConfigMap
3. Set individual Redis URLs in per-service Secrets

**Code change example (ioredis):**
```typescript
const redis = new Redis(redisUrl, {
  keyPrefix: 'gw:', // per-service prefix
});
```

### RabbitMQ: vhost separation vs. user permission separation

**Option A: Per-user permission separation (recommended)**

Retain the current single vhost (`algosu`) while separating queue/exchange access permissions per user.

| User | configure | write | read |
|--------|-----------|-------|------|
| sub-user | `^(submission\..*)$` | `^(submission\.\|analysis\.\|github\..*)$` | `^(submission\..*)$` |
| ghw-user | `^(github\..*)$` | `^(github\..*)$` | `^(github\..*)$` |
| ai-user | `^(analysis\..*)$` | `^(analysis\..*)$` | `^(analysis\..*)$` |

```bash
# Create user and set permissions
rabbitmqctl add_user sub-user <password>
rabbitmqctl set_permissions -p algosu sub-user \
  "^(submission\..*)" "^(submission\.|analysis\.|github\..*)" "^(submission\..*)"
```

**Option B: vhost separation**

Create a vhost per service. This requires the Shovel plugin for inter-service message routing,
resulting in significant resource overhead in the OCI ARM environment. Not recommended.

## OCI ARM Resource Impact Analysis

| Item | Additional resources | Notes |
|------|-----------|------|
| Redis ACL | 0 (config only) | Add redis.conf ConfigMap |
| 5 Redis users | Negligible | Memory in KB range |
| 3 RabbitMQ users | Negligible | Metadata in KB range |
| Additional Secrets (5) | Negligible | Stored in etcd |

Total additional resources: effectively 0. No issues with existing 4 OCPU / 24GB environment.

## Migration Plan

### Phase 1: Introduce key prefixes (zero-downtime)
1. Add `keyPrefix` to each service's code
2. Run migration script to add prefixes to existing keys
3. After deployment, clean up keys without old prefix

### Phase 2: Enable Redis ACL
1. Deploy redis.conf ConfigMap
2. Set individual Redis URLs (including user) in per-service Secrets
3. Rolling deployment (Gateway → Problem → Submission → Workers)

### Phase 3: Separate RabbitMQ users
1. Confirm queue/exchange naming conventions are applied
2. Create per-service RabbitMQ users
3. Set individual RABBITMQ_URL in per-service Secrets
4. Rolling deployment

## Decision

**Deferred** — will not be applied immediately.

Proposed in Sprint 50 security audit (2026-03-16). Urgency is low since there are currently 6 services and a single team operating. Apply sequentially from Phase 1 when any of the following conditions are met:

- When multi-tenancy is introduced
- When external developers join
- When a security audit requires it

## References

- Redis ACL documentation: https://redis.io/docs/management/security/acl/
- RabbitMQ Access Control: https://www.rabbitmq.com/access-control.html
- Current Redis-using services: Gateway, Submission, Problem, GitHub-Worker, AI-Analysis
- Current RabbitMQ-using services: Submission, GitHub-Worker, AI-Analysis
