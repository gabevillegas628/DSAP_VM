#!/bin/bash
# Script to initialize server environment
# Run from ~/

echo "Starting server initialization..."

# Install packages
echo "+Installing packages..."
sudo apt update
sudo apt install -y nodejs npm postgresql postgresql-contrib pgbouncer

# Start and enable PostgreSQL
echo "+Starting PostgreSQL..."
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Configure PgBouncer
echo "+Configuring PgBouncer..."

# Backup original config
sudo cp /etc/pgbouncer/pgbouncer.ini /etc/pgbouncer/pgbouncer.ini.backup

# Write new pgbouncer.ini using heredoc
sudo tee /etc/pgbouncer/pgbouncer.ini > /dev/null << 'EOF'
[databases]
; Databases will be added here by the instance creation script
; Format: dbname = host=localhost port=5432 dbname=actual_dbname

[pgbouncer]
listen_addr = 127.0.0.1
listen_port = 6432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 20
min_pool_size = 5
reserve_pool_size = 5
reserve_pool_timeout = 3
server_idle_timeout = 600
logfile = /var/log/postgresql/pgbouncer.log
pidfile = /var/run/postgresql/pgbouncer.pid
admin_users = postgres
EOF

# Initialize empty userlist.txt (databases will add their users)
sudo tee /etc/pgbouncer/userlist.txt > /dev/null << 'EOF'
; Users will be added here by the instance creation script
; Format: "username" "md5<hash>"
EOF

# Set proper permissions
sudo chown postgres:postgres /etc/pgbouncer/pgbouncer.ini
sudo chown postgres:postgres /etc/pgbouncer/userlist.txt
sudo chmod 640 /etc/pgbouncer/userlist.txt

# Start and enable PgBouncer
echo "+Starting PgBouncer..."
sudo systemctl start pgbouncer
sudo systemctl enable pgbouncer

# Verify PgBouncer is running
if systemctl is-active --quiet pgbouncer; then
    echo "++PgBouncer is running on port 6432"
else
    echo "++PgBouncer failed to start. Check logs with: sudo journalctl -u pgbouncer"
    exit 1
fi

# Clone repository (if not already done)
if [ ! -d "DSAP_VM" ]; then
    echo "+Cloning repository..."
    git clone https://github.com/gabevillegas628/DSAP_VM.git
else
    echo "+Repository already exists"
fi

# Install dependencies
echo "+Installing Node.js dependencies..."
cd DSAP_VM
npm install bcryptjs

echo "================================"
echo "Server initialization complete!"
echo ""
echo "Next steps:"
echo "1. Run create-instance script to set up app instances"
echo "2. Check PgBouncer status: sudo systemctl status pgbouncer"
echo "3. Monitor connections: psql -h localhost -p 6432 -U postgres pgbouncer -c 'SHOW POOLS;'"