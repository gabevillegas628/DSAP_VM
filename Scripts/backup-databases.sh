# Create backup script: /home/user/scripts/backup-databases.sh
#!/bin/bash

BACKUP_DIR="/home/user/backups/postgresql"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Create backup directory
mkdir -p $BACKUP_DIR

# Get list of all your app databases
DATABASES=$(sudo -u postgres psql -t -c "SELECT datname FROM pg_database WHERE datname LIKE '%_db';")

for db in $DATABASES; do
    if [ ! -z "$db" ]; then
        echo "Backing up database: $db"
        sudo -u postgres pg_dump "$db" | gzip > "$BACKUP_DIR/${db}_${DATE}.sql.gz"
    fi
done

# Clean up old backups (keep only last 30 days)
find $BACKUP_DIR -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed at $(date)"