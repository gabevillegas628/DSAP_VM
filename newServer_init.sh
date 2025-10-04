# On fresh Ubuntu/RedHat VM
sudo apt update  # or yum update on RedHat

# 1. Podman
sudo apt install -y podman
sudo apt install -y podman-compose

# 2. Node.js and npm
sudo apt install -y nodejs npm

# 3. PM2
sudo npm install -g pm2

# 4. table2asn
wget https://ftp.ncbi.nlm.nih.gov/asn1-converters/by_program/table2asn/linux64.table2asn.gz -O /tmp/table2asn.gz
gunzip /tmp/table2asn.gz
chmod +x /tmp/table2asn
sudo mv /tmp/table2asn /usr/local/bin/table2asn