# Nexo API server.
#
# Serves the JSON API, the SSE streams, and /widget.js, which is why the widget
# bundle is built here too: app.ts resolves it relative to the compiled server,
# so the workspace layout has to survive into the runtime image.
#
# Debian slim rather than Alpine on purpose. Prisma ships a different query
# engine for musl, and a mismatch there fails at the first query rather than at
# build time, which is the worst place to find out.

FROM node:20-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# Manifests first, so a source-only change reuses the dependency layer.
COPY package.json package-lock.json ./
COPY packages/server/package.json ./packages/server/
COPY packages/widget/package.json ./packages/widget/
COPY packages/admin/package.json ./packages/admin/
COPY packages/landing/package.json ./packages/landing/
RUN npm ci

COPY packages/server ./packages/server
COPY packages/widget ./packages/widget

RUN npx prisma generate --schema packages/server/prisma/schema.prisma
RUN npm run build --workspace=@nexo/server
RUN npm run build --workspace=@nexo/widget


FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY packages/server/package.json ./packages/server/

# The Prisma CLI is a dev dependency and is kept: `migrate deploy` runs as the
# release step, and it has to exist somewhere the deployed image can reach.
RUN npm ci --omit=dev && npm install --no-save prisma@5.22.0

# The generated client, rather than regenerating: it must match the schema this
# image was built from, not whatever a later generate would produce.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/server/prisma ./packages/server/prisma
COPY --from=builder /app/packages/widget/dist ./packages/widget/dist

# Fly sends SIGINT on deploy and shutdown. Without an init, node is PID 1 and
# in-flight SSE connections are killed rather than closed.
RUN useradd --system --create-home --uid 10001 nexo
USER nexo

EXPOSE 4000
CMD ["node", "packages/server/dist/index.js"]
