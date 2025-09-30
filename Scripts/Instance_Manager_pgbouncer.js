#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

class InstanceManager {
    constructor() {
        this.baseDir = path.join(__dirname, '..');
        this.instancesDir = path.join(this.baseDir, 'instances');
        this.basePort = 5000;
    }

    async question(prompt) {
        return new Promise((resolve) => {
            rl.question(prompt, resolve);
        });
    }

    async main() {
        console.log('DNA Analysis Instance Manager');
        console.log('================================');

        let running = true;

        while (running) {
            const instances = this.getInstances();

            console.log('\nChoose an action:');
            console.log('1. Create new instance');
            console.log('2. Manage existing instances');
            console.log('3. Quick status check');
            console.log('4. View logs (non-streaming)');
            console.log('5. Start/Stop Instances');
            console.log('6. Exit');

            const choice = await this.question('\nEnter choice (1-6): ');

            switch (choice) {
                case '1':
                    await this.createInstance();
                    break;
                case '2':
                    await this.manageInstances();
                    break;
                case '3':
                    this.showQuickStatus();
                    break;
                case '4':
                    await this.viewLogs();
                    break;
                case '5':
                    await this.resurrectMenu();
                    break;
                case '6':
                    console.log('Goodbye!');
                    running = false;  // Exit the loop
                    break;
                default:
                    console.log('Invalid choice');
            }

            // Optional: add a small pause between iterations
            if (running) {
                console.log('\nPress Enter to continue...');
                await this.question('');
            }
        }

        rl.close();
    }

    getInstances() {
        if (!fs.existsSync(this.instancesDir)) {
            return [];
        }
        return fs.readdirSync(this.instancesDir).filter(item =>
            fs.statSync(path.join(this.instancesDir, item)).isDirectory()
        );
    }

    async createInstance() {
        console.log('\n🚀 Creating New Instance');
        console.log('========================');

        // Get instance details
        const instanceName = await this.question('Instance name: ');
        if (!instanceName || !instanceName.match(/^[a-zA-Z0-9-_]+$/)) {
            console.log('❌ Invalid instance name. Use only letters, numbers, hyphens, and underscores.');
            return;
        }

        // Check if instance already exists
        const instanceDir = path.join(this.instancesDir, instanceName);
        if (fs.existsSync(instanceDir)) {
            console.log('❌ Instance already exists!');
            return;
        }

        // Port selection
        console.log('\n🔌 Port Configuration');
        const portChoice = await this.question('(A)uto-assign port or (M)anually specify? [A/M]: ');

        let port;
        if (portChoice.toLowerCase() === 'm') {
            const portInput = await this.question('Enter port number (1024-65535): ');
            port = parseInt(portInput);

            // Validate port number
            if (isNaN(port) || port < 1024 || port > 65535) {
                console.log('❌ Invalid port. Must be between 1024-65535.');
                return;
            }

            // Check if port is available locally
            const isAvailable = await this.isPortAvailable(port);
            if (!isAvailable) {
                console.log(`⚠️  Port ${port} is already in use on this system.`);
                const proceed = await this.question('Continue anyway? (y/n): ');
                if (proceed.toLowerCase() !== 'y') {
                    console.log('Setup cancelled.');
                    return;
                }
            }

            // Check if port is used by another instance
            const instances = this.getInstances();
            for (const inst of instances) {
                const config = this.getInstanceConfig(inst);
                if (config?.port === port) {
                    console.log(`❌ Port ${port} is already assigned to instance: ${inst}`);
                    return;
                }
            }

            console.log(`✅ Using port: ${port}`);
        } else {
            // Auto-assign port
            port = await this.findAvailablePort();
            console.log(`✅ Auto-assigned port: ${port}`);
        }

        // Get director account details
        console.log('\n👤 Director Account Setup');
        const directorName = await this.question('Director name: ');
        const directorEmail = await this.question('Director email: ');
        const directorPassword = await this.question('Director password (or press Enter for "admin123"): ');

        const finalPassword = directorPassword.trim() || 'admin123';

        console.log(`\n📋 Configuration:`);
        console.log(`- Instance name: ${instanceName}`);
        console.log(`- Database: ${instanceName.toLowerCase()}_db`);
        console.log(`- Port: ${port}`);
        console.log(`- Director: ${directorName} (${directorEmail})`);

        const confirm = await this.question('\nProceed? (y/n): ');
        if (confirm.toLowerCase() !== 'y') {
            console.log('Setup cancelled.');
            return;
        }

        try {
            console.log('\n🔧 Creating instance...');

            // Execute all creation steps
            await this.createDatabase(instanceName);
            await this.setupInstanceFiles(instanceName, port);
            await this.installDependencies(instanceName);
            await this.runMigrations(instanceName);
            await this.createDirectorAccount(instanceName, directorName, directorEmail, finalPassword);
            await this.buildFrontend(instanceName);
            await this.configureFirewall(port);
            await this.startInstance(instanceName, port);

            console.log('\n🎉 Instance created successfully!');
            console.log(`\n🔗 Access your app at: http://localhost:${port}`);
            console.log(`\n🔑 Director Login:`);
            console.log(`   Email: ${directorEmail}`);
            console.log(`   Password: ${finalPassword}`);

            // Offer immediate management options
            console.log('\n📋 Quick Actions:');
            const quickAction = await this.question('Would you like to (v)iew logs, (r)estart, or (c)ontinue? ');

            if (quickAction.toLowerCase() === 'v') {
                this.showInstanceLogs(instanceName);
            } else if (quickAction.toLowerCase() === 'r') {
                execSync(`pm2 restart ${instanceName}`, { stdio: 'inherit' });
                console.log(`✅ Restarted ${instanceName}`);
            }

        } catch (error) {
            console.error(`\n❌ Failed to create instance: ${error.message}`);

            // Offer cleanup
            const cleanup = await this.question('\nWould you like to clean up partial installation? (y/n): ');
            if (cleanup.toLowerCase() === 'y') {
                await this.cleanupFailedInstance(instanceName);
            }
        }
    }

