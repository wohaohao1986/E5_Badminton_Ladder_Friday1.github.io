const { DATA_FILE, ADMIN_CONFIG_FILE, safeReadJson, safeWriteJson, logToFile } = require('./fileUtils');
const CATEGORIES = { huitailang: '灰太狼', xiyangyang: '喜羊羊' };
const CATEGORY_ORDER = ['huitailang', 'xiyangyang'];
const DEFAULT_DATA = { players: [], groups: [], matches: [], currentRound: 1, roundHistory: [], matchHistory: [] };
const currentDateTime = new Date().toLocaleString('en-US', {
   year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
});

// ========== CORE HELPERS ==========
const loadData = () => safeReadJson(DATA_FILE, DEFAULT_DATA);
const getActivePlayers = (data, cat) => data.players.filter(p => p.active && p.category === cat).sort((a, b) => a.ranking - b.ranking);
const findPlayer = (data, cond) => data.players.find(cond);
const findPlayerIndex = (data, cond) => data.players.findIndex(cond);

// ========== MATCH HELPERS ==========
const createMatch = (id, round, groupId, team1, team2) => ({ id, round, groupId, team1, team2, score1: null, score2: null, completed: false, timestamp: null });
const getMatchesByRound = (matches, round) => matches.filter(m => m.round === round);
const getPlayerMatches = (matches, id) => matches.filter(m => m.completed && (m.team1.includes(id) || m.team2.includes(id)));
const filterMatchesByScore = (matches, score) => matches.filter(m => Math.max(m.score1, m.score2) === score);

// ========== GROUP CALCULATIONS ==========
function calculateGroupSizes(total) {
  const remainder = total % 4, baseFours = (total / 4) | 0, groupSizes = [];
  // Add (baseFours - remainder) groups of 4, then remainder groups of 5
  for (let i = 0; i < baseFours - remainder; i++) groupSizes.push(4);
  for (let i = 0; i < remainder; i++) groupSizes.push(5);
  return groupSizes;
}

function generateRoundRobinMatches(playerIds, round, groupId) {
  const matches = [];
  if (playerIds.length === 4) {
    const [p1, p2, p3, p4] = playerIds;
    matches.push(
      createMatch(`${round}-${groupId}-1`, round, groupId, [p1, p2], [p3, p4]),
      createMatch(`${round}-${groupId}-2`, round, groupId, [p1, p3], [p2, p4]),
      createMatch(`${round}-${groupId}-3`, round, groupId, [p1, p4], [p2, p3])
    );
  } else if (playerIds.length === 5) {
    const [p1, p2, p3, p4, p5] = playerIds;
    matches.push(
      createMatch(`${round}-${groupId}-1`, round, groupId, [p1, p2], [p3, p4]),
      createMatch(`${round}-${groupId}-2`, round, groupId, [p1, p3], [p2, p5]),
      createMatch(`${round}-${groupId}-3`, round, groupId, [p1, p4], [p3, p5]),
      createMatch(`${round}-${groupId}-4`, round, groupId, [p1, p5], [p2, p4]),
      createMatch(`${round}-${groupId}-5`, round, groupId, [p2, p3], [p4, p5])
    );
  }
  return matches;
}

// ========== STATS CALCULATIONS ==========
function calculatePlayerStatsByMatches(playerId, matches) {
  let wins = 0, netScore = 0;
  matches.forEach(m => {
    const inTeam1 = m.team1.includes(playerId), inTeam2 = m.team2.includes(playerId);
    if (inTeam1) { if (m.score1 > m.score2) wins++; netScore += (m.score1 - m.score2); }
    else if (inTeam2) { if (m.score2 > m.score1) wins++; netScore += (m.score2 - m.score1); }
  });
  return { wins, netScore };
}

function updatePlayerMatchStats(player, matches, scoreTarget) {
  const suffix = scoreTarget === 21 ? 'TwentyOne' : 'Fifteen';
  const filtered = filterMatchesByScore(matches, scoreTarget);
  if (filtered.length > 0) {
    const stats = calculatePlayerStatsByMatches(player.id, filtered);
    player[`numberOfMatches${suffix}`] = (player[`numberOfMatches${suffix}`] || 0) + filtered.length;
    player[`wins${suffix}`] = (player[`wins${suffix}`] || 0) + stats.wins;
    player[`totalNetScore${suffix}`] = (player[`totalNetScore${suffix}`] || 0) + stats.netScore;
  }
}

