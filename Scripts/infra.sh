#!/bin/bash
# infra.sh - Quick infrastructure control

case "$1" in
    start)
        echo "🚀 Starting infrastructure..."
        podman start postgres
        sleep 5
        podman start pgbouncer
        sleep 2
        echo "✅ Infrastructure started"
        podman ps --filter name=postgres --filter name=pgbouncer
        ;;
    stop)
        echo "🛑 Stopping infrastructure..."
        podman stop pgbouncer postgres
        echo "✅ Infrastructure stopped"
        ;;
    restart)
        echo "🔄 Restarting infrastructure..."
        podman stop pgbouncer postgres
        sleep 2
        podman start postgres
        sleep 5
        podman start pgbouncer
        sleep 2
        echo "✅ Infrastructure restarted"
        podman ps --filter name=postgres --filter name=pgbouncer
        ;;
    status)
        echo "📊 Infrastructure Status:"
        podman ps --filter name=postgres --filter name=pgbouncer
        ;;
    logs)
        if [ "$2" == "postgres" ]; then
            podman logs postgres --tail 50 -f
        elif [ "$2" == "pgbouncer" ]; then
            podman logs pgbouncer --tail 50 -f
        else
            echo "PostgreSQL logs:"
            podman logs postgres --tail 20
            echo ""
            echo "PgBouncer logs:"
            podman logs pgbouncer --tail 20
        fi
        ;;
    *)
        echo "Usage: ./infra.sh {start|stop|restart|status|logs [postgres|pgbouncer]}"
        exit 1
        ;;
esac