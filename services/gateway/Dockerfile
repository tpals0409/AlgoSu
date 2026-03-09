# ──────────────────────────────────────────────
# Stage 1: Builder (네이티브 플랫폼에서 빌드 — QEMU 크래시 방지)
# ──────────────────────────────────────────────
FROM --platform=$BUILDPLATFORM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && mv node_modules /tmp/prod_node_modules
# ARM64용 sharp 바이너리를 네이티브(x86)에서 미리 다운로드 — Stage 2 QEMU 실행 제거
RUN rm -rf /tmp/prod_node_modules/@img/sharp-linux-x64 \
           /tmp/prod_node_modules/@img/sharp-linuxmusl-x64 \
           /tmp/prod_node_modules/@img/sharp-libvips-linux-x64 \
           /tmp/prod_node_modules/@img/sharp-libvips-linuxmusl-x64 && \
    cd /tmp/prod_node_modules && npm install --no-save --os=linux --libc=musl --cpu=arm64 sharp
RUN npm ci

COPY . .
RUN npm run build

# ──────────────────────────────────────────────
# Stage 2: Production
# ──────────────────────────────────────────────
FROM node:22-alpine AS production

# 보안: non-root 사용자 생성
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY --from=builder /tmp/prod_node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

# npm 제거 (보안 + 이미지 경량화) — sharp ARM64 바이너리는 Stage 1에서 설치 완료
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

USER appuser

EXPOSE 3000

# 환경변수는 k3s Secret → 컨테이너 런타임 주입
CMD ["node", "dist/src/main.js"]
