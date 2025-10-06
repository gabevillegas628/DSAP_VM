#!/bin/bash
# connection-monitor.sh - Monitor active database connections

echo "📊 Database Connection Monitor"
echo "=============================="
echo ""

# Active connections by database
echo "Connections by database:"
podman exec postgres psql -U postgres -c "
    SELECT 
        datname as database,
        count(*) as connections,
        count(*) filter (where state = 'active') as active,
        count(*) filter (where state = 'idle') as idle
    FROM pg_stat_activity
    WHERE datname IS NOT NULL
    GROUP BY datname
    ORDER BY count(*) DESC;
"

echo ""

# PgBouncer pool status
echo "PgBouncer Pool Status:"
echo "SHOW POOLS;" | podman exec -i pgbouncer psql -h localhost -p 5432 -U postgres pgbouncer 2>/dev/null || echo "   (PgBouncer admin access not available)"

echo ""

# Long-running queries
echo "Long-running queries (>30 seconds):"
podman exec postgres psql -U postgres -c "
    SELECT 
        pid,
        usename,
        datname,
        state,
        now() - query_start as duration,
        left(query, 50) as query
    FROM pg_stat_activity
    WHERE state != 'idle'
      AND now() - query_start > interval '30 seconds'
    ORDER BY duration DESC;
"