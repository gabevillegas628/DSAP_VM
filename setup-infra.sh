#!/bin/bash
echo "🚀 Setting up database infrastructure..."

# Clean up completely
podman rm -f postgres pgbouncer 2>/dev/null || true
podman network rm dbnetwork 2>/dev/null || true
rm -f userlist.txt

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

echo "⏳ Waiting for PostgreSQL..."
sleep 8

# Get the SCRAM hash and strip ALL whitespace
POSTGRES_HASH=$(podman exec postgres psql -U postgres -t -A -c "SELECT passwd FROM pg_shadow WHERE usename='postgres';" | tr -d '[:space:]')

echo "Creating userlist.txt..."
echo "\"postgres\" \"${POSTGRES_HASH}\"" > userlist.txt

echo "Userlist contents (should have NO space before SCRAM):"
cat userlist.txt

# Start PgBouncer
podman run -d \
  --name pgbouncer \
  --network dbnetwork \
  -p 127.0.0.1:6432:5432 \
  -v $(pwd)/pgbouncer.ini:/etc/pgbouncer/pgbouncer.ini:Z \
  -v $(pwd)/userlist.txt:/etc/pgbouncer/userlist.txt:Z \
  docker.io/edoburu/pgbouncer:latest

echo "⏳ Waiting for PgBouncer..."
sleep 5

podman ps
podman logs pgbouncer | tail -10
echo ""
echo "✅ Done!"