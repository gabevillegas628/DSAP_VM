#!/bin/bash
echo "🚀 Setting up database infrastructure..."

# Clean up
podman rm -f postgres pgbouncer 2>/dev/null || true
podman network rm dbnetwork 2>/dev/null || true
rm -f userlist.txt pg_hba.conf

# Create network
podman network create dbnetwork

# Create custom pg_hba.conf that trusts connections from the docker network
cat > pg_hba.conf << 'EOF'
# Trust connections from within docker network for auth_query
host    all             all             10.89.0.0/16            trust
# SCRAM for external connections
host    all             all             all                     scram-sha-256
local   all             all                                     trust
EOF

# Start PostgreSQL with custom pg_hba.conf
podman run -d \
  --name postgres \
  --network dbnetwork \
  -p 127.0.0.1:5432:5432 \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_USER=postgres \
  -v postgres-data:/var/lib/postgresql/data:Z \
  -v $(pwd)/pg_hba.conf:/var/lib/postgresql/data/pg_hba.conf:Z \
  docker.io/library/postgres:15-alpine

echo "⏳ Waiting for PostgreSQL..."
sleep 8

# Reload pg_hba.conf
podman exec postgres psql -U postgres -c "SELECT pg_reload_conf();"

# Get hash (though we may not need it now)
POSTGRES_HASH=$(podman exec postgres psql -U postgres -t -A -c "SELECT passwd FROM pg_shadow WHERE usename='postgres';" | tr -d '[:space:]')
echo "\"postgres\" \"${POSTGRES_HASH}\"" > userlist.txt

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

echo ""
echo "Testing if pgbouncer can query postgres..."
podman exec pgbouncer psql -h postgres -U postgres -d postgres -c "SELECT 1;"

podman ps
echo "✅ Done!"