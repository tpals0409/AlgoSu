# Gateway 미들웨어 파이프라인

> 소스: `services/gateway/src/main.ts`, `app.module.ts`

## 요청 처리 순서

```
Client Request
  │
  ▼
┌─────────────────────────────────┐
│  1. cookie-parser               │  main.ts — app.use(cookieParser())
│     httpOnly Cookie 파싱        │
└─────────────┬───────────────────┘
              ▼
┌─────────────────────────────────┐
│  2. CORS                        │  main.ts — app.enableCors()
│     origin: ALLOWED_ORIGINS     │  credentials: true
│     methods: GET/POST/PUT/      │
│       PATCH/DELETE/OPTIONS      │
└─────────────┬───────────────────┘
              ▼
┌─────────────────────────────────┐
│  3. RequestIdMiddleware         │  AppModule.configure() — 1번째
│     X-Request-Id, X-Trace-Id   │  적용: 모든 경로
│     부여 + HTTP 로그 출력       │
└─────────────┬───────────────────┘
              ▼
┌─────────────────────────────────┐
│  4. SecurityHeadersMiddleware   │  AppModule.configure() — 2번째
│     X-Content-Type-Options      │  적용: 모든 경로
│     X-Frame-Options, etc.       │
└─────────────┬───────────────────┘
              ▼
┌─────────────────────────────────┐
│  5. RateLimitMiddleware         │  AppModule.configure() — 3번째
│     기본 600req/min             │  제외: /health, /health/ready
│     제출 10req/min              │
└─────────────┬───────────────────┘
              ▼
┌─────────────────────────────────┐
│  6. JwtMiddleware               │  AppModule.configure() — 4번째
│     Cookie JWT 검증             │  제외: health, metrics,
│     req.headers['x-user-id']    │    auth/oauth/*, auth/refresh,
│     세팅                        │    auth/logout, internal/*,
│                                 │    sse/*, api/public/*
└─────────────┬───────────────────┘
              ▼
┌─────────────────────────────────┐
│  7. ValidationPipe (Global)     │  main.ts — app.useGlobalPipes()
│     whitelist + transform       │  forbidNonWhitelisted: true
└─────────────┬───────────────────┘
              ▼
┌─────────────────────────────────┐
│  8. Guards (라우트별)            │
│     - InternalKeyGuard          │  Internal API 전용
│     - StudyActiveGuard          │  스터디 상태 검증
│     - StudyMemberGuard          │  스터디 멤버 검증
│     - ShareLinkGuard            │  공유 링크 토큰 검증
└─────────────┬───────────────────┘
              ▼
┌─────────────────────────────────┐
│  9. TokenRefreshInterceptor     │  APP_INTERCEPTOR (Global)
│     (Global)                    │  만료 5분 이내 → 새 쿠키 발급
└─────────────┬───────────────────┘
              ▼
┌─────────────────────────────────┐
│  10. Route Handler              │  Controller 메서드 실행
└─────────────┬───────────────────┘
              ▼
┌─────────────────────────────────┐
│  11. GlobalExceptionFilter      │  main.ts — app.useGlobalFilters()
│     (예외 발생 시)               │  구조화 에러 응답
└─────────────┴───────────────────┘
              ▼
         Client Response
```

## NestJS 실행 순서 참고

NestJS 공식 파이프라인: **Middleware → Guard → Interceptor (before) → Pipe → Handler → Interceptor (after) → ExceptionFilter**

- `cookie-parser`, `CORS`는 Express 레벨 미들웨어로 NestJS 미들웨어보다 먼저 실행된다.
- `ValidationPipe`는 Global Pipe로 Guard 이후, Handler 이전에 실행된다.
- `TokenRefreshInterceptor`는 Handler 실행 후 응답 시점에 쿠키를 설정한다 (`tap` 연산자).
