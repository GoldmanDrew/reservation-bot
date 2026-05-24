FROM node:20-bookworm-slim AS base

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/data
ENV HOSTNAME=0.0.0.0

RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 3000

CMD ["npm", "start"]
