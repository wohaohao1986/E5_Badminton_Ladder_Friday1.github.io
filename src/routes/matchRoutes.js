const express = require('express');
const { DATA_FILE, safeReadJson, safeWriteJson } = require('../utils/fileUtils');

const router = express.Router();

// POST: Add a new match
router.post('/', (req, res) => {
  const payload = req.body;
  if (!payload || Object.keys(payload).length === 0) {
    return res.status(400).json({ error: 'Empty payload' });
  }
  const matchesStore = safeReadJson(DATA_FILE, { matches: [] });
  const matchId = payload.id;
  const exist = matchesStore.matches.find(m => m.id === matchId);
  if (!exist) {
    matchesStore.matches.push(payload);
    safeWriteJson(DATA_FILE, matchesStore);
    res.status(201).json({ message: 'Match added successfully', entry: matchesStore.matches[matchesStore.matches.length - 1] });
  } else {
    res.status(409).json({ error: 'Match already exists' });
  }
});

// PUT: Update an existing match
router.put('/', (req, res) => {
  const payload = req.body;
  const matchesStore = safeReadJson(DATA_FILE, { matches: [] });
  const matchIndex = matchesStore.matches.findIndex(m => m.id === payload.id);
  if (matchIndex !== -1) {
    matchesStore.matches[matchIndex] = { ...matchesStore.matches[matchIndex], ...payload };
    safeWriteJson(DATA_FILE, matchesStore);
    res.json({ message: 'Match updated successfully', entry: matchesStore.matches[matchIndex] });
  } else {
    res.status(404).json({ error: 'Match not found' });
  }
});



module.exports = router;

