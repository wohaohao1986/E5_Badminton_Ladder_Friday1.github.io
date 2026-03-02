const express = require('express');
const { DATA_FILE, safeReadJson, safeWriteJson } = require('../utils/fileUtils');
const { CATEGORIES, currentDateTime, rerankPlayer, sortPlayersByRanking, calculatePlayerAvgRankInCat } = require('../utils/dataUtils');
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
    changePlayerCategory(playerIndex, payload.category);
    cleanupCategories(oldCategory, payload.category);
    let newPlayer = loadStore().players.find(p => p.id === payload.id);
    msg += `选手${newPlayer.name}已从${CATEGORIES[oldCategory]}移至${CATEGORIES[payload.category]}分组\n`;
    msg += `平均排名为${newPlayer.avgRankInCat}，现排在第${newPlayer.ranking}名\n`;
    msg += `请重新生成${CATEGORIES[oldCategory]}和${CATEGORIES[payload.category]}分组\n`;
    msg += checkAndPromptGroupingMessage(oldCategory);
    msg += checkAndPromptGroupingMessage(payload.category);
  }

  // Ranking change
  if ('ranking' in payload) {
    console.log(`[${currentDateTime}] Player ${playersStore.players[playerIndex].name}, ranking changed to ${payload.ranking}`);
    rerankPlayer(playerIndex, payload.ranking, null);
    cleanupCategories(playersStore.players[playerIndex].category);
    msg += `${playersStore.players[playerIndex].name} 已调整为第 ${payload.ranking} 名！`;
  }

  // Active status change
  if ('active' in payload) {
    if (payload.active === true) {
      console.log(`[${currentDateTime}] Player ${playersStore.players[playerIndex].name} activated`);
      console.log(`[${currentDateTime}] Player activated in category ${playersStore.players[playerIndex].category}`);
      msg = `选手${playersStore.players[playerIndex].name}平均排名为${playersStore.players[playerIndex].avgRankInCat}，现排在第${playersStore.players[playerIndex].ranking}名\n`;
    } else {
      console.log(`[${currentDateTime}] Player ${playersStore.players[playerIndex].name} deactivated`);
      msg = `选手${playersStore.players[playerIndex].name}已被设为不活跃\n`;
    }
    rerankPlayer(playerIndex, null, payload.active);
    cleanupCategories(playersStore.players[playerIndex].category);
    msg += checkAndPromptGroupingMessage(playersStore.players[playerIndex].category);
  }

  console.log(`[${currentDateTime}] Player updated successfully`);
  if (msg && msg.length > 0) {
    res.status(201).json({ message: msg });
  } else {
    res.status(200).json({ message: 'OK' });
  }
});

// Remove a player
router.put('/delete', (req, res) => {
  const payload = requirePayload(req, res);
  if (!payload) return;
  const playerId = payload.id;
  console.log(`[${currentDateTime}] Received delete request for playerId: ${playerId}`);

  let playersStore = loadStore();
  const player = playersStore.players.find(p => p.id === playerId);
  if (!player) return res.status(404).json({ error: 'Player not found' });

  playersStore.players = playersStore.players.filter(p => p.id !== playerId);
  saveStore(playersStore);

  // Re-rank, remove groups/matches
  cleanupCategories(player.category);
  sortPlayersByRanking();
  console.log(`[${currentDateTime}] Player ${player.name} deleted successfully`);
  const msg = `选手${player.name}已被删除\n请重新生成${CATEGORIES[player.category]}分组`;
  res.status(201).json({ message: msg });
});

// Helper: common cleanup after category changes
function cleanupCategories(...categories) {
  const data = loadStore();
  categories.forEach(category => {
    data.matches = data.matches.filter(m => !m.id.includes(category));
    data.groups = data.groups.filter(g => g.category !== category);
  });
  saveStore(data);
}

function changePlayerCategory(playerIndex, newCategory) {
  const data = loadStore();
  data.players[playerIndex].category = newCategory;
  saveStore(data);
  calculatePlayerAvgRankInCat(data.players[playerIndex].name);
  rerankPlayer(playerIndex, null, data.players[playerIndex].active);
}

// Helper function to check category counts
function checkAndPromptGroupingMessage(category) {
  const playersStore = loadStore();
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

module.exports = router;
