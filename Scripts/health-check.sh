#!/bin/bash
# health-check.sh - Check health of database infrastructure

echo "🏥 Database Infrastructure Health Check"
echo "========================================"
echo ""

# Check if containers are running
echo "📦 Container Status:"
postgres_status=$(podman ps --filter name=postgres --format "{{.Status}}" 2>/dev/null)
pgbouncer_status=$(podman ps --filter name=pgbouncer --format "{{.Status}}" 2>/dev/null)

if [ -n "$postgres_status" ]; then
    echo "   ✅ PostgreSQL: $postgres_status"
else
    echo "   ❌ PostgreSQL: Not running"
fi

if [ -n "$pgbouncer_status" ]; then
    echo "   ✅ PgBouncer: $pgbouncer_status"
else
    echo "   ❌ PgBouncer: Not running"
fi

echo ""

# Check PostgreSQL connectivity
echo "🔌 Connectivity:"
if podman exec postgres pg_isready -U postgres > /dev/null 2>&1; then
    echo "   ✅ PostgreSQL accepting connections"
else
    echo "   ❌ PostgreSQL not accepting connections"
    exit 1
fi

# Check PgBouncer connectivity
if podman exec pgbouncer psql -h postgres -U postgres -d postgres -c "SELECT 1;" > /dev/null 2>&1; then
    echo "   ✅ PgBouncer can reach PostgreSQL"
else
    echo "   ❌ PgBouncer cannot reach PostgreSQL"
fi

echo ""

# Database statistics
echo "📊 Database Statistics:"
db_count=$(podman exec postgres psql -U postgres -t -c "SELECT COUNT(*) FROM pg_database WHERE datistemplate = false;")
echo "   Total databases: $db_count"

# Connection count
conn_count=$(podman exec postgres psql -U postgres -t -c "SELECT count(*) FROM pg_stat_activity;")
echo "   Active connections: $conn_count"

# Show databases with sizes
echo ""
echo "   Database sizes:"
podman exec postgres psql -U postgres -c "
    SELECT 
        datname as database,
        pg_size_pretty(pg_database_size(datname)) as size
    FROM pg_database 
    WHERE datistemplate = false
    ORDER BY pg_database_size(datname) DESC;
" | head -15

echo ""

# Disk usage
echo "💾 Storage:"
volume_size=$(podman volume inspect postgres-data --format '{{.Mountpoint}}' 2>/dev/null | xargs du -sh 2>/dev/null | cut -f1)
if [ -n "$volume_size" ]; then
    echo "   postgres-data volume: $volume_size"
fi

backup_size=$(du -sh ~/db-backups 2>/dev/null | cut -f1)
if [ -n "$backup_size" ]; then
    echo "   Backup directory: $backup_size"
fi

echo ""

# Recent errors in logs
echo "⚠️  Recent Errors (last 24 hours):"
error_count=$(podman logs postgres --since 24h 2>&1 | grep -i error | wc -l)
if [ "$error_count" -gt 0 ]; then
    echo "   ⚠️  $error_count errors found in PostgreSQL logs"
    echo "   Run: podman logs postgres | grep -i error"
else
    echo "   ✅ No errors in PostgreSQL logs"
fi

echo ""
echo "✅ Health check complete!"