#!/usr/bin/env node

// startup.js - Cross-platform DNA Analysis App startup script (IMPROVED VERSION)
const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');

console.log('=====================================');
console.log('DNA Analysis App - Automated Startup');
console.log('=====================================\n');

// Configuration
const CONFIG_FILE = 'client/src/config.js';
const BACKEND_FILE = 'server/index.js';
const FRONTEND_PORT = 3000;
const BACKEND_PORT = 5000;
const NGROK_API = 'http://localhost:4040/api/tunnels';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Helper functions for colored output
function log(message, color = 'reset') {
  console.log(colors[color] + message + colors.reset);
}

function logError(message) {
  log(`ERROR: ${message}`, 'red');
}

function success(message) {
  log(message, 'green');
}

function info(message) {
  log(message, 'cyan');
}

function warn(message) {
  log(message, 'yellow');
}

// Check if servers are responding (not just if ports are in use)
function checkServerHealth(port, path = '') {
  return new Promise((resolve) => {
    const url = `http://localhost:${port}${path}`;
    
    http.get(url, (res) => {
      resolve(res.statusCode < 400);
    }).on('error', () => {
      resolve(false);
    }).setTimeout(3000, () => {
      resolve(false);
    });
  });
}
function checkNpm() {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32';
    const npmCommand = isWindows ? 'npm.cmd --version' : 'npm --version';
    
    exec(npmCommand, (err, stdout) => {
      if (err) {
        logError('npm not found in PATH');
        logError('Please make sure Node.js is properly installed');
        if (isWindows) {
          logError('Windows users: try running this from Command Prompt or PowerShell where "npm --version" works');
          logError('You may need to restart your terminal after installing Node.js');
        }
        reject(new Error('npm not found'));
      } else {
        info(`npm version: ${stdout.trim()}`);
        resolve();
      }
    });
  });
}
function findNgrokConfigPath() {
  const possiblePaths = [];
  
  if (process.platform === 'win32') {
    // Windows paths
    possiblePaths.push(
      path.join(os.homedir(), 'AppData', 'Local', 'ngrok', 'ngrok.yml'),
      path.join(os.homedir(), '.ngrok2', 'ngrok.yml'),
      'ngrok.yml'
    );
  } else {
    // Unix/Linux/macOS paths
    possiblePaths.push(
      path.join(os.homedir(), '.config', 'ngrok', 'ngrok.yml'),
      path.join(os.homedir(), '.ngrok2', 'ngrok.yml'),
      'ngrok.yml'
    );
  }

  // Check if any of these paths exist
  for (const configPath of possiblePaths) {
    if (fs.existsSync(configPath)) {
      info(`Found ngrok config at: ${configPath}`);
      return configPath;
    }
  }

  warn('No ngrok config file found. Will try default ngrok behavior.');
  return null;
}

// Check if ngrok is installed and working
function checkNgrok() {
  return new Promise((resolve, reject) => {
    exec('ngrok version', (err, stdout) => {
      if (err) {
        logError('ngrok not found in PATH');
        logError('Please install ngrok and add it to your PATH');
        logError('Download from: https://ngrok.com/download');
        logError('After installing, run: ngrok config add-authtoken YOUR_TOKEN');
        reject(new Error('ngrok not found'));
      } else {
        info(`ngrok version: ${stdout.trim()}`);
        resolve();
      }
    });
  });
}

// Kill existing ngrok processes more reliably
function killExistingNgrok() {
  return new Promise((resolve) => {
    info('Cleaning up existing ngrok processes...');
    
    const isWindows = process.platform === 'win32';
    let killCommand;
    
    if (isWindows) {
      killCommand = 'taskkill /f /im ngrok.exe /t';
    } else {
      killCommand = 'pkill -f ngrok || killall ngrok';
    }
    
    exec(killCommand, (err) => {
      // Ignore errors - ngrok might not be running
      setTimeout(resolve, 1000); // Give it a moment to clean up
    });
  });
}

