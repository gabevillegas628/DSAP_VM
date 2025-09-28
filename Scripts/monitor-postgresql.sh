# Create monitoring script: /home/user/scripts/monitor-postgresql.sh
#!/bin/bash

# Check if PostgreSQL is running
if ! systemctl is-active --quiet postgresql; then
    echo "ALERT: PostgreSQL is not running!" | mail -s "DB Alert" your-email@university.edu
    systemctl start postgresql
fi

# Check disk space
DISK_USAGE=$(df /var/lib/postgresql | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 85 ]; then
    echo "ALERT: PostgreSQL disk usage is at ${DISK_USAGE}%" | mail -s "Disk Space Alert" your-email@university.edu
fi

# Check database connections
CONNECTIONS=$(sudo -u postgres psql -t -c "SELECT count(*) FROM pg_stat_activity;")
if [ $CONNECTIONS -gt 80 ]; then
    echo "ALERT: High number of database connections: $CONNECTIONS" | mail -s "Connection Alert" your-email@university.edu
fi

# Log database sizes
sudo -u postgres psql -c "
SELECT 
    datname as database_name,
    pg_size_pretty(pg_database_size(datname)) as size
FROM pg_database 
WHERE datname LIKE '%_db' 
ORDER BY pg_database_size(datname) DESC;
" >> /var/log/postgres-monitor.log