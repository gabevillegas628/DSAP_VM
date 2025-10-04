#!/bin/bash
# Run this once to start containers

echo "Starting PostgreSQL and PgBouncer containers..."

# Start containers
podman-compose up -d

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL..."
sleep 5

# Test connection
podman exec dna-postgres pg_isready -U postgres

echo "Containers running!"

# Set containers to auto-start on boot
podman update --restart=always dna-postgres
podman update --restart=always dna-pgbouncer

echo "PostgreSQL: localhost:5432"
echo "PgBouncer: localhost:6432"