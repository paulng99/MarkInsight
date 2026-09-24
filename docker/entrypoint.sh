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

echo "Starting MarkInsight..."
exec node server.js
