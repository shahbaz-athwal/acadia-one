FROM oven/bun:1.3.12 AS deps

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM deps AS build

COPY . .
RUN bun run build

FROM oven/bun:1.3.12 AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/package.json /app/bun.lock ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/drizzle.config.ts ./drizzle.config.ts

EXPOSE 3000

CMD ["sh", "-c", "bun run db:migrate && bunx --bun vite preview --host 0.0.0.0 --port ${PORT:-3000}"]
