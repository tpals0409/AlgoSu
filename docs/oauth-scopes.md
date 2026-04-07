# OAuth Scope 문서

> 소스: `services/gateway/src/auth/oauth/oauth.service.ts`

## Provider별 요청 Scope

| Provider | 요청 Scope | Token Endpoint | UserInfo Endpoint |
|----------|-----------|----------------|-------------------|
| **Google** | `openid email profile` | `https://oauth2.googleapis.com/token` | `https://www.googleapis.com/oauth2/v2/userinfo` |
| **Naver** | *(기본 — scope 파라미터 없음)* | `https://nid.naver.com/oauth2.0/token` | `https://openapi.naver.com/v1/nid/me` |
| **Kakao** | *(기본 — scope 파라미터 없음)* | `https://kauth.kakao.com/oauth/token` | `https://kapi.kakao.com/v2/user/me` |
| **GitHub** (연동) | `repo` | `https://github.com/login/oauth/access_token` | `https://api.github.com/user` |

## 반환 데이터 매핑

| Provider | email | name | avatar_url |
|----------|-------|------|------------|
| **Google** | `userinfo.email` | `userinfo.name` | `userinfo.picture` |
| **Naver** | `response.email` | `response.name` | `response.profile_image` |
| **Kakao** | `kakao_account.email` | `kakao_account.profile.nickname` | `kakao_account.profile.profile_image_url` |
| **GitHub** | *(사용 안 함)* | *(사용 안 함)* | *(사용 안 함)* |

> GitHub 연동은 로그인 목적이 아니라 repo push 권한 획득 목적이다. `github_user_id`, `github_username`, 암호화된 `github_token`만 저장한다.

## 사용 목적

| Provider | 목적 | 비고 |
|----------|------|------|
| Google / Naver / Kakao | **로그인 + 회원가입** | email 기반 1계정 1OAuth 정책. 다른 provider로 가입된 email은 거부 |
| GitHub | **코드 Push 연동** | `repo` scope로 private repo 접근. access token은 AES-256-GCM 암호화 저장 |

## 환경변수

| Provider | Client ID | Client Secret |
|----------|-----------|---------------|
| Google | `GOOGLE_CLIENT_ID` | `GOOGLE_CLIENT_SECRET` |
| Naver | `NAVER_CLIENT_ID` | `NAVER_CLIENT_SECRET` |
| Kakao | `KAKAO_CLIENT_ID` | `KAKAO_CLIENT_SECRET` |
| GitHub | `GITHUB_CLIENT_ID` | `GITHUB_CLIENT_SECRET` |

공통: `OAUTH_CALLBACK_URL` (redirect URI의 base URL)