// Start ngrok tunnels with better error handling
function startNgrok() {
  return new Promise((resolve, reject) => {
    info('Starting ngrok tunnels...');
    
    // Find config file or use default
    const configPath = findNgrokConfigPath();
    
    let ngrokArgs = ['start'];
    if (configPath) {
      ngrokArgs.push('--config', configPath);
    }
    ngrokArgs.push('frontend', 'backend');
    
    info(`Running: ngrok ${ngrokArgs.join(' ')}`);
    
    const ngrok = spawn('ngrok', ngrokArgs, {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let ngrokOutput = '';
    let ngrokError = '';
    let hasResolved = false;

    ngrok.stdout.on('data', (data) => {
      const output = data.toString();
      ngrokOutput += output;
      
      // Print ngrok output but suppress too much noise
      const lines = output.split('\n').filter(line => {
        const l = line.toLowerCase();
        return !l.includes('web interface') && !l.includes('forwarding') && line.trim();
      });
      lines.forEach(line => console.log(`[ngrok] ${line}`));
    });

    ngrok.stderr.on('data', (data) => {
      const output = data.toString();
      ngrokError += output;
      console.error(`[ngrok stderr] ${output}`);
    });

    ngrok.on('exit', (code) => {
      if (code !== 0 && !hasResolved) {
        logError(`ngrok exited with code ${code}`);
        if (ngrokError) {
          logError('ngrok stderr:', ngrokError);
        }
        reject(new Error(`ngrok failed to start (exit code ${code})`));
      }
    });

    ngrok.on('error', (err) => {
      if (!hasResolved) {
        logError('ngrok spawn error:', err.message);
        reject(err);
      }
    });

    // Check if ngrok started successfully
    const checkNgrokStart = (attempt = 1, maxAttempts = 15) => {
      setTimeout(() => {
        http.get('http://localhost:4040/api/tunnels', (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              const tunnels = JSON.parse(data);
              if (tunnels.tunnels && tunnels.tunnels.length >= 2) {
                hasResolved = true;
                success('ngrok tunnels started successfully!');
                resolve();
              } else if (attempt < maxAttempts) {
                info(`Waiting for tunnels... (attempt ${attempt}/${maxAttempts})`);
                checkNgrokStart(attempt + 1, maxAttempts);
              } else {
                reject(new Error('ngrok tunnels not ready after waiting'));
              }
            } catch (e) {
              if (attempt < maxAttempts) {
                checkNgrokStart(attempt + 1, maxAttempts);
              } else {
                reject(new Error('Failed to parse ngrok API response'));
              }
            }
          });
        }).on('error', (err) => {
          if (attempt < maxAttempts) {
            checkNgrokStart(attempt + 1, maxAttempts);
          } else {
            logError('ngrok API not accessible. Common causes:');
            logError('1. ngrok config file missing or invalid');
            logError('2. Tunnel names "frontend" and "backend" not defined in ngrok.yml');
            logError('3. ngrok auth token not configured');
            logError('4. Firewall blocking ngrok');
            reject(new Error('ngrok API not accessible'));
          }
        });
      }, attempt === 1 ? 3000 : 2000); // First attempt waits longer
    };

    checkNgrokStart();
  });
}