    async manageInstances() {
        const instances = this.getInstances();

        if (instances.length === 0) {
            console.log('No instances found. Create one first.');
            return;
        }

        console.log('\n🛠️  Instance Management');
        console.log('======================');

        instances.forEach((instance, index) => {
            const status = this.getInstanceStatus(instance);
            const config = this.getInstanceConfig(instance);
            console.log(`${index + 1}. ${instance} (Port: ${config?.port || 'unknown'}) - ${status}`);
        });

        console.log('\nActions:');
        console.log('r - Restart instance');
        console.log('s - Stop instance');
        console.log('d - Delete instance (with confirmation)');
        console.log('l - View logs');
        console.log('c - Cancel');

        const action = await this.question('\nChoose action: ');
        if (action.toLowerCase() === 'c') return;

        const choice = await this.question('Enter instance number: ');
        const index = parseInt(choice) - 1;

        if (index < 0 || index >= instances.length) {
            console.log('Invalid instance number.');
            return;
        }

        const instanceName = instances[index];

        switch (action.toLowerCase()) {
            case 'r':
                await this.restartInstance(instanceName);
                break;
            case 's':
                await this.stopInstance(instanceName);
                break;
            case 'd':
                await this.deleteInstance(instanceName);
                break;
            case 'l':
                await this.showInstanceLogs(instanceName);
                break;
            default:
                console.log('Invalid action.');
        }
    }

    showQuickStatus() {
        console.log('\n📊 Quick Status Check');
        console.log('====================');

        const instances = this.getInstances();
        if (instances.length === 0) {
            console.log('No instances found.');
            return;
        }

        instances.forEach(instance => {
            const config = this.getInstanceConfig(instance);
            const status = this.getInstanceStatus(instance);
            const url = config ? `http://localhost:${config.port}` : 'unknown';
            console.log(`${instance.padEnd(20)} ${status.padEnd(12)} ${url}`);
        });
    }

    async viewLogs() {
        const instances = this.getInstances();

        if (instances.length === 0) {
            console.log('No instances found.');
            return;
        }

        console.log('\nSelect instance:');
        instances.forEach((instance, index) => {
            console.log(`${index + 1}. ${instance}`);
        });

        const choice = await this.question('Enter instance number: ');
        const index = parseInt(choice) - 1;

        if (index >= 0 && index < instances.length) {
            await this.showInstanceLogs(instances[index]);
        } else {
            console.log('Invalid instance number.');
        }
    }

