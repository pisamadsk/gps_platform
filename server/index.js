// Node.js backend: Receives GPS data via UDP and broadcasts to clients via WebSocket
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 8080;

// Serve static files from the 'client' directory
app.use(express.static(path.join(__dirname, '../client')));

let lastGpsData = null;

wss.on('connection', ws => {
  console.log('WebSocket client connected');
  if (lastGpsData) {
    ws.send(lastGpsData);
  }

  ws.on('message', message => {
    // Assuming GPS data might also come from WebSocket clients in some scenarios
    // For this application, it's primarily for broadcasting, but good to have.
    try {
      const parsedMessage = JSON.parse(message.toString());
      lastGpsData = JSON.stringify(parsedMessage); // Store as stringified JSON
      wss.clients.forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(lastGpsData); // Send the stringified JSON
        }
      });
    } catch (error) {
      console.error('Failed to parse incoming message as JSON:', error);
      console.error('Received message:', message.toString());
    }
      }
    });
  });

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });

  ws.on('error', error => {
    console.error('WebSocket error:', error);
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Serving static files from ${path.join(__dirname, '../client')}`);
});

// This part is for receiving data from a source (e.g., a simulated GPS sender)
// For the purpose of this deployment, we'll assume data comes from elsewhere
// or is simulated. If you need to re-introduce UDP, it would be a separate service.
// For now, we'll keep lastGpsData updated via a simple interval for testing purposes
// or expect it to be updated by an external source.

// Example: Simulate GPS data for testing if no external source is connected
// setInterval(() => {
//   const simulatedData = `GPS_DATA:${Date.now()}:Lat:${(Math.random() * 0.001) + 31.504920}:Lon:${(Math.random() * 0.001) - 9.764338}`;
//   lastGpsData = simulatedData;
//   wss.clients.forEach(client => {
//     if (client.readyState === WebSocket.OPEN) {
//       client.send(simulatedData);
//     }
//   });
// }, 2000); // Send simulated data every 2 seconds