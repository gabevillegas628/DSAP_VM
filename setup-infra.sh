#!/bin/bash
echo "🚀 Setting up database infrastructure..."

# Clean up
podman rm -f postgres pgbouncer 2>/dev/null || true
podman network rm dbnetwork 2>/dev/null || true

# Create network
podman network create dbnetwork

# Start PostgreSQL
podman run -d \
  --name postgres \
  --network dbnetwork \
  -p 127.0.0.1:5432:5432 \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_USER=postgres \
  -v postgres-data:/var/lib/postgresql/data:Z \
  docker.io/library/postgres:15-alpine

echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 8

# Start PgBouncer with auth_query for automatic user authentication
podman run -d \
  --name pgbouncer \
  --network dbnetwork \
  -p 127.0.0.1:6432:5432 \
  -e DB_HOST=postgres \
  -e DB_PORT=5432 \
  -e DB_USER=postgres \
  -e DB_PASSWORD=postgres \
  -e DB_NAME=postgres \
  -e POOL_MODE=transaction \
  -e MAX_CLIENT_CONN=1000 \
  -e DEFAULT_POOL_SIZE=25 \
  -e AUTH_TYPE=md5 \
  -e AUTH_QUERY="SELECT usename, passwd FROM pg_shadow WHERE usename=$1" \
  docker.io/edoburu/pgbouncer:latest

echo "⏳ Waiting for PgBouncer..."
sleep 5

echo ""
echo "✅ Checking status..."
podman ps

echo ""
echo "✅ Infrastructure ready!"