    async showInstanceLogs(instanceName) {
        console.log(`\n📋 Log Options for ${instanceName}:`);
        console.log('1. Last 20 lines');
        console.log('2. Last 50 lines');
        console.log('3. Last 100 lines');
        console.log('4. Errors only');

        const logChoice = await this.question('Choose option (1-4): ');

        try {
            switch (logChoice) {
                case '1':
                    execSync(`pm2 logs ${instanceName} --lines 20 --nostream`, { stdio: 'inherit' });
                    break;
                case '2':
                    execSync(`pm2 logs ${instanceName} --lines 50 --nostream`, { stdio: 'inherit' });
                    break;
                case '3':
                    execSync(`pm2 logs ${instanceName} --lines 100 --nostream`, { stdio: 'inherit' });
                    break;
                case '4':
                    execSync(`pm2 logs ${instanceName} --err --lines 50 --nostream`, { stdio: 'inherit' });
                    break;
                default:
                    console.log('Invalid option.');
            }
        } catch (error) {
            console.log(`❌ Failed to show logs: ${error.message}`);
        }
    }

    // All the existing creation methods...
    async findAvailablePort() {
        let port = this.basePort;

        if (fs.existsSync(this.instancesDir)) {
            const instances = fs.readdirSync(this.instancesDir).filter(item =>
                fs.statSync(path.join(this.instancesDir, item)).isDirectory()
            );

            const usedPorts = new Set();

            for (const instance of instances) {
                const configPath = path.join(this.instancesDir, instance, 'config.json');
                if (fs.existsSync(configPath)) {
                    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                    if (config.port) {
                        usedPorts.add(config.port);
                    }
                }
            }

            while (usedPorts.has(port) || !(await this.isPortAvailable(port))) {
                port++;
            }
        } else {
            while (!(await this.isPortAvailable(port))) {
                port++;
            }
        }

        return port;
    }

    async isPortAvailable(port) {
        return new Promise((resolve) => {
            const server = require('net').createServer();

            server.listen(port, () => {
                server.close(() => resolve(true));
            });

            server.on('error', () => resolve(false));
        });
    }

    async registerWithPgBouncer(dbName, dbUser, dbPassword) {
        console.log('   🔌 Registering with PgBouncer...');

        try {
            // Add database to pgbouncer.ini
            const dbEntry = `${dbName} = host=localhost port=5432 dbname=${dbName}\n`;
            execSync(`echo "${dbEntry}" | sudo tee -a /etc/pgbouncer/pgbouncer.ini`, { stdio: 'pipe' });

            // Generate MD5 hash for userlist.txt
            const crypto = require('crypto');
            const hash = crypto.createHash('md5')
                .update(dbPassword + dbUser)
                .digest('hex');

            const userEntry = `"${dbUser}" "md5${hash}"\n`;
            execSync(`echo '${userEntry}' | sudo tee -a /etc/pgbouncer/userlist.txt`, { stdio: 'pipe' });

            // Reload PgBouncer to pick up new config
            execSync('sudo systemctl reload pgbouncer', { stdio: 'pipe' });

            console.log('   ✅ Registered with PgBouncer');
        } catch (error) {
            console.log(`   ⚠️  Could not register with PgBouncer: ${error.message}`);
            console.log('   💡 You may need to manually add this database to /etc/pgbouncer/pgbouncer.ini');
        }
    }

    async createDatabase(instanceName) {
        console.log('   📊 Creating database...');

        const dbName = `${instanceName.toLowerCase()}_db`;
        const dbUser = `${instanceName.toLowerCase()}_user`;
        const dbPassword = this.generatePassword();

        try {
            execSync(`sudo -u postgres createdb ${dbName}`, { stdio: 'pipe' });

            const sqlCommands = `
        CREATE USER ${dbUser} WITH ENCRYPTED PASSWORD '${dbPassword}';
        GRANT ALL PRIVILEGES ON DATABASE ${dbName} TO ${dbUser};
        ALTER DATABASE ${dbName} OWNER TO ${dbUser};
      `;

            execSync(`sudo -u postgres psql -c "${sqlCommands}"`, { stdio: 'pipe' });

            const dbConfig = {
                name: dbName,
                user: dbUser,
                password: dbPassword,
                host: 'localhost',
                port: 6432,  // Changed from 5432 to 6432 (PgBouncer)
                url: `postgresql://${dbUser}:${dbPassword}@localhost:6432/${dbName}`  // Use PgBouncer port
            };

            if (!fs.existsSync(this.instancesDir)) {
                fs.mkdirSync(this.instancesDir, { recursive: true });
            }

            const instanceDir = path.join(this.instancesDir, instanceName);
            fs.mkdirSync(instanceDir, { recursive: true });

            fs.writeFileSync(
                path.join(instanceDir, 'db-config.json'),
                JSON.stringify(dbConfig, null, 2)
            );

            console.log(`   ✅ Database created: ${dbName}`);

        } catch (error) {
            throw new Error(`Database creation failed: ${error.message}`);
        }

        await this.registerWithPgBouncer(dbName, dbUser, dbPassword);
    }

