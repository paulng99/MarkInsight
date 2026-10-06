# MarkInsight production image (Next.js standalone + Prisma)
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
# Host lockfile may require a newer npm than the image default.
RUN npm install -g npm@11.6.1 && npm ci

FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Optional short SHA for the page footer (no .git in the image — pass at build time).
ARG GIT_COMMIT_SHA=
ARG NEXT_PUBLIC_APP_COMMIT=
ENV GIT_COMMIT_SHA=$GIT_COMMIT_SHA
ENV NEXT_PUBLIC_APP_COMMIT=$NEXT_PUBLIC_APP_COMMIT
RUN npx prisma generate
RUN npx next build

FROM node:22-alpine AS runner
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
# seed-admin (and future ops scripts) — bcryptjs is not always traced into standalone
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/bcryptjs ./node_modules/bcryptjs
# pdfjs loads this worker by path even when the worker thread is disabled.
# Next standalone traces pdf.mjs but not pdf.worker.mjs.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs ./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs
COPY docker/entrypoint.sh /app/entrypoint.sh

RUN sed -i 's/\r$//' /app/entrypoint.sh \
  && chmod +x /app/entrypoint.sh \
  && mkdir -p \
    /app/.data/uploads \
    /app/.data/exam-structure \
    /app/.data/job-progress \
  && chown -R nextjs:nodejs /app/.data /app/prisma /app/public /app/scripts

USER nextjs
EXPOSE 3000
ENTRYPOINT ["/app/entrypoint.sh"]
