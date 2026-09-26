#!/bin/sh
set -eu

echo "Waiting for PostgreSQL at ${DATABASE_HOST:-db}:${DATABASE_PORT:-5432}..."
i=0
until node -e "
const net = require('net');
const host = process.env.DATABASE_HOST || 'db';
const port = Number(process.env.DATABASE_PORT || 5432);
const s = net.connect(port, host, () => { s.end(); process.exit(0); });
s.on('error', () => process.exit(1));
" 2>/dev/null; do
  i=$((i + 1))
  if [ "$i" -ge 60 ]; then
    echo "Database did not become ready in time" >&2
    exit 1
  fi
  sleep 1
done

echo "Applying Prisma schema (db push)..."
prisma db push --schema=./prisma/schema.prisma --skip-generate

# Auth.js sends every sign-in and /api/auth callback to AUTH_URL / NEXTAUTH_URL.
# The sample .env uses http://localhost:3000, which breaks a droplet opened by IP.
strip_loopback_auth_url() {
  name="$1"
  val=$(printenv "$name" 2>/dev/null || true)
  [ -n "$val" ] || return 0
  host=$(node -e '
    const raw = process.argv[1] || "";
    try {
      const host = new URL(raw).hostname.replace(/^\[|\]$/g, "").toLowerCase();
      process.stdout.write(host);
    } catch {
      process.stdout.write("");
    }
  ' "$val")
  case "$host" in
    localhost|127.0.0.1|::1|0.0.0.0)
      echo "Ignoring ${name}=${val} (loopback). Sign-in uses the browser host, such as the droplet IP."
      unset "$name"
      ;;
  esac
}

strip_loopback_auth_url NEXTAUTH_URL
strip_loopback_auth_url AUTH_URL
export AUTH_TRUST_HOST="${AUTH_TRUST_HOST:-true}"

echo "Starting MarkInsight..."
exec node server.js
