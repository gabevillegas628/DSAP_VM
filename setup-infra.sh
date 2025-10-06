#!/bin/bash
# setup-infra.sh - Run this ONCE to set up postgres + pgbouncer

echo "🚀 Setting up database infrastructure..."

# Create pod with exposed ports
podman pod create --name dbpod -p 5432:5432 -p 6432:6432

# Start PostgreSQL
podman run -d \
  --pod dbpod \
  --name postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_USER=postgres \
  -v postgres-data:/var/lib/postgresql/data:Z \
  postgres:15-alpine

echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 5

# Start PgBouncer (configured to allow any database)
podman run -d \
  --pod dbpod \
  --name pgbouncer \
  -e DATABASE_URL="postgres://postgres:postgres@localhost:5432/postgres" \
  -e POOL_MODE=transaction \
  -e MAX_CLIENT_CONN=1000 \
  -e DEFAULT_POOL_SIZE=25 \
  -e AUTH_TYPE=md5 \
  edoburu/pgbouncer:latest

echo "✅ Infrastructure ready!"
echo "   PostgreSQL: localhost:5432"
echo "   PgBouncer:  localhost:6432"