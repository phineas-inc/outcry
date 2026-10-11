# Build from the repo root:  docker build -f server/Dockerfile -t outcry-api .
FROM node:24-alpine
WORKDIR /app
COPY shared ./shared
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev
COPY server ./server
ENV PORT=8787 DB_PATH=/data/outcry.db NODE_ENV=production
VOLUME /data
EXPOSE 8787
CMD ["node", "server/src/index.ts"]
