# AlgoSu Tech Blog — CI host-side SSG 빌드 산출물을 nginx에 COPY
# 빌드: CI workflow에서 npm ci + npm run build → out/ 생성
# 이미지 태그: main-{git-sha} (latest 사용 금지)

FROM nginx:1.28-alpine3.21
ARG APK_CACHE_BUST
RUN apk update && apk upgrade --no-cache libcrypto3 libssl3 libpng libxml2 libexpat musl musl-utils && rm -rf /var/cache/apk/*
COPY out/ /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
