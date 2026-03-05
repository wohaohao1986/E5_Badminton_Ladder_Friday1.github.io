const express = require('express');
const { DATA_FILE, safeReadJson, safeWriteJson } = require('../utils/fileUtils');
const { generateRoundRobinMatches, rerankPlayer } = require('../utils/dataUtils');
const router = express.Router();

// POST: Add a new group or multiple groups
router.post('/', (req, res) => {
  const payload = req.body;
  if (!payload || (Array.isArray(payload) ? payload.length === 0 : Object.keys(payload).length === 0)) {
    return res.status(400).json({ error: 'Empty payload' });
  }

  const groupsStore = safeReadJson(DATA_FILE, { groups: [] });
  const groupsToAdd = Array.isArray(payload) ? payload : [payload];
  const duplicates = [];
  const added = [];
  
  groupsToAdd.forEach(group => {
    if (!group.id) {
      duplicates.push(`Group missing id`);
      return;
    }
    const exist = groupsStore.groups.find(g => g.id === group.id);
    if (!exist) {
      groupsStore.groups.push(group);
      added.push(group.id);
    } else {
      duplicates.push(group.id);
    }
  });

  if (added.length > 0) {
    safeWriteJson(DATA_FILE, groupsStore);
  }

  if (duplicates.length === 0) {
    res.status(201).json({ message: `${added.length} group(s) added successfully`, addedIds: added });
  } else {
    res.status(207).json({ 
      message: `${added.length} group(s) added, ${duplicates.length} duplicate(s) found`,
      addedIds: added,
      duplicates: duplicates 
    });
  }
});

router.put('/resetGroup', (req, res) => {
  const payload = req.body;
  if (!payload || !payload.groupId || !payload.playerIds || !Array.isArray(payload.playerIds)) {
    return res.status(400).json({ error: 'Invalid payload. Required: groupId, playerIds array' });
  }
  
  const { groupId, playerIds } = payload;
  const data = safeReadJson(DATA_FILE, { players: [], groups: [], matches: [], currentRound: 1 });
  
  // Find the group
  const group = data.groups.find(g => g.id === groupId);
  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }
  
  // Get the category from the group
  const category = group.category;
  
  // 1. Remove all matches in current round of this group
  data.matches = data.matches.filter(m => !(m.round === data.currentRound && m.groupId === groupId));
  
  // 2. Regenerate matches for selected players
  const newMatches = generateRoundRobinMatches(playerIds, data.currentRound, groupId);
  data.matches.push(...newMatches);
  
  // 3. For rest of players, deactivate them and re-rank
  const deactivatePlayerIds = group.playerIds.filter(id => !playerIds.includes(id));
  
  // Write data before reranking to have updated state
  safeWriteJson(DATA_FILE, data);
  
  deactivatePlayerIds.forEach(playerId => {
    const playerIdx = data.players.findIndex(p => p.id === playerId);
    if (playerIdx !== -1) {
      rerankPlayer(playerIdx, null, false);
    }
  });
  
  // Re-load data after reranking operations
  data = safeReadJson(DATA_FILE);
  
  // Remove deactivated players from the group
  group.playerIds = playerIds;
  
  // 4. Write data back to file
  safeWriteJson(DATA_FILE, data);
  
  res.status(200).json({ message: `Group ${groupId} has been reset with ${playerIds.length} players` });
});

// DELETE: Remove a group or multiple groups
router.delete('/', (req, res) => {
  const payload = req.body;
  if (!payload || (Array.isArray(payload) ? payload.length === 0 : !payload.id)) {
    return res.status(400).json({ error: 'Empty or invalid payload' });
  }

  const groupsStore = safeReadJson(DATA_FILE, { groups: [] });
  const idsToDelete = Array.isArray(payload) ? payload.map(g => g.id) : [payload.id];
  const notFound = [];
  const deleted = [];

  idsToDelete.forEach(id => {
    const existIndex = groupsStore.groups.findIndex(g => g.id === id);
    if (existIndex !== -1) {
      groupsStore.groups.splice(existIndex, 1);
      deleted.push(id);
    } else {
      notFound.push(id);
    }
  });

  if (deleted.length > 0) {
    safeWriteJson(DATA_FILE, groupsStore);
  }

  if (notFound.length === 0) {
    res.json({ message: `${deleted.length} group(s) deleted successfully`, deletedIds: deleted });
  } else {
    res.status(207).json({ 
      message: `${deleted.length} group(s) deleted, ${notFound.length} not found`,
      deletedIds: deleted,
      notFound: notFound 
    });
  }
});

module.exports = router;