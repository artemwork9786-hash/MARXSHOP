# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-slim AS builder
WORKDIR /app
COPY server/package*.json ./
RUN npm install --production
COPY server/ .

# ─── Stage 2: Runtime ────────────────────────────────────────────────────────
FROM node:20-slim
RUN apt-get update && apt-get install -y --no-install-recommends curl ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app .

# Yandex Cloud Serverless Containers требует слушать порт из переменной PORT.
# Стандарт YC SC — 8080.
ENV PORT=8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s \
  CMD curl -f http://localhost:8080/health || exit 1

CMD ["node", "server.js"]
