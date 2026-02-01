const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

// Basic CORS to allow front-end requests from file:// or other origins during dev
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

const DATA_FILE = path.join(__dirname, 'data', 'badminton_ladder_v2.json');

// Safe read helpers (create default if missing)
function safeReadJson(filePath, defaultValue) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
      return defaultValue;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw || JSON.stringify(defaultValue));
  } catch (err) {
    return defaultValue;
  }
}

function safeWriteJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Existing users endpoints (unchanged behavior, but resilient)
app.get('/users', (req, res) => {
  const data = safeReadJson(DATA_FILE, { users: [] });
  res.json(data);
});

// New endpoint for local player data
app.post('/api/player', (req, res) => {
  const payload = req.body;
  if (!payload || Object.keys(payload).length === 0) {
    return res.status(400).json({ error: 'Empty payload' });
  }

  const playersStore = safeReadJson(DATA_FILE, { players: [] });
  const newP = payload;
  const exists = playersStore.players.find(p => p.id === newP.id || p.name === newP.name);
  if (!exists) {
    playersStore.players.push(newP);
    safeWriteJson(DATA_FILE, playersStore);
    console.log('Added new player:', newP);
    res.status(201).json({ message: 'Player data saved', entry: newP });
  }
  else {
    console.log('Player already exists, not adding:', newP);
    res.status(409).json({ error: 'Player already exists' });
  }
});

// Delete player endpoint
app.delete('/api/player', (req, res) => {
  const playerId = req.body.id;
  console.log('Received delete request for playerId:', playerId);
  if (!playerId || Object.keys(playerId).length === 0) {
    return res.status(400).json({ error: 'Empty playerId' });
  }
  const playersStore = safeReadJson(DATA_FILE, { players: [] });
  const filteredPlayers = playersStore.players.filter(p => p.id !== playerId);
  if (filteredPlayers.length === playersStore.players.length) {
    return res.status(404).json({ error: 'Player not found' });
  }
  console.log('Deleting player with id:', playerId);
  playersStore.players = filteredPlayers;
  safeWriteJson(DATA_FILE, playersStore);
  res.json({ message: 'Player deleted successfully' });
});

// Serve static files (optional) - serves index.html / app.js if present
app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
