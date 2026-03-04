# ──────────────────────────────────────────────
# Stage 1: Builder (네이티브 플랫폼에서 빌드 — QEMU 크래시 방지)
# ──────────────────────────────────────────────
FROM --platform=$BUILDPLATFORM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && mv node_modules /tmp/prod_node_modules
RUN npm ci

COPY . .
RUN npm run build

# ──────────────────────────────────────────────
# Stage 2: Production
# ──────────────────────────────────────────────
FROM node:20-alpine AS production

# 보안: non-root 사용자 생성
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY --from=builder /tmp/prod_node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

# ARM64 네이티브 모듈 재빌드 (builder가 x86에서 빌드하므로) + npm 제거
RUN npm rebuild sharp && \
    rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

USER appuser

EXPOSE 3000

# 환경변수는 k3s Secret → 컨테이너 런타임 주입
CMD ["node", "dist/src/main.js"]