// Fetch tunnel URLs with better error handling and validation
function getTunnelUrls(retries = 8) {
  return new Promise((resolve, reject) => {
    const makeRequest = (attempt) => {
      const req = http.get(NGROK_API, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            
            if (!response.tunnels || !Array.isArray(response.tunnels)) {
              throw new Error('Invalid ngrok API response format');
            }

            info(`Found ${response.tunnels.length} tunnel(s)`);
            
            // Log all tunnels for debugging
            response.tunnels.forEach((tunnel, i) => {
              console.log(`Tunnel ${i + 1}:`, {
                name: tunnel.name,
                addr: tunnel.addr || tunnel.config?.addr,
                configAddr: tunnel.config?.addr,
                publicUrl: tunnel.public_url
              });
            });

            // Look for tunnels that match our ports (handle different ngrok response formats)
            const frontendTunnel = response.tunnels.find(t => {
              const addr = t.config?.addr || t.addr;
              return addr && (
                addr === `localhost:${FRONTEND_PORT}` ||
                addr === `127.0.0.1:${FRONTEND_PORT}` ||
                addr === `http://localhost:${FRONTEND_PORT}` ||
                addr === `http://127.0.0.1:${FRONTEND_PORT}` ||
                addr.includes(`:${FRONTEND_PORT}`)
              );
            });
            
            const backendTunnel = response.tunnels.find(t => {
              const addr = t.config?.addr || t.addr;
              return addr && (
                addr === `localhost:${BACKEND_PORT}` ||
                addr === `127.0.0.1:${BACKEND_PORT}` ||
                addr === `http://localhost:${BACKEND_PORT}` ||
                addr === `http://127.0.0.1:${BACKEND_PORT}` ||
                addr.includes(`:${BACKEND_PORT}`)
              );
            });

            if (!frontendTunnel) {
              console.log(`DEBUG: Looking for frontend tunnel on port ${FRONTEND_PORT}`);
              response.tunnels.forEach((t, i) => {
                const addr = t.config?.addr || t.addr;
                console.log(`Tunnel ${i + 1} addr: "${addr}"`);
              });
              throw new Error(`No tunnel found for frontend (port ${FRONTEND_PORT})`);
            }
            
            if (!backendTunnel) {
              console.log(`DEBUG: Looking for backend tunnel on port ${BACKEND_PORT}`);
              response.tunnels.forEach((t, i) => {
                const addr = t.config?.addr || t.addr;
                console.log(`Tunnel ${i + 1} addr: "${addr}"`);
              });
              throw new Error(`No tunnel found for backend (port ${BACKEND_PORT})`);
            }

            if (!frontendTunnel.public_url || !backendTunnel.public_url) {
              throw new Error('Tunnel URLs not ready yet');
            }

            resolve({
              frontend: frontendTunnel.public_url,
              backend: backendTunnel.public_url
            });
          } catch (err) {
            if (attempt < retries) {
              warn(`Attempt ${attempt}: ${err.message}, retrying in 2 seconds...`);
              setTimeout(() => makeRequest(attempt + 1), 2000);
            } else {
              logError('Failed to get tunnel URLs after multiple attempts');
              logError('Make sure your ngrok.yml has these tunnel definitions:');
              logError(`
tunnels:
  frontend:
    addr: ${FRONTEND_PORT}
    proto: http
  backend:
    addr: ${BACKEND_PORT}
    proto: http`);
              reject(err);
            }
          }
        });
      });

      req.on('error', (err) => {
        if (attempt < retries) {
          warn(`API connection attempt ${attempt} failed, retrying...`);
          setTimeout(() => makeRequest(attempt + 1), 2000);
        } else {
          reject(new Error(`Failed to connect to ngrok API: ${err.message}`));
        }
      });

      req.setTimeout(5000, () => {
        req.destroy();
        if (attempt < retries) {
          setTimeout(() => makeRequest(attempt + 1), 2000);
        } else {
          reject(new Error('Timeout connecting to ngrok API'));
        }
      });
    };

    makeRequest(1);
  });
}

// Update frontend config.js with better validation
function updateFrontendConfig(backendUrl) {
  try {
    if (!fs.existsSync(path.dirname(CONFIG_FILE))) {
      logError(`Frontend config directory doesn't exist: ${path.dirname(CONFIG_FILE)}`);
      logError('Make sure you\'re running this script from the project root');
      return false;
    }

    const configContent = `// src/config.js
const config = {
    // API_BASE: process.env.REACT_APP_API_BASE || 'http://localhost:5000/api'
    API_BASE: process.env.REACT_APP_API_BASE || '${backendUrl}/api'
};

export default config;`;

    fs.writeFileSync(CONFIG_FILE, configContent);
    success(`Frontend config updated: ${backendUrl}/api`);
    return true;
  } catch (error) {
    logError(`Failed to update frontend config: ${error.message}`);
    return false;
  }
}

// Update backend CORS settings with better pattern matching
function updateBackendCors(frontendUrl, backendUrl) {
  try {
    if (!fs.existsSync(BACKEND_FILE)) {
      logError(`Backend file doesn't exist: ${BACKEND_FILE}`);
      return false;
    }

    let content = fs.readFileSync(BACKEND_FILE, 'utf8');
    
    // Create new origins array with all necessary URLs
    const newOrigins = [
      'http://localhost:3000',
      'http://localhost:3001', 
      frontendUrl,
      backendUrl
    ];
    
    const originsString = `['${newOrigins.join("', '")}']`;
    
    // More robust pattern matching for CORS origins
    const originPatterns = [
      /origin:\s*\[.*?\]/gs,
      /origin:\s*\[[^\]]*\]/g
    ];
    
    let updated = false;
    for (const pattern of originPatterns) {
      if (pattern.test(content)) {
        content = content.replace(pattern, `origin: ${originsString}`);
        updated = true;
        break;
      }
    }

    if (!updated) {
      warn('Could not find CORS origin pattern to update');
      warn('Please manually update your CORS configuration with:');
      warn(originsString);
      return false;
    }

    fs.writeFileSync(BACKEND_FILE, content);
    success(`Backend CORS updated with: ${frontendUrl}`);
    return true;
  } catch (error) {
    logError(`Failed to update backend CORS: ${error.message}`);
    return false;
  }
}

