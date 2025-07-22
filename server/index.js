// Entry point for Node.js backend

const path = require('path');
const { spawn } = require('child_process');

console.log('Starting GPS Platform backend server...');

// Import and run the main server script
try {
  require(path.join(__dirname, 'gps-server.js'));
  console.log('GPS Platform backend server started successfully.');
} catch (error) {
  console.error('Failed to start GPS Platform backend server:', error);
  process.exit(1);
}