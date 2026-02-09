const express = require('express');
const path = require('path');
const { safeReadJson, safeWriteJson } = require('./utils/fileUtils');
const { DATA_FILE, ADMIN_CONFIG_FILE } = require('./utils/fileUtils');
const { sortPlayersByCategoryAndRanking, generateGroups, generateMatches, finishRound } = require('./utils/dataUtils');

// Import route handlers
const playerRoutes = require('./routes/playerRoutes');
const matchRoutes = require('./routes/matchRoutes');
const groupRoutes = require('./routes/groupRoute');

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

// Endpoint to get main data
app.get('/api/main', (req, res) => {
  const data = safeReadJson(DATA_FILE, { players: [], groups: [], matches: [], currentRound: 1, roundHistory: [] });
  data.players = sortPlayersByCategoryAndRanking(data.players);
  safeWriteJson(DATA_FILE, data); // Ensure players are always sorted in storage
  res.json(data);
});

// Endpoint to generate groups and matches for current round
app.post('/api/grouping', (req, res) => {
  try {
    const msg = generateGroups();
    res.json({ message: msg });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/generateMatch', (req, res) => {
  try {
    const msg = generateMatches();
    res.json({ message: msg });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/finishRound', (req, res) => {
  try {
    const msg = finishRound();
    res.json({ message: msg });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin', (req, res) => {
  const adminInfo = safeReadJson(ADMIN_CONFIG_FILE, { username: 'admin', password: 'admin' });
  console.log('Admin login attempt:', req.body.adminName, req.body.adminPassword);
  if(req.body.adminName === adminInfo.admin.username && req.body.adminPassword === adminInfo.admin.password) {
    res.status(200).json({ authenticated: true });
  } else {
    res.status(401).json({ authenticated: false, error: '用户名或密码错误！' });
  }
});

// Mount API routes
app.use('/api/player', playerRoutes);
app.use('/api/match', matchRoutes);
app.use('/api/group', groupRoutes);

// Serve static files (optional) - serves index.html / app.js if present
app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 80;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