    async setupInstanceFiles(instanceName, port) {
        console.log('   📁 Setting up files...');

        const instanceDir = path.join(this.instancesDir, instanceName);

        const dbConfig = JSON.parse(
            fs.readFileSync(path.join(instanceDir, 'db-config.json'), 'utf8')
        );

        const serverDir = path.join(instanceDir, 'server');
        execSync(`cp -r ${path.join(this.baseDir, 'server')} ${serverDir}`, { stdio: 'pipe' });

        const clientDir = path.join(instanceDir, 'client');
        execSync(`cp -r ${path.join(this.baseDir, 'client')} ${clientDir}`, { stdio: 'pipe' });

        const uploadsDir = path.join(serverDir, 'uploads');
        fs.mkdirSync(uploadsDir, { recursive: true });
        fs.mkdirSync(path.join(uploadsDir, 'profile-pics'), { recursive: true });

        const serverEnv = `
DATABASE_URL="${dbConfig.url}"
PORT=${port}
NODE_ENV=production
HOST=0.0.0.0
${this.getEmailConfig()}
INSTANCE_NAME=${instanceName}
`.trim();

        fs.writeFileSync(path.join(serverDir, '.env'), serverEnv);

        const instanceConfig = {
            name: instanceName,
            port: port,
            database: dbConfig,
            paths: {
                instance: instanceDir,
                server: serverDir,
                client: clientDir,
                uploads: uploadsDir
            },
            created: new Date().toISOString()
        };

        fs.writeFileSync(
            path.join(instanceDir, 'config.json'),
            JSON.stringify(instanceConfig, null, 2)
        );

        console.log(`   ✅ Files set up in: ${instanceDir}`);
    }

    getEmailConfig() {
        try {
            const mainEnvPath = path.join(this.baseDir, 'server', '.env');
            if (fs.existsSync(mainEnvPath)) {
                const content = fs.readFileSync(mainEnvPath, 'utf8');
                const configLines = content.split('\n').filter(line =>
                    line.startsWith('EMAIL_USER=') ||
                    line.startsWith('EMAIL_PASSWORD=') ||
                    line.startsWith('SENDGRID_API_KEY=') ||
                    line.startsWith('S3_ACCESS_KEY_ID=') ||
                    line.startsWith('S3_SECRET_ACCESS_KEY=') ||
                    line.startsWith('S3_REGION=') ||
                    line.startsWith('S3_BUCKET_NAME=') ||
                    line.startsWith('JWT_SECRET=')
                );
                console.log(configLines);
                return configLines.join('\n');
            }
        } catch (error) {
            console.warn('Could not copy config from main .env');
        }

        return '';
    }

    async installDependencies(instanceName) {
        console.log('   📦 Installing dependencies...');

        const instanceDir = path.join(this.instancesDir, instanceName);
        const serverDir = path.join(instanceDir, 'server');
        const clientDir = path.join(instanceDir, 'client');

        try {
            execSync('npm install', { cwd: serverDir, stdio: 'pipe' });
            execSync('npm install', { cwd: clientDir, stdio: 'pipe' });
            console.log('   ✅ Dependencies installed');
        } catch (error) {
            throw new Error(`Dependency installation failed: ${error.message}`);
        }
    }

    async runMigrations(instanceName) {
        console.log('   🗄️  Setting up database schema...');

        const serverDir = path.join(this.instancesDir, instanceName, 'server');

        try {
            execSync('npx prisma generate', { cwd: serverDir, stdio: 'pipe' });
            execSync('npx prisma db push --accept-data-loss', { cwd: serverDir, stdio: 'pipe' });
            console.log('   ✅ Database schema setup completed');
        } catch (error) {
            throw new Error(`Schema setup failed: ${error.message}`);
        }
    }

