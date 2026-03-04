# ──────────────────────────────────────────────
# Stage 1: Builder (네이티브 플랫폼에서 빌드 — QEMU 크래시 방지)
# ──────────────────────────────────────────────
FROM --platform=$BUILDPLATFORM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && cp -R node_modules prod_node_modules
RUN npm ci

COPY . .
RUN npm run build

# ──────────────────────────────────────────────
# Stage 2: Production
# ──────────────────────────────────────────────
FROM node:20-alpine AS production

# 보안: non-root 사용자 생성 + npm 제거
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && \
    rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

WORKDIR /app

COPY --from=builder /app/prod_node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

USER appuser

EXPOSE 3000

# 환경변수는 k3s Secret → 컨테이너 런타임 주입
CMD ["node", "dist/src/main.js"]
