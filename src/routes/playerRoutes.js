const express = require('express');
const { DATA_FILE, safeReadJson, safeWriteJson } = require('../utils/fileUtils');
const { CATEGORIES, removeMatchesInCategory } = require('../utils/dataUtils');
const router = express.Router();

// Helper: load and init store
function loadStore() {
  return safeReadJson(DATA_FILE, { players: [], groups: [], matches: [] });
}

// Helper: save store
function saveStore(store) {
  safeWriteJson(DATA_FILE, store);
}

// Helper: validate payload
function requirePayload(req, res) {
  const payload = req.body;
  if (!payload || Object.keys(payload).length === 0) {
    res.status(400).json({ error: 'Empty payload' });
    return null;
  }
  return payload;
}

// POST: Add a new player
router.post('/', (req, res) => {
  const payload = requirePayload(req, res);
  if (!payload) return;

  const playersStore = loadStore();
  const newP = payload;
  const exists = playersStore.players.find(p => p.id === newP.id || p.name === newP.name);
  if (!exists) {
    const catPlayers = playersStore.players.filter(p => p.category === newP.category && p.active);
    const rankedPlayersInCat = catPlayers.filter(p => typeof p.ranking === 'number');
    newP.ranking = rankedPlayersInCat.length + 1; // set rank to last
    playersStore.players.push(newP);
    console.log(`[${currentDateTime}] Request to Add a new player, name: ${newP.name}, category: ${CATEGORIES[newP.category]}`);
    const message = checkAndPromptGroupingMessage(newP.category, playersStore);
    saveStore(playersStore);
    res.status(201).json({ message });
  } else {
    res.status(201).json({ message: '该选手已存在，无法添加' });
  }
});

// PUT: Update an existing player
router.put('/', (req, res) => {
  const payload = requirePayload(req, res);
  if (!payload) return;

  const playersStore = loadStore();
  const playerIndex = playersStore.players.findIndex(p => p.id === payload.id);
  if (playerIndex === -1) {
    console.log('Player not found for update, client send:\n', payload);
    return res.status(404).json({ error: 'Player not found' });
  }

  let msg = '';
  const currentPlayer = playersStore.players[playerIndex];

  // Category change
  if ('category' in payload) {
    const oldCategory = currentPlayer.category;
    console.log(`[${currentDateTime}] Player ${currentPlayer.name}, category changed from ${CATEGORIES[oldCategory]} to ${CATEGORIES[payload.category]}`);
    playersStore.players[playerIndex].category = payload.category;
    if (currentPlayer.active) {
      playersStore.players[playerIndex].ranking = playersStore.players.filter(p => p.category === payload.category && p.active).length;
    }
    cleanupCategories(playersStore, oldCategory, payload.category);
    msg += `选手${playersStore.players[playerIndex].name}已从${CATEGORIES[oldCategory]}移至${CATEGORIES[payload.category]}分组\n`;
    msg += `请重新生成${CATEGORIES[oldCategory]}和${CATEGORIES[payload.category]}分组\n`;
    msg += checkAndPromptGroupingMessage(oldCategory, playersStore);
    msg += checkAndPromptGroupingMessage(payload.category, playersStore);
  }

  // Ranking change
  if ('ranking' in payload) {
    console.log(`[${currentDateTime}] Player ${playersStore.players[playerIndex].name}, ranking changed to ${payload.ranking}`);
    rankShift(playersStore, playersStore.players[playerIndex].category, playerIndex, payload.ranking, null);
    cleanupCategories(playersStore, playersStore.players[playerIndex].category);
    msg += `${playersStore.players[playerIndex].name} 已调整为第 ${payload.ranking} 名！`;
  } else {
    // general update (merge fields)
    playersStore.players[playerIndex] = { ...playersStore.players[playerIndex], ...payload };
    cleanupCategories(playersStore, playersStore.players[playerIndex].category);
  }

  // Active status change
  if ('active' in payload) {
    if (payload.active === true) {
      console.log(`[${currentDateTime}] Player ${playersStore.players[playerIndex].name} activated`);
      const catPlayers = playersStore.players.filter(p => p.category === playersStore.players[playerIndex].category && p.active);
      const rankedPlayersInCat = catPlayers.filter(p => typeof p.ranking === 'number');
      playersStore.players[playerIndex].ranking = rankedPlayersInCat.length + 1;
      playersStore.players[playerIndex].active = true;
      playersStore.matches = removeMatchesInCategory(playersStore.players[playerIndex].category);
      console.log(`[${currentDateTime}] Player activated in category ${playersStore.players[playerIndex].category}`);
      msg = checkAndPromptGroupingMessage(playersStore.players[playerIndex].category, playersStore);
    } else {
      console.log(`[${currentDateTime}] Player ${playersStore.players[playerIndex].name} deactivated`);
      playersStore.players[playerIndex].ranking = '-';
      playersStore.players[playerIndex].active = false;
      msg = `选手${playersStore.players[playerIndex].name}已被设为不活跃，无法参加比赛\n`;
      msg += `请重新生成${CATEGORIES[playersStore.players[playerIndex].category]}分组`;
      rankShift(playersStore, playersStore.players[playerIndex].category, playerIndex, null, false);
      cleanupCategories(playersStore, playersStore.players[playerIndex].category);
    }
  }

  saveStore(playersStore);
  console.log(`[${currentDateTime}] Player updated successfully`);
  if (msg && msg.length > 0) {
    res.status(201).json({ message: msg });
  } else {
    res.status(200).json({ message: 'OK' });
  }
});

