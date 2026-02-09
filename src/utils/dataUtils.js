const { DATA_FILE, ADMIN_CONFIG_FILE, safeReadJson, safeWriteJson } = require('./fileUtils');
const CATEGORIES = {
  male: '男双',
  female: '女双',
  fun: '娱乐'
};
// remove all matches of current round in given category
function removeMatchesInCategory(category) {
  const data = safeReadJson(DATA_FILE, { players: [], groups: [], matches: [] });
  return data.matches.filter(m => m.round !== data.currentRound || !m.id.includes(category));
}

// Generate groups for current round
function generateGroups() {
  const data = safeReadJson(DATA_FILE, { players: [], groups: [], matches: [] });

  const newGroups = [];
  let msg = '';
  
  Object.keys(CATEGORIES).forEach(cat => {
    msg += CATEGORIES[cat] + '分组情况：\n';
    const activePlayers = data.players.filter(p => p.active && p.category === cat).sort((a, b) => a.ranking - b.ranking);
    const total = activePlayers.length;
    
    if (total < 4) return;
    else if (total === 7 || total === 11) {
      msg += CATEGORIES[cat] + '无法分组，请调整人数\n';
    }
    else {
      const groupSizes = [];
      const remainder = total % 4;
      
      if (remainder === 0) {
        // total is divisible by 4: use all 4s
        for (let i = 0; i < total / 4; i++) groupSizes.push(4);
      } else if (remainder === 1) {
        // total = 4k + 1: use (k-1) 4s and one 5
        for (let i = 0; i < (total / 4 | 0) - 1; i++) groupSizes.push(4);
        groupSizes.push(5);
      } else if (remainder === 2) {
        // total = 4k + 2: use (k-2) 4s and two 5s
        for (let i = 0; i < (total / 4 | 0) - 2; i++) groupSizes.push(4);
        groupSizes.push(5, 5);
      } else {
        // remainder === 3: total = 4k + 3: use (k-3) 4s and three 5s
        for (let i = 0; i < (total / 4 | 0) - 3; i++) groupSizes.push(4);
        groupSizes.push(5, 5, 5);
      }
      
      // Assign players to groups
      let playerIndex = 0;
      groupSizes.forEach((size, index) => {
        const playerIds = activePlayers.slice(playerIndex, playerIndex + size).map(p => p.id);
        const groupId = `${cat}-group-${index + 1}`;
        newGroups.push({ id: groupId, level: index + 1, playerIds, category: cat });
        playerIndex += size;
        });
        msg += `共生成 ${groupSizes.length} 组\n`;
    }
    });
  data.groups = newGroups;
  safeWriteJson(DATA_FILE, data);
  return msg;
}

// Generate round-robin matches for all groups
function generateMatches() {
  const data = safeReadJson(DATA_FILE, { players: [], groups: [], matches: [] });

  // Remove existing matches of current round
  data.matches = data.matches.filter(m => m.round !== data.currentRound);

  data.groups.forEach(group => {
    data.matches.push(...generateRoundRobinMatches(group.playerIds, data.currentRound, group.id));
  });
  safeWriteJson(DATA_FILE, data);
  msg = `为本轮的 ${data.groups.length} 组生成了比赛`;
  return msg;
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
  const data = safeReadJson(DATA_FILE, { players: [], groups: [], matches: [], currentRound: 1, roundHistory: [] });
  const roundRankingsToChange = [];
  let msg = '本轮比赛结束，升降名次详情如下：\n';

  Object.keys(CATEGORIES).forEach(cat => {
    msg += `\n=== ${CATEGORIES[cat]} ===\n`;
    // Get groups in this category sorted by level
    const catGroups = data.groups.filter(g => g.category === cat).sort((a, b) => a.level - b.level);
    if (catGroups.length === 0) return;
    
    // Sort players within each group by net scores in this round
    const groupRankings = catGroups.map(g => {
      const groupMatches = data.matches.filter(m => m.groupId === g.id);
      const rankings = g.playerIds.map(id => {
        const stats = calculatePlayerStats(id, groupMatches);
        return { id, netScore: stats.netScore };
      }).sort((a, b) => b.netScore - a.netScore);
      return { groupId: g.id, level: g.level, rankings };
    });
    let promotedNames = '排名上升：';
    let relegatedNames = '排名下降：';
    // Record round rankings and determine promotions/relegations
    groupRankings.forEach((group, idx) => {
      group.rankings.forEach((r, rankIdx) => {
        const player = data.players.find(p => p.id === r.id);
        let change = 'none';
        if (idx > 0 && rankIdx === 0) {
          change = 'promoted';
          promotedNames += `${player.name}, `;
        }
        if (idx < groupRankings.length - 1 && rankIdx === group.rankings.length - 1) {
          change = 'relegated';
          relegatedNames += `${player.name}, `;
        }
        roundRankingsToChange.push({
          name: player.name,
          category: cat,
          group: group.level,
          netScore: r.netScore,
          change: change
        });
      });
      msg += promotedNames + '\n' + relegatedNames + '\n';
    });
    
    // Create a new ranking list to reflect promotions/relegations
    const newRanking = [];
    for (let i = 0; i < groupRankings.length; i++) {
      const rankings = groupRankings[i].rankings;
      if (i === 0) {
        newRanking.push(...rankings.map(r => r.id)); // top group, directly add
      } else {
        const promoted = rankings[0].id;
        const relegated = groupRankings[i - 1].rankings[groupRankings[i - 1].rankings.length - 1].id;
        newRanking.splice(newRanking.length - 1, 1, promoted, relegated);
        newRanking.push(...rankings.slice(1).map(r => r.id));
      }
    }
    
    newRanking.forEach((playerId, index) => {
      const playerIndex = data.players.findIndex(p => p.id === playerId);
      if (playerIndex !== -1) {
        data.players[playerIndex].ranking = index + 1;
      }
    });
  });
  
  data.roundHistory.push({ round: data.currentRound, rankings: roundRankingsToChange });
  data.currentRound++;
  safeWriteJson(DATA_FILE, data);
  msg += '请截图保存本轮升降名次详情以备查阅！';
  return msg;
}

// Calculate wins and net score for a player in given matches
function calculatePlayerStats(playerId, matches) {
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

// Sort players by category and ranking
function sortPlayersByCategoryAndRanking() {
  const data = safeReadJson(DATA_FILE, { players: [] });

  const categoryOrder = ['male', 'female', 'fun'];
  
  const sortedPlayers = data.players.sort((a, b) => {
    const catA = categoryOrder.indexOf(a.category);
    const catB = categoryOrder.indexOf(b.category);
    if (catA !== catB) {
      return catA - catB;
    }
    const rankA = typeof a.ranking === 'number' ? a.ranking : Infinity;
    const rankB = typeof b.ranking === 'number' ? b.ranking : Infinity;
    return rankA - rankB;
  });
  
  return sortedPlayers;
}

module.exports = {
  CATEGORIES,
  removeMatchesInCategory,
  sortPlayersByCategoryAndRanking,
  generateGroups,
  generateMatches,
  finishRound
};

