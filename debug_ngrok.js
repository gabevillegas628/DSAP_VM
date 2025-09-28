#!/usr/bin/env node

// debug-ngrok.js - Simple script to debug ngrok setup
const { exec } = require('child_process');
const http = require('http');

console.log('=== NGROK DEBUG SCRIPT ===\n');

// Step 1: Check if ngrok is running
console.log('1. Checking if ngrok is running...');
http.get('http://localhost:4040/api/tunnels', (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      console.log('✅ ngrok API accessible');
      console.log('📊 Raw tunnel data:');
      console.log(JSON.stringify(result, null, 2));
      
      if (result.tunnels && result.tunnels.length > 0) {
        console.log('\n🔍 Found tunnels:');
        result.tunnels.forEach((tunnel, i) => {
          console.log(`  Tunnel ${i + 1}:`);
          console.log(`    Name: ${tunnel.name || 'unnamed'}`);
          console.log(`    URL: ${tunnel.public_url}`);
          console.log(`    Local: ${tunnel.config ? tunnel.config.addr : 'unknown'}`);
          console.log(`    Proto: ${tunnel.proto}`);
          console.log('');
        });
      } else {
        console.log('❌ No tunnels found');
      }
    } catch (err) {
      console.log('❌ Error parsing ngrok API response:', err.message);
      console.log('Raw response:', data);
    }
  });
}).on('error', (err) => {
  console.log('❌ ngrok API not accessible:', err.message);
  console.log('\n🔧 Troubleshooting steps:');
  console.log('1. Make sure ngrok is running');
  console.log('2. Try manually: ngrok start frontend backend');
  console.log('3. Check if your ngrok.yml has the right tunnel names');
  console.log('4. Verify ngrok.yml location: C:/Users/gabev/AppData/Local/ngrok/ngrok.yml');
  console.log('\n📋 Your ngrok.yml should look like:');
  console.log(`
version: "3"
agent:
    authtoken: YOUR_TOKEN

tunnels:
  frontend:
    addr: 3000
    proto: http
  backend:
    addr: 5000
    proto: http
`);
});

// Step 2: Test manual ngrok command
console.log('\n2. Testing ngrok command...');
exec('ngrok start frontend backend', (error, stdout, stderr) => {
  if (error) {
    console.log('❌ Error running ngrok command:', error.message);
  } else {
    console.log('✅ ngrok command executed');
  }
});