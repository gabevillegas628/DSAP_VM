#!/bin/bash
echo "🚀 Setting up database infrastructure..."

# Clean up any existing containers
podman rm -f postgres pgbouncer 2>/dev/null || true

# Start PostgreSQL on port 5432
podman run -d \
  --name postgres \
  -p 127.0.0.1:5432:5432 \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_USER=postgres \
  -v postgres-data:/var/lib/postgresql/data:Z \
  docker.io/library/postgres:15-alpine

echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 8

# Get the PostgreSQL container's IP address
POSTGRES_IP=$(podman inspect postgres --format '{{.NetworkSettings.IPAddress}}')
echo "   PostgreSQL IP: $POSTGRES_IP"

# Start PgBouncer on port 6432, pointing to PostgreSQL container
podman run -d \
  --name pgbouncer \
  -p 127.0.0.1:6432:5432 \
  -e DATABASE_URL="postgres://postgres:postgres@${POSTGRES_IP}:5432/postgres" \
  -e POOL_MODE=transaction \
  -e MAX_CLIENT_CONN=1000 \
  -e DEFAULT_POOL_SIZE=25 \
  -e AUTH_TYPE=md5 \
  docker.io/edoburu/pgbouncer:latest

echo "⏳ Waiting for PgBouncer to start..."
sleep 3

echo ""
echo "✅ Testing connections..."
podman exec postgres psql -U postgres -c "SELECT 'PostgreSQL is ready!' as status;"

echo ""
echo "✅ Infrastructure ready!"
echo "   PostgreSQL: 127.0.0.1:5432"
echo "   PgBouncer:  127.0.0.1:6432"
echo ""
echo "Test PgBouncer with:"
echo "  psql 'postgresql://postgres:postgres@127.0.0.1:6432/postgres' -c 'SELECT 1;'"