const express = require('express');
const { DATA_FILE, safeReadJson, safeWriteJson, logToFile } = require('../utils/fileUtils');

const router = express.Router();

// POST: Add a new match or multiple matches
router.post('/', (req, res) => {
  const payload = req.body;
  if (!payload || (Array.isArray(payload) ? payload.length === 0 : Object.keys(payload).length === 0)) {
    return res.status(400).json({ error: 'Empty payload' });
  }

  const matchesStore = safeReadJson(DATA_FILE, { matches: [] });
  const matchesToAdd = Array.isArray(payload) ? payload : [payload];
  const duplicates = [];
  const added = [];

  matchesToAdd.forEach(match => {
    if (!match.id) {
      duplicates.push(`Match missing id`);
      return;
    }
    const exist = matchesStore.matches.find(m => m.id === match.id);
    if (!exist) {
      matchesStore.matches.push(match);
      added.push(match.id);
    } else {
      duplicates.push(match.id);
    }
  });

  if (added.length > 0) {
    safeWriteJson(DATA_FILE, matchesStore);
  }

  if (duplicates.length === 0) {
    res.status(201).json({ message: `${added.length} match(es) added successfully`, addedIds: added });
  } else {
    res.status(207).json({ 
      message: `${added.length} match(es) added, ${duplicates.length} duplicate(s) found`,
      addedIds: added,
      duplicates: duplicates 
    });
  }
});

// PUT: Update an existing match
router.put('/', (req, res) => {
  const payload = req.body;
  if (!payload || !payload.id) {
    return res.status(400).json({ error: 'Invalid payload. Required: id' });
  }
  const matchesStore = safeReadJson(DATA_FILE, { matches: [] });
  const matchIndex = matchesStore.matches.findIndex(m => m.id === payload.id);
  if (matchIndex !== -1) {
    matchesStore.matches[matchIndex] = { ...matchesStore.matches[matchIndex], ...payload };
    safeWriteJson(DATA_FILE, matchesStore);
    logToFile(`Match ${payload.id} updated with score ${payload.score1} : ${payload.score2}`);
    res.json({ message: 'Match updated successfully', entry: matchesStore.matches[matchIndex] });
  } else {
    res.status(404).json({ error: 'Match not found' });
  }
});



module.exports = router;

