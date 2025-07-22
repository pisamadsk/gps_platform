// Node.js backend: Receives GPS data via UDP and broadcasts to clients via WebSocket
const dgram = require('dgram');
const WebSocket = require('ws');

const UDP_PORT = 4210; // Must match your GPS Nano sender
const WS_PORT = 8080;  // WebSocket port for frontend

// UDP Server
const udpServer = dgram.createSocket('udp4');
let lastGpsData = null;

udpServer.on('listening', () => {
  const address = udpServer.address();
  console.log(`UDP Server listening on ${address.address}:${address.port}`);
});

udpServer.on('message', (msg, rinfo) => {
  const data = msg.toString();
  lastGpsData = data;
  console.log(`Received UDP: ${data}`);
  // Broadcast to all WebSocket clients
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
});

udpServer.bind(UDP_PORT);

// WebSocket Server
const wss = new WebSocket.Server({ port: WS_PORT });
wss.on('connection', ws => {
  console.log('WebSocket client connected');
  // Send last known GPS data on connect
  if (lastGpsData) ws.send(lastGpsData);
});

console.log(`WebSocket Server running on ws://localhost:${WS_PORT}`);