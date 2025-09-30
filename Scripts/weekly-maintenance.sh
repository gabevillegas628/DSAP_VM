#!/bin/bash

echo "Starting weekly PostgreSQL maintenance..."

# Get all app databases
DATABASES=$(sudo -u postgres psql -t -c "SELECT datname FROM pg_database WHERE datname LIKE '%_db';")

for db in $DATABASES; do
    if [ ! -z "$db" ]; then
        echo "Maintaining database: $db"
        
        # Analyze database statistics
        sudo -u postgres psql -d "$db" -c "ANALYZE;"
        
        # Vacuum to reclaim space
        sudo -u postgres psql -d "$db" -c "VACUUM;"
        
        # Reindex if needed (be careful - this can take time)
        # sudo -u postgres psql -d "$db" -c "REINDEX DATABASE \"$db\";"
    fi
done

# Rotate PostgreSQL logs
logrotate /etc/logrotate.d/postgresql-common

echo "Maintenance completed at $(date)"