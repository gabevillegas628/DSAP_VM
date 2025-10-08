#!/bin/bash
echo "🚀 Setting up database infrastructure..."

# Clean up
podman rm -f postgres pgbouncer 2>/dev/null || true
podman network rm dbnetwork 2>/dev/null || true
rm -f userlist.txt pg_hba.conf

# Create network
podman network create dbnetwork

# Get the actual subnet of the network we just created
NETWORK_SUBNET=$(podman network inspect dbnetwork --format '{{range .Subnets}}{{.Subnet}}{{end}}')
echo "Network subnet: $NETWORK_SUBNET"

# Create custom pg_hba.conf that trusts connections from our docker network
cat > pg_hba.conf << EOF
# Trust connections from within docker network for auth_query
host    all             all             ${NETWORK_SUBNET}      trust
# SCRAM for external connections
host    all             all             all                     scram-sha-256
local   all             all                                     trust
EOF

echo "Generated pg_hba.conf:"
cat pg_hba.conf

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Start PostgreSQL with custom pg_hba.conf
podman run -d \
  --name postgres \
  --network dbnetwork \
  --restart=unless-stopped \
  -p 127.0.0.1:5432:5432 \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_USER=postgres \
  -v postgres-data:/var/lib/postgresql/data:Z \
  -v ${SCRIPT_DIR}/pga_hba.conf:/var/lib/postgresql/data/pg_hba.conf:Z \
  docker.io/library/postgres:15-alpine

echo "⏳ Waiting for PostgreSQL..."
sleep 8

# Reload pg_hba.conf
podman exec postgres psql -U postgres -c "SELECT pg_reload_conf();"

# Get hash for userlist
POSTGRES_HASH=$(podman exec postgres psql -U postgres -t -A -c "SELECT passwd FROM pg_shadow WHERE usename='postgres';" | tr -d '[:space:]')
echo "\"postgres\" \"${POSTGRES_HASH}\"" > userlist.txt

# Start PgBouncer
podman run -d \
  --name pgbouncer \
  --network dbnetwork \
  --restart=unless-stopped \
  -p 127.0.0.1:6432:5432 \
  -v ${SCRIPT_DIR}/pgbouncer.ini:/etc/pgbouncer/pgbouncer.ini:Z \
  -v ${SCRIPT_DIR}/userlist.txt:/etc/pgbouncer/userlist.txt:Z \
  docker.io/edoburu/pgbouncer:latest

echo "⏳ Waiting for PgBouncer..."
sleep 5

echo ""
echo "Testing if pgbouncer can query postgres..."
podman exec pgbouncer psql -h postgres -U postgres -d postgres -c "SELECT 1;"

podman ps
echo "✅ Done!"