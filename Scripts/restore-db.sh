#!/bin/bash
# restore-db.sh - Restore PostgreSQL database from backup

if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Usage: ./restore-db.sh <backup_file> <target_database_name>"
    echo ""
    echo "Available backups:"
    ls -1t ~/db-backups/*.sql.gz 2>/dev/null | head -10
    exit 1
fi

BACKUP_FILE=$1
DB_NAME=$2

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "⚠️  WARNING: This will replace all data in database: $DB_NAME"
echo "Backup file: $BACKUP_FILE"
read -p "Continue? (type YES to confirm): " confirm

if [ "$confirm" != "YES" ]; then
    echo "Cancelled."
    exit 0
fi

echo "🔄 Restoring $DB_NAME from backup..."

# Drop existing database if it exists (be careful!)
echo "   Dropping existing database..."
podman exec postgres psql -U postgres -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null

# Create fresh database
echo "   Creating fresh database..."
podman exec postgres createdb -U postgres "$DB_NAME"

# Restore from backup
echo "   Restoring data..."
if gunzip -c "$BACKUP_FILE" | podman exec -i postgres psql -U postgres "$DB_NAME" > /dev/null; then
    echo "✅ Restore complete!"
else
    echo "❌ Restore failed!"
    exit 1
fi