# MarkInsight production image (Next.js standalone + Prisma)
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
# Host lockfile is npm 11 (Windows); node:20-alpine ships npm 10, which rejects it.
RUN npm install -g npm@11.6.1 && npm ci

FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npx prisma generate
RUN npx next build

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_HOST=db
ENV DATABASE_PORT=5432

# Prisma CLI for schema push on boot (devDependency in app; install globally in image)
RUN npm install -g prisma@6.19.3

COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY docker/entrypoint.sh /app/entrypoint.sh

RUN sed -i 's/\r$//' /app/entrypoint.sh \
  && chmod +x /app/entrypoint.sh \
  && mkdir -p /app/.data \
  && chown -R nextjs:nodejs /app/.data /app/prisma /app/public

USER nextjs
EXPOSE 3000
ENTRYPOINT ["/app/entrypoint.sh"]
