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
        await this.checkInfrastructure();
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
            console.log('6. Manage Infrastructure');
            console.log('7. Exit');

            const choice = await this.question('\nEnter choice (1-7): ');

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
                    await this.manageInfrastructure();
                    break;
                case '7':
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
            await this.switchToPgBouncer(instanceName);
            await this.buildFrontend(instanceName);
            //await this.configureFirewall(port);
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
        console.log('b - Rebuild instance (update code, keep database)');
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
            case 'b':
                await this.rebuildInstance(instanceName);
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

    async streamLiveLogs(instanceName, errorsOnly = false) {
        console.log(`\n📡 Live log streaming for ${instanceName}`);
        console.log('Press "q" and Enter to stop streaming...\n');

        // Close readline temporarily
        rl.pause();

        return new Promise((resolve) => {
            const args = ['logs', instanceName, '--timestamp'];
            if (errorsOnly) {
                args.push('--err');
            }

            const logProcess = spawn('pm2', args, {
                stdio: ['pipe', 'inherit', 'inherit']
            });

            let stopped = false;

            // Listen for 'q' keypress to stop streaming (works better in SSH)
            const handleStdin = (data) => {
                const input = data.toString().trim().toLowerCase();
                if (input === 'q' && !stopped) {
                    stopped = true;
                    logProcess.kill('SIGTERM');
                }
            };

            process.stdin.setRawMode(false); // Ensure cooked mode for line buffering
            process.stdin.resume();
            process.stdin.on('data', handleStdin);

            logProcess.on('close', () => {
                if (!stopped) {
                    stopped = true;
                }
                process.stdin.removeListener('data', handleStdin);
                process.stdin.pause();
                rl.resume();
                console.log('\n📡 Streaming stopped\n');
                resolve();
            });

            logProcess.on('error', (error) => {
                if (!stopped) {
                    stopped = true;
                }
                process.stdin.removeListener('data', handleStdin);
                process.stdin.pause();
                rl.resume();
                console.log(`\n❌ Failed to stream logs: ${error.message}\n`);
                resolve();
            });
        });
    }

    async searchLogs(instanceName) {
        const searchTerm = await this.question('Enter search term: ');
        if (!searchTerm.trim()) {
            console.log('Search cancelled.');
            return;
        }

        const caseInsensitive = await this.question('Case insensitive? (y/n): ');
        const iFlag = caseInsensitive.toLowerCase() === 'y' ? '-i' : '';

        console.log(`\n🔍 Searching for "${searchTerm}"...\n`);

        try {
            // Get logs and pipe through grep
            const grepCmd = iFlag ? `grep ${iFlag} "${searchTerm}"` : `grep "${searchTerm}"`;
            execSync(`pm2 logs ${instanceName} --nostream --lines 1000 --timestamp | ${grepCmd}`, {
                stdio: 'inherit',
                shell: true
            });
        } catch (error) {
            if (error.status === 1) {
                console.log(`\n❌ No matches found for "${searchTerm}"`);
            } else {
                console.log(`\n❌ Search failed: ${error.message}`);
            }
        }
    }

    async showRecentLogs(instanceName) {
        console.log('\n⏱️  Show logs from:');
        console.log('1. Last 5 minutes');
        console.log('2. Last 10 minutes');
        console.log('3. Last 30 minutes');
        console.log('4. Last hour');

        const choice = await this.question('Choose option (1-4): ');

        const minutes = { '1': 5, '2': 10, '3': 30, '4': 60 }[choice];
        if (!minutes) {
            console.log('Invalid option.');
            return;
        }

        console.log(`\n📋 Logs from last ${minutes} minutes:\n`);

        try {
            // Get logs with timestamps (PM2 adds them automatically)
            const logOutput = execSync(`pm2 logs ${instanceName} --lines 1000 --nostream --timestamp`, {
                encoding: 'utf8'
            });

            // Calculate cutoff time
            const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);

            // Parse and filter logs by timestamp
            const lines = logOutput.split('\n');
            const filteredLines = [];

            for (const line of lines) {
                if (!line.trim()) continue;

                // PM2 timestamp formats:
                // "2025-11-13 12:34:56" or "2025-11-13T12:34:56.789Z" at the start
                // Try to extract timestamp from the beginning of the line
                const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z)?)/);

                if (timestampMatch) {
                    const timestampStr = timestampMatch[1].replace(' ', 'T');
                    const logTime = new Date(timestampStr);

                    if (!isNaN(logTime.getTime()) && logTime >= cutoffTime) {
                        filteredLines.push(line);
                    }
                } else {
                    // If we can't parse timestamp, include the line (might be continuation of previous log)
                    if (filteredLines.length > 0) {
                        filteredLines.push(line);
                    }
                }
            }

            if (filteredLines.length === 0) {
                console.log(`⚠️  No logs found in the last ${minutes} minutes`);
                console.log(`   (searched ${lines.length} lines)`);
            } else {
                console.log(`Found ${filteredLines.length} log lines from the last ${minutes} minutes:\n`);
                console.log(filteredLines.join('\n'));
            }
        } catch (error) {
            console.log(`❌ Failed to show logs: ${error.message}`);
        }
    }

    async saveLogsToFile(instanceName) {
        const defaultFilename = `${instanceName}_logs_${new Date().toISOString().replace(/[:.]/g, '-')}.log`;
        const filename = await this.question(`Save to filename (${defaultFilename}): `);
        const finalFilename = filename.trim() || defaultFilename;

        try {
            console.log(`\n💾 Saving logs to ${finalFilename}...`);

            const logContent = execSync(`pm2 logs ${instanceName} --nostream --lines 1000 --timestamp`, {
                encoding: 'utf8'
            });

            fs.writeFileSync(finalFilename, logContent);
            console.log(`✅ Logs saved to ${finalFilename}`);
        } catch (error) {
            console.log(`❌ Failed to save logs: ${error.message}`);
        }
    }

    async showInstanceLogs(instanceName) {
        console.log(`\n📋 Log Options for ${instanceName}:`);
        console.log('1. Last 20 lines');
        console.log('2. Last 50 lines');
        console.log('3. Last 100 lines');
        console.log('4. Last 200 lines');
        console.log('5. Errors only (last 50)');
        console.log('6. Live tail (streaming)');
        console.log('7. Live errors (streaming)');
        console.log('8. Recent logs (time-based)');
        console.log('9. Search logs');
        console.log('10. Save logs to file');
        console.log('11. All logs (combined stdout/stderr)');

        const logChoice = await this.question('Choose option (1-11): ');

        try {
            switch (logChoice) {
                case '1':
                    execSync(`pm2 logs ${instanceName} --lines 20 --nostream --timestamp`, { stdio: 'inherit' });
                    break;
                case '2':
                    execSync(`pm2 logs ${instanceName} --lines 50 --nostream --timestamp`, { stdio: 'inherit' });
                    break;
                case '3':
                    execSync(`pm2 logs ${instanceName} --lines 100 --nostream --timestamp`, { stdio: 'inherit' });
                    break;
                case '4':
                    execSync(`pm2 logs ${instanceName} --lines 200 --nostream --timestamp`, { stdio: 'inherit' });
                    break;
                case '5':
                    execSync(`pm2 logs ${instanceName} --err --lines 50 --nostream --timestamp`, { stdio: 'inherit' });
                    break;
                case '6':
                    await this.streamLiveLogs(instanceName, false);
                    break;
                case '7':
                    await this.streamLiveLogs(instanceName, true);
                    break;
                case '8':
                    await this.showRecentLogs(instanceName);
                    break;
                case '9':
                    await this.searchLogs(instanceName);
                    break;
                case '10':
                    await this.saveLogsToFile(instanceName);
                    break;
                case '11':
                    execSync(`pm2 logs ${instanceName} --lines 100 --nostream --timestamp`, { stdio: 'inherit' });
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
        // Not needed with containerized PgBouncer using wildcard database config
        // The edoburu/pgbouncer image with DATABASE_URL handles all databases automatically
        console.log('   ✅ PgBouncer configured for all databases');
    }

    async switchToPgBouncer(instanceName) {
        console.log('   🔄 Switching to PgBouncer connection...');

        const instanceDir = path.join(this.instancesDir, instanceName);
        const serverDir = path.join(instanceDir, 'server');
        const dbConfig = JSON.parse(
            fs.readFileSync(path.join(instanceDir, 'db-config.json'), 'utf8')
        );

        const serverEnv = `
DATABASE_URL="${dbConfig.url}"
DIRECT_URL="${dbConfig.directUrl}"
PORT=${this.getInstanceConfig(instanceName).port}
NODE_ENV=production
HOST=0.0.0.0
${this.getEmailConfig()}
INSTANCE_NAME=${instanceName}
`.trim();

        fs.writeFileSync(path.join(serverDir, '.env'), serverEnv);
        console.log('   ✅ Switched to PgBouncer connection');
    }

    async manageInfrastructure() {
        console.log('\n🏗️  Infrastructure Management');
        console.log('============================');
        console.log('1. Start infrastructure');
        console.log('2. Stop infrastructure');
        console.log('3. Restart infrastructure');
        console.log('4. Check infrastructure status');
        console.log('5. View logs');
        console.log('6. Cancel');

        const choice = await this.question('\nEnter choice (1-6): ');

        switch (choice) {
            case '1':
                await this.startInfrastructure();
                break;
            case '2':
                await this.stopInfrastructure();
                break;
            case '3':
                await this.restartInfrastructure();
                break;
            case '4':
                this.checkInfrastructureStatus();
                break;
            case '5':
                await this.viewInfrastructureLogs();
                break;
            case '6':
                console.log('Cancelled.');
                break;
            default:
                console.log('Invalid choice.');
        }
    }

    async startInfrastructure() {
        try {
            console.log('🚀 Starting infrastructure...');

            // Check if containers exist but are stopped
            const postgresExists = execSync('podman ps -a --filter name=postgres --format "{{.Names}}"', {
                encoding: 'utf8',
                stdio: 'pipe'
            }).trim();

            const pgbouncerExists = execSync('podman ps -a --filter name=pgbouncer --format "{{.Names}}"', {
                encoding: 'utf8',
                stdio: 'pipe'
            }).trim();

            if (!postgresExists || !pgbouncerExists) {
                console.log('❌ Infrastructure not set up. Run setup-infra.sh first.');
                return;
            }

            execSync('podman start postgres', { stdio: 'inherit' });
            console.log('⏳ Waiting for PostgreSQL...');
            await new Promise(resolve => setTimeout(resolve, 5000));

            execSync('podman start pgbouncer', { stdio: 'inherit' });
            console.log('⏳ Waiting for PgBouncer...');
            await new Promise(resolve => setTimeout(resolve, 3000));

            console.log('✅ Infrastructure started');
        } catch (error) {
            console.log(`❌ Failed to start infrastructure: ${error.message}`);
        }
    }

    async stopInfrastructure() {
        try {
            console.log('🛑 Stopping infrastructure...');
            execSync('podman stop pgbouncer postgres', { stdio: 'inherit' });
            console.log('✅ Infrastructure stopped');
        } catch (error) {
            console.log(`❌ Failed to stop infrastructure: ${error.message}`);
        }
    }

    async restartInfrastructure() {
        await this.stopInfrastructure();
        await this.startInfrastructure();
    }

    checkInfrastructureStatus() {
        try {
            console.log('\n📊 Infrastructure Status');
            console.log('========================');
            execSync('podman ps --filter name=postgres --filter name=pgbouncer', { stdio: 'inherit' });
        } catch (error) {
            console.log(`❌ Failed to check status: ${error.message}`);
        }
    }

    async viewInfrastructureLogs() {
        console.log('\n📋 Which logs?');
        console.log('1. PostgreSQL');
        console.log('2. PgBouncer');
        console.log('3. Both');

        const choice = await this.question('\nEnter choice (1-3): ');

        try {
            switch (choice) {
                case '1':
                    execSync('podman logs postgres --tail 50', { stdio: 'inherit' });
                    break;
                case '2':
                    execSync('podman logs pgbouncer --tail 50', { stdio: 'inherit' });
                    break;
                case '3':
                    console.log('\n=== PostgreSQL Logs ===');
                    execSync('podman logs postgres --tail 30', { stdio: 'inherit' });
                    console.log('\n=== PgBouncer Logs ===');
                    execSync('podman logs pgbouncer --tail 30', { stdio: 'inherit' });
                    break;
                default:
                    console.log('Invalid choice.');
            }
        } catch (error) {
            console.log(`❌ Failed to view logs: ${error.message}`);
        }
    }

    async checkInfrastructure() {
        try {
            const postgresRunning = execSync('podman ps --filter name=postgres --format "{{.Names}}"', {
                encoding: 'utf8',
                stdio: 'pipe'
            }).trim();

            const pgbouncerRunning = execSync('podman ps --filter name=pgbouncer --format "{{.Names}}"', {
                encoding: 'utf8',
                stdio: 'pipe'
            }).trim();

            if (!postgresRunning || !pgbouncerRunning) {
                console.log('\n⚠️  Database infrastructure not fully running!');
                console.log(`PostgreSQL: ${postgresRunning ? '✅ Running' : '❌ Stopped'}`);
                console.log(`PgBouncer: ${pgbouncerRunning ? '✅ Running' : '❌ Stopped'}`);

                const answer = await this.question('\nWould you like to start it now? (y/n): ');
                if (answer.toLowerCase() === 'y') {
                    await this.startInfrastructure();
                    console.log('Infrastructure started. Continuing...\n');
                    return false;
                } else {
                    console.log('\nPlease start infrastructure before managing instances.');
                    process.exit(1);
                }
            }

            return true;
        } catch (error) {
            console.log('\n❌ Podman not available or infrastructure not set up');
            console.log('Run setup-infra.sh to initialize the database infrastructure.');
            process.exit(1);
        }
    }


    async createDatabase(instanceName) {
        console.log('   📊 Creating database...');

        const dbName = `${instanceName.toLowerCase()}_db`;
        const dbUser = `${instanceName.toLowerCase()}_user`;
        const dbPassword = this.generatePassword();

        console.log(`   DEBUG: dbName=${dbName}, dbUser=${dbUser}, password=${dbPassword}`);

        try {
            // Create database using podman exec instead of sudo
            console.log('   DEBUG: Running createdb...');
            execSync(`podman exec postgres createdb -U postgres ${dbName}`, { stdio: 'inherit' });
            console.log('   DEBUG: createdb completed');

            const sqlCommands = `
            CREATE USER ${dbUser} WITH ENCRYPTED PASSWORD '${dbPassword}';
            GRANT ALL PRIVILEGES ON DATABASE ${dbName} TO ${dbUser};
            ALTER DATABASE ${dbName} OWNER TO ${dbUser};
        `;

            console.log('   DEBUG: Running SQL commands...');
            execSync(`podman exec postgres psql -U postgres -c "${sqlCommands}"`, { stdio: 'inherit' });
            console.log('   DEBUG: SQL commands completed');

            const dbConfig = {
                name: dbName,
                user: dbUser,
                password: dbPassword,
                host: '127.0.0.1',
                port: 16432,  // PgBouncer port for runtime
                directPort: 15432,  // Direct PostgreSQL for setup
                url: `postgresql://${dbUser}:${dbPassword}@127.0.0.1:16432/${dbName}?pgbouncer=true`,
                directUrl: `postgresql://${dbUser}:${dbPassword}@127.0.0.1:15432/${dbName}`
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

        // PgBouncer in container with wildcard config doesn't need registration
        console.log('   ✅ PgBouncer will auto-route to this database');
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
DATABASE_URL="${dbConfig.directUrl}"
DIRECT_URL="${dbConfig.directUrl}"
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
            execSync(`pm2 start index.js --name ${instanceName} --cwd ${serverDir} --time`, { stdio: 'pipe' });
            execSync('pm2 save', { stdio: 'pipe' });
            console.log(`   ✅ Instance started in PM2`);

            // Verify instance is actually healthy
            console.log(`   🔍 Verifying instance health...`);
            const health = await this.verifyInstanceHealth(instanceName, port);

            if (health.healthy) {
                console.log(`   ✅ Instance is healthy and responding on port ${port}`);
            } else {
                console.log(`   ⚠️  Instance started but may have issues: ${health.reason}`);
                console.log(`   💡 Check logs with: pm2 logs ${instanceName}`);
            }
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

    async verifyInstanceHealth(instanceName, port, maxAttempts = 10) {
        // Wait a moment for the instance to initialize
        await new Promise(resolve => setTimeout(resolve, 2000));

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                // Check PM2 status first
                const pm2Status = this.getInstanceStatus(instanceName);
                if (pm2Status !== 'online') {
                    if (attempt < maxAttempts) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        continue;
                    }
                    return { healthy: false, reason: `PM2 status is ${pm2Status}` };
                }

                // Try to connect to the port
                const net = require('net');
                const client = new net.Socket();

                const connected = await new Promise((resolve) => {
                    client.setTimeout(2000);

                    client.connect(port, '127.0.0.1', () => {
                        client.destroy();
                        resolve(true);
                    });

                    client.on('error', () => {
                        resolve(false);
                    });

                    client.on('timeout', () => {
                        client.destroy();
                        resolve(false);
                    });
                });

                if (connected) {
                    return { healthy: true, reason: 'Instance is responding' };
                }

                // If not connected and we have more attempts, wait and retry
                if (attempt < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } catch (error) {
                if (attempt === maxAttempts) {
                    return { healthy: false, reason: `Health check failed: ${error.message}` };
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        return { healthy: false, reason: `Port ${port} not responding after ${maxAttempts} attempts` };
    }

    async restartInstance(instanceName) {
        try {
            const config = this.getInstanceConfig(instanceName);
            if (!config || !config.paths || !config.paths.server) {
                console.log(`❌ Cannot find config for ${instanceName}`);
                return;
            }

            console.log(`🔄 Restarting ${instanceName} (reloading environment)...`);

            // Delete and restart to reload environment variables (pm2 restart doesn't reload .env)
            try {
                execSync(`pm2 delete ${instanceName}`, { stdio: 'pipe' });
            } catch (e) {
                // Instance might not exist in PM2, that's okay
            }

            execSync(`pm2 start index.js --name ${instanceName} --cwd ${config.paths.server} --time`, { stdio: 'pipe' });
            execSync('pm2 save', { stdio: 'pipe' });

            // Verify instance is actually healthy
            console.log(`🔍 Verifying instance health...`);
            const health = await this.verifyInstanceHealth(instanceName, config.port);

            if (health.healthy) {
                console.log(`✅ ${instanceName} restarted successfully and is responding on port ${config.port}`);
            } else {
                console.log(`⚠️  ${instanceName} restarted but may have issues: ${health.reason}`);
                console.log(`💡 Check logs with: pm2 logs ${instanceName}`);
            }
        } catch (error) {
            console.log(`❌ Failed to restart ${instanceName}: ${error.message}`);
            console.log(`💡 Try checking: pm2 logs ${instanceName} --err`);
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
                // Stop the instance first to close database connections
                console.log('   🛑 Stopping instance...');
                try {
                    execSync(`pm2 stop ${instanceName}`, { stdio: 'pipe' });
                } catch (e) {
                    // Instance might not be running, that's okay
                }

                // Delete from PM2
                try {
                    execSync(`pm2 delete ${instanceName}`, { stdio: 'pipe' });
                } catch (e) {
                    // Instance might not exist in PM2, that's okay
                }
                execSync('pm2 save', { stdio: 'pipe' }); // Save PM2 state so deletion persists
                console.log('   ✅ Instance stopped and removed from PM2');

                if (config?.database) {
                    // Wait a moment for connections to fully close
                    console.log('   ⏳ Waiting for database connections to close...');
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    // Force-terminate any remaining connections to the database
                    const terminateConnections = `
                        SELECT pg_terminate_backend(pg_stat_activity.pid)
                        FROM pg_stat_activity
                        WHERE pg_stat_activity.datname = '${config.database.name}'
                        AND pid <> pg_backend_pid();
                    `;

                    try {
                        execSync(`podman exec postgres psql -U postgres -c "${terminateConnections}"`, { stdio: 'pipe' });
                        console.log('   ✅ Database connections terminated');
                    } catch (e) {
                        // Connections might already be closed, that's okay
                    }

                    // Now drop the database
                    execSync(`podman exec postgres dropdb -U postgres ${config.database.name}`, { stdio: 'pipe' });
                    execSync(`podman exec postgres psql -U postgres -c "DROP USER IF EXISTS ${config.database.user}"`, { stdio: 'pipe' });

                    console.log('   ✅ Database dropped');
                }

                execSync(`rm -rf ${path.join(this.instancesDir, instanceName)}`, { stdio: 'pipe' });
                console.log(`✅ Deleted ${instanceName} completely`);
            } catch (error) {
                console.log(`❌ Failed to delete ${instanceName}: ${error.message}`);
            }
        }
    }

    async rebuildInstance(instanceName) {
        const config = this.getInstanceConfig(instanceName);

        if (!config) {
            console.log(`❌ Cannot find config for ${instanceName}`);
            return;
        }

        console.log(`\n🔨 Rebuild Instance: ${instanceName}`);
        console.log('================================');
        console.log('This will:');
        console.log('  ✓ Update backend and frontend code');
        console.log('  ✓ Reinstall dependencies');
        console.log('  ✓ Rebuild frontend');
        console.log('  ✗ Keep database and data intact');
        console.log(`\nCurrent port: ${config.port}`);

        const confirm = await this.question('\nProceed with rebuild? (y/n): ');

        if (confirm.toLowerCase() !== 'y') {
            console.log('Rebuild cancelled.');
            return;
        }

        // PRE-FLIGHT VALIDATION
        console.log('\n🔍 Pre-flight checks...');
        const baseServerDir = path.join(this.baseDir, 'server');
        const baseClientDir = path.join(this.baseDir, 'client');

        if (!fs.existsSync(baseServerDir)) {
            console.log(`❌ Base server directory not found: ${baseServerDir}`);
            console.log('💡 Make sure you have the base server code in the project root');
            return;
        }

        if (!fs.existsSync(baseClientDir)) {
            console.log(`❌ Base client directory not found: ${baseClientDir}`);
            console.log('💡 Make sure you have the base client code in the project root');
            return;
        }

        console.log('   ✅ Base directories validated');

        // Ask about schema changes
        console.log('\n⚠️  Database Schema Changes');
        console.log('If you made changes to the Prisma schema, the database needs to be updated.');
        console.log('WARNING: Some schema changes can cause DATA LOSS (e.g., dropping columns).');
        const schemaChanged = await this.question('\nDid you change the Prisma schema? (y/n): ');

        const instanceDir = path.join(this.instancesDir, instanceName);
        const serverDir = path.join(instanceDir, 'server');
        const clientDir = path.join(instanceDir, 'client');
        const rollbackDir = path.join(instanceDir, 'rollback_backup');
        let currentStep = 'initialization';

        try {
            console.log('\n🔧 Rebuilding instance...');

            // STEP: Stop the instance
            currentStep = 'stopping instance';
            console.log('   🛑 Stopping instance...');
            try {
                execSync(`pm2 stop ${instanceName}`, { stdio: 'pipe' });
            } catch (e) {
                // Instance might not be running, that's okay
            }

            // STEP: Create full rollback backup
            currentStep = 'creating rollback backup';
            console.log('   💾 Creating rollback backup...');

            // Remove old rollback backup if exists
            if (fs.existsSync(rollbackDir)) {
                execSync(`rm -rf ${rollbackDir}`, { stdio: 'pipe' });
            }

            fs.mkdirSync(rollbackDir, { recursive: true });

            if (fs.existsSync(serverDir)) {
                execSync(`cp -r ${serverDir} ${path.join(rollbackDir, 'server')}`, { stdio: 'pipe' });
            }
            if (fs.existsSync(clientDir)) {
                execSync(`cp -r ${clientDir} ${path.join(rollbackDir, 'client')}`, { stdio: 'pipe' });
            }

            const configPath = path.join(instanceDir, 'config.json');
            if (fs.existsSync(configPath)) {
                fs.copyFileSync(configPath, path.join(rollbackDir, 'config.json'));
            }

            console.log('   ✅ Rollback backup created');

            // STEP: Backup uploads
            currentStep = 'backing up uploads';
            const uploadsDir = path.join(serverDir, 'uploads');
            const uploadsBackupDir = path.join(instanceDir, 'uploads_backup_temp');

            console.log('   💾 Backing up user data...');
            if (fs.existsSync(uploadsDir)) {
                execSync(`cp -r ${uploadsDir} ${uploadsBackupDir}`, { stdio: 'pipe' });
                console.log('   ✅ User data backed up');
            }

            // STEP: Backup .env
            currentStep = 'backing up configuration';
            const serverEnvBackup = fs.readFileSync(path.join(serverDir, '.env'), 'utf8');

            // STEP: Remove old code
            currentStep = 'removing old code';
            console.log('   🗑️  Removing old code...');
            execSync(`rm -rf ${serverDir}`, { stdio: 'pipe' });
            execSync(`rm -rf ${clientDir}`, { stdio: 'pipe' });

            // STEP: Copy fresh code
            currentStep = 'copying fresh code';
            console.log('   📁 Copying fresh code...');
            execSync(`cp -r ${baseServerDir} ${serverDir}`, { stdio: 'pipe' });
            execSync(`cp -r ${baseClientDir} ${clientDir}`, { stdio: 'pipe' });

            // STEP: Restore configuration
            currentStep = 'restoring configuration';
            console.log('   ♻️  Restoring configuration...');
            fs.writeFileSync(path.join(serverDir, '.env'), serverEnvBackup);

            // STEP: Restore uploads
            currentStep = 'restoring user data';
            if (fs.existsSync(uploadsBackupDir)) {
                const newUploadsDir = path.join(serverDir, 'uploads');
                execSync(`rm -rf ${newUploadsDir}`, { stdio: 'pipe' });
                execSync(`cp -r ${uploadsBackupDir} ${newUploadsDir}`, { stdio: 'pipe' });
                console.log('   ✅ User data restored');
            } else {
                fs.mkdirSync(path.join(serverDir, 'uploads'), { recursive: true });
                fs.mkdirSync(path.join(serverDir, 'uploads', 'profile-pics'), { recursive: true });
            }

            // STEP: Install server dependencies
            currentStep = 'installing server dependencies';
            console.log('   📦 Installing server dependencies...');
            execSync('npm install', { cwd: serverDir, stdio: 'pipe' });

            // STEP: Install client dependencies
            currentStep = 'installing client dependencies';
            console.log('   📦 Installing client dependencies...');
            execSync('npm install', { cwd: clientDir, stdio: 'pipe' });

            // STEP: Generate Prisma client
            currentStep = 'generating Prisma client';
            console.log('   🗄️  Generating Prisma client...');
            execSync('npx prisma generate', { cwd: serverDir, stdio: 'pipe' });

            // STEP: Apply schema changes if requested
            if (schemaChanged.toLowerCase() === 'y') {
                currentStep = 'applying schema changes';
                console.log('   🗄️  Applying schema changes to database...');
                console.log('   ⚠️  This may cause data loss if columns were removed or types changed!');
                try {
                    execSync('npx prisma db push --accept-data-loss', { cwd: serverDir, stdio: 'pipe' });
                    console.log('   ✅ Schema changes applied');
                } catch (error) {
                    throw new Error(`Schema update failed: ${error.message}`);
                }
            }

            // STEP: Build frontend
            currentStep = 'building frontend';
            console.log('   🏗️  Building frontend...');
            execSync('npm run build', { cwd: clientDir, stdio: 'pipe' });

            // STEP: Start instance
            currentStep = 'starting instance';
            console.log('   🚀 Starting instance...');
            try {
                execSync(`pm2 delete ${instanceName}`, { stdio: 'pipe' });
            } catch (e) {
                // Instance might not exist in PM2, that's okay
            }

            execSync(`pm2 start index.js --name ${instanceName} --cwd ${serverDir} --time`, { stdio: 'pipe' });
            execSync('pm2 save', { stdio: 'pipe' });

            // STEP: Health check
            currentStep = 'verifying instance health';
            console.log('   🔍 Verifying instance health...');
            const health = await this.verifyInstanceHealth(instanceName, config.port);

            if (!health.healthy) {
                throw new Error(`Instance not healthy: ${health.reason}`);
            }

            console.log('   ✅ Instance is healthy and responding');

            // Clean up temp files
            this.cleanupTempFiles(instanceName);

            // Remove rollback backup on success
            if (fs.existsSync(rollbackDir)) {
                execSync(`rm -rf ${rollbackDir}`, { stdio: 'pipe' });
            }

            console.log('\n🎉 Instance rebuilt successfully!');
            console.log(`🔗 Access your app at: http://localhost:${config.port}`);

            // Offer to view logs
            const viewLogs = await this.question('\nWould you like to view the logs? (y/n): ');
            if (viewLogs.toLowerCase() === 'y') {
                await this.showInstanceLogs(instanceName);
            }

        } catch (error) {
            console.error(`\n❌ Failed at: ${currentStep}`);
            console.error(`Error: ${error.message}`);
            console.log('\n🔄 Attempting to rollback to previous state...');

            // ROLLBACK
            try {
                // Stop the broken instance
                try {
                    execSync(`pm2 stop ${instanceName}`, { stdio: 'pipe' });
                    execSync(`pm2 delete ${instanceName}`, { stdio: 'pipe' });
                } catch (e) { }

                // Restore from rollback backup
                if (fs.existsSync(rollbackDir)) {
                    const rollbackServerDir = path.join(rollbackDir, 'server');
                    const rollbackClientDir = path.join(rollbackDir, 'client');

                    if (fs.existsSync(rollbackServerDir)) {
                        execSync(`rm -rf ${serverDir}`, { stdio: 'pipe' });
                        execSync(`cp -r ${rollbackServerDir} ${serverDir}`, { stdio: 'pipe' });
                    }

                    if (fs.existsSync(rollbackClientDir)) {
                        execSync(`rm -rf ${clientDir}`, { stdio: 'pipe' });
                        execSync(`cp -r ${rollbackClientDir} ${clientDir}`, { stdio: 'pipe' });
                    }

                    // Restart old instance
                    execSync(`pm2 start index.js --name ${instanceName} --cwd ${serverDir} --time`, { stdio: 'pipe' });
                    execSync('pm2 save', { stdio: 'pipe' });

                    console.log('✅ Rollback successful - instance restored to previous state');
                    console.log(`💡 Instance is running again on port ${config.port}`);
                } else {
                    console.log('⚠️  No rollback backup found - instance may be in inconsistent state');
                    console.log('💡 You may need to delete and recreate the instance');
                }
            } catch (rollbackError) {
                console.error(`❌ Rollback failed: ${rollbackError.message}`);
                console.log('⚠️  Instance is in an inconsistent state');
                console.log('💡 You may need to delete and recreate the instance');
            }
        } finally {
            // Always clean up temp files
            this.cleanupTempFiles(instanceName);
        }
    }

    async unregisterFromPgBouncer(dbName, dbUser) {
        // Not needed with containerized setup
        console.log('   ✅ Database removed (PgBouncer auto-adjusts)');
    }

    cleanupTempFiles(instanceName) {
        const instanceDir = path.join(this.instancesDir, instanceName);
        const tempDirs = [
            path.join(instanceDir, 'uploads_backup_temp'),
            path.join(instanceDir, 'rollback_backup')
        ];

        for (const tempDir of tempDirs) {
            try {
                if (fs.existsSync(tempDir)) {
                    execSync(`rm -rf ${tempDir}`, { stdio: 'pipe' });
                }
            } catch (error) {
                // Silently fail - cleanup is best effort
            }
        }
    }

    async cleanupFailedInstance(instanceName) {
        try {
            console.log('🧹 Cleaning up failed installation...');

            // Try to stop PM2 process
            try {
                execSync(`pm2 delete ${instanceName}`, { stdio: 'pipe' });
            } catch (e) { }

            // Try to drop database - FIXED to use podman
            try {
                execSync(`podman exec postgres dropdb -U postgres ${instanceName.toLowerCase()}_db`, { stdio: 'pipe' });
                execSync(`podman exec postgres psql -U postgres -c "DROP USER IF EXISTS ${instanceName.toLowerCase()}_user"`, { stdio: 'pipe' });
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
        console.log('3. Resurrect with port change');
        console.log('4. Stop specific instances');
        console.log('5. Cancel');

        const choice = await this.question('\nEnter choice (1-5): ');

        switch (choice) {
            case '1':
                await this.resurrectAllInstances();
                break;
            case '2':
                await this.resurrectSpecificInstances();
                break;
            case '3':
                await this.resurrectWithPortChange();
                break;
            case '4':
                await this.stopSpecificInstances();
                break;
            case '5':
                console.log('Cancelled.');
                break;
            default:
                console.log('Invalid choice.');
        }
    }

    async resurrectWithPortChange() {
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
            console.log(`${index + 1}. ${instance} (Current Port: ${port}) - ${status}`);
        });

        const choice = await this.question('\nEnter instance number: ');
        const index = parseInt(choice) - 1;

        if (index < 0 || index >= instances.length) {
            console.log('Invalid instance number.');
            return;
        }

        const instanceName = instances[index];
        const config = this.getInstanceConfig(instanceName);

        console.log(`\nCurrent port: ${config.port}`);
        const newPortInput = await this.question('Enter new port (or press Enter to keep current): ');

        if (!newPortInput.trim()) {
            // No port change, just resurrect normally
            await this.startInstance(instanceName, config.port);
            console.log(`✅ Started ${instanceName} on port ${config.port}`);
            return;
        }

        const newPort = parseInt(newPortInput);

        // Validate port
        if (isNaN(newPort) || newPort < 1024 || newPort > 65535) {
            console.log('❌ Invalid port. Must be between 1024-65535.');
            return;
        }

        // Check if port is available
        const isAvailable = await this.isPortAvailable(newPort);
        if (!isAvailable) {
            console.log(`⚠️  Port ${newPort} is already in use.`);
            const proceed = await this.question('Continue anyway? (y/n): ');
            if (proceed.toLowerCase() !== 'y') {
                return;
            }
        }

        // Check if another instance uses this port
        const allInstances = this.getInstances();
        for (const inst of allInstances) {
            if (inst === instanceName) continue;
            const instConfig = this.getInstanceConfig(inst);
            if (instConfig?.port === newPort) {
                console.log(`❌ Port ${newPort} is already assigned to instance: ${inst}`);
                return;
            }
        }

        try {
            console.log(`\n🔧 Changing ${instanceName} from port ${config.port} to ${newPort}...`);

            // Stop instance if running
            try {
                execSync(`pm2 stop ${instanceName}`, { stdio: 'pipe' });
            } catch (e) { }

            // Update config.json
            config.port = newPort;
            const configPath = path.join(this.instancesDir, instanceName, 'config.json');
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

            // Update .env file
            const serverDir = config.paths.server;
            const envPath = path.join(serverDir, '.env');
            let envContent = fs.readFileSync(envPath, 'utf8');
            envContent = envContent.replace(/PORT=\d+/, `PORT=${newPort}`);
            fs.writeFileSync(envPath, envContent);

            // Configure firewall
            //await this.configureFirewall(newPort);

            // Delete old PM2 process and start fresh
            try {
                execSync(`pm2 delete ${instanceName}`, { stdio: 'pipe' });
            } catch (e) { }

            execSync(`pm2 start index.js --name ${instanceName} --cwd ${serverDir} --time`, { stdio: 'pipe' });
            execSync('pm2 save', { stdio: 'pipe' });

            console.log(`✅ ${instanceName} now running on port ${newPort}`);
            console.log(`🔗 Access at: http://localhost:${newPort}`);

        } catch (error) {
            console.log(`❌ Failed to change port: ${error.message}`);
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

                    //await this.configureFirewall(config.port);

                    execSync(`pm2 start index.js --name ${instanceName} --cwd ${config.paths.server} --time`, { stdio: 'pipe' });
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

                    //await this.configureFirewall(config.port);

                    execSync(`pm2 start index.js --name ${instanceName} --cwd ${config.paths.server} --time`, { stdio: 'pipe' });
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