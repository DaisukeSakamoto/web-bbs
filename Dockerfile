FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund && mkdir -p /app/data && chown -R node:node /app
COPY --chown=node:node src ./src
COPY --chown=node:node public ./public
USER node
ENV PORT=8000 DB_PATH=/app/data/bbs.sqlite
EXPOSE 8000
CMD ["node","src/server.js"]
