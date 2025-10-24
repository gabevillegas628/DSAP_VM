#!/bin/bash
echo "🚀 Setting up database infrastructure..."

# Clean up
podman rm -f postgres pgbouncer 2>/dev/null || true
podman network rm dbnetwork 2>/dev/null || true
podman volume rm postgres-data 2>/dev/null || true
rm -f userlist.txt pg_hba.conf

# Create network
podman network create dbnetwork

NETWORK_SUBNET=$(podman network inspect dbnetwork --format '{{range .Subnets}}{{.Subnet}}{{end}}')
echo "Network subnet: $NETWORK_SUBNET"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Start PostgreSQL WITHOUT pg_hba.conf first - let it initialize
podman run -d \
  --name postgres \
  --network dbnetwork \
  --restart=unless-stopped \
  -p 127.0.0.1:15432:5432 \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_USER=postgres \
  -v postgres-data:/var/lib/postgresql/data:Z \
  docker.io/library/postgres:15-alpine

echo "⏳ Waiting for PostgreSQL to initialize..."
sleep 10

# NOW create and copy in the custom pg_hba.conf
cat > pg_hba.conf << EOF
# Trust connections from within docker network for auth_query
host    all             all             ${NETWORK_SUBNET}      trust
# Trust connections from localhost (for instance setup)
host    all             all             127.0.0.1/32           trust
host    all             all             ::1/128                trust
# SCRAM for external connections
host    all             all             all                     scram-sha-256
local   all             all                                     trust
EOF

# Copy it into the running container
podman cp pg_hba.conf postgres:/var/lib/postgresql/data/pg_hba.conf

# Reload config
podman exec postgres psql -U postgres -c "SELECT pg_reload_conf();"

# Get hash for userlist
POSTGRES_HASH=$(podman exec postgres psql -U postgres -t -A -c "SELECT passwd FROM pg_shadow WHERE usename='postgres';" | tr -d '[:space:]')
echo "\"postgres\" \"${POSTGRES_HASH}\"" > userlist.txt

# Start PgBouncer
podman run -d \
  --name pgbouncer \
  --network dbnetwork \
  --restart=unless-stopped \
  -p 127.0.0.1:16432:5432 \
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