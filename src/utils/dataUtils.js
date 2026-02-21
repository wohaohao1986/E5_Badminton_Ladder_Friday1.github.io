const { DATA_FILE, ADMIN_CONFIG_FILE, safeReadJson, safeWriteJson } = require('./fileUtils');
const CATEGORIES = {
  tiger: 'Tiger',
  dragon: 'Dragon'
};
const currentDateTime = new Date().toLocaleString('en-US', {
   year: 'numeric',
   month: '2-digit',
   day: '2-digit',
   hour: '2-digit',
   minute: '2-digit',
   second: '2-digit'
});
// Example Output: 03/12/2024, 12:45:30 PM

// Helper: Load data with safe defaults
function loadData() {
  return safeReadJson(DATA_FILE, { players: [], groups: [], matches: [], currentRound: 1, roundHistory: [], matchHistory: [] });
}

// Helper: Get active players in a category, sorted by ranking
function getActivePlayers(data, category) {
  return data.players.filter(p => p.active && p.category === category).sort((a, b) => a.ranking - b.ranking);
}

// Remove all matches of current round in given category
function removeMatchesInCategory(category) {
  const data = loadData();
  return data.matches.filter(m => m.round !== data.currentRound || !m.id.includes(category));
}

// Helper: Calculate group sizes for given total
function calculateGroupSizes(total) {
  const groupSizes = [];
  const remainder = total % 4;
  const baseFours = (total / 4) | 0;
  
  if (remainder === 0) {
    for (let i = 0; i < baseFours; i++) groupSizes.push(4);
  } else if (remainder === 1) {
    for (let i = 0; i < baseFours - 1; i++) groupSizes.push(4);
    groupSizes.push(5);
  } else if (remainder === 2) {
    for (let i = 0; i < baseFours - 2; i++) groupSizes.push(4);
    groupSizes.push(5, 5);
  } else { // remainder === 3
    for (let i = 0; i < baseFours - 3; i++) groupSizes.push(4);
    groupSizes.push(5, 5, 5);
  }
  return groupSizes;
}

// Generate groups for current round
function generateGroups() {
  const data = loadData();
  const newGroups = [];
  const messages = {};
  
  Object.keys(CATEGORIES).forEach(cat => {
    messages[cat] = CATEGORIES[cat] + '分组情况：\n';
    const activePlayers = getActivePlayers(data, cat);
    const total = activePlayers.length;
    
    if (total < 4) {
      messages[cat] += CATEGORIES[cat] + '只有' + total + '人，至少需要4人才能分组\n';
      return;
    }
    if (total === 7 || total === 11) {
      messages[cat] += CATEGORIES[cat] + '无法分组，请调整人数\n';
      return;
    }
    
    const groupSizes = calculateGroupSizes(total);
    // Assign players to groups
    let playerIndex = 0;
    groupSizes.forEach((size, index) => {
      const playerIds = activePlayers.slice(playerIndex, playerIndex + size).map(p => p.id);
      const groupId = `${cat}-group-${index + 1}`;
      newGroups.push({ id: groupId, level: index + 1, playerIds, category: cat });
      playerIndex += size;
    });
    messages[cat] += `共生成 ${groupSizes.length} 组\n`;
  });
  
  data.groups = newGroups;
  safeWriteJson(DATA_FILE, data);
  return Object.values(messages).join('');
}

// Shift ranks in a category after certain operations (e.g., ranking change or deletion)
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

// Generate round-robin matches for all groups
function generateMatches() {
  const data = loadData();

  // Remove existing matches of current round
  data.matches = data.matches.filter(m => m.round !== data.currentRound);

  data.groups.forEach(group => {
    data.matches.push(...generateRoundRobinMatches(group.playerIds, data.currentRound, group.id));
  });
  safeWriteJson(DATA_FILE, data);
  return `为本轮的 ${data.groups.length} 组生成了比赛`;
}

