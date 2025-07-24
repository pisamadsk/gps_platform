// Connect to backend WebSocket for live GPS data
// WebSocket connection with error handling
let ws;
let connectionStatus = 'Connecting...';

// Field boundaries (adjust to your GPS area)
//const lon_min = -9.7581925;
//const lon_max = -9.7567925;
//const lat_min = 31.51674333;
//const lat_max = 31.51814333;


const lon_min = -9.764519167;
const lon_max = -9.7639675;
const lat_min = 31.50500167;
const lat_max = 31.50639517;


const fieldWidth = 800;
const fieldHeight = 500;


const pitchCanvas = document.getElementById('pitchCanvas');
    const statsDiv = document.getElementById('gps-data');
    const playerTableBody = document.querySelector('#player-table tbody');

    let currentDrawWidth = 0;
    let currentDrawHeight = 0;
    let currentOffsetX = 0;
    let currentOffsetY = 0;

function connectWebSocket() {
  try {
    // Explicitly use wss:// for secure WebSocket connection to Render
    // Replace 'gps-platform-e6n5.onrender.com' with your actual Render URL if it changes
    ws = new WebSocket(`wss://gps-platform-e6n5.onrender.com`);
    
    ws.onopen = function() {
      connectionStatus = 'Connected';
      console.log('WebSocket connected');
      // updateConnectionStatus will be called by DOMContentLoaded listener
    };
    
    ws.onclose = function() {
      connectionStatus = 'Disconnected';
      console.log('WebSocket disconnected');
      updateConnectionStatus();
      // Try to reconnect after 3 seconds
      setTimeout(connectWebSocket, 3000);
    };
    
    ws.onerror = function(error) {
      connectionStatus = 'Error: ' + error.message;
      console.error('WebSocket error:', error);
      updateConnectionStatus();
    };
    
    ws.onmessage = function(event) {
      // Expecting JSON string from Arduino
      try {
        const gps = JSON.parse(event.data);
        // Ensure all expected fields are present and valid
        if (typeof gps.latitude === 'number' && typeof gps.longitude === 'number' && typeof gps.speed === 'number' && typeof gps.hdop === 'number') {
        // --- Analytics Calculation ---
        if (analyticsData.lastGps) {
          const dt = 1; // Assume 1s interval (adjust if you have real timestamps)
          const v1 = analyticsData.lastGps.speed / 3.6; // km/h to m/s
          const v2 = gps.speed / 3.6;
          const accel = (v2 - v1) / dt;
          analyticsData.velocities.push(v2);
          analyticsData.accelerations.push(accel);
          // Sprint detection
          if (v2 > sprintThreshold && v1 <= sprintThreshold) {
            analyticsData.sprints.push({ startIdx: analyticsData.velocities.length - 1, maxSpeed: v2 });
          } else if (v2 > sprintThreshold && analyticsData.sprints.length > 0) {
            const lastSprint = analyticsData.sprints[analyticsData.sprints.length - 1];
            if (v2 > lastSprint.maxSpeed) lastSprint.maxSpeed = v2;
          }
          // IMA placeholder: use abs(accel) as a proxy
          analyticsData.imaImpacts.push(Math.abs(accel));
        } else {
          // For the very first data point, initialize with current speed and zero acceleration/IMA
          analyticsData.velocities.push(gps.speed / 3.6);
          analyticsData.accelerations.push(0);
          analyticsData.imaImpacts.push(0);
        }
        analyticsData.lastGps = gps;

        // --- SMOOTHING (Moving Average) ---
        const smoothWindow = 5; // Use last 5 data points for smoothing
        if (analyticsData.velocities.length >= smoothWindow) {
            const lastFiveVelocities = analyticsData.velocities.slice(-smoothWindow);
            const smoothedVelocity = lastFiveVelocities.reduce((a, b) => a + b, 0) / smoothWindow;
            analyticsData.velocities[analyticsData.velocities.length - 1] = smoothedVelocity; // Update last entry

            const lastFiveAccelerations = analyticsData.accelerations.slice(-smoothWindow);
            const smoothedAcceleration = lastFiveAccelerations.reduce((a, b) => a + b, 0) / smoothWindow;
            analyticsData.accelerations[analyticsData.accelerations.length - 1] = smoothedAcceleration; // Update last entry
        }

        // --- Update Charts ---
        if (accelerationChart && velocityChart && sprintsChart && imaChart) {
            const newLabel = new Date().toLocaleTimeString();
            const maxDataPoints = 20; // Limit the number of points on the charts

            // Acceleration
            accelerationChart.data.labels.push(newLabel);
            accelerationChart.data.datasets[0].data.push(analyticsData.accelerations[analyticsData.accelerations.length - 1]);
            if (accelerationChart.data.labels.length > maxDataPoints) {
                accelerationChart.data.labels.shift();
                accelerationChart.data.datasets[0].data.shift();
            }
            accelerationChart.update('none');

            // Velocity
            velocityChart.data.labels.push(newLabel);
            velocityChart.data.datasets[0].data.push(analyticsData.velocities[analyticsData.velocities.length - 1]);
            if (velocityChart.data.labels.length > maxDataPoints) {
                velocityChart.data.labels.shift();
                velocityChart.data.datasets[0].data.shift();
            }
            velocityChart.update('none');
            
            // Sprints - Only update if there is a new sprint
            if (sprintsChart.data.datasets[0].data.length < analyticsData.sprints.length) {
                sprintsChart.data.labels = analyticsData.sprints.map((s, i) => `Sprint ${i + 1}`);
                sprintsChart.data.datasets[0].data = analyticsData.sprints.map(s => s.maxSpeed);
                sprintsChart.update();
            }

            // IMA
            imaChart.data.labels.push(newLabel);
            imaChart.data.datasets[0].data.push(analyticsData.imaImpacts[analyticsData.imaImpacts.length - 1]);
            if (imaChart.data.labels.length > maxDataPoints) {
                imaChart.data.labels.shift();
                imaChart.data.datasets[0].data.shift();
            }
            imaChart.update('none');
        }
        const { x, y } = gpsToXY(gps.latitude, gps.longitude);
        playerTrail.push({ x, y });
        if (playerTrail.length > maxTrailLength) playerTrail.shift();
        drawField();
        drawTrail(playerTrail);
        drawPlayer(x, y);
        updateStats(gps);
        addPlayerInfo(gps);
      } else {
        console.warn('Received incomplete or invalid GPS data:', gps);
      }
    } catch (e) {
      console.error('Failed to parse incoming message as JSON:', e);
      console.error('Received message:', event.data);
    }
    };
  } catch (error) {
    connectionStatus = 'Failed to connect: ' + error.message;
    console.error('Failed to create WebSocket:', error);
    updateConnectionStatus();
  }
}

