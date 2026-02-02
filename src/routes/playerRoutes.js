const express = require('express');
const { DATA_FILE, safeReadJson, safeWriteJson } = require('../utils/fileUtils');
const { CATEGORIES, removeMatchesOnly } = require('../utils/dataUtils');
const router = express.Router();

// POST: Add a new player
router.post('/', (req, res) => {
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
    const message = checkAndPromptRegroup(newP.category);

    res.status(201).json({ message: message });
  }
  else {
    console.log('Player already exists, not adding:', newP);
    res.status(201).json({ message: '该选手已存在，无法添加' });
  }
});

// PUT: Update an existing player
router.put('/', (req, res) => {
  const payload = req.body;
  const playersStore = safeReadJson(DATA_FILE, { players: [] });
  const playerIndex = playersStore.players.findIndex(p => p.id === payload.id);
  let result = null;
  if (playerIndex !== -1) {

    // Handle category change
    if ('category' in payload) {
      console.log(`Player category changed to ${payload.category}\nGoing to check category counts...`);
      result = checkCategoriesAfterChange(playersStore.players[playerIndex].category, payload.category, playersStore);
    }

    // Update player info
    playersStore.players[playerIndex] = { ...playersStore.players[playerIndex], ...payload };
    safeWriteJson(DATA_FILE, playersStore);

    // Handle active status change
    if ('active' in payload) {
      let msg = '';
      if(payload.active){
        console.log(`Player activated in category ${playersStore.players[playerIndex].category}\nGoing to check category counts...`);
        msg = checkAndPromptRegroup(playersStore.players[playerIndex].category, playersStore);
      }
      else {
        console.log(`Player deactivated in category ${playersStore.players[playerIndex].category}\nGoing to handle deactivation...`);
        msg = handleDeactivation(playersStore.players[playerIndex].id, playersStore.players[playerIndex].category, playersStore);
      }
      if (msg) {
          res.status(201).json({ message: msg });
          return;
        }
    }

    console.log('Updated player:', playersStore.players[playerIndex]);
    if (result && result.hasWarning) {
      res.status(200).json({ status: 'warning', message: result.message });
    } else {
      res.json({ message: 'Player updated successfully', entry: playersStore.players[playerIndex] });
    }
  } else {
    console.log('Player not found for update:', payload);
    res.status(404).json({ error: 'Player not found' });
  }
});

// DELETE: Remove a player
router.delete('/', (req, res) => {
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

// Helper function to check category counts after player category change
function checkCategoriesAfterChange(oldCat, newCat, playersStore) {
  const CATEGORIES_MAP = {
    male: '男双',
    female: '女双',
    fun: '娱乐'
  };
  
  const oldCatActive = playersStore.players.filter(p => p.active && p.category === oldCat).length;
  const newCatActive = playersStore.players.filter(p => p.active && p.category === newCat).length;
  
  let message = '类别人数变化：\n';
  
  if (oldCatActive === 3 || oldCatActive === 7) {
    message += `${CATEGORIES[oldCat]}现有${oldCatActive}人，无法分组，请添加/启用或停用选手\n`;
    removeMatchesOnly(oldCat);
  }
  
  if (newCatActive === 7) {
    message += `${CATEGORIES[newCat]}现有${newCatActive}人，无法分组，请添加/启用或停用选手\n`;
    removeMatchesOnly(newCat);
  }
  
  if (oldCatActive === 3 || oldCatActive === 7 || newCatActive === 7) {
    return {hasWarning: true, message: message};
  }
  
  if (oldCatActive >= 4 || newCatActive >= 4) {
    message += `\n${CATEGORIES[oldCat]}: ${oldCatActive}人\n${CATEGORIES[newCat]}: ${newCatActive}人\n\n可以生成分组了，请在分组管理中点击“生成本轮分组”按钮`;
  }
}

function checkAndPromptRegroup(category, playersStore) {
  const activePlayers = playersStore.players.filter(p => p.active && p.category === category);
  const total = activePlayers.length;

  let message = '';
  
  if (total < 4) {
    message = `${CATEGORIES[category]}只有${total}人，至少需要4人才能分组`;
    removeMatchesOnly(category);
  }
  else if (total === 7) {
    message = `${CATEGORIES[category]}有7人无法分组\n请再添加/启用一人，或停用一人`;
    removeMatchesOnly(category);
  }
  else {
    message = `${CATEGORIES[category]}现有${total}人参赛\n可以生成分组了，请在分组管理中点击“生成本轮分组”按钮`;
  }
  return message;
}

function handleDeactivation(playerId, category, playersStore) {
  if (playersStore.groups.length === 0) return;
  
  const group = playersStore.groups.find(g => g.playerIds.includes(playerId));
  if (!group) return;
  
  group.playerIds = group.playerIds.filter(id => id !== playerId);
  const newSize = group.playerIds.length;
  
  if (newSize === 3) {
    removeMatchesOnly(category);
    return `${CATEGORIES[category]}第${group.level}组只剩3人\n请添加/启用一人，或重新分组`;
  } else if (newSize >= 4 && newSize <= 6) {
    const newMatches = generateMatches(group.id, group.playerIds, playersStore.currentRound).map(m => ({...m, category: group.category}));
    playersStore.matches = playersStore.matches.filter(m => m.groupId !== group.id || m.round !== playersStore.currentRound);
    playersStore.matches.push(...newMatches);
    safeWriteJson(DATA_FILE, playersStore);
    return `${CATEGORIES[category]}第${group.level}组已调整为${newSize}人`;
  }
}

module.exports = router;
