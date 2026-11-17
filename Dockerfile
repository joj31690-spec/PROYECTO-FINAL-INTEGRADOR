FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.24.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend ./frontend
RUN pnpm build

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001 DATA_DIR=/app/backend/storage
COPY --chown=node:node package.json ./
COPY --chown=node:node backend ./backend
COPY --chown=node:node engine ./engine
COPY --chown=node:node content ./content
COPY --from=build --chown=node:node /app/frontend/dist ./frontend/dist
RUN mkdir -p /app/backend/storage && chown node:node /app/backend/storage
USER node
EXPOSE 3001
CMD ["node", "backend/server.mjs"]
