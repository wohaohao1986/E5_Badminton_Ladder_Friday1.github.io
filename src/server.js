const express = require('express');
const path = require('path');
const { safeReadJson } = require('./utils/fileUtils');
const { DATA_FILE } = require('./utils/fileUtils');

// Import route handlers
const playerRoutes = require('./routes/playerRoutes');
const matchRoutes = require('./routes/matchRoutes');

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
  const data = safeReadJson(DATA_FILE, { players: [], groups: [], matches: [], currentRound: 1, adminPassword: 'e52026', rankingModified: false, roundHistory: [] });
  
  // Sort players by category and ranking before sending to client
  const CATEGORIES = { male: '男双', female: '女双', fun: '娱乐' };
  Object.keys(CATEGORIES).forEach(cat => {
    const catPlayers = data.players.filter(p => p.category === cat);
    catPlayers.sort((a, b) => a.ranking - b.ranking);
  });
  
  res.json(data);
});

// Mount API routes
app.use('/api/player', playerRoutes);
app.use('/api/match', matchRoutes);

// Serve static files (optional) - serves index.html / app.js if present
app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
