# ADR-001: Gateway → Identity DB 분리

## 상태
승인 (Accepted) — 2026-03-18

## 맥락
Gateway 서비스가 identity_db에 직접 접근하여 6개 엔티티(User, Study, StudyMember, StudyInvite, Notification, ShareLink)를 19개 파일에서 CRUD 수행 중. Identity 서비스는 마이그레이션 러너 + 헬스체크만 존재하며 비즈니스 API 0개. 이는 DB per Service 원칙 위반.

## 결정
**Option A: 전면 이관** — Identity 서비스에 비즈니스 API를 구축하고, Gateway의 모든 identity_db 직접 접근을 Identity HTTP API 호출로 전환한다.

### 이관 대상 엔티티 (6개)
| 엔티티 | Gateway 사용 파일 수 | 주요 작업 |
|--------|---------------------|----------|
| User | 7개 | OAuth upsert, 프로필, GitHub 연동, 탈퇴 |
| Study | 6개 | CRUD, 상태 검증 |
| StudyMember | 6개 | 가입/탈퇴, 권한 검증, 닉네임 |
| StudyInvite | 2개 | 초대 코드 생성/소비 |
| Notification | 3개 | CRUD, 30일 정리, SSE 발행 |
| ShareLink | 3개 | CRUD, 토큰 검증, 공개 프로필 |

### 아키텍처 변경
```
[Before]
Gateway ──TypeORM──▶ identity_db
Other services ──HTTP──▶ Gateway /internal/*

[After]
Gateway ──HTTP──▶ Identity Service ──TypeORM──▶ identity_db
Other services ──HTTP──▶ Gateway /internal/* ──HTTP──▶ Identity Service
```

### 설계 원칙
1. **Gateway /internal/* 유지**: 타 서비스(submission, problem, github-worker)는 기존대로 Gateway /internal/* 호출. Gateway가 Identity로 프록시. 타 서비스 변경 최소화.
2. **성능**: Guard/미들웨어 핫패스는 기존 Redis 캐시 유지 + Identity 내부 네트워크 호출 (k8s ClusterIP)
3. **SSE**: SSE 커넥션 관리는 Gateway 유지, Notification CRUD만 Identity로 이관
4. **OAuth**: OAuth redirect/callback 흐름은 Gateway 유지, User upsert/조회만 Identity API 호출

## 대안 (기각)
- **Option B (단계적 이관)**: User만 먼저 → 엔티티 간 상호 참조가 많아 부분 이관 시 dual-datasource 복잡도 증가
- **Option C (현행 유지)**: 기능 문제 없으나 MSA 원칙 위반 지속, 포트폴리오 아키텍처 일관성 부재

## 리스크
- Gateway ↔ Identity HTTP 호출 레이턴시 추가 (k8s 내부 네트워크, ~1ms)
- Identity 서비스 장애 시 Gateway 전체 영향 (Circuit Breaker 검토)
- 테스트 대량 수정 (Gateway 597건 중 identity 관련)

## 후속
- 타 서비스 → Identity 직접 호출 전환 (Gateway 프록시 제거) — 별도 스프린트
- Identity 서비스 HPA/PDB 설정
