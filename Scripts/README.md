# ============================================
# scripts/README.md
# ============================================

# Scripts Directory

Contains the instance manager and all maintenance scripts for the database system.

## Instance Management

### Instance_manager_Docker.js
**Main tool for creating and managing app instances.**

Run from project root:
```bash
node scripts/Instance_manager_Docker.js
```

What it does:
- Creates new app instances (each gets its own database)
- Manages existing instances (start/stop/restart/delete)
- Monitors infrastructure status
- Each instance runs on its own port with PM2

The script assumes it's one level below project root (needs to find ../server and ../client).

## Maintenance Scripts

### backup-db.sh
**Backup individual or all databases.**

```bash
./backup-db.sh                    # Backup all databases
./backup-db.sh myinstance_db      # Backup specific database
```

Saves compressed backups to ~/db-backups/

### restore-db.sh
**Restore a database from backup.**

```bash
./restore-db.sh ~/db-backups/myinstance_db_20250106_143022.sql.gz myinstance_db
```

WARNING: Destroys existing database and replaces with backup.

### auto-backup.sh
**Automated backup with rotation.**

Backs up all databases and deletes backups older than 7 days. Set up with cron:
```bash
./setup-cron.sh
```

### vacuum-db.sh
**Database maintenance - reclaim space and update statistics.**

```bash
./vacuum-db.sh                # All databases
./vacuum-db.sh myinstance_db  # Specific database
```

Run weekly or after large data deletions.

### health-check.sh
**Complete infrastructure health report.**

```bash
./health-check.sh
```

Shows:
- Container status
- Database connectivity
- Active connections
- Database sizes
- Recent errors

### connection-monitor.sh
**Monitor active database connections in real-time.**

```bash
./connection-monitor.sh
```

Shows:
- Connections per database
- PgBouncer pool status
- Long-running queries

### infra.sh
**Quick infrastructure control.**

```bash
./infra.sh start              # Start postgres + pgbouncer
./infra.sh stop               # Stop both
./infra.sh restart            # Restart both
./infra.sh status             # Show running containers
./infra.sh logs postgres      # View logs
./infra.sh logs pgbouncer     # View logs
```

### setup-cron.sh
**Set up automated daily backups at 2 AM.**

```bash
./setup-cron.sh
```

Adds cron job to run auto-backup.sh daily.

## Quick Reference

**After server reboot:**
1. Infrastructure containers should auto-start
2. If not: `./infra.sh start`
3. Start app instances: `node Instance_manager_Docker.js` → option 5

**Daily operations:**
- Create instance: Run instance manager → option 1
- Check health: `./health-check.sh`
- View connections: `./connection-monitor.sh`

**Weekly maintenance:**
- Run: `./vacuum-db.sh`
- Check backup sizes: `du -sh ~/db-backups`

**Emergency:**
- Stop everything: `./infra.sh stop`
- Check logs: `./infra.sh logs postgres` or `./infra.sh logs pgbouncer`
- Nuclear option: `podman system reset` (deletes ALL data)