// Check if ports are available
function checkPort(port) {
  return new Promise((resolve) => {
    const server = require('net').createServer();
    
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    
    server.on('error', () => resolve(false));
  });
}

// Start backend server with better error handling
function startBackend() {
  return new Promise((resolve, reject) => {
    info('Starting backend server...');
    
    const serverDir = path.join(process.cwd(), 'server');
    
    if (!fs.existsSync(serverDir)) {
      logError(`Server directory doesn't exist: ${serverDir}`);
      reject(new Error('Server directory not found'));
      return;
    }
    
    if (!fs.existsSync(path.join(serverDir, 'index.js'))) {
      logError(`Backend entry file doesn't exist: ${path.join(serverDir, 'index.js')}`);
      reject(new Error('Backend entry file not found'));
      return;
    }
    
    const backend = spawn('node', ['index.js'], {
      stdio: 'inherit',
      cwd: serverDir
    });

    backend.on('error', (err) => {
      logError(`Failed to start backend: ${err.message}`);
      reject(err);
    });

    // Give the backend a moment to start
    setTimeout(() => resolve(backend), 2000);
  });
}

// Start frontend server with Windows npm handling
function startFrontend() {
  return new Promise((resolve, reject) => {
    info('Starting frontend server...');
    
    const clientDir = path.join(process.cwd(), 'client');
    
    if (!fs.existsSync(clientDir)) {
      logError(`Client directory doesn't exist: ${clientDir}`);
      reject(new Error('Client directory not found'));
      return;
    }
    
    if (!fs.existsSync(path.join(clientDir, 'package.json'))) {
      logError(`Client package.json doesn't exist: ${path.join(clientDir, 'package.json')}`);
      reject(new Error('Frontend package.json not found'));
      return;
    }
    
    // Handle Windows npm PATH issues
    const isWindows = process.platform === 'win32';
    let npmCommand = isWindows ? 'npm.cmd' : 'npm';
    
    // Test if npm command works
    try {
      require('child_process').execSync(`${npmCommand} --version`, { stdio: 'ignore' });
      info(`✅ npm found: ${npmCommand}`);
    } catch (e) {
      if (isWindows) {
        // Try alternative commands on Windows
        const alternatives = ['npm', 'npm.exe'];
        let found = false;
        
        for (const alt of alternatives) {
          try {
            require('child_process').execSync(`${alt} --version`, { stdio: 'ignore' });
            npmCommand = alt;
            found = true;
            info(`✅ npm found: ${npmCommand}`);
            break;
          } catch (e2) {
            // Continue
          }
        }
        
        if (!found) {
          logError('npm not found. Please ensure Node.js is installed and npm is in PATH');
          logError('Try opening a new Command Prompt and running: npm --version');
          reject(new Error('npm command not found'));
          return;
        }
      } else {
        logError('npm not found in PATH');
        logError('Please make sure Node.js and npm are installed');
        reject(new Error('npm command not found'));
        return;
      }
    }
    
    const frontend = spawn(npmCommand, ['start'], {
      stdio: 'inherit', 
      cwd: clientDir,
      shell: isWindows // Use shell on Windows for better compatibility
    });

    frontend.on('error', (err) => {
      logError(`Failed to start frontend: ${err.message}`);
      if (err.code === 'ENOENT') {
        logError('npm command not found. Make sure Node.js is installed and npm is in your PATH');
        logError('Windows users: try running this script from a Command Prompt or PowerShell where "npm --version" works');
      }
      reject(err);
    });

    // Give the frontend a moment to start
    setTimeout(() => resolve(frontend), 2000);
  });
}

