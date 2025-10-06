#!/bin/bash
echo "🚀 Setting up database infrastructure..."

# Clean up old containers
podman rm -f postgres pgbouncer dna-pgbouncer 2>/dev/null || true

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

# Start PgBouncer with correct environment variables
podman run -d \
  --name pgbouncer \
  -p 127.0.0.1:6432:5432 \
  -e DB_HOST=${POSTGRES_IP} \
  -e DB_PORT=5432 \
  -e DB_USER=postgres \
  -e DB_PASSWORD=postgres \
  -e DB_NAME=postgres \
  -e POOL_MODE=transaction \
  -e MAX_CLIENT_CONN=1000 \
  -e DEFAULT_POOL_SIZE=25 \
  -e AUTH_TYPE=md5 \
  docker.io/edoburu/pgbouncer:latest

echo "⏳ Waiting for PgBouncer to start..."
sleep 5

echo ""
echo "✅ Testing connections..."
podman exec postgres psql -U postgres -c "SELECT 'PostgreSQL is ready!' as status;"

echo ""
echo "Checking PgBouncer status..."
podman ps | grep pgbouncer

echo ""
echo "✅ Infrastructure ready!"
echo "   PostgreSQL: 127.0.0.1:5432"
echo "   PgBouncer:  127.0.0.1:6432"
echo ""
echo "Test PgBouncer with:"
echo "  PGPASSWORD=postgres psql -h 127.0.0.1 -p 6432 -U postgres -d postgres -c 'SELECT 1;'"