// ========== GROUP GENERATION ==========
function generateGroups() {
  const data = loadData();
  const newGroups = [];
  const messages = {};
  
  Object.keys(CATEGORIES).forEach(cat => {
    const activePlayers = getActivePlayers(data, cat);
    const total = activePlayers.length;
    messages[cat] = CATEGORIES[cat] + '分组情况：\n';
    
    if (total < 4) { messages[cat] += CATEGORIES[cat] + '只有' + total + '人，至少需要4人才能分组\n'; return; }
    // Invalid: 6, 7, 11 cannot be split into groups of 4-5
    if (total === 6 || total === 7 || total === 11) { messages[cat] += CATEGORIES[cat] + '无法分组，请调整人数\n'; return; }
    
    const groupSizes = calculateGroupSizes(total);
    let playerIndex = 0;
    groupSizes.forEach((size, idx) => {
      const playerIds = activePlayers.slice(playerIndex, playerIndex + size).map(p => p.id);
      newGroups.push({ id: `${cat}-group-${idx + 1}`, level: idx + 1, playerIds, category: cat });
      playerIndex += size;
    });
    messages[cat] += `共生成 ${groupSizes.length} 组\n`;
  });
  
  data.groups = newGroups;
  safeWriteJson(DATA_FILE, data);
  return Object.values(messages).join('');
}

function generateMatches() {
  const data = loadData();
  data.matches = getMatchesByRound(data.matches, data.currentRound).length === 0 ? data.matches : data.matches.filter(m => m.round !== data.currentRound);
  data.groups.forEach(group => data.matches.push(...generateRoundRobinMatches(group.playerIds, data.currentRound, group.id)));
  safeWriteJson(DATA_FILE, data);
  return `为本轮的 ${data.groups.length} 组生成了比赛`;
}

const generateGroupsAndMatches = () => generateGroups() + '\n' + generateMatches();

// ========== RANK-RELATED HELPERS ==========
function getLastRoundRankingInCategory(category) {
  const data = loadData();
  const lastRound = data.roundHistory[data.roundHistory.length - 1];
  if (!lastRound) return null;
  
  const lastRoundRanking = [...lastRound.rankings.filter(r => r.category === category)];
  
  // Swap adjacent relegated and promoted pairs
  for (let i = 0; i < lastRoundRanking.length - 1; i++) {
    if (lastRoundRanking[i].change === 'relegated' && lastRoundRanking[i + 1].change === 'promoted') {
      [lastRoundRanking[i], lastRoundRanking[i + 1]] = [lastRoundRanking[i + 1], lastRoundRanking[i]];
      i++;
    }
  }
  
  const activePlayersInCat = getActivePlayers(data, category);
  return lastRoundRanking.filter(r => activePlayersInCat.some(p => p.name === r.name));
}

function findClosestPlayerInRanking(ranking, positions, activePlayersInCat) {
  for (let pos of positions) {
    if (pos >= 0 && pos < ranking.length) {
      const player = activePlayersInCat.find(p => p.name === ranking[pos].name);
      if (player) return player;
    }
  }
  return null;
}

function calculateTargetRank(player, lastRoundRanking, activePlayersInCat, data) {
  let targetRank = Math.ceil(player.avgRankInCat);
  
  if (!lastRoundRanking || lastRoundRanking.length === 0 || typeof player.avgRankInCat !== 'number') return targetRank;
  
  const floorPos = Math.floor(player.avgRankInCat) - 1;
  const ceilPos = Math.ceil(player.avgRankInCat) - 1;
  
  if (floorPos > lastRoundRanking.length) return targetRank;
  
  const floorPlayer = floorPos >= 0 && floorPos < lastRoundRanking.length 
    ? activePlayersInCat.find(p => p.name === lastRoundRanking[floorPos].name) : null;
  const ceilPlayer = ceilPos >= 0 && ceilPos < lastRoundRanking.length 
    ? activePlayersInCat.find(p => p.name === lastRoundRanking[ceilPos].name) : null;
  
  if (floorPlayer?.id === player.id && ceilPlayer?.id === player.id) return Math.ceil(player.avgRankInCat);
  
  if (floorPlayer && ceilPlayer) {
    const minRank = Math.min(floorPlayer.ranking, ceilPlayer.ranking);
    const maxRank = Math.max(floorPlayer.ranking, ceilPlayer.ranking);
    return minRank + 1 < maxRank ? minRank + 1 : minRank;
  }
  
  if (floorPlayer) return floorPlayer.ranking + 1;
  if (ceilPlayer) return ceilPlayer.ranking;
  
  const closestFloor = findClosestPlayerInRanking(lastRoundRanking, Array.from({length: floorPos + 1}, (_, i) => floorPos - i), activePlayersInCat);
  const closestCeil = findClosestPlayerInRanking(lastRoundRanking, Array.from({length: lastRoundRanking.length - ceilPos}, (_, i) => ceilPos + i), activePlayersInCat);
  
  if (closestFloor && closestCeil) {
    const minRank = Math.min(closestFloor.ranking, closestCeil.ranking);
    const maxRank = Math.max(closestFloor.ranking, closestCeil.ranking);
    return minRank + 1 < maxRank ? minRank + 1 : maxRank - 1;
  }
  
  return closestFloor ? closestFloor.ranking + 1 : closestCeil?.ranking ?? Math.ceil(player.avgRankInCat);
}

