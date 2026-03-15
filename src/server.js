const express = require('express');
const path = require('path');
const { safeReadJson, safeWriteJson, logToFile, DATA_FILE, ADMIN_CONFIG_FILE } = require('./utils/fileUtils');
const { currentDateTime, sortPlayersByRanking, generateGroups, generateMatches, generateGroupsAndMatches, finishRound, autoFillScores, calculatePlayerStats, calculateAllPlayerAvgRankInCat, resetGroupLogic, rearrangeGroups } = require('./utils/dataUtils');

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
  const data = safeReadJson(DATA_FILE, { players: [], groups: [], matches: [], currentRound: 1, roundHistory: [] });
  sortPlayersByRanking(data.players);
  res.json(data);
});

// Endpoint to generate groups and matches for current round
app.put('/api/grouping', (req, res) => {
  logToFile('Request to generate groups');
  try {
    const msg = generateGroups();
    res.json({ message: msg });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/generateMatch', (req, res) => {
  logToFile('Request to generate matches');
  try {
    const msg = generateMatches();
    res.json({ message: msg });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to generate groups and matches together for current round
app.put('/api/generateGroupsAndMatches', (req, res) => {
  logToFile('Request to generate groups and matches');
  try {
    const msg = generateGroupsAndMatches();
    res.json({ message: msg });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/finishRound', (req, res) => {
  logToFile('Request to finish current round');
  try {
    const msg = finishRound();
    res.json({ message: msg });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/calculateAvgRank', (req, res) => {
  logToFile('Request to calculate average rank in category for all players');
  try {    calculateAllPlayerAvgRankInCat();
    res.json({ message: 'Average rank in category calculated for all players' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/randomScoring', (req, res) => {
  logToFile('Request to do random scoring');
  try {
    const msg = autoFillScores();
    res.json({ message: msg });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/rearrangeGroups', (req, res) => {
  try {
    const { category, newGroupSizes, currentRound } = req.body;
    
    if (!category || !newGroupSizes || !Array.isArray(newGroupSizes)) {
      return res.status(400).json({ success: false, message: '参数无效' });
    }
    
    const data = safeReadJson(DATA_FILE, { players: [], groups: [], matches: [], currentRound: 1, roundHistory: [], matchHistory: [] });
    const result = rearrangeGroups(data, category, newGroupSizes, currentRound);
    
    if (result.success) {
      safeWriteJson(DATA_FILE, data);
      res.json({ success: true, message: result.message });
    } else {
      res.status(400).json({ success: false, message: result.message });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/admin', (req, res) => {
  try {
    const adminInfo = safeReadJson(ADMIN_CONFIG_FILE, { username: 'admin', password: 'admin' });
    logToFile(`Admin login attempt: ${req.body.adminName}`);
    if (req.body.adminName === adminInfo.admin.username && req.body.adminPassword === adminInfo.admin.password) {
      res.status(200).json({ authenticated: true });
    } else {
      res.status(401).json({ authenticated: false, error: '用户名或密码错误！' });
    }
  } catch (error) {
    logToFile(`Admin login error: ${error.message}`);
    res.status(500).json({ authenticated: false, error: '服务器错误' });
  }
});

app.put('/api/calculateStats', (req, res) => {
  logToFile('Request to calculate player stats');
  try {
    calculatePlayerStats();
    res.json({ message: 'Player stats calculated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/resetGroup', (req, res) => {
  logToFile(`Request to reset a group with payload: ${JSON.stringify(req.body)}`);
  const payload = req.body;
  if (!payload || !payload.groupId || !payload.playerIds || !Array.isArray(payload.playerIds)) {
    return res.status(400).json({ error: 'Invalid payload. Required: groupId, playerIds array' });
  }
  
  try {
    const message = resetGroupLogic(payload.groupId, payload.playerIds);
    res.status(200).json({ message });
  } catch (error) {
    res.status(error.message === 'Group not found' ? 404 : 500).json({ error: error.message });
  }
});

// Mount API routes
app.use('/api/player', playerRoutes);
app.use('/api/match', matchRoutes);

// Serve static files (optional) - serves index.html / app.js if present
app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 80;
app.listen(PORT, '0.0.0.0', () => {
  logToFile(`Server is running on port ${PORT}`);
});
