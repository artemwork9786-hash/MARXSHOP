FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY server/package*.json ./
RUN npm install --production

COPY server/ .

EXPOSE 5000

CMD ["node", "server.js"]