function adjustRankByNeighbors(player, activePlayersInCat) {
  let currentRank = player.ranking, adjusted = true;
  while (adjusted) {
    adjusted = false;
    if (currentRank > 1) {
      const leftNeighbor = activePlayersInCat.find(p => p.ranking === currentRank - 1);
      if (leftNeighbor?.returnCurrentRound && leftNeighbor.avgRankInCat > player.avgRankInCat) {
        currentRank--;
        adjusted = true;
      }
    }
    if (!adjusted && currentRank < activePlayersInCat.length) {
      const rightNeighbor = activePlayersInCat.find(p => p.ranking === currentRank + 1);
      if (rightNeighbor?.returnCurrentRound && rightNeighbor.avgRankInCat < player.avgRankInCat) {
        currentRank++;
        adjusted = true;
      }
    }
  }
  return currentRank;
}

// ========== PLAYER RANKING ==========
function rerankPlayer(playerIndex, rank, isActive, isCategoryChange = false) {
  const data = loadData();
  if (playerIndex === -1) return;
  
  const player = data.players[playerIndex];
  
  if (rank !== null) {
    // Temporarily push the player out of original list
    const tempPlayers = data.players.filter((_, idx) => idx !== playerIndex);
    player.ranking = rank;
    tempPlayers.splice(rank - 1, 0, player);
    data.players = tempPlayers;
  }
  
  if (isActive !== null) {
    player.active = isActive;
    if (isActive) {
      const lastRoundRanking = getLastRoundRankingInCategory(player.category);
      const activePlayersInCat = getActivePlayers(data, player.category);
      
      let targetRank = calculateTargetRank(player, lastRoundRanking, activePlayersInCat, data);
      targetRank = Math.max(1, Math.min(targetRank, activePlayersInCat.length + 1));
      player.ranking = targetRank;
      player.returnCurrentRound = true;
      
      if (!isCategoryChange) {
        player.ranking = adjustRankByNeighbors(player, activePlayersInCat);
      }
    } else {
      data.players[playerIndex].ranking = '-';
    }
  }
  
  safeWriteJson(DATA_FILE, data);
  sortPlayersByRanking();
}

function sortPlayersByRanking() {
  const data = loadData();
  data.players.sort((a, b) => {
    const catCmp = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
    if (catCmp !== 0) return catCmp;
    const activeCmp = (a.active ? 0 : 1) - (b.active ? 0 : 1);
    if (activeCmp !== 0) return activeCmp;
    return (typeof a.ranking === 'number' ? a.ranking : Infinity) - (typeof b.ranking === 'number' ? b.ranking : Infinity);
  });
  
  CATEGORY_ORDER.forEach(cat => {
    getActivePlayers(data, cat).forEach((p, idx) => {
      const pIdx = findPlayerIndex(data, pl => pl.id === p.id);
      if (pIdx !== -1) data.players[pIdx].ranking = idx + 1;
    });
  });
  
  safeWriteJson(DATA_FILE, data);
}

