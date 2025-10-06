# ============================================
# infrastructure/README.md
# ============================================

# Infrastructure Directory

This directory contains the one-time database infrastructure setup for the containerized PostgreSQL + PgBouncer system.

## Files

### setup-infra.sh
**Run once to create the database infrastructure.**

What it does:
- Creates a custom Podman network (`dbnetwork`)
- Starts PostgreSQL container (port 5432)
- Starts PgBouncer container (port 6432)
- Configures authentication between them
- Sets containers to auto-restart

Usage:
```bash
cd infrastructure
./setup-infra.sh
```

After server reboot, containers auto-start. If they don't:
```bash
podman start postgres
podman start pgbouncer
```

### pgbouncer.ini
**PgBouncer configuration file** (you create this manually).

Defines:
- Database wildcard routing (all databases go through one PgBouncer)
- Connection pooling settings
- Authentication method (scram-sha-256)
- Pool mode (transaction-level pooling)

This file is mounted into the PgBouncer container.

### pg_hba.conf (auto-generated)
**PostgreSQL host-based authentication config.**

Created automatically by setup-infra.sh. Tells PostgreSQL to:
- Trust connections from the docker network (for auth_query)
- Require scram-sha-256 for external connections

This file is mounted into the PostgreSQL container.

### userlist.txt (auto-generated)
**PgBouncer user authentication list.**

Created automatically by setup-infra.sh. Contains the postgres user's password hash for PgBouncer to authenticate to PostgreSQL.

## Important Notes

- Only run setup-infra.sh once (or when you need to recreate infrastructure)
- The postgres-data volume persists even if containers are deleted
- To completely wipe everything: `podman volume rm postgres-data`
- All config files must stay in this directory (scripts use relative paths)