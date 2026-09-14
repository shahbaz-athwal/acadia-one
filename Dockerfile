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
ENV DATABASE_URL=/app/data/local.db

COPY --from=build /app/package.json /app/bun.lock ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/drizzle.config.ts ./drizzle.config.ts
# `db:migrate` reads the schema path out of the drizzle config and `db:seed`
# imports the snapshot and table classification from source, so both need src/.
COPY --from=build /app/src ./src
COPY --from=build /app/scripts ./scripts

EXPOSE 3000

# The volume starts empty on a new deploy, so seed it here rather than expecting
# an operator to shell in. `--if-empty` makes a restart a no-op once the catalog
# is in place, which keeps imports made in production from being overwritten.
# drizzle-kit fails with a bare "unable to open database file" when the parent
# directory is missing rather than creating it, so make the directory first:
# on a fresh volume it may not be there yet, and that error is what a failed
# boot looks like from the outside.
CMD ["sh", "-c", "mkdir -p /app/data && bun run db:migrate && bun run db:seed --if-empty && bun run start"]