// ========== ROUND FINISHING ==========
function finishRound() {
  const data = loadData();
  const roundRankingsToChange = [];
  const categoryMessages = {};
  
  Object.keys(CATEGORIES).forEach(cat => {
    const catGroups = data.groups.filter(g => g.category === cat).sort((a, b) => a.level - b.level);
    if (catGroups.length === 0) return;
    
    const groupRankings = catGroups.map(g => ({
      groupId: g.id, level: g.level,
      rankings: g.playerIds.map(id => ({ id, netScore: calculatePlayerStatsByMatches(id, data.matches.filter(m => m.groupId === g.id && m.round === data.currentRound)).netScore }))
        .sort((a, b) => compareTwoPlayerStats(a, b, data))
    }));
    
    const promoted = [], relegated = [];
    groupRankings.forEach((group, idx) => {
      group.rankings.forEach((r, rankIdx) => {
        const player = findPlayer(data, p => p.id === r.id);
        let change = 'none';
        if (idx > 0 && rankIdx === 0) { change = 'promoted'; promoted.push(player.name); }
        if (idx < groupRankings.length - 1 && rankIdx === group.rankings.length - 1) { change = 'relegated'; relegated.push(player.name); }
        roundRankingsToChange.push({ name: player.name, category: cat, group: group.level, netScore: r.netScore, change });
      });
    });
    
    const newRanking = [];
    groupRankings.forEach((group, i) => {
      if (i === 0) {
        newRanking.push(...group.rankings.map(r => r.id));
      } else {
        const promotedId = group.rankings[0].id;
        const relegatedId = groupRankings[i - 1].rankings[groupRankings[i - 1].rankings.length - 1].id;
        newRanking.splice(newRanking.length - 1, 1, promotedId, relegatedId);
        newRanking.push(...group.rankings.slice(1).map(r => r.id));
      }
    });
    
    newRanking.forEach((pId, idx) => {
      const pIdx = findPlayerIndex(data, p => p.id === pId);
      if (pIdx !== -1) data.players[pIdx].ranking = idx + 1;
    });
    
    categoryMessages[cat] = `\n=== ${CATEGORIES[cat]} ===\n排名上升：${promoted.join(', ')}\n排名下降：${relegated.join(', ')}\n`;
  });
  
  data.roundHistory.push({ round: data.currentRound, rankings: roundRankingsToChange });
  
  const currentRoundMatches = data.matches.filter(m => m.round === data.currentRound);
  data.players.forEach(player => {
    player.returnCurrentRound = false;
    const playerMatches = getPlayerMatches(currentRoundMatches, player.id);
    if (playerMatches.length > 0) {
      updatePlayerMatchStats(player, playerMatches, 21);
      updatePlayerMatchStats(player, playerMatches, 15);
    }
  });
  
  data.matchHistory.push(...currentRoundMatches);
  data.matches = data.matches.filter(m => m.round !== data.currentRound);
  data.groups.length = 0;
  data.currentRound++;
  
  safeWriteJson(DATA_FILE, data);
  calculateAllPlayerAvgRankInCat();
  
  return '本轮比赛结束，升降名次详情如下：\n' + Object.values(categoryMessages).join('') + '请截图保存本轮升降名次详情以备查阅！';
}

// ========== PLAYER STATS ==========
function calculatePlayerStats() {
  const data = loadData();
  data.players.forEach(player => {
    logToFile(`Calculating stats for player: ${player.name}`);
    updatePlayerMatchStats(player, getPlayerMatches(data.matchHistory, player.id), 21);
    updatePlayerMatchStats(player, getPlayerMatches(data.matchHistory, player.id), 15);
  });
  safeWriteJson(DATA_FILE, data);
}

function calculatePlayerAvgRankInCat(playerName) {
  const data = loadData();
  const player = findPlayer(data, p => p.name === playerName);
  if (!player) return;
  
  const ranks = [];
  let roundPlayed = 0;
  data.roundHistory.forEach(round => {
    const ranking = round.rankings.find(r => r.name === playerName);
    if (!ranking || ranking.category !== player.category) return;
    
    let playerRank = round.rankings.filter(r => r.category === player.category).findIndex(r => r.name === playerName) + 1;
    if (ranking.change === 'promoted') playerRank -= 1;
    else if (ranking.change === 'relegated') playerRank += 1;
    ranks.push(playerRank);
    roundPlayed++;
  });
  
  player.roundPlayed = roundPlayed;
  
  if (roundPlayed > 10) {
    const recentRanks = ranks.slice(-10);
    player.avgRankInCat = parseFloat((recentRanks.reduce((a, r) => a + r, 0) / recentRanks.length).toFixed(2));
  } else if (roundPlayed > 0) {
    player.avgRankInCat = parseFloat((ranks.reduce((a, r) => a + r, 0) / roundPlayed).toFixed(2));
  } else {
    player.avgRankInCat = '-';
  }
  
  safeWriteJson(DATA_FILE, data);
}

const calculateAllPlayerAvgRankInCat = () => { 
  const data = loadData(); 
  data.players.forEach(p => calculatePlayerAvgRankInCat(p.name)); 
};

// ========== RESET & SCORING ==========
function resetGroupLogic(groupId, playerIds) {
  const data = safeReadJson(DATA_FILE, DEFAULT_DATA);
  const group = data.groups.find(g => g.id === groupId);
  if (!group) throw new Error('Group not found');
  
  const originalPlayerIds = [...group.playerIds];
  data.matches = data.matches.filter(m => m.groupId !== groupId);
  data.matches.push(...generateRoundRobinMatches(playerIds, data.currentRound, groupId));
  
  group.playerIds = playerIds;
  originalPlayerIds.filter(id => !playerIds.includes(id)).forEach(playerId => {
    const player = findPlayer(data, p => p.id === playerId);
    if (player) { player.active = false; player.ranking = '-'; }
  });
  
  safeWriteJson(DATA_FILE, data);
  return `${group.category}第${group.level}组 已重置，当前有 ${playerIds.length} 名选手`;
}