function updateConnectionStatus() {
  statsDiv.innerHTML = `<p><strong>Connection Status:</strong> ${connectionStatus}</p><p>Waiting for GPS data...</p>`;
}

// Create canvas for drawing
const canvas = pitchCanvas;
canvas.width = canvas.offsetWidth;
canvas.height = canvas.offsetHeight;
const ctx = canvas.getContext('2d');

let playerTrail = [];
const maxTrailLength = 100;

// --- Analytics State ---
let analyticsData = {
  velocities: [], // m/s
  accelerations: [], // m/s^2
  sprints: [], // {startIdx, endIdx, maxSpeed}
  imaImpacts: [], // placeholder for IMA
  lastGps: null
};
const sprintThreshold = 7.0; // m/s (example: ~25 km/h)

// --- Chart.js Setup ---
let accelerationChart, velocityChart, sprintsChart, imaChart;

function initializeCharts() {
    if (typeof Chart === 'undefined') {
        console.error('Chart.js is not loaded.');
        return;
    }
    const accCtx = document.getElementById('accelerationCanvas').getContext('2d');
    accelerationChart = new Chart(accCtx, { type: 'line', data: { labels: [], datasets: [{ label: 'Acceleration', data: [], borderColor: '#38bdf8', fill: false, tension: 0.1 }] }, options: { scales: { x: { title: { display: true, text: 'Time' }, grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#f0f0f0' } }, y: { title: { display: true, text: 'm/s²' }, grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#f0f0f0' } } } } });
    const velCtx = document.getElementById('velocityCanvas').getContext('2d');
    velocityChart = new Chart(velCtx, { type: 'line', data: { labels: [], datasets: [{ label: 'Velocity', data: [], borderColor: '#22d3ee', fill: false, tension: 0.1 }] }, options: { scales: { x: { title: { display: true, text: 'Time' }, grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#f0f0f0' } }, y: { title: { display: true, text: 'm/s' }, grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#f0f0f0' } } } } });
    const sprCtx = document.getElementById('sprintsCanvas').getContext('2d');
    sprintsChart = new Chart(sprCtx, { type: 'bar', data: { labels: [], datasets: [{ label: 'Sprint Max Speed', data: [], backgroundColor: '#f87171' }] }, options: { scales: { x: { title: { display: true, text: 'Sprint #' }, grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#f0f0f0' } }, y: { beginAtZero: true, title: { display: true, text: 'Max Speed (m/s)' }, grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#f0f0f0' } } } } });
    const imaCtx = document.getElementById('imaCanvas').getContext('2d');
    imaChart = new Chart(imaCtx, { type: 'line', data: { labels: [], datasets: [{ label: 'IMA Impact', data: [], borderColor: '#a78bfa', fill: false, tension: 0.1 }] }, options: { scales: { x: { title: { display: true, text: 'Time' }, grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#f0f0f0' } }, y: { title: { display: true, text: 'IMA' }, grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#f0f0f0' } } } } });
}

window.addEventListener('DOMContentLoaded', initializeCharts);

function drawField() {
    // Ensure the canvas is sized correctly relative to its container
    const container = document.getElementById('pitch-map');
    canvas.width = container.offsetWidth;
    canvas.height = container.offsetHeight;

    const pitchAspectRatio = 105 / 68; // Standard pitch ratio
    let drawWidth = canvas.width;
    let drawHeight = canvas.width / pitchAspectRatio;

    if (drawHeight > canvas.height) {
        drawHeight = canvas.height;
        drawWidth = canvas.height * pitchAspectRatio;
    }

    const offsetX = (canvas.width - drawWidth) / 2;
    const offsetY = (canvas.height - drawHeight) / 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(offsetX, offsetY);

    // Field color
    ctx.fillStyle = '#6abF4b'; // A nice green for the pitch
    ctx.fillRect(0, 0, drawWidth, drawHeight);

    // White lines
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;

    // Outer lines
    ctx.strokeRect(0, 0, drawWidth, drawHeight);

    // Center line
    ctx.beginPath();
    ctx.moveTo(drawWidth / 2, 0);
    ctx.lineTo(drawWidth / 2, drawHeight);
    ctx.stroke();

    const centerX = drawWidth / 2;
    const centerY = drawHeight / 2;
    const meter = drawWidth / 105; // Assume 105 meters width

    // Center circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, 9.15 * meter, 0, 2 * Math.PI, false);
    ctx.stroke();

    // Center spot
    ctx.beginPath();
    ctx.arc(centerX, centerY, 0.3 * meter, 0, 2 * Math.PI, false);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Penalty areas (16.5m x 40.3m)
    const penaltyAreaWidth = 16.5 * meter;
    const penaltyAreaHeight = 40.3 * meter;
    // Left
    ctx.strokeRect(0, (drawHeight - penaltyAreaHeight) / 2, penaltyAreaWidth, penaltyAreaHeight);
    // Right
    ctx.strokeRect(drawWidth - penaltyAreaWidth, (drawHeight - penaltyAreaHeight) / 2, penaltyAreaWidth, penaltyAreaHeight);

    // Goal areas (5.5m x 18.32m)
    const goalAreaWidth = 5.5 * meter;
    const goalAreaHeight = 18.32 * meter;
    // Left
    ctx.strokeRect(0, (drawHeight - goalAreaHeight) / 2, goalAreaWidth, goalAreaHeight);
    // Right
    ctx.strokeRect(drawWidth - goalAreaWidth, (drawHeight - goalAreaHeight) / 2, goalAreaWidth, goalAreaHeight);
    
    // Goals (7.32m wide)
    const goalWidth = 7.32 * meter;
    const goalPostOffset = (drawHeight - goalWidth) / 2;
    ctx.strokeRect(-2 * meter, goalPostOffset, 2*meter, goalWidth);
    ctx.strokeRect(drawWidth, goalPostOffset, 2*meter, goalWidth);

    // Penalty spots (11m from goal line)
    const penaltySpotDist = 11 * meter;
    // Left
    ctx.beginPath();
    ctx.arc(penaltySpotDist, centerY, 0.3 * meter, 0, 2 * Math.PI, false);
    ctx.fill();
    // Right
    ctx.beginPath();
    ctx.arc(drawWidth - penaltySpotDist, centerY, 0.3 * meter, 0, 2 * Math.PI, false);
    ctx.fill();

    // Penalty arcs
    const penaltyArcRadius = 9.15 * meter;
    // Left
    ctx.beginPath();
    ctx.arc(penaltySpotDist, centerY, penaltyArcRadius, -0.98, 0.98, false);
    ctx.stroke();
    // Right
    ctx.beginPath();
    ctx.arc(drawWidth - penaltySpotDist, centerY, penaltyArcRadius, Math.PI - 0.98, Math.PI + 0.98, false);
    ctx.stroke();

    // Corner arcs (1m radius)
    const cornerRadius = 1 * meter;
    // Top-left
    ctx.beginPath();
    ctx.arc(0, 0, cornerRadius, 0, Math.PI / 2, false);
    ctx.stroke();
    // Top-right
    ctx.beginPath();
    ctx.arc(drawWidth, 0, cornerRadius, Math.PI / 2, Math.PI, false);
    ctx.stroke();
    // Bottom-left
    ctx.beginPath();
    ctx.arc(0, drawHeight, cornerRadius, -Math.PI / 2, 0, false);
    ctx.stroke();
    // Bottom-right
    ctx.beginPath();
    ctx.arc(drawWidth, drawHeight, cornerRadius, Math.PI, -Math.PI / 2, false);
    ctx.stroke();

    ctx.restore(); // Restore the context to remove the translation

    currentDrawWidth = drawWidth;
    currentDrawHeight = drawHeight;
    currentOffsetX = offsetX;
    currentOffsetY = offsetY;
}

// Redraw the field on window resize to maintain aspect ratio
window.addEventListener('resize', () => {
    // A small debounce to prevent excessive redraws
    setTimeout(drawField, 100);
});

function drawPlayer(x, y) {
  ctx.beginPath();
  ctx.arc(x, y, 8, 0, 2 * Math.PI); // Reduced player size for a cleaner look
  ctx.fillStyle = 'yellow';
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawTrail(trail) {
  if (trail.length < 2) return;
  for (let i = 0; i < trail.length; i++) {
    const point = trail[i];
    const age = trail.length - i;
    const opacity = Math.max(0, 1 - age / maxTrailLength);
    const radius = Math.max(1, 5 - age / (maxTrailLength / 4));

    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = `rgba(255, 255, 0, ${opacity * 0.7})`; // Yellow heatmap
    ctx.fill();
  }
}

function updateStats(gps) {
  statsDiv.innerHTML = `<b>Latitude:</b> ${gps.latitude}<br>
    <b>Longitude:</b> ${gps.longitude}<br>
    <b>Speed:</b> ${gps.speed} km/h<br>
    <b>Date:</b> ${gps.date}<br>
    <b>Time:</b> ${gps.time}<br>
    <b>HDOP:</b> ${gps.hdop}`;
}

function addPlayerInfo(gps) {
  const row = document.createElement('tr');
  const timeCell = document.createElement('td');
  timeCell.textContent = gps.time;
  const latCell = document.createElement('td');
  latCell.textContent = gps.latitude.toFixed(6);
  const lonCell = document.createElement('td');
  lonCell.textContent = gps.longitude.toFixed(6);
  const speedCell = document.createElement('td');
  speedCell.textContent = gps.speed.toFixed(2);
  row.appendChild(timeCell);
  row.appendChild(latCell);
  row.appendChild(lonCell);
  row.appendChild(speedCell);
  playerTableBody.appendChild(row);
  // Limit table rows
  if (playerTableBody.rows.length > 20) {
    playerTableBody.deleteRow(0);
  }
}

function gpsToXY(lat, lon) {
  // Map GPS coordinates to field canvas, using dynamic draw dimensions and offsets
  const x = (lon - lon_min) / (lon_max - lon_min) * currentDrawWidth + currentOffsetX;
  const y = currentDrawHeight - (lat - lat_min) / (lat_max - lat_min) * currentDrawHeight + currentOffsetY;
  return { x, y };
}

drawField();

document.addEventListener('DOMContentLoaded', () => {
  connectWebSocket();
  if (statsDiv) {
    statsDiv.innerHTML = '<p>Waiting for GPS data...</p>';
    updateConnectionStatus(); // Call it here after statsDiv is guaranteed to be initialized
  }
});