    async configureFirewall(port) {
        console.log(`   🔥 Configuring firewall for port ${port}...`);

        try {
            // Check if UFW is installed and active
            const ufwStatus = execSync('sudo ufw status', { encoding: 'utf8' });

            if (ufwStatus.includes('Status: inactive')) {
                console.log('   ℹ️  UFW is inactive, skipping firewall configuration');
                return;
            }

            // Add the firewall rule
            execSync(`sudo ufw allow ${port}/tcp`, { stdio: 'pipe' });
            console.log(`   ✅ Firewall rule added for port ${port}`);

        } catch (error) {
            // UFW might not be installed or user might not have sudo access
            console.log(`   ⚠️  Could not configure firewall: ${error.message}`);
            console.log(`   💡 Manually run: sudo ufw allow ${port}`);
        }
    }

    async createDirectorAccount(instanceName, name, email, password) {
        console.log('   👤 Creating director account...');

        const serverDir = path.join(this.instancesDir, instanceName, 'server');

        try {
            const bcrypt = require('bcryptjs');
            const hashedPassword = await bcrypt.hash(password, 10);

            const createUserScript = `
const { PrismaClient } = require('@prisma/client');

async function createDirector() {
  const prisma = new PrismaClient();
  
  try {
    await prisma.user.create({
      data: {
        name: '${name}',
        email: '${email}',
        password: '${hashedPassword}',
        role: 'director',
        status: 'approved'
      }
    });
    console.log('Director created successfully');
  } catch (error) {
    if (error.code === 'P2002') {
      console.log('Director with this email already exists');
    } else {
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

createDirector();
`;

            const scriptPath = path.join(serverDir, 'create-director.js');
            fs.writeFileSync(scriptPath, createUserScript);

            execSync('node create-director.js', { cwd: serverDir, stdio: 'pipe' });
            fs.unlinkSync(scriptPath);

            console.log(`   ✅ Director account created: ${email}`);

        } catch (error) {
            throw new Error(`Director account creation failed: ${error.message}`);
        }
    }

    async buildFrontend(instanceName) {
        console.log('   🏗️  Building frontend...');

        const clientDir = path.join(this.instancesDir, instanceName, 'client');

        try {
            execSync('npm run build', { cwd: clientDir, stdio: 'pipe' });
            console.log('   ✅ Frontend built successfully');
        } catch (error) {
            throw new Error(`Frontend build failed: ${error.message}`);
        }
    }

    async startInstance(instanceName, port) {
        console.log('   🚀 Starting instance...');

        try {
            execSync('pm2 --version', { stdio: 'pipe' });
        } catch {
            console.log('   📦 Installing PM2...');
            execSync('npm install -g pm2', { stdio: 'inherit' });
        }

        const serverDir = path.join(this.instancesDir, instanceName, 'server');

        try {
            execSync(`pm2 start index.js --name ${instanceName} --cwd ${serverDir}`, { stdio: 'pipe' });
            execSync('pm2 save', { stdio: 'pipe' });
            console.log(`   ✅ Instance started on port ${port}`);
        } catch (error) {
            throw new Error(`Failed to start instance: ${error.message}`);
        }
    }

    // Management methods
    getInstanceConfig(instanceName) {
        try {
            const configPath = path.join(this.instancesDir, instanceName, 'config.json');
            return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } catch {
            return null;
        }
    }

    getInstanceStatus(instanceName) {
        try {
            const result = execSync(`pm2 jlist`, { encoding: 'utf8' });
            const processes = JSON.parse(result);
            const process = processes.find(p => p.name === instanceName);
            return process ? process.pm2_env.status : 'stopped';
        } catch {
            return 'unknown';
        }
    }

    async restartInstance(instanceName) {
        try {
            execSync(`pm2 restart ${instanceName}`, { stdio: 'inherit' });
            console.log(`✅ Restarted ${instanceName}`);
        } catch (error) {
            console.log(`❌ Failed to restart ${instanceName}: ${error.message}`);
        }
    }

    async stopInstance(instanceName) {
        try {
            execSync(`pm2 stop ${instanceName}`, { stdio: 'inherit' });
            console.log(`✅ Stopped ${instanceName}`);
        } catch (error) {
            console.log(`❌ Failed to stop ${instanceName}: ${error.message}`);
        }
    }

