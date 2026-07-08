FROM node:20-alpine

RUN apk add --no-cache curl

WORKDIR /app

COPY server/package*.json ./
RUN npm install --production

COPY server/ .

EXPOSE 5000

CMD ["node", "server.js"]