// Helper to generate round-robin matches for a 4-player or 5-player group
function generateRoundRobinMatches(playerIds, round, groupId) {
  if (playerIds.length === 4) {
    const [p1, p2, p3, p4] = playerIds;
    return [
      { id: `${round}-${groupId}-1`, round, groupId, team1: [p1, p2], team2: [p3, p4], score1: null, score2: null, completed: false, timestamp: null },
      { id: `${round}-${groupId}-2`, round, groupId, team1: [p1, p3], team2: [p2, p4], score1: null, score2: null, completed: false, timestamp: null },
      { id: `${round}-${groupId}-3`, round, groupId, team1: [p1, p4], team2: [p2, p3], score1: null, score2: null, completed: false, timestamp: null }
    ];
  } else if (playerIds.length === 5) {
    const [p1, p2, p3, p4, p5] = playerIds;
    return [
      { id: `${round}-${groupId}-1`, round, groupId, team1: [p1, p2], team2: [p3, p4], score1: null, score2: null, completed: false, timestamp: null },
      { id: `${round}-${groupId}-2`, round, groupId, team1: [p1, p3], team2: [p2, p5], score1: null, score2: null, completed: false, timestamp: null },
      { id: `${round}-${groupId}-3`, round, groupId, team1: [p1, p4], team2: [p3, p5], score1: null, score2: null, completed: false, timestamp: null },
      { id: `${round}-${groupId}-4`, round, groupId, team1: [p1, p5], team2: [p2, p4], score1: null, score2: null, completed: false, timestamp: null },
      { id: `${round}-${groupId}-5`, round, groupId, team1: [p2, p3], team2: [p4, p5], score1: null, score2: null, completed: false, timestamp: null }
    ];
  }
  return [];
}

function finishRound() {
  const data = loadData();
  const roundRankingsToChange = [];
  const categoryMessages = {};

  Object.keys(CATEGORIES).forEach(cat => {
    const promoted = [];
    const relegated = [];
    // Get groups in this category sorted by level
    const catGroups = data.groups.filter(g => g.category === cat).sort((a, b) => a.level - b.level);
    if (catGroups.length === 0) return;
    // Sort players within each group by net scores in this round
    const groupRankings = catGroups.map(g => {
      const groupMatchesThisRound = data.matches.filter(m => m.groupId === g.id && m.round === data.currentRound);
      const rankings = g.playerIds.map(id => {
        const stats = calculatePlayerStatsByMatches(id, groupMatchesThisRound);
        return { id, netScore: stats.netScore };
      }).sort((a, b) => compareTwoPlayerStats(a, b, data));
      return { groupId: g.id, level: g.level, rankings };
    });
    // Record round rankings and determine promotions/relegations
    groupRankings.forEach((group, idx) => {
      group.rankings.forEach((r, rankIdx) => {
        const player = data.players.find(p => p.id === r.id);
        let change = 'none';
        if (idx > 0 && rankIdx === 0) {
          change = 'promoted';
          promoted.push(player.name);
        }
        if (idx < groupRankings.length - 1 && rankIdx === group.rankings.length - 1) {
          change = 'relegated';
          relegated.push(player.name);
        }
        roundRankingsToChange.push({
          name: player.name,
          category: cat,
          group: group.level,
          netScore: r.netScore,
          change: change
        });
      });
    });
    
    // Create a new ranking list to reflect promotions/relegations
    const newRanking = [];
    for (let i = 0; i < groupRankings.length; i++) {
      const rankings = groupRankings[i].rankings;
      if (i === 0) {
        newRanking.push(...rankings.map(r => r.id));
      } else {
        const promotedId = rankings[0].id;
        const relegatedId = groupRankings[i - 1].rankings[groupRankings[i - 1].rankings.length - 1].id;
        newRanking.splice(newRanking.length - 1, 1, promotedId, relegatedId);
        newRanking.push(...rankings.slice(1).map(r => r.id));
      }
    }
    
    newRanking.forEach((playerId, index) => {
      const playerIndex = data.players.findIndex(p => p.id === playerId);
      if (playerIndex !== -1) {
        data.players[playerIndex].ranking = index + 1;
      }
    });
    
    categoryMessages[cat] = `\n=== ${CATEGORIES[cat]} ===\n`;
    categoryMessages[cat] += `排名上升：${promoted.join(', ')}\n`;
    categoryMessages[cat] += `排名下降：${relegated.join(', ')}\n`;
  });
  
  data.roundHistory.push({ round: data.currentRound, rankings: roundRankingsToChange });
  // Save all completed matches of current round to matchHistory
  const currentRoundMatches = data.matches.filter(m => m.round === data.currentRound);
  data.matchHistory.push(...currentRoundMatches);
  // Remove current round matches from data.matches
  data.matches = data.matches.filter(m => m.round !== data.currentRound);
  // Clear current groups
  data.groups.length = 0;
  data.currentRound++;
  safeWriteJson(DATA_FILE, data);
  
  let msg = '本轮比赛结束，升降名次详情如下：\n';
  msg += Object.values(categoryMessages).join('');
  msg += '请截图保存本轮升降名次详情以备查阅！';
  return msg;
}

