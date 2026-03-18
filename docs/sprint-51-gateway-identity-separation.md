# Sprint 51 — Gateway → Identity DB 분리

## 목표
Gateway의 identity_db 직접 접근(19파일, 6엔티티)을 Identity 서비스 API 호출로 전환하여 DB per Service 원칙을 준수한다.

## 근거
ADR-001: `docs/adr/ADR-001-gateway-identity-db-separation.md`

## 웨이브 계획

### W1 — Identity 서비스 Foundation
| 번호 | 작업 | Agent |
|------|------|-------|
| 1-1 | Identity Entity 6개 등록 (Study, StudyMember, StudyInvite, Notification, ShareLink + User 보완) | Architect |
| 1-2 | Identity 모듈 구조 생성 (UserModule, StudyModule, NotificationModule, ShareLinkModule) | Architect |
| 1-3 | Identity InternalKeyGuard + HttpModule 인프라 | Architect |

### W2 — Identity API 구축
| 번호 | 작업 | Agent |
|------|------|-------|
| 2-1 | User API: findById, findByEmail, upsert, update, softDelete, github 연동 | Gatekeeper |
| 2-2 | Study API: CRUD + StudyMember 관리 + StudyInvite 관리 | Gatekeeper |
| 2-3 | Notification API: CRUD + unreadCount + markRead + 30일 cleanup | Postman |
| 2-4 | ShareLink API: CRUD + verify + profileSettings | Postman |

### W3 — Gateway 전환
| 번호 | 작업 | Agent |
|------|------|-------|
| 3-1 | Gateway IdentityClient 서비스 생성 (Identity HTTP 호출 래퍼) | Gatekeeper |
| 3-2 | OAuthService 전환: userRepository → IdentityClient | Gatekeeper |
| 3-3 | StudyService 전환: repository → IdentityClient | Gatekeeper |
| 3-4 | NotificationService + DeadlineReminderService 전환 | Postman |
| 3-5 | ShareLinkService + PublicProfile/PublicShare 전환 | Postman |
| 3-6 | Guards 전환 (StudyMemberGuard, StudyActiveGuard, ShareLinkGuard) | Gatekeeper |
| 3-7 | JwtMiddleware 전환: userRepository → IdentityClient | Gatekeeper |
| 3-8 | InternalController 전환: repository → IdentityClient | Gatekeeper |

### W4 — 정리 & 검증
| 번호 | 작업 | Agent |
|------|------|-------|
| 4-1 | Gateway identity_db TypeORM 연결 제거 + Entity 파일 삭제 | Architect |
| 4-2 | Gateway 테스트 수정 (identity 관련 mock 전환) | Conductor |
| 4-3 | Identity 서비스 테스트 작성 | Conductor |
| 4-4 | K8s 매니페스트 업데이트 (Identity env, NetworkPolicy) | Architect |
| 4-5 | CI 검증 + 통합 테스트 | Conductor |

## Identity API 엔드포인트 설계

### User API (`/api/users`)
```
POST   /api/users/upsert          — OAuth upsert (email + provider)
GET    /api/users/:id              — ID로 조회
GET    /api/users/by-email/:email  — 이메일로 조회
PATCH  /api/users/:id              — 프로필 업데이트 (name, avatar_url)
DELETE /api/users/:id              — 소프트 삭제
PATCH  /api/users/:id/github       — GitHub 연동/해제
GET    /api/users/:id/github-status — GitHub 연동 상태
GET    /api/users/:id/github-token  — GitHub 토큰 (암호화)
GET    /api/users/by-slug/:slug    — 공개 프로필 조회
PATCH  /api/users/:id/profile-settings — 프로필 설정 (slug, is_public)
```

### Study API (`/api/studies`)
```
POST   /api/studies                — 스터디 생성 (+멤버 자동 등록)
GET    /api/studies/:id            — 스터디 상세
GET    /api/studies/by-user/:userId — 사용자 참여 스터디 목록
PUT    /api/studies/:id            — 스터디 수정
DELETE /api/studies/:id            — 스터디 삭제

POST   /api/studies/:id/members           — 멤버 추가
GET    /api/studies/:id/members/:userId    — 멤버 조회
DELETE /api/studies/:id/members/:userId    — 멤버 탈퇴
PATCH  /api/studies/:id/members/:userId/role     — 역할 변경
PATCH  /api/studies/:id/members/:userId/nickname — 닉네임 수정
GET    /api/studies/:id/members            — 전체 멤버 목록

POST   /api/studies/:id/invites           — 초대 생성
GET    /api/invites/by-code/:code         — 코드로 조회
PATCH  /api/invites/:id/consume           — 초대 소비
```

### Notification API (`/api/notifications`)
```
POST   /api/notifications                 — 알림 생성
GET    /api/notifications/by-user/:userId — 사용자 알림 목록
GET    /api/notifications/by-user/:userId/unread-count — 미읽음 수
PATCH  /api/notifications/:id/read        — 읽음 처리
PATCH  /api/notifications/by-user/:userId/read-all — 전체 읽음
DELETE /api/notifications/old             — 30일 정리
```

### ShareLink API (`/api/share-links`)
```
POST   /api/share-links                   — 공유 링크 생성
GET    /api/share-links/by-user/:userId   — 사용자 링크 목록
PATCH  /api/share-links/:id/deactivate    — 비활성화
GET    /api/share-links/by-token/:token   — 토큰 검증
```

## 환경 변수
Identity 서비스: 기존 DATABASE_* 유지
Gateway 추가: `IDENTITY_SERVICE_URL=http://identity-service:3000`

## 이월 항목 (이번 스프린트 제외)
- L-14: 보안 헤더 Traefik 이전
- L-15: Rate limit 모니터링
- 타 서비스 → Identity 직접 호출 전환 (Gateway 프록시 제거)