// Validate project structure
function validateProjectStructure() {
  const requiredPaths = [
    { path: 'client', type: 'directory' },
    { path: 'server', type: 'directory' },
    { path: 'client/src', type: 'directory' },
    { path: 'server/index.js', type: 'file' },
    { path: 'client/package.json', type: 'file' }
  ];

  info('Validating project structure...');
  
  for (const item of requiredPaths) {
    const fullPath = path.join(process.cwd(), item.path);
    
    if (!fs.existsSync(fullPath)) {
      logError(`Missing ${item.type}: ${item.path}`);
      logError('Make sure you\'re running this script from your project root directory');
      return false;
    }
    
    if (item.type === 'directory' && !fs.statSync(fullPath).isDirectory()) {
      logError(`Expected directory but found file: ${item.path}`);
      return false;
    }
    
    if (item.type === 'file' && !fs.statSync(fullPath).isFile()) {
      logError(`Expected file but found directory: ${item.path}`);
      return false;
    }
  }
  
  success('Project structure validation passed');
  return true;
}

// Main startup function
async function startup() {
  try {
    // Validate project structure first
    if (!validateProjectStructure()) {
      process.exit(1);
    }

    // Check prerequisites
    await checkNgrok();
    await checkNpm();
    
    // Check if ports are available and if servers are healthy
    const frontendPortAvailable = await checkPort(FRONTEND_PORT);
    const backendPortAvailable = await checkPort(BACKEND_PORT);
    
    // Also check if servers are actually responding
    const backendHealthy = !backendPortAvailable ? await checkServerHealth(BACKEND_PORT, '/api/test') : false;
    const frontendHealthy = !frontendPortAvailable ? await checkServerHealth(FRONTEND_PORT) : false;
    
    if (!frontendPortAvailable) {
      if (frontendHealthy) {
        success(`✅ Frontend already running and healthy on port ${FRONTEND_PORT}`);
      } else {
        warn(`⚠️ Port ${FRONTEND_PORT} in use but frontend not responding - might be stuck`);
      }
    }
    
    if (!backendPortAvailable) {
      if (backendHealthy) {
        success(`✅ Backend already running and healthy on port ${BACKEND_PORT}`);
      } else {
        warn(`⚠️ Port ${BACKEND_PORT} in use but backend not responding - might be stuck`);
        warn('You may need to kill the process and restart');
      }
    }
    
    // Clean up any existing ngrok processes
    await killExistingNgrok();
    
    // Start ngrok
    await startNgrok();
    
    // Get tunnel URLs
    info('Fetching tunnel URLs...');
    const urls = await getTunnelUrls();
    
    console.log('\n=====================================');
    success('Tunnel URLs Retrieved:');
    console.log(`Frontend: ${colors.blue}${urls.frontend}${colors.reset}`);
    console.log(`Backend:  ${colors.blue}${urls.backend}${colors.reset}`);
    console.log('=====================================');
    
    info('📋 Frontend URL will be copied to clipboard when setup completes...');
    
    // Update configuration files
    const configUpdated = updateFrontendConfig(urls.backend);
    const corsUpdated = updateBackendCors(urls.frontend, urls.backend);
    
    if (!configUpdated || !corsUpdated) {
      logError('Failed to update configuration files');
      process.exit(1);
    }
    
    info('Configuration files updated successfully!');
    console.log(); // Add spacing
    
    // Start servers
    warn('Starting servers (this will take over the terminal)...');
    warn('Use Ctrl+C to stop both servers\n');
    
    let backendProcess = null;
    let frontendProcess = null;
    
    // Start backend only if port is available
    if (backendPortAvailable) {
      backendProcess = await startBackend();
      // Wait a bit for backend to fully start
      info('Waiting for backend to initialize...');
      await new Promise(resolve => setTimeout(resolve, 4000));
    } else {
      info('Skipping backend startup - port already in use');
    }
    
    // Start frontend only if port is available
    if (frontendPortAvailable) {
      frontendProcess = await startFrontend();
    } else {
      info('Skipping frontend startup - port already in use');
    }
    
    success('\n🎉 Services configured successfully!');
    
    // Copy frontend URL to clipboard
    await copyToClipboard(urls.frontend);
    
    // Big prominent display of the frontend URL
    console.log('\n' + '='.repeat(70));
    console.log('🧬  YOUR DNA ANALYSIS APP IS READY!  🧬');
    console.log('='.repeat(70));
    console.log(`\n🎯 ${colors.magenta}${colors.cyan}${urls.frontend}${colors.reset}`);
    console.log('\n📋 Frontend URL has been copied to your clipboard!');
    console.log('🌟 Just paste it in your browser to access your app!');
    console.log('='.repeat(70));
    
    console.log('\n📋 Quick Reference:');
    console.log(`Frontend: ${colors.cyan}${urls.frontend}${colors.reset} ${frontendPortAvailable ? '(starting...)' : '(already running)'}`);
    console.log(`Backend:  ${colors.cyan}${urls.backend}${colors.reset} ${backendPortAvailable ? '(starting...)' : '(already running)'}`);
    console.log(`ngrok UI: ${colors.cyan}http://localhost:4040${colors.reset}`);
    
    if (!frontendPortAvailable && !backendPortAvailable) {
      console.log('\n💡 Both servers appear to already be running. Your app should be accessible now!');
      console.log(`\n🚀 Open: ${colors.green}${urls.frontend}${colors.reset}`);
    } else {
      console.log('\nPress Ctrl+C to stop all services');
    }
    
    console.log(`\n💡 Tip: Run "${colors.yellow}node startup.js --url${colors.reset}" anytime to get the URL again!`);
    
    // Handle cleanup on exit
    const cleanup = () => {
      console.log('\n\n🛑 Shutting down services...');
      
      if (backendProcess && !backendProcess.killed) {
        info('Stopping backend server...');
        backendProcess.kill('SIGTERM');
      }
      
      if (frontendProcess && !frontendProcess.killed) {
        info('Stopping frontend server...');
        frontendProcess.kill('SIGTERM');
      }
      
      // Kill ngrok too
      info('Stopping ngrok tunnels...');
      exec(process.platform === 'win32' ? 'taskkill /f /im ngrok.exe' : 'pkill ngrok', () => {
        console.log('✅ All services stopped');
        process.exit(0);
      });
    };
    
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('exit', cleanup);
    
    // Keep the process alive
    await new Promise(() => {});
    
  } catch (err) {
    logError(err.message);
    console.log('\n🔧 Troubleshooting tips:');
    console.log('1. Make sure ngrok is installed: ngrok version');
    console.log('2. Check your ngrok auth token: ngrok config check');
    console.log('3. Verify your ngrok.yml has "frontend" and "backend" tunnels');
    console.log('4. Make sure you\'re in the project root directory');
    console.log('5. Try running manually: ngrok start frontend backend');
    process.exit(1);
  }
}