// Calculate wins and net score for a player in given matches
function calculatePlayerStatsByMatches(playerId, matches) {
  let wins = 0, netScore = 0;
  matches.forEach(m => {
    if (!m.completed) return;
    const inTeam1 = m.team1.includes(playerId);
    const inTeam2 = m.team2.includes(playerId);
    if (inTeam1) {
      if (m.score1 > m.score2) wins++;
      netScore += (m.score1 - m.score2);
    } else if (inTeam2) {
      if (m.score2 > m.score1) wins++;
      netScore += (m.score2 - m.score1);
    }
  });
  return { wins, netScore };
}

function sortPlayersByCategoryAndRanking() {
  const data = loadData();
  const categoryOrder = ['tiger', 'dragon'];
  
  return data.players.sort((a, b) => {
    const catA = categoryOrder.indexOf(a.category);
    const catB = categoryOrder.indexOf(b.category);
    if (catA !== catB) return catA - catB;
    
    const rankA = typeof a.ranking === 'number' ? a.ranking : Infinity;
    const rankB = typeof b.ranking === 'number' ? b.ranking : Infinity;
    return rankA - rankB;
  });
}

// Helper: Compare two players to determine ranks in group
function compareTwoPlayerStats(playerOne, playerTwo, data) {
  if (playerOne.netScore > playerTwo.netScore) return -1;
  if (playerOne.netScore < playerTwo.netScore) return 1;
  
  // Same net score: use current ranking to break tie
  const rankOne = data.players.find(p => p.id === playerOne.id)?.ranking ?? Infinity;
  const rankTwo = data.players.find(p => p.id === playerTwo.id)?.ranking ?? Infinity;
  return rankTwo - rankOne; // Higher rank (lower number) comes first
}

function autoFillScores() {
  const data = loadData();
  const currentMatches = data.matches.filter(m => m.round === data.currentRound && !m.completed);
  
  if (currentMatches.length === 0) {
    return '没有待报分的比赛';
  }
  
  currentMatches.forEach(m => {
    const scores = generateRandomScore();
    const matchIndex = data.matches.findIndex(match => match.id === m.id);
    if (matchIndex !== -1) {
      data.matches[matchIndex].score1 = scores.score1;
      data.matches[matchIndex].score2 = scores.score2;
      data.matches[matchIndex].completed = true;
      data.matches[matchIndex].timestamp = Date.now();
    }
  });
  
  safeWriteJson(DATA_FILE, data);
  return '随机报分完成';
}

// Helper: Generate random badminton match score
function generateRandomScore() {
  const winner = Math.random() > 0.5 ? 1 : 2;
  const winScoreType = Math.random();
  let winScore, loseScore;
  
  if (winScoreType < 0.7) {
    winScore = 21;
    loseScore = Math.floor(Math.random() * 10) + 10;
  } else if (winScoreType < 0.85) {
    winScore = 22;
    loseScore = 20;
  } else {
    winScore = 23;
    loseScore = 21;
  }
  
  return {
    score1: winner === 1 ? winScore : loseScore,
    score2: winner === 2 ? winScore : loseScore
  };
}

module.exports = {
  CATEGORIES,
  currentDateTime,
  removeMatchesInCategory,
  sortPlayersByCategoryAndRanking,
  generateGroups,
  generateMatches,
  rankShift,
  finishRound,
  autoFillScores,
  loadData,
  getActivePlayers,
  calculateGroupSizes,
  generateRandomScore,
  generateRoundRobinMatches
};

