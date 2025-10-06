#!/bin/bash
# setup-cron.sh - Set up automated daily backups

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "📅 Setting up automated daily backups..."

# Create cron entry (runs at 2 AM daily)
CRON_JOB="0 2 * * * $SCRIPT_DIR/auto-backup.sh >> $HOME/db-backups/backup.log 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "auto-backup.sh"; then
    echo "⚠️  Cron job already exists"
else
    # Add cron job
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "✅ Cron job added: Daily backups at 2 AM"
fi

echo ""
echo "Current crontab:"
crontab -l | grep auto-backup.sh

echo ""
echo "To remove: crontab -e (then delete the auto-backup.sh line)"