// Kill processes on specific ports (useful for cleanup)
function killProcessOnPort(port) {
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    
    if (isWindows) {
      // Windows: find and kill process on port
      exec(`netstat -ano | findstr :${port}`, (err, stdout) => {
        if (stdout) {
          const lines = stdout.trim().split('\n');
          const pids = lines
            .map(line => line.trim().split(/\s+/).pop())
            .filter(pid => pid && /^\d+$/.test(pid));
          
          if (pids.length > 0) {
            const killCommand = `taskkill /f /pid ${pids.join(' /pid ')}`;
            exec(killCommand, (err) => {
              if (!err) {
                info(`Killed process(es) on port ${port}`);
              }
              resolve();
            });
          } else {
            resolve();
          }
        } else {
          resolve();
        }
      });
    } else {
      // Unix/Linux/macOS
      exec(`lsof -ti:${port} | xargs kill -9`, () => resolve());
    }
  });
}

// Copy text to clipboard (cross-platform)
function copyToClipboard(text) {
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const isMac = process.platform === 'darwin';
    
    let command;
    if (isWindows) {
      command = `echo ${text} | clip`;
    } else if (isMac) {
      command = `echo "${text}" | pbcopy`;
    } else {
      // Linux - try multiple clipboard utilities
      command = `echo "${text}" | xclip -selection clipboard || echo "${text}" | xsel --clipboard --input`;
    }
    
    exec(command, (err) => {
      if (!err) {
        success('📋 Frontend URL copied to clipboard!');
      } else {
        warn('Could not copy to clipboard (but URL is displayed above)');
      }
      resolve(!err);
    });
  });
}

// Enhanced help text
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
🧬 DNA Analysis App Startup Script

