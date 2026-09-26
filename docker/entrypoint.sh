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

# Auth.js returns {"message":"There was a problem with the server configuration..."}
# when AUTH_SECRET is missing in production.
ensure_auth_secret() {
  secret="${AUTH_SECRET:-}"
  if [ -z "$secret" ]; then
    secret="${NEXTAUTH_SECRET:-}"
  fi
  secret=$(printf '%s' "$secret" | tr -d '\r')
  case "$secret" in
    \"*\") secret=${secret#\"}; secret=${secret%\"} ;;
    \'*\') secret=${secret#\'}; secret=${secret%\'} ;;
  esac
  if [ -n "$secret" ]; then
    export AUTH_SECRET="$secret"
    export NEXTAUTH_SECRET="$secret"
    if [ "$secret" = "replace-with-a-long-random-string" ]; then
      echo "AUTH_SECRET is still the example placeholder. Replace it in .env before real use."
    fi
    return 0
  fi
  file="/app/.data/auth-secret"
  if [ -f "$file" ]; then
    secret=$(tr -d '\r\n' < "$file")
  fi
  if [ -z "$secret" ]; then
    secret=$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64url'))")
    mkdir -p /app/.data
    printf '%s' "$secret" > "$file"
    chmod 600 "$file" 2>/dev/null || true
    echo "AUTH_SECRET was missing. Saved a generated secret in the data volume."
  fi
  export AUTH_SECRET="$secret"
  export NEXTAUTH_SECRET="$secret"
}

ensure_auth_secret

echo "Starting MarkInsight..."
exec node server.js