    async deleteInstance(instanceName) {
        const config = this.getInstanceConfig(instanceName);

        console.log(`\n⚠️  WARNING: This will permanently delete:`);
        console.log(`- Instance: ${instanceName}`);
        console.log(`- Database: ${config?.database?.name || 'unknown'}`);
        console.log(`- All files and uploads`);

        const confirm = await this.question('\nType "DELETE" to confirm: ');

        if (confirm === 'DELETE') {
            try {
                execSync(`pm2 delete ${instanceName}`, { stdio: 'pipe' });

                if (config?.database) {
                    // Drop database
                    execSync(`sudo -u postgres dropdb ${config.database.name}`, { stdio: 'pipe' });
                    execSync(`sudo -u postgres psql -c "DROP USER ${config.database.user}"`, { stdio: 'pipe' });

                    // NEW: Remove from PgBouncer
                    await this.unregisterFromPgBouncer(config.database.name, config.database.user);
                }

                execSync(`rm -rf ${path.join(this.instancesDir, instanceName)}`, { stdio: 'pipe' });
                console.log(`✅ Deleted ${instanceName} completely`);
            } catch (error) {
                console.log(`❌ Failed to delete ${instanceName}: ${error.message}`);
            }
        }
    }

    async unregisterFromPgBouncer(dbName, dbUser) {
        try {
            // Remove database entry from pgbouncer.ini
            execSync(`sudo sed -i '/${dbName} =/d' /etc/pgbouncer/pgbouncer.ini`, { stdio: 'pipe' });

            // Remove user entry from userlist.txt
            execSync(`sudo sed -i '/"${dbUser}"/d' /etc/pgbouncer/userlist.txt`, { stdio: 'pipe' });

            // Reload PgBouncer
            execSync('sudo systemctl reload pgbouncer', { stdio: 'pipe' });

            console.log('   ✅ Removed from PgBouncer');
        } catch (error) {
            console.log(`   ⚠️  Could not unregister from PgBouncer: ${error.message}`);
        }
    }

    async cleanupFailedInstance(instanceName) {
        try {
            console.log('🧹 Cleaning up failed installation...');

            // Try to stop PM2 process
            try {
                execSync(`pm2 delete ${instanceName}`, { stdio: 'pipe' });
            } catch (e) { }

            // Try to drop database
            try {
                execSync(`sudo -u postgres dropdb ${instanceName.toLowerCase()}_db`, { stdio: 'pipe' });
                execSync(`sudo -u postgres psql -c "DROP USER ${instanceName.toLowerCase()}_user"`, { stdio: 'pipe' });
            } catch (e) { }

            // Remove files
            try {
                execSync(`rm -rf ${path.join(this.instancesDir, instanceName)}`, { stdio: 'pipe' });
            } catch (e) { }

            console.log('✅ Cleanup completed');
        } catch (error) {
            console.log(`⚠️  Cleanup had issues: ${error.message}`);
        }
    }

    async resurrectMenu() {
        console.log('\n🔄 Instance Resurrection Menu');
        console.log('============================');

        console.log('1. Resurrect all instances');
        console.log('2. Resurrect specific instances');
        console.log('3. Stop specific instances');
        console.log('4. Cancel');

        const choice = await this.question('\nEnter choice (1-4): ');

        switch (choice) {
            case '1':
                await this.resurrectAllInstances();
                break;
            case '2':
                await this.resurrectSpecificInstances();
                break;
            case '3':
                await this.stopSpecificInstances();
                break;
            case '4':
                console.log('Cancelled.');
                break;
            default:
                console.log('Invalid choice.');
        }
    }

