# AlgoSu Identity Service — 멀티스테이지 빌드 (ARM aarch64 호환)
# 이미지 태그: main-{git-sha} (latest 사용 금지)

FROM --platform=$BUILDPLATFORM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && mv node_modules /tmp/prod_node_modules
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001 && \
    rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
WORKDIR /app
COPY --from=builder /tmp/prod_node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
USER nestjs
EXPOSE 3004
CMD ["node", "dist/src/main.js"]
