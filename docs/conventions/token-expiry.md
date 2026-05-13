# 토큰 만료 정책

## 토큰 종류 및 현재 정책

| 토큰 | 저장 위치 | 현재 만료 | 코드 위치 |
|------|-----------|-----------|-----------|
| **JWT (Access Token)** | httpOnly Cookie | `JWT_EXPIRES_IN` (기본 `1h`) | `oauth.service.ts` L64 |
| **JWT (Refresh Token)** | Redis (`refresh:{userId}`) | `7d` (하드코딩) | `oauth.service.ts` L528, L532 |
| **OAuth State** | Redis (`oauth:state:{state}`) | `300s` (5분) | `oauth.service.ts` L49 |
| **GitHub Link State** | Redis (`oauth:github:link:{state}`) | `300s` (5분) | `oauth.service.ts` L49, L301 |
| **Share Link Token** | DB (`share_links.expires_at`) | 사용자 지정 또는 `null` (무기한) | `share-link.service.ts` L58 |
| **Invite Code** | DB (`study_invites.expires_at`) | `5분` | `study.service.ts` L301 |
| **Rate Limit Counter** | Redis (ThrottlerStorage) | `60s` (TTL) | `app.module.ts` L66 |
| **Invite Throttle Lock** | Redis (`invite_fail:{ip}:{code}`) | `900s` (15분) | `invite-throttle.service.ts` |

## 권장 정책

| 토큰 | 현재값 | 권장값 | 근거 |
|------|--------|--------|------|
| JWT Access Token | 1h | **15m~30m** | 탈취 시 피해 범위 축소. Refresh Token과 조합하면 UX 영향 없음 |
| JWT Refresh Token | 7d | **7d** (유지) | 주 1회 로그인 패턴에 적합. sliding window 미적용 상태 |
| OAuth State | 5m | **5m** (유지) | CSRF 방지 목적. 로그인 플로우에 충분한 시간 |
| GitHub Link State | 5m | **5m** (유지) | OAuth State와 동일 정책 |
| Share Link Token | 무기한 가능 | **최대 90일** | 무기한 공유 링크는 유출 시 회수 곤란. 생성 시 max 제한 권장 |
| Invite Code | 5m | **10m~15m** | 모바일 사용자 고려. 카카오톡 등 외부 전달 시 5분은 촉박할 수 있음 |

## 자동 갱신

- **TokenRefreshInterceptor**: JWT 만료 5분 이내 감지 시 응답 쿠키에 새 Access Token 자동 발급
- Refresh Token은 sliding window 미적용 (발급 시점 기준 7일 고정)

## 향후 개선 사항

1. Access Token 만료를 단축하면 TokenRefreshInterceptor 임계값(`REFRESH_THRESHOLD_SECONDS = 300`)도 비례 조정 필요
2. Refresh Token rotation (재사용 시 전체 무효화) 도입 검토
3. Share Link 생성 시 `max_expires_at` 서버 제한 추가
