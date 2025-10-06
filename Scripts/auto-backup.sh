#!/bin/bash
# auto-backup.sh - Automated backup with rotation (keep last N backups)

BACKUP_DIR="${HOME}/db-backups"
RETENTION_DAYS=7  # Keep backups for 7 days
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

echo "🕐 $(date): Starting automated backup..."

# Backup all databases
databases=$(podman exec postgres psql -U postgres -t -c "SELECT datname FROM pg_database WHERE datistemplate = false AND datname NOT IN ('postgres');")

backup_count=0
for db in $databases; do
    backup_file="${BACKUP_DIR}/${db}_${TIMESTAMP}.sql.gz"
    
    if podman exec postgres pg_dump -U postgres "$db" | gzip > "$backup_file"; then
        echo "   ✅ Backed up: $db ($(du -h "$backup_file" | cut -f1))"
        ((backup_count++))
    else
        echo "   ❌ Failed: $db"
    fi
done

# Clean up old backups
echo ""
echo "🧹 Cleaning up backups older than $RETENTION_DAYS days..."
deleted=$(find "$BACKUP_DIR" -name "*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete -print | wc -l)
echo "   Deleted $deleted old backup(s)"

echo ""
echo "✅ Backup complete: $backup_count database(s) backed up"
echo "📊 Total backup size: $(du -sh "$BACKUP_DIR" | cut -f1)"