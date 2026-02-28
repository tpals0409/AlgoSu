# ──────────────────────────────────────────────
# Stage 1: Builder
# ──────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ──────────────────────────────────────────────
# Stage 2: Production
# ──────────────────────────────────────────────
FROM node:20-alpine AS production

# 보안: non-root 사용자 생성
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && \
    rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# 빌드 결과물만 복사 (.env 파일 COPY 금지)
COPY --from=builder /app/dist ./dist

USER appuser

EXPOSE 3000

# 환경변수는 k3s Secret → 컨테이너 런타임 주입
CMD ["node", "dist/src/main.js"]
