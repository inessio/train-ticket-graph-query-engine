# syntax=docker/dockerfile:1.6

FROM node:20.11.1-alpine3.19 AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20.11.1-alpine3.19 AS builder
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src/ ./src/
RUN npm run build

FROM node:20.11.1-alpine3.19 AS runner
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=deps    /app/node_modules ./node_modules
COPY --from=builder /app/dist        ./dist
COPY train-ticket-be.json            .
RUN mkdir -p logs && chown -R appuser:appgroup /app
USER appuser
EXPOSE 3000
ENV NODE_ENV=production
ENV DATA_FILE_PATH=/app/train-ticket-be.json
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/v1/health || exit 1
CMD ["node", "dist/app.js"]
