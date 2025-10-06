#!/bin/bash
# backup-db.sh - Backup PostgreSQL databases

BACKUP_DIR="${HOME}/db-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Function to backup a single database
backup_database() {
    local db_name=$1
    local backup_file="${BACKUP_DIR}/${db_name}_${TIMESTAMP}.sql.gz"
    
    echo "📦 Backing up $db_name..."
    
    if podman exec postgres pg_dump -U postgres "$db_name" | gzip > "$backup_file"; then
        echo "   ✅ Saved to: $backup_file"
        echo "   Size: $(du -h "$backup_file" | cut -f1)"
    else
        echo "   ❌ Backup failed for $db_name"
        return 1
    fi
}

# Check if specific database provided
if [ -n "$1" ]; then
    # Backup specific database
    backup_database "$1"
else
    # Backup all databases except system ones
    echo "🗄️  Backing up all databases..."
    
    databases=$(podman exec postgres psql -U postgres -t -c "SELECT datname FROM pg_database WHERE datistemplate = false AND datname NOT IN ('postgres');")
    
    for db in $databases; do
        backup_database "$db"
    done
    
    echo ""
    echo "✅ All backups complete!"
fi

# Show disk usage
echo ""
echo "📊 Backup directory usage:"
du -sh "$BACKUP_DIR"
echo ""
echo "Recent backups:"
ls -lht "$BACKUP_DIR" | head -10