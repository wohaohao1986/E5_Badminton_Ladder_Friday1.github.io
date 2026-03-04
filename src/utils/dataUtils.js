const { DATA_FILE, ADMIN_CONFIG_FILE, safeReadJson, safeWriteJson } = require('./fileUtils');
const CATEGORIES = {
  huitailang: '灰太狼',
  xiyangyang: '喜羊羊'
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
  data.matches = data.matches.filter(m => m.round !== data.currentRound || !m.id.includes(category));
  safeWriteJson(DATA_FILE, data);
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
function rerankPlayer(playerIndex, rank, isActive, isCategoryChange = false) {
  const data = loadData();
  if (playerIndex === -1) return;
  const player = data.players[playerIndex];
  if (rank !== null) {
    player.ranking = rank;
    // Find the actual index of the player in the array
    const actualIndex = data.players.findIndex(p => p.id === player.id);
    // Remove the player from current position
    if (actualIndex !== -1) {
      data.players.splice(actualIndex, 1);
    }
    // Find correct insertion position: after all players in same category with lower rank
    let insertIndex = 0;
    for (let i = 0; i < data.players.length; i++) {
      if (data.players[i].category === player.category && data.players[i].ranking < rank) {
        insertIndex = i + 1;
      }
    }
    data.players.splice(insertIndex, 0, player);
  }
  if (isActive !== null) {
    player.active = isActive;
    if (isActive) {
      // Step 1: Get last round ranking and determine initial position based on avgRankInCat
      const lastRoundRanking = getLastRoundRankingInCategory(player.category);
      const activePlayersInCat = data.players.filter(p => p.active && p.category === player.category);
      
      let targetRank = Math.ceil(player.avgRankInCat);
      console.log(`Initial target rank for player ${player.name} in category ${CATEGORIES[player.category]} based on avgRankInCat ${player.avgRankInCat} is ${targetRank}`);
      // Only use last round matching if avgRankInCat is within the last round size
      if (lastRoundRanking && lastRoundRanking.length > 0 && typeof player.avgRankInCat === 'number' && Math.floor(player.avgRankInCat) <= lastRoundRanking.length) {
        const floorPos = Math.floor(player.avgRankInCat) - 1; // 0-indexed position in last round list
        const ceilPos = Math.ceil(player.avgRankInCat) - 1;   // 0-indexed position in last round list
        
        // Get the player names who were at floor and ceil positions in last round
        const floorPlayerName = floorPos >= 0 && floorPos < lastRoundRanking.length ? lastRoundRanking[floorPos].name : null;
        const ceilPlayerName = ceilPos >= 0 && ceilPos < lastRoundRanking.length ? lastRoundRanking[ceilPos].name : null;
        
        // Find these players in current active list
        const floorPlayer = floorPlayerName ? activePlayersInCat.find(p => p.name === floorPlayerName) : null;
        const ceilPlayer = ceilPlayerName ? activePlayersInCat.find(p => p.name === ceilPlayerName) : null;
        
        console.log(`For player ${player.name}, floor player in last round is ${floorPlayerName} (${floorPlayer ? 'active' : 'inactive'}), ceil player in last round is ${ceilPlayerName} (${ceilPlayer ? 'active' : 'inactive'})`);
        
        // If both floor and ceil players are the same as current player, just set rank to avgRankInCat
        if (floorPlayer && ceilPlayer && floorPlayer.id === player.id && ceilPlayer.id === player.id) {
          targetRank = Math.ceil(player.avgRankInCat);
          console.log(`Floor and ceil players are same as current player ${player.name}, setting rank to ${targetRank}`);
        }
        // Determine target rank based on which players exist
        else if (floorPlayer && ceilPlayer) {
          // Both exist, position between them
          const minRank = Math.min(floorPlayer.ranking, ceilPlayer.ranking);
          const maxRank = Math.max(floorPlayer.ranking, ceilPlayer.ranking);
          targetRank = minRank + 1;
          // Ensure we're properly positioned between them
          if (targetRank >= maxRank) {
            targetRank = minRank;
          }
        } else if (floorPlayer) {
          // Only floor exists, position right after
          targetRank = floorPlayer.ranking + 1;
        } else if (ceilPlayer) {
          // Only ceil exists, position at or above ceil player
          targetRank = ceilPlayer.ranking;
        } else {
          // Neither exists, find closest active players from last round rankings
          let closestFloor = null;
          let closestFloorPos = -1;
          
          // Search backward from floor position
          for (let i = floorPos; i >= 0; i--) {
            const playerName = lastRoundRanking[i].name;
            const candidate = activePlayersInCat.find(p => p.name === playerName);
            if (candidate) {
              closestFloor = candidate;
              closestFloorPos = i;
              break;
            }
          }
          
          let closestCeil = null;
          let closestCeilPos = lastRoundRanking.length;
          
          // Search forward from ceil position
          for (let i = ceilPos; i < lastRoundRanking.length; i++) {
            const playerName = lastRoundRanking[i].name;
            const candidate = activePlayersInCat.find(p => p.name === playerName);
            if (candidate) {
              closestCeil = candidate;
              closestCeilPos = i;
              break;
            }
          }
          
          if (closestFloor && closestCeil) {
            // Position between closest floor and ceil
            const minRank = Math.min(closestFloor.ranking, closestCeil.ranking);
            const maxRank = Math.max(closestFloor.ranking, closestCeil.ranking);
            // Position right after the better-ranked player (closer to floor)
            targetRank = minRank + 1;
            // Ensure we're properly positioned between them
            if (targetRank >= maxRank) {
              targetRank = maxRank - 1;
            }
          } else if (closestFloor) {
            // Only closest floor exists
            targetRank = closestFloor.ranking + 1;
          } else if (closestCeil) {
            // Only closest ceil exists
            targetRank = closestCeil.ranking;
          } else {
            // Fallback - position at calculated avgRankInCat
            targetRank = Math.ceil(player.avgRankInCat);
          }
        }
      }
      console.log(`Calculated target rank for player ${player.name} in category ${CATEGORIES[player.category]} is ${targetRank} based on avgRankInCat ${player.avgRankInCat}`);
      // Ensure targetRank is within valid range
      targetRank = Math.max(1, Math.min(targetRank, activePlayersInCat.length + 1));
      player.ranking = targetRank;
      player.returnCurrentRound = true;
      
      // Step 2: Adjust rank by comparing with adjacent returned players (skip for category changes)
      if (!isCategoryChange) {
        let currentRank = player.ranking;
        let adjusted = true;
        
        while (adjusted) {
          adjusted = false;
          
          // Check left neighbor (rank = currentRank - 1)
          if (currentRank > 1) {
            const leftNeighbor = activePlayersInCat.find(p => p.ranking === currentRank - 1);
            if (leftNeighbor && leftNeighbor.returnCurrentRound) {
              // Left neighbor also returned, compare avgRanks
              // Smaller avgRank is better, so if left neighbor has worse (larger) avgRank, move current up
              if (leftNeighbor.avgRankInCat > player.avgRankInCat) {
                currentRank--;
                adjusted = true;
              }
            }
          }
          
          // Check right neighbor (rank = currentRank + 1)
          if (!adjusted && currentRank < activePlayersInCat.length) {
            const rightNeighbor = activePlayersInCat.find(p => p.ranking === currentRank + 1);
            if (rightNeighbor && rightNeighbor.returnCurrentRound) {
              // Right neighbor also returned, compare avgRanks
              // If right neighbor has better (smaller) avgRank, move current down
              if (rightNeighbor.avgRankInCat < player.avgRankInCat) {
                currentRank++;
                adjusted = true;
              }
            }
          }
        }
        
        player.ranking = currentRank;
        console.log(`Adjusted target rank for player ${player.name} in category ${CATEGORIES[player.category]} is ${player.ranking} after comparing with adjacent returned players`);
      }
    } else {
      data.players[playerIndex].ranking = '-';
    }
  }
  safeWriteJson(DATA_FILE, data);
  sortPlayersByRanking();
}

function getLastRoundRankingInCategory(category) {
  const data = loadData();
  const lastRound = data.roundHistory.length > 0 ? data.roundHistory[data.roundHistory.length - 1] : null;
  if (!lastRound) return null;
  const lastRoundRanking = lastRound.rankings.filter(r => r.category === category);
  
  // Swap adjacent relegated and promoted pairs
  for (let i = 0; i < lastRoundRanking.length - 1; i++) {
    const current = lastRoundRanking[i];
    const next = lastRoundRanking[i + 1];
    
    // If current is relegated and next is promoted, swap them
    if (current.change === 'relegated' && next.change === 'promoted') {
      [lastRoundRanking[i], lastRoundRanking[i + 1]] = [lastRoundRanking[i + 1], lastRoundRanking[i]];
      // Continue from next position since we just swapped
      i++;
    }
  }

  // Remove players who is not currently active in this category
  const activePlayersInCat = data.players.filter(p => p.active && p.category === category);
  const filteredLastRoundRanking = lastRoundRanking.filter(r => activePlayersInCat.some(p => p.name === r.name));
  return filteredLastRoundRanking;
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
  
  // Update each player's stats with matches from this round
  data.players.forEach(player => {
    player.returnCurrentRound = false; // reset returnCurrentRound flag after processing stats
    const playerMatches = currentRoundMatches.filter(m => m.completed && (m.team1.includes(player.id) || m.team2.includes(player.id)));
    if (playerMatches.length > 0) {
      // Separate into 21-point and 15-point matches
      const twentyOneMatches = playerMatches.filter(m => Math.max(m.score1, m.score2) === 21);
      const fifteenMatches = playerMatches.filter(m => Math.max(m.score1, m.score2) === 15);
      
      // Update 21-point stats
      if (twentyOneMatches.length > 0) {
        const twentyOneStats = calculatePlayerStatsByMatches(player.id, twentyOneMatches);
        player.numberOfMatchesTwentyOne = (player.numberOfMatchesTwentyOne || 0) + twentyOneMatches.length;
        player.winsTwentyOne = (player.winsTwentyOne || 0) + twentyOneStats.wins;
        player.totalNetScoreTwentyOne = (player.totalNetScoreTwentyOne || 0) + twentyOneStats.netScore;
      }
      
      // Update 15-point stats
      if (fifteenMatches.length > 0) {
        const fifteenStats = calculatePlayerStatsByMatches(player.id, fifteenMatches);
        player.numberOfMatchesFifteen = (player.numberOfMatchesFifteen || 0) + fifteenMatches.length;
        player.winsFifteen = (player.winsFifteen || 0) + fifteenStats.wins;
        player.totalNetScoreFifteen = (player.totalNetScoreFifteen || 0) + fifteenStats.netScore;
      }
    }
  });
  
  data.matchHistory.push(...currentRoundMatches);
  // Remove current round matches from data.matches
  data.matches = data.matches.filter(m => m.round !== data.currentRound);
  // Clear current groups
  data.groups.length = 0;
  data.currentRound++;
  safeWriteJson(DATA_FILE, data);
  calculateAllPlayerAvgRankInCat();
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

function calculatePlayerStats() {
  const data = loadData();
  
  // For each player, calculate their stats from matchHistory separated by match type
  data.players.forEach(player => {
    console.log(`Calculating stats for player: ${player.name}`);
    
    // Separate completed matches into 21-point and 15-point matches
    const twentyOneMatches = data.matchHistory.filter(match => {
      return match.completed && 
             (match.team1.includes(player.id) || match.team2.includes(player.id)) &&
             Math.max(match.score1, match.score2) === 21;
    });
    
    const fifteenMatches = data.matchHistory.filter(match => {
      return match.completed && 
             (match.team1.includes(player.id) || match.team2.includes(player.id)) &&
             Math.max(match.score1, match.score2) === 15;
    });
    
    // Calculate stats for 21-point matches
    const twentyOneStats = calculatePlayerStatsByMatches(player.id, twentyOneMatches);
    player.numberOfMatchesTwentyOne = twentyOneMatches.length;
    player.winsTwentyOne = twentyOneStats.wins;
    player.totalNetScoreTwentyOne = twentyOneStats.netScore;
    
    // Calculate stats for 15-point matches
    const fifteenStats = calculatePlayerStatsByMatches(player.id, fifteenMatches);
    player.numberOfMatchesFifteen = fifteenMatches.length;
    player.winsFifteen = fifteenStats.wins;
    player.totalNetScoreFifteen = fifteenStats.netScore;
  });
  
  // Step 4: Write the updated data back to the file
  safeWriteJson(DATA_FILE, data);
}
function calculatePlayerAvgRankInCat(playerName) {
  const data = loadData();
  const player = data.players.find(p => p.name === playerName);
  
  if (!player) return;
  
  player.avgRankInCat = 0;
  player.roundPlayed = 0;
  
  let ranks = [];
  data.roundHistory.forEach(round => {
    const ranking = round.rankings.find(r => r.name === playerName);
    if (!ranking || ranking.category !== player.category) return;
    
    let playerRankIndex = round.rankings.filter(r => r.category === player.category).findIndex(r => r.name === playerName);
    let playerRank = playerRankIndex + 1;
    
    if (ranking.change === 'promoted') playerRank -= 1;
    else if (ranking.change === 'relegated') playerRank += 1;
    
    ranks.push(playerRank);
    player.roundPlayed += 1;
  });
  
  if (player.roundPlayed > 0) {
    player.avgRankInCat = parseFloat((ranks.reduce((sum, r) => sum + r, 0) / player.roundPlayed).toFixed(2));
  } 
  else if (player.roundPlayed > 10) {
    // only calculate most recent 10 rounds
    const recentRanks = ranks.slice(-10);
    player.avgRankInCat = parseFloat((recentRanks.reduce((sum, r) => sum + r, 0) / recentRanks.length).toFixed(2));
  }
  else {
    player.avgRankInCat = '-';
  }
  
  data.players.find(p => p.name === playerName).avgRankInCat = player.avgRankInCat;
  data.players.find(p => p.name === playerName).roundPlayed = player.roundPlayed;
  safeWriteJson(DATA_FILE, data);
}

function calculateAllPlayerAvgRankInCat() {
  const data = loadData();
  data.players.forEach(player => {
    calculatePlayerAvgRankInCat(player.name);
  });
}

function sortPlayersByRanking() {
  const data = loadData();
  const categoryOrder = ['huitailang', 'xiyangyang'];
  
  data.players = data.players.sort((a, b) => {
    const catA = categoryOrder.indexOf(a.category);
    const catB = categoryOrder.indexOf(b.category);
    if (catA !== catB) return catA - catB;
    
    // Sort active players before inactive ones
    const activeA = a.active ? 0 : 1;
    const activeB = b.active ? 0 : 1;
    if (activeA !== activeB) return activeA - activeB;
    
    const rankA = typeof a.ranking === 'number' ? a.ranking : Infinity;
    const rankB = typeof b.ranking === 'number' ? b.ranking : Infinity;
    return rankA - rankB;
  });
  
  // Reassign rankings to ensure sequential order for active players
  Object.keys(CATEGORIES).forEach(cat => {
    const catPlayers = data.players.filter(p => p.category === cat && p.active);
    catPlayers.forEach((p, index) => {
      const playerIndex = data.players.findIndex(player => player.id === p.id);
      if (playerIndex !== -1) {
        data.players[playerIndex].ranking = index + 1;
      }
    });
  });
  safeWriteJson(DATA_FILE, data);
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
  const winScore = 21; // Winner always gets 21
  const loseScore = Math.floor(Math.random() * 10) + 10; // Loser gets random score between 10-19
  
  return {
    score1: winner === 1 ? winScore : loseScore,
    score2: winner === 2 ? winScore : loseScore
  };
}

module.exports = {
  CATEGORIES,
  currentDateTime,
  removeMatchesInCategory,
  sortPlayersByRanking,
  generateGroups,
  generateMatches,
  rerankPlayer,
  finishRound,
  autoFillScores,
  calculatePlayerStats,
  loadData,
  getActivePlayers,
  calculateGroupSizes,
  generateRandomScore,
  generateRoundRobinMatches,
  calculatePlayerAvgRankInCat,
  calculateAllPlayerAvgRankInCat
};