    async resurrectSpecificInstances() {
        const instances = this.getInstances();

        if (instances.length === 0) {
            console.log('No instances found.');
            return;
        }

        console.log('\n📋 Available Instances:');
        instances.forEach((instance, index) => {
            const status = this.getInstanceStatus(instance);
            const config = this.getInstanceConfig(instance);
            const port = config?.port || 'unknown';
            console.log(`${index + 1}. ${instance} (Port: ${port}) - ${status}`);
        });

        console.log('\nEnter instance numbers to start (comma-separated, e.g. "1,3,5"):');
        const input = await this.question('Instances: ');

        if (!input.trim()) {
            console.log('No instances selected.');
            return;
        }

        const selectedIndices = input.split(',')
            .map(s => parseInt(s.trim()) - 1)
            .filter(i => i >= 0 && i < instances.length);

        if (selectedIndices.length === 0) {
            console.log('No valid instances selected.');
            return;
        }

        let started = 0;
        let failed = 0;

        for (const index of selectedIndices) {
            const instanceName = instances[index];
            const config = this.getInstanceConfig(instanceName);

            if (config && config.paths && config.paths.server) {
                try {
                    const status = this.getInstanceStatus(instanceName);

                    if (status === 'online') {
                        console.log(`   ⚡ ${instanceName} already running`);
                        continue;
                    }

                    await this.configureFirewall(config.port);

                    execSync(`pm2 start index.js --name ${instanceName} --cwd ${config.paths.server}`, { stdio: 'pipe' });
                    console.log(`   ✅ Started ${instanceName} on port ${config.port}`);
                    started++;
                } catch (error) {
                    console.log(`   ❌ Failed to start ${instanceName}: ${error.message}`);
                    failed++;
                }
            } else {
                console.log(`   ⚠️  No valid config found for ${instanceName}`);
                failed++;
            }
        }

        if (started > 0) {
            execSync('pm2 save', { stdio: 'pipe' });
            console.log(`\n🎉 Complete: ${started} started, ${failed} failed`);
        }
    }

    async stopSpecificInstances() {
        const instances = this.getInstances();

        if (instances.length === 0) {
            console.log('No instances found.');
            return;
        }

        console.log('\n📋 Available Instances:');
        instances.forEach((instance, index) => {
            const status = this.getInstanceStatus(instance);
            const config = this.getInstanceConfig(instance);
            const port = config?.port || 'unknown';
            console.log(`${index + 1}. ${instance} (Port: ${port}) - ${status}`);
        });

        console.log('\nEnter instance numbers to stop (comma-separated, e.g. "1,3,5"):');
        const input = await this.question('Instances: ');

        if (!input.trim()) {
            console.log('No instances selected.');
            return;
        }

        const selectedIndices = input.split(',')
            .map(s => parseInt(s.trim()) - 1)
            .filter(i => i >= 0 && i < instances.length);

        if (selectedIndices.length === 0) {
            console.log('No valid instances selected.');
            return;
        }

        let stopped = 0;
        let failed = 0;

        for (const index of selectedIndices) {
            const instanceName = instances[index];

            try {
                const status = this.getInstanceStatus(instanceName);

                if (status !== 'online') {
                    console.log(`   ⚡ ${instanceName} already stopped`);
                    continue;
                }

                execSync(`pm2 stop ${instanceName}`, { stdio: 'pipe' });
                console.log(`   ✅ Stopped ${instanceName}`);
                stopped++;
            } catch (error) {
                console.log(`   ❌ Failed to stop ${instanceName}: ${error.message}`);
                failed++;
            }
        }

        if (stopped > 0) {
            execSync('pm2 save', { stdio: 'pipe' });
            console.log(`\n🎉 Complete: ${stopped} stopped, ${failed} failed`);
        }
    }

    async resurrectAllInstances() {
        console.log('🔄 Starting all instances after server restart...');

        const instances = this.getInstances();

        if (instances.length === 0) {
            console.log('No instances found to resurrect.');
            return;
        }

        console.log(`Found ${instances.length} instances: ${instances.join(', ')}`);

        let started = 0;
        let failed = 0;

        for (const instanceName of instances) {
            const config = this.getInstanceConfig(instanceName);
            if (config && config.paths && config.paths.server) {
                try {
                    const status = this.getInstanceStatus(instanceName);
                    if (status === 'online') {
                        console.log(`   ⚡ ${instanceName} already running`);
                        continue;
                    }

                    await this.configureFirewall(config.port);

                    execSync(`pm2 start index.js --name ${instanceName} --cwd ${config.paths.server}`, { stdio: 'pipe' });
                    console.log(`   ✅ Started ${instanceName} on port ${config.port}`);
                    started++;
                } catch (error) {
                    console.log(`   ❌ Failed to start ${instanceName}: ${error.message}`);
                    failed++;
                }
            } else {
                console.log(`   ⚠️  No valid config found for ${instanceName}`);
                failed++;
            }
        }

        if (started > 0) {
            execSync('pm2 save', { stdio: 'pipe' });
            console.log(`\n🎉 Resurrection complete: ${started} started, ${failed} failed`);
        } else {
            console.log('\nNo instances needed to be started');
        }
    }

    generatePassword() {
        return Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);
    }
}

// Run the script
if (require.main === module) {
    const manager = new InstanceManager();
    manager.main().catch(console.error);
}

module.exports = InstanceManager;