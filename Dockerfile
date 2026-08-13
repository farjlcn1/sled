FROM node:24-slim AS base
RUN apt-get update -y && apt-get install -y openssl tzdata && rm -rf /var/lib/apt/lists/*
# Podjetje posluje samo v Sloveniji — vsi datumsko/časovni izračuni (rezervacije vozil, izpisi,
# revizijska sled ...) morajo teči v tem času, ne v UTC, sicer se lokalni "naivni" datumski nizi
# (npr. iz <input type="datetime-local">) na strežniku tolmačijo narobe za 1-2 uri.
ENV TZ=Europe/Ljubljana

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Samo za "prisma generate" med gradnjo — dejanski DATABASE_URL se poda ob zagonu vsebnika.
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Poln node_modules (ne samo standalone-pruned) + prisma shema, ker `prisma migrate deploy`
# ob zagonu potrebuje celoten Prisma CLI z vsemi njegovimi tranzitivnimi odvisnostmi.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
# `prisma/seed.ts` imports from `lib/` (e.g. lib/auth/password.ts) directly, outside the
# Next.js build's own module tracing, so it needs an explicit copy here.
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/generated ./generated

COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

ENTRYPOINT ["./docker-entrypoint.sh"]
