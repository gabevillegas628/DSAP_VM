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
        this.instancesDir = path.join(__dirname, '..', 'instances'); // Go up one level from scripts/
    }

    async question(prompt) {
        return new Promise((resolve) => {
            rl.question(prompt, resolve);
        });
    }

    async manage() {
        console.log('🛠️  Instance Manager');
        console.log('==================');

        if (!fs.existsSync(this.instancesDir)) {
            console.log('No instances found. Run create-instance.js first.');
            rl.close();
            return;
        }

        const instances = this.getInstances();

        if (instances.length === 0) {
            console.log('No instances found.');
            rl.close();
            return;
        }

        console.log('\nAvailable instances:');
        instances.forEach((instance, index) => {
            const config = this.getInstanceConfig(instance);
            const status = this.getInstanceStatus(instance);
            console.log(`${index + 1}. ${instance} (Port: ${config.port}) - ${status}`);
        });

        console.log('\nActions:');
        console.log('s - Show status of all instances');
        console.log('r - Restart an instance');
        console.log('t - Stop an instance');
        console.log('d - Delete an instance');
        console.log('l - View logs for an instance');
        console.log('q - Quit');

        const action = await this.question('\nChoose action: ');

        switch (action.toLowerCase()) {
            case 's':
                this.showStatus();
                break;
            case 'r':
                await this.restartInstance(instances);
                break;
            case 't':
                await this.stopInstance(instances);
                break;
            case 'd':
                await this.deleteInstance(instances);
                break;
            case 'l':
                await this.viewLogs(instances);
                break;
            case 'q':
                console.log('Goodbye!');
                break;
            default:
                console.log('Invalid action.');
        }

        rl.close();
    }

    getInstances() {
        return fs.readdirSync(this.instancesDir).filter(item =>
            fs.statSync(path.join(this.instancesDir, item)).isDirectory()
        );
    }

    getInstanceConfig(instanceName) {
        const configPath = path.join(this.instancesDir, instanceName, 'config.json');
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }

    getInstanceStatus(instanceName) {
        try {
            const result = execSync(`pm2 jlist`, { encoding: 'utf8' });
            const processes = JSON.parse(result);
            const process = processes.find(p => p.name === instanceName);

            if (process) {
                return process.pm2_env.status;
            }
            return 'stopped';
        } catch {
            return 'unknown';
        }
    }

    showStatus() {
        console.log('\n📊 Instance Status:');
        console.log('─'.repeat(50));

        const instances = this.getInstances();
        instances.forEach(instance => {
            const config = this.getInstanceConfig(instance);
            const status = this.getInstanceStatus(instance);
            console.log(`${instance.padEnd(20)} Port: ${config.port.toString().padEnd(6)} Status: ${status}`);
        });
    }

    async restartInstance(instances) {
        const choice = await this.question('Enter instance number to restart: ');
        const index = parseInt(choice) - 1;

        if (index >= 0 && index < instances.length) {
            const instanceName = instances[index];
            try {
                execSync(`pm2 restart ${instanceName}`, { stdio: 'inherit' });
                console.log(`✅ Restarted ${instanceName}`);
            } catch (error) {
                console.log(`❌ Failed to restart ${instanceName}: ${error.message}`);
            }
        } else {
            console.log('Invalid instance number.');
        }
    }

    async stopInstance(instances) {
        const choice = await this.question('Enter instance number to stop: ');
        const index = parseInt(choice) - 1;

        if (index >= 0 && index < instances.length) {
            const instanceName = instances[index];
            try {
                execSync(`pm2 stop ${instanceName}`, { stdio: 'inherit' });
                console.log(`✅ Stopped ${instanceName}`);
            } catch (error) {
                console.log(`❌ Failed to stop ${instanceName}: ${error.message}`);
            }
        } else {
            console.log('Invalid instance number.');
        }
    }

    async deleteInstance(instances) {
        const choice = await this.question('Enter instance number to DELETE: ');
        const index = parseInt(choice) - 1;

        if (index >= 0 && index < instances.length) {
            const instanceName = instances[index];
            const config = this.getInstanceConfig(instanceName);

            console.log(`\n⚠️  WARNING: This will permanently delete:`);
            console.log(`- Instance: ${instanceName}`);
            console.log(`- Database: ${config.database.name}`);
            console.log(`- All files and uploads`);

            const confirm = await this.question('\nType "DELETE" to confirm: ');

            if (confirm === 'DELETE') {
                try {
                    // Stop PM2 process
                    try {
                        execSync(`pm2 delete ${instanceName}`, { stdio: 'pipe' });
                    } catch (e) {
                        // Process might not be running
                    }

                    // Drop database
                    execSync(`sudo -u postgres dropdb ${config.database.name}`, { stdio: 'pipe' });
                    execSync(`sudo -u postgres psql -c "DROP USER ${config.database.user}"`, { stdio: 'pipe' });

                    // Remove files
                    execSync(`rm -rf ${path.join(this.instancesDir, instanceName)}`, { stdio: 'pipe' });

                    console.log(`✅ Deleted ${instanceName} completely`);
                } catch (error) {
                    console.log(`❌ Failed to delete ${instanceName}: ${error.message}`);
                }
            } else {
                console.log('Deletion cancelled.');
            }
        } else {
            console.log('Invalid instance number.');
        }
    }

    async viewLogs(instances) {
        const choice = await this.question('Enter instance number to view logs: ');
        const index = parseInt(choice) - 1;

        if (index >= 0 && index < instances.length) {
            const instanceName = instances[index];

            console.log('\n📋 Choose log viewing option:');
            console.log('1. View last 50 lines');
            console.log('2. View last 100 lines');
            console.log('3. Follow logs (real-time) - Use Ctrl+C to exit');

            const logChoice = await this.question('Choose option (1-3): ');

            try {
                switch (logChoice) {
                    case '1':
                        execSync(`pm2 logs ${instanceName} --lines 50 --nostream`, { stdio: 'inherit' });
                        break;
                    case '2':
                        execSync(`pm2 logs ${instanceName} --lines 100 --nostream`, { stdio: 'inherit' });
                        break;
                    case '3':
                        console.log(`\nShowing real-time logs for ${instanceName}`);
                        console.log('Press Ctrl+C to return to menu\n');

                        // Spawn the process so we can handle Ctrl+C properly
                        const logProcess = spawn('pm2', ['logs', instanceName], {
                            stdio: 'inherit'
                        });

                        // Handle Ctrl+C gracefully
                        process.on('SIGINT', () => {
                            logProcess.kill('SIGTERM');
                            console.log('\n\nReturning to menu...\n');
                        });

                        // Wait for the log process to end
                        await new Promise((resolve) => {
                            logProcess.on('close', resolve);
                            logProcess.on('exit', resolve);
                        });
                        break;
                    default:
                        console.log('Invalid option.');
                }
            } catch (error) {
                console.log(`❌ Failed to show logs: ${error.message}`);
            }
        } else {
            console.log('Invalid instance number.');
        }
    }
}

// Run the script
if (require.main === module) {
    const manager = new InstanceManager();
    manager.manage().catch(console.error);
}

module.exports = InstanceManager;