function compareTwoPlayerStats(playerOne, playerTwo, data) {
  if (playerOne.netScore !== playerTwo.netScore) return playerTwo.netScore - playerOne.netScore;
  const rankOne = findPlayer(data, p => p.id === playerOne.id)?.ranking ?? Infinity;
  const rankTwo = findPlayer(data, p => p.id === playerTwo.id)?.ranking ?? Infinity;
  return rankOne - rankTwo;
}

function autoFillScores() {
  const data = loadData();
  const currentMatches = data.matches.filter(m => m.round === data.currentRound && !m.completed);
  if (currentMatches.length === 0) return '没有待报分的比赛';
  
  currentMatches.forEach(m => {
    const scores = generateRandomScore();
    const mIdx = data.matches.findIndex(match => match.id === m.id);
    if (mIdx !== -1) {
      data.matches[mIdx].score1 = scores.score1;
      data.matches[mIdx].score2 = scores.score2;
      data.matches[mIdx].completed = true;
      data.matches[mIdx].timestamp = Date.now();
    }
  });
  
  safeWriteJson(DATA_FILE, data);
  return '随机报分完成';
}

const generateRandomScore = () => {
  const winner = Math.random() > 0.5 ? 1 : 2;
  return { score1: winner === 1 ? 21 : Math.floor(Math.random() * 10) + 10, score2: winner === 2 ? 21 : Math.floor(Math.random() * 10) + 10 };
};

// ========== GROUP REARRANGEMENT ==========
function rearrangeGroups(data, category, newGroupSizes, currentRound) {
  // Get groups for this category to get previous arrangement
  const catGroups = data.groups
    .filter(g => g.category === category && g.level)
    .sort((a, b) => a.level - b.level);
  
  const previousArrangement = catGroups.map(g => g.playerIds.length);
  
  // Collect all players from existing groups
  let allPlayers = [];
  catGroups.forEach(g => {
    allPlayers.push(...g.playerIds);
  });
  
  // Validate total players
  const currentTotal = allPlayers.length;
  const newTotal = newGroupSizes.reduce((a, b) => a + b, 0);
  
  if (currentTotal !== newTotal) {
    return { success: false, message: `总人数不匹配：当前${currentTotal}人，新${newTotal}人` };
  }
  
  if (newGroupSizes.some(s => s < 4 || s > 5)) {
    return { success: false, message: '每组必须是4-5人' };
  }
  
  // Create new groups with new sizes
  const newGroups = [];
  let playerIndex = 0;
  
  newGroupSizes.forEach((size, idx) => {
    const newPlayerIds = allPlayers.slice(playerIndex, playerIndex + size);
    newGroups.push({
      id: `${category}-group-${idx + 1}`,
      level: idx + 1,
      playerIds: newPlayerIds,
      category: category
    });
    playerIndex += size;
  });
  
  // Replace old groups with new groups
  data.groups = data.groups.filter(g => g.category !== category);
  data.groups.push(...newGroups);
  
  // Regenerate matches for this category
  const newMatches = [];
  newGroups.forEach(group => {
    const groupMatches = generateRoundRobinMatches(group.playerIds, currentRound, group.id);
    newMatches.push(...groupMatches);
  });
  
  // Remove old matches for this category and current round
  data.matches = data.matches.filter(m => {
    const isCurrentCategoryMatch = m.groupId.startsWith(category);
    const isCurrentRound = m.round === currentRound;
    return !(isCurrentCategoryMatch && isCurrentRound);
  });
  
  // Add new matches
  data.matches.push(...newMatches);
  
  const successMsg = `${CATEGORIES[category]}: 从 [${previousArrangement.join(',')}] 重新排列为 [${newGroupSizes.join(',')}]`;
  logToFile(successMsg);
  return { success: true, message: `${CATEGORIES[category]}已重新排列为${newGroupSizes.join(',')}` };
}

module.exports = {
  CATEGORIES, currentDateTime, sortPlayersByRanking, generateGroups, generateMatches, generateGroupsAndMatches,
  rerankPlayer, finishRound, autoFillScores, calculatePlayerStats, calculatePlayerAvgRankInCat, calculateAllPlayerAvgRankInCat, resetGroupLogic, rearrangeGroups
};
