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

echo "⏳ Waiting for PostgreSQL..."
sleep 8

# Get the actual SCRAM password hash for postgres user
POSTGRES_HASH=$(podman exec postgres psql -U postgres -t -c "SELECT passwd FROM pg_shadow WHERE usename='postgres';")

# Create userlist.txt with the actual hash
cat > userlist.txt << EOF
"postgres" "$POSTGRES_HASH"
EOF

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
echo ""
echo "✅ Done! Check: podman logs pgbouncer"