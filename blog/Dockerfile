# AlgoSu Tech Blog — Next.js SSG + nginx 멀티스테이지 빌드 (ARM aarch64 호환)
# 이미지 태그: main-{git-sha} (latest 사용 금지)

FROM --platform=$BUILDPLATFORM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runner
COPY --from=builder /app/out /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