Usage: node startup.js [options]

Options:
  --help, -h        Show this help message
  --tunnels-only    Start only ngrok tunnels (don't start servers)
  --no-config      Don't update config files
  --check          Check prerequisites without starting anything
  --kill-ports     Kill any processes on ports 3000 and 5000, then exit
  --url            Just show current ngrok URL and copy to clipboard

This script will:
1. ✅ Validate project structure
2. 🔍 Check ngrok installation and configuration  
3. 🚀 Start ngrok tunnels for frontend and backend
4. ⚙️  Update config.js with the new backend URL
5. 🌐 Update CORS settings with the new frontend URL
6. 🖥️  Start both frontend and backend servers

Prerequisites:
- ngrok installed and in PATH
- ngrok.yml configured (auto-detected)
- npm dependencies installed
- Project structure: client/ and server/ directories

For ngrok setup:
1. Install ngrok: https://ngrok.com/download
2. Get auth token: https://dashboard.ngrok.com/get-started/your-authtoken
3. Add token: ngrok config add-authtoken YOUR_TOKEN
4. This script expects tunnels named "frontend" and "backend" in your ngrok.yml
`);
  process.exit(0);
}

// Handle --check option
if (process.argv.includes('--check')) {
  (async () => {
    console.log('🔍 Running prerequisite checks...\n');
    
    try {
      await checkNgrok();
      const configPath = findNgrokConfigPath();
      
      if (configPath) {
        success(`✅ ngrok config found: ${configPath}`);
      } else {
        warn('⚠️ ngrok config file not found - will use default behavior');
      }
      
      if (validateProjectStructure()) {
        success('✅ Project structure is valid');
      }
      
      const frontendAvailable = await checkPort(FRONTEND_PORT);
      const backendAvailable = await checkPort(BACKEND_PORT);
      
      if (frontendAvailable) {
        success(`✅ Port ${FRONTEND_PORT} available`);
      } else {
        warn(`⚠️ Port ${FRONTEND_PORT} in use`);
      }
      
      if (backendAvailable) {
        success(`✅ Port ${BACKEND_PORT} available`);
      } else {
        warn(`⚠️ Port ${BACKEND_PORT} in use`);
      }
      
      console.log('\n🎉 All checks completed!');
      
    } catch (error) {
      logError(`❌ Check failed: ${error.message}`);
    }
  })();
} else if (process.argv.includes('--url')) {
  // Just show current ngrok URL and copy to clipboard
  (async () => {
    try {
      console.log('🔍 Checking for active ngrok tunnels...\n');
      
      // Check if ngrok is running
      const urls = await getTunnelUrls(3); // Only try 3 times for this
      
      // Display and copy URL
      console.log('='.repeat(70));
      console.log('🧬  CURRENT FRONTEND URL  🧬');
      console.log('='.repeat(70));
      console.log(`\n🎯 ${colors.magenta}${urls.frontend}${colors.reset}`);
      
      await copyToClipboard(urls.frontend);
      console.log('\n📋 URL copied to clipboard!');
      console.log('🌟 Just paste it in your browser to access your app!');
      console.log('='.repeat(70));
      
    } catch (error) {
      logError('No active ngrok tunnels found');
      console.log('💡 Run "node startup.js" to start your app first');
    }
  })();
} else if (process.argv.includes('--kill-ports')) {
  // Kill processes on our ports
  (async () => {
    console.log('🛑 Killing processes on ports 3000 and 5000...');
    await killProcessOnPort(3000);
    await killProcessOnPort(5000);
    success('✅ Ports cleared!');
  })();
} else if (process.argv.includes('--tunnels-only')) {
  // Just start tunnels and show URLs
  (async () => {
    try {
      await checkNgrok();
      await killExistingNgrok();
      await startNgrok();
      const urls = await getTunnelUrls();
      
      console.log('\n🌐 Tunnel URLs:');
      console.log(`Frontend: ${colors.green}${urls.frontend}${colors.reset}`);
      console.log(`Backend:  ${colors.green}${urls.backend}${colors.reset}`);
      console.log('\nPress Ctrl+C to stop tunnels');
      
      // Keep tunnels running
      await new Promise(() => {});
    } catch (error) {
      logError(error.message);
      process.exit(1);
    }
  })();
} else {
  // Full startup
  startup();
}