// DELETE: Remove a player
router.delete('/', (req, res) => {
  const payload = requirePayload(req, res);
  if (!payload) return;
  const playerId = payload.id;
  console.log(`[${currentDateTime}] Received delete request for playerId: ${playerId}`);

  let playersStore = loadStore();
  const player = playersStore.players.find(p => p.id === playerId);
  if (!player) return res.status(404).json({ error: 'Player not found' });

  playersStore.players = playersStore.players.filter(p => p.id !== playerId);
  // Re-rank, remove groups/matches
  cleanupCategories(playersStore, player.category);
  const msg = `选手${player.name}已被删除\n请重新生成${CATEGORIES[player.category]}分组`;
  saveStore(playersStore);
  console.log(`[${currentDateTime}] Player ${player.name} deleted successfully`);
  res.status(201).json({ message: msg });
});

// Helper: common cleanup after category changes
function cleanupCategories(store, ...categories) {
  categories.forEach(cat => {
    rankShift(store, cat, null, null, null);
    removeGroupContainsPlayer(cat, store);
    store.matches = removeMatchesInCategory(cat);
  });
}

// Helper: Shift rank after certain operations (e.g., ranking change or deletion)
function rankShift(playersStore, category, playerIndex, rank, isActive) {
  if (playerIndex !== null) {
    let categoryPlayers = playersStore.players
      .filter(p => p.category === category && p.active)
      .sort((a, b) => {
        const rankA = typeof a.ranking === 'number' ? a.ranking : Infinity;
        const rankB = typeof b.ranking === 'number' ? b.ranking : Infinity;
        return rankA - rankB;
      });
    
    if (rank !== null) {
      const currentRank = playersStore.players[playerIndex].ranking;
      categoryPlayers.splice(currentRank - 1, 1);
      categoryPlayers.splice(rank - 1, 0, playersStore.players[playerIndex]);
    }
    
    if (isActive === false) {
      playersStore.players[playerIndex].ranking = '-';
      categoryPlayers = categoryPlayers.filter(p => p.id !== playersStore.players[playerIndex].id);
    }
    
    // Reassign rankings
    categoryPlayers.forEach(p => {
      const globalIndex = playersStore.players.findIndex(pl => pl.id === p.id);
      playersStore.players[globalIndex].ranking = categoryPlayers.indexOf(p) + 1;
    });
  } else if (category !== null) {
    // Re-rank all players in the category
    const categoryPlayers = playersStore.players
      .filter(p => p.category === category && p.active)
      .sort((a, b) => a.ranking - b.ranking);
    
    categoryPlayers.forEach((p, index) => {
      const globalIndex = playersStore.players.findIndex(pl => pl.id === p.id);
      playersStore.players[globalIndex].ranking = index + 1;
    });
  }
}

// Helper function to check category counts
function checkAndPromptGroupingMessage(category, playersStore) {
  const activePlayers = playersStore.players.filter(p => p.active && p.category === category);
  const total = activePlayers.length;

  let message = '';
  
  if (total < 4) {
    message = `${CATEGORIES[category]}只有${total}人，至少需要4人才能分组`;
  }
  else if (total === 7 || total === 6 || total === 11) {
    message = `${CATEGORIES[category]}现有人数无法分组（${total}人），建议调整至4、5、8、10人或更多`;
  }
  else {
    message = `${CATEGORIES[category]}现有${total}人参赛\n可以生成分组了，请在分组管理中点击“生成本轮分组”按钮`;
  }
  return message;
}

// Remove all groups in deactivated player's category
// Returns a new groups array without the groups containing the deactivated player
function removeGroupContainsPlayer(category, playersStore) {
  if (playersStore.groups.length !== 0)
    playersStore.groups = playersStore.groups.filter(g => g.category !== category);
  return playersStore.groups;
}

module.exports = router;
