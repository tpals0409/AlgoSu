# User Soft Delete 패턴

> 소스: `services/identity/src/user/user.service.ts`, `user.entity.ts`

## 개요

- `deleted_at` 컬럼(nullable timestamp) 기반 soft delete
- 재가입 시 자동 복구 — 동일 이메일 OAuth 로그인으로 탈퇴 계정 즉시 복원
- **Hard delete 없음** — 데이터 무결성과 감사 추적을 위해 물리 삭제를 수행하지 않음

## 메서드별 동작

| 메서드 | deleted_at 필터링 | 용도 |
|--------|:-:|------|
| `findById(id)` | O (`IS NULL`) | 활성 유저만 조회 — 일반 API 조회 |
| `findByEmail(email)` | X (의도적) | OAuth upsert 전용 — 탈퇴 계정 복구 판별 |
| `findBySlug(slug)` | O (`IS NULL`) | 공개 프로필 조회 — 탈퇴 유저 노출 차단 |
| `findByIdOrThrow(id)` | O (`IS NULL`) | 내부 헬퍼 — 없으면 `NotFoundException` |

> `findByEmail`은 탈퇴 계정(`deleted_at IS NOT NULL`)을 포함하여 조회한다. 이는 `upsertUser` 내부에서 탈퇴 계정 복구 여부를 판별하기 위한 의도적 설계이다. 일반 조회 목적으로 사용하지 않는다.

## Soft Delete 프로세스

`softDeleteUser(id)` 실행 시 트랜잭션 내에서 6단계를 수행한다.

```
1. deleted_at = NOW()           — 소프트 삭제 마킹
2. email = deleted_{uuid}@withdrawn.local  — 이메일 익명화
3. name = '탈퇴한 사용자'         — 개인정보 제거
4. avatar_url = NULL             — 프로필 이미지 제거
5. github_* = NULL/false         — GitHub 연동 정보 제거
6. study_members, notifications DELETE  — 관계 데이터 물리 삭제
```

- 전체를 하나의 트랜잭션으로 감싸 부분 실패를 방지한다.
- 이미 탈퇴한 유저(`deleted_at` 존재)에 대해 재호출 시 조기 반환(멱등성).

## 재가입 복구 플로우

```
OAuth 로그인 요청
  │
  ▼
upsertUser(dto)
  │
  ├─ findOne({ email })          ← deleted_at 필터링 없이 조회
  │
  ├─ validateOneAccountOneOAuth  ← OAuth 공급자 일치 검증
  │
  ├─ existing?.deleted_at ?
  │   ├─ YES → restoreDeletedUser()
  │   │         ├─ deleted_at = NULL
  │   │         ├─ name = dto.name
  │   │         ├─ avatar_url = 'preset:default'
  │   │         └─ github_connected = false
  │   │
  │   └─ NO  → atomicUpsert() (일반 생성/업데이트)
  │
  ▼
복원된 User 반환
```

- 이메일은 OAuth 공급자가 제공하는 값으로 자동 복원된다 (익명화 해제).
- `study_members`, `notifications`는 soft delete 시 물리 삭제되었으므로 복원되지 않는다.

## JWT 검증 — 탈퇴 유저 거부

```
JWT Cookie 수신
  │
  ▼
JwtMiddleware (Gateway)
  ├─ JWT 디코딩 → userId 추출
  ├─ req.headers['x-user-id'] 설정
  │
  ▼
API 요청 처리
  ├─ findById(userId) — deleted_at IS NULL 필터링
  ├─ 결과 null → NotFoundException
  └─ 탈퇴 유저의 JWT는 유효하더라도 조회 실패로 거부됨
```

- JWT 자체를 무효화하지 않고, `findById`의 `deleted_at IS NULL` 필터로 자연 차단한다.
- JWT 만료(기본 정책)까지 토큰 자체는 유효하나, 모든 API 호출이 유저 조회 실패로 거부된다.
