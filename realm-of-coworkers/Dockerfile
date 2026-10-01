# syntax=docker/dockerfile:1
# Multi-Stage-Build (2.1, 16.6): baut Client und Server, liefert ein schlankes Laufzeit-Image.

FROM node:24-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/client/package.json apps/client/
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/
COPY packages/content/package.json packages/content/
COPY tools/balance/package.json tools/balance/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @aethra/client build \
 && pnpm --filter @aethra/server build \
 && pnpm --filter @aethra/server deploy --prod --legacy /out

FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/app/data/aethra.db \
    CONTENT_DIR=/app/content \
    PUBLIC_DIR=/app/public
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /app/apps/server/dist ./dist
COPY --from=build /app/apps/client/dist ./public
COPY --from=build /app/packages/content ./content
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node
EXPOSE 3000
VOLUME ["/app/data"]
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--enable-source-maps", "dist/main.js"]
