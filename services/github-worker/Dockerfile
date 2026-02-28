# AlgoSu GitHub Worker — 멀티스테이지 빌드 (ARM aarch64 호환)
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && cp -R node_modules prod_node_modules
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
RUN addgroup -g 1001 -S nodejs && adduser -S worker -u 1001
WORKDIR /app
COPY --from=builder /app/prod_node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
USER worker
CMD ["node", "dist/main.js"]
