# GPS Platform Backend

## Setup

1. Install Node.js (if not already installed): https://nodejs.org/
2. Open a terminal in this directory (`server/`).
3. Run:
   ```
   npm install
   ```
4. Start the backend server:
   ```
   npm start
   ```

- The server will listen for GPS data via UDP on port 4210.
- It will broadcast GPS data to frontend clients via WebSocket on port 8080.

## Files
- `gps-server.js`: Main backend logic (UDP + WebSocket)
- `package.json`: Dependencies and scripts