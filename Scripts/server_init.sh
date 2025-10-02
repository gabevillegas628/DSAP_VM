#!/bin/bash
# Script to initialize server environment
# Run from ~/

echo "Starting server initialization..."

# Install packages
echo "+Installing packages..."
sudo apt update
sudo apt install -y nodejs npm postgresql postgresql-contrib pgbouncer

# setup table2asn
echo "+Setting up NCBI table2asn..."
TABLE2ASN_URL="https://ftp.ncbi.nlm.nih.gov/asn1-converters/by_program/table2asn/linux64.table2asn.gz"
wget $TABLE2ASN_URL -O /tmp/table2asn.gz
gunzip /tmp/table2asn.gz
chmod +x /tmp/table2asn
sudo mv /tmp/table2asn /usr/local/bin/table2asn
# Verify installation
if command -v table2asn &> /dev/null; then
    echo "++table2asn installed successfully"
else
    echo "++table2asn installation failed"

# Start and enable PostgreSQL
echo "+Starting PostgreSQL..."
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Configure PgBouncer
echo "+Configuring PgBouncer..."

# Backup original config
sudo cp /etc/pgbouncer/pgbouncer.ini /etc/pgbouncer/pgbouncer.ini.backup

# Set PostgreSQL to use scram-sha-256
sudo -u postgres psql -c "ALTER SYSTEM SET password_encryption = 'scram-sha-256';"

# Add trust rules for PgBouncer (both IPv4 and IPv6)
PG_HBA=$(sudo find /etc/postgresql -name pg_hba.conf)
sudo sed -i '/^# TYPE/a host    all    postgres    127.0.0.1/32    trust' "$PG_HBA"
sudo sed -i '/^# TYPE/a host    all    postgres    ::1/128         trust' "$PG_HBA"

sudo systemctl reload postgresql

# Write pgbouncer.ini with auth_query
sudo tee /etc/pgbouncer/pgbouncer.ini > /dev/null << 'EOF'
[databases]
; Databases will be added here by the instance creation script

[pgbouncer]
listen_addr = *
listen_port = 6432
auth_type = scram-sha-256
auth_user = postgres
auth_query = SELECT usename, passwd FROM pg_shadow WHERE usename=$1
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 20
min_pool_size = 5
reserve_pool_size = 5
reserve_pool_timeout = 3
logfile = /var/log/postgresql/pgbouncer.log
pidfile = /var/run/postgresql/pgbouncer.pid
EOF

sudo chown postgres:postgres /etc/pgbouncer/pgbouncer.ini
sudo systemctl restart pgbouncer
sudo systemctl enable pgbouncer

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
#if [ ! -d "DSAP_VM" ]; then
#    echo "+Cloning repository..."
#    git clone https://github.com/gabevillegas628/DSAP_VM.git
#else
#    echo "+Repository already exists"
#fi

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