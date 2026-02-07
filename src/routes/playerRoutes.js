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
    const catPlayers = playersStore.players.filter(p => p.category === newP.category && p.active);
    newP.ranking = catPlayers.length + 1; // Adding player, set rank to last
    playersStore.players.push(newP);
    console.log('Added new player:', newP);
    const message = checkAndPromptGroupingMessage(newP.category, playersStore);
    safeWriteJson(DATA_FILE, playersStore);

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
  let msg = '';
  if (playerIndex !== -1) {

    // Handle category change
    if ('category' in payload) {
      console.log(`Player category changed to ${payload.category}`);
      const oldCategory = playersStore.players[playerIndex].category;
      playersStore.players[playerIndex].category = payload.category;
      // Re-rank both old and new categories
      playersStore.players = rankShift(playersStore, oldCategory, null, null, null);
      playersStore.players = rankShift(playersStore, payload.category, null, null, null);
      // Player moved categories, remove groups in both categories
      playersStore.groups = removeGroupContainsPlayer(oldCategory, playersStore);
      playersStore.groups = removeGroupContainsPlayer(payload.category, playersStore);
      msg = `选手${playersStore.players[playerIndex].name}已从${CATEGORIES[oldCategory]}移至${CATEGORIES[payload.category]}分组\n`;
      msg += `请重新生成${CATEGORIES[oldCategory]}和${CATEGORIES[payload.category]}分组\n`;
      msg += checkAndPromptGroupingMessage(oldCategory, playersStore);
      msg += checkAndPromptGroupingMessage(payload.category, playersStore);
    }

    // Handle ranking change
    if ('ranking' in payload) {
      console.log(`Player ranking changed to ${payload.ranking}\n.`);
      playersStore.players = rankShift(playersStore, payload.category, playerIndex, payload.ranking);
    }
    else {
      // No ranking shift needed, update directly
      playersStore.players[playerIndex] = { ...playersStore.players[playerIndex], ...payload };
    }

    // Handle active status change
    if ('active' in payload) {
      if(payload.active === true){
        console.log('Player activated:\n', playersStore.players[playerIndex]);
        const catPlayers = playersStore.players.filter(p => p.category === playersStore.players[playerIndex].category && p.active);
        playersStore.players[playerIndex].ranking = catPlayers.length + 1; // Re-activate player, set rank to last
        console.log(`Player activated in category ${playersStore.players[playerIndex].category}`);
        msg = checkAndPromptGroupingMessage(playersStore.players[playerIndex].category, playersStore);
      }
      else {
        console.log(`Player deactivated:\n`, playersStore.players[playerIndex]);
        playersStore.players[playerIndex].ranking = '-'; // Deactivate player, set rank to "-"
        msg = `选手${playersStore.players[playerIndex].name}已被设为不活跃，无法参加比赛\n`;
        msg += `请重新生成${playersStore.players[playerIndex].category}分组`;
        playersStore.players = rankShift(playersStore, playersStore.players[playerIndex].category, playerIndex, null, false);
        playersStore.groups = removeGroupContainsPlayer(playersStore.players[playerIndex].category, playersStore);
      }
    }
    safeWriteJson(DATA_FILE, playersStore);
    console.log('Player updated successfully');
    if (msg && msg.length > 0) {
      res.status(201).json({ message: msg });
    }
  } else {
    console.log('Player not found for update, client send:\n', payload);
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
  let playersStore = safeReadJson(DATA_FILE, { players: [] });
  const player = playersStore.players.find(p => p.id === playerId);
  const filteredPlayers = playersStore.players.filter(p => p.id !== playerId);
  if (filteredPlayers.length === playersStore.players.length) {
    return res.status(404).json({ error: 'Player not found' });
  }
  console.log('Deleting player with id:', playerId);
  playersStore.players = filteredPlayers;
  // Re-rank after deletion
  playersStore.players = rankShift(playersStore, player.category, null, null, null);
  playersStore.groups = removeGroupContainsPlayer(player.category, playersStore);
  let msg = `选手${player.name}已被删除\n请重新生成${CATEGORIES[player.category]}分组`;
  safeWriteJson(DATA_FILE, playersStore);
  res.status(201).json({ message: msg });
});

// Helper function to shift rank after certain operations
// (e.g., ranking change or deletion)
// Returns a new players array with updated rankings
function rankShift(playersStore, category, playerIndex, rank, isActive) {
  if (playerIndex !== null) {
    // Filter out players with non-numeric rankings (e.g., "-") before sorting
    const categoryPlayers = playersStore.players
      .filter(p => p.category === category && p.active)
      .sort((a, b) => {
        const rankA = typeof a.ranking === 'number' ? a.ranking : Infinity;
        const rankB = typeof b.ranking === 'number' ? b.ranking : Infinity;
        return rankA - rankB;
      });
    if (rank !== null){
      // take out the player and re-insert at new position
      categoryPlayers.splice(playerIndex, 1);
      categoryPlayers.splice(rank - 1, 0, playersStore.players[playerIndex]);
    }
    if (isActive !== null && isActive === false) {
      // Shift rankings when a player is deactivated
      playersStore.players[playerIndex].ranking = '-';
      categoryPlayers = categoryPlayers.filter(p => p.id !== playersStore.players[playerIndex].id);
    }
    // Reassign rankings
      categoryPlayers.forEach((p, index) => {
        if (typeof p.ranking === 'number'){
          p.ranking = index + 1;
          const globalIndex = playersStore.players.findIndex(pl => pl.id === p.id);
          playersStore.players[globalIndex].ranking = p.ranking;
        }
      });
  }
  else if (category !== null){
    // Re-rank all players in the category
    const categoryPlayers = playersStore.players.filter(p => p.category === category && p.active).sort((a, b) => a.ranking - b.ranking);
    categoryPlayers.forEach((p, index) => {
      const globalIndex = playersStore.players.findIndex(pl => pl.id === p.id);
      playersStore.players[globalIndex].ranking = index + 1;
    });
  }
  return playersStore.players;
}

// Helper function to check category counts
function checkAndPromptGroupingMessage(category, playersStore) {
  const activePlayers = playersStore.players.filter(p => p.active && p.category === category);
  const total = activePlayers.length;

  let message = '';
  
  if (total < 4) {
    message = `${CATEGORIES[category]}只有${total}人，至少需要4人才能分组`;
    removeMatchesOnly(category);
  }
  else if (total === 7 || total === 6 || total === 11) {
    message = `${CATEGORIES[category]}现有人数无法分组（${total}人），建议调整至4、5、8、10人或更多`;
    removeMatchesOnly(category);
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
