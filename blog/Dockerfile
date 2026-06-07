# AlgoSu Tech Blog — CI host-side SSG 빌드 산출물을 nginx에 COPY
# 빌드: CI workflow에서 npm ci + npm run build → out/ 생성
# 이미지 태그: main-{git-sha} (latest 사용 금지)

FROM nginx:1.28-alpine3.21
ARG APK_CACHE_BUST
# APK_CACHE_BUST를 RUN에서 참조해야 BuildKit이 값 변경 시 이 레이어를 무효화한다.
# (미참조 ARG는 BuildKit 캐시를 깨지 못해 apk_bust=true가 무력화됨 — Sprint 225)
RUN echo "apk cache bust: ${APK_CACHE_BUST}" && apk update && apk upgrade --no-cache libcrypto3 libssl3 libpng libxml2 libexpat musl musl-utils && rm -rf /var/cache/apk/*
COPY out/ /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
