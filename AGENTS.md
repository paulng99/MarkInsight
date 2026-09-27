<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Cloud Agent

PostgreSQL 16 is installed locally and started on boot. The app database is `markinsight` on `127.0.0.1:5432` (user `markinsight`). If `.env` is missing it is created with `MARKINSIGHT_ANALYSIS_DEMO=true` so exam analysis can run without a live model key. Apply schema changes with `npx prisma db push`.

Run the app with `npm run dev` and open http://localhost:3000. Demo sign-in accounts are in the README.
