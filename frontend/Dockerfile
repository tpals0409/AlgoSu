# AlgoSu Frontend — Next.js standalone 멀티스테이지 빌드 (ARM aarch64 호환)
# 이미지 태그: main-{git-sha} (latest 사용 금지)

FROM --platform=$BUILDPLATFORM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Google AdSense — NEXT_PUBLIC_* 는 빌드 타임에 번들 인라인 필수
ENV NEXT_PUBLIC_ADSENSE_ENABLED=true
ENV NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-4088760185957474

RUN npm run build

FROM node:22-alpine AS runner
ARG APK_CACHE_BUST
RUN apk update && apk upgrade --no-cache libcrypto3 libssl3 && rm -rf /var/cache/apk/*
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001 \
    && npm uninstall -g npm \
    && rm -rf /usr/local/lib/node_modules/npm /opt/yarn-* /usr/local/lib/node_modules/corepack
WORKDIR /app

# Next.js standalone 출력물 복사
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3001
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
