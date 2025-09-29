#!/usr/bin/env bash
sudo apt install nodejs, npm, postgresql, postgresql-contrib

sudo systemctl start postgresql
sudo systemctl enable PostgreSQL

git clone https://github.com/gabevillegas628/DSAP_VM.git


cd DSAP_VM
npm install bcryptjs


