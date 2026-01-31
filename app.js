let data = { players: [], groups: [], matches: [], currentRound: 1, adminPassword: 'badminton2024' };

function init() {
  const stored = localStorage.getItem('badminton_ladder_data');
  if (stored) data = JSON.parse(stored);
  if (!data.adminPassword) data.adminPassword = 'badminton2024';
  data.players.forEach(p => {
    if (p.active === undefined) p.active = true;
  });
  showPage('home');
}

function saveData() {
  localStorage.setItem('badminton_ladder_data', JSON.stringify(data));
}

function showPage(page) {
  ['home', 'score', 'ranking', 'history', 'rules', 'admin'].forEach(p => {
    document.getElementById(`page-${p}`).classList.add('hidden');
    document.getElementById(`nav-${p}`).classList.remove('active');
  });
  document.getElementById(`page-${page}`).classList.remove('hidden');
  document.getElementById(`nav-${page}`).classList.add('active');

  if (page === 'home') renderHome();
  if (page === 'score') renderScore();
  if (page === 'ranking') renderRanking();
  if (page === 'history') renderHistory();
  if (page === 'admin') renderAdmin();
}

function getPlayerName(id) {
  const player = data.players.find(p => p.id === id);
  return player ? player.name : '未知';
}

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

function generateMatches(groupId, playerIds, round) {
  if (playerIds.length === 4) {
    const [p1, p2, p3, p4] = playerIds;
    return [
      { id: `${round}-${groupId}-1`, round, groupId, team1: [p1, p2], team2: [p3, p4], score1: null, score2: null, completed: false },
      { id: `${round}-${groupId}-2`, round, groupId, team1: [p1, p3], team2: [p2, p4], score1: null, score2: null, completed: false },
      { id: `${round}-${groupId}-3`, round, groupId, team1: [p1, p4], team2: [p2, p3], score1: null, score2: null, completed: false }
    ];
  } else if (playerIds.length === 5) {
    const [p1, p2, p3, p4, p5] = playerIds;
    return [
      { id: `${round}-${groupId}-1`, round, groupId, team1: [p1, p2], team2: [p3, p4], score1: null, score2: null, completed: false },
      { id: `${round}-${groupId}-2`, round, groupId, team1: [p1, p3], team2: [p2, p5], score1: null, score2: null, completed: false },
      { id: `${round}-${groupId}-3`, round, groupId, team1: [p1, p4], team2: [p3, p5], score1: null, score2: null, completed: false },
      { id: `${round}-${groupId}-4`, round, groupId, team1: [p1, p5], team2: [p2, p4], score1: null, score2: null, completed: false },
      { id: `${round}-${groupId}-5`, round, groupId, team1: [p2, p3], team2: [p4, p5], score1: null, score2: null, completed: false }
    ];
  } else if (playerIds.length === 6) {
    const [p1, p2, p3, p4, p5, p6] = playerIds;
    return [
      { id: `${round}-${groupId}-1`, round, groupId, team1: [p1, p2], team2: [p3, p4], score1: null, score2: null, completed: false },
      { id: `${round}-${groupId}-2`, round, groupId, team1: [p1, p3], team2: [p4, p5], score1: null, score2: null, completed: false },
      { id: `${round}-${groupId}-3`, round, groupId, team1: [p1, p4], team2: [p2, p6], score1: null, score2: null, completed: false },
      { id: `${round}-${groupId}-4`, round, groupId, team1: [p1, p5], team2: [p2, p3], score1: null, score2: null, completed: false },
      { id: `${round}-${groupId}-5`, round, groupId, team1: [p1, p6], team2: [p2, p4], score1: null, score2: null, completed: false },
      { id: `${round}-${groupId}-6`, round, groupId, team1: [p2, p5], team2: [p3, p6], score1: null, score2: null, completed: false },
      { id: `${round}-${groupId}-7`, round, groupId, team1: [p3, p5], team2: [p4, p6], score1: null, score2: null, completed: false },
      { id: `${round}-${groupId}-8`, round, groupId, team1: [p5, p6], team2: [p1, p2], score1: null, score2: null, completed: false }
    ];
  }
  return [];
}

function renderHome() {
  document.getElementById('home-round').textContent = data.currentRound;
  const container = document.getElementById('home-groups');
  
  if (data.groups.length === 0) {
    container.innerHTML = '<div class="card"><p>暂无分组，请前往管理页面创建选手和分组</p></div>';
    return;
  }

  const currentMatches = data.matches.filter(m => m.round === data.currentRound);
  let html = '';

  data.groups.sort((a, b) => a.level - b.level).forEach(group => {
    const groupMatches = currentMatches.filter(m => m.groupId === group.id);
    const rankings = group.playerIds.map(id => {
      const stats = calculatePlayerStats(id, groupMatches);
      return { id, name: getPlayerName(id), ...stats };
    }).sort((a, b) => b.wins !== a.wins ? b.wins - a.wins : b.netScore - a.netScore);

    html += `<div class="card">
      <h2>第 ${group.level} 组 (${group.playerIds.length}人)</h2>
      <table>
        <thead><tr><th>排名</th><th>选手</th><th style="text-align:center;">胜场</th><th style="text-align:center;">净胜分</th></tr></thead>
        <tbody>`;
    
    rankings.forEach((p, i) => {
      html += `<tr><td>${i+1}</td><td>${p.name}</td><td style="text-align:center;">${p.wins}</td><td style="text-align:center;">${p.netScore > 0 ? '+' : ''}${p.netScore}</td></tr>`;
    });

    html += `</tbody></table><div class="mt-20"><h3>本组比赛</h3>`;
    groupMatches.forEach(m => {
      const status = m.completed ? 'match-completed' : 'match-pending';
      const score = m.completed ? `${m.score1} : ${m.score2}` : '待比赛';
      html += `<div class="match-item ${status}">
        <span>${m.team1.map(getPlayerName).join(' / ')} vs ${m.team2.map(getPlayerName).join(' / ')}</span>
        <span style="font-weight:bold;">${score}</span>
      </div>`;
    });
    html += `</div></div>`;
  });

  container.innerHTML = html;
}

function renderScore() {
  const select = document.getElementById('score-match');
  const currentMatches = data.matches.filter(m => m.round === data.currentRound);
  const pending = currentMatches.filter(m => !m.completed);

  select.innerHTML = '<option value="">-- 请选择 --</option>';
  pending.forEach(m => {
    select.innerHTML += `<option value="${m.id}">${m.team1.map(getPlayerName).join('/')} vs ${m.team2.map(getPlayerName).join('/')}</option>`;
  });

  const completed = currentMatches.filter(m => m.completed);
  let html = '';
  completed.forEach(m => {
    html += `<div class="match-item match-completed">
      <span>${m.team1.map(getPlayerName).join(' / ')} vs ${m.team2.map(getPlayerName).join(' / ')}</span>
      <span style="font-weight:bold;color:#4CAF50;">${m.score1} : ${m.score2}</span>
      <button onclick="editScore('${m.id}')" class="btn-warning" style="padding:5px 10px;font-size:12px;margin-left:10px;">修改</button>
    </div>`;
  });
  document.getElementById('completed-matches').innerHTML = html || '<p>暂无已完成比赛</p>';
}

function editScore(matchId) {
  const match = data.matches.find(m => m.id === matchId);
  if (!match) return;

  const newScore1 = prompt(`请输入 ${match.team1.map(getPlayerName).join('/')} 的得分：`, match.score1);
  if (newScore1 === null) return;

  const newScore2 = prompt(`请输入 ${match.team2.map(getPlayerName).join('/')} 的得分：`, match.score2);
  if (newScore2 === null) return;

  const s1 = parseInt(newScore1);
  const s2 = parseInt(newScore2);

  if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) {
    alert('请输入有效分数');
    return;
  }

  data.matches = data.matches.map(m => {
    if (m.id === matchId) {
      return { ...m, score1: s1, score2: s2 };
    }
    return m;
  });

  saveData();
  alert('比分已修改！');
  renderScore();
}

function updateScoreForm() {
  const matchId = document.getElementById('score-match').value;
  const inputs = document.getElementById('score-inputs');
  
  if (!matchId) {
    inputs.classList.add('hidden');
    return;
  }

  const match = data.matches.find(m => m.id === matchId);
  document.getElementById('team1-label').textContent = match.team1.map(getPlayerName).join(' / ') + ' 得分';
  document.getElementById('team2-label').textContent = match.team2.map(getPlayerName).join(' / ') + ' 得分';
  inputs.classList.remove('hidden');
}

function submitScore(e) {
  e.preventDefault();
  const matchId = document.getElementById('score-match').value;
  const score1 = parseInt(document.getElementById('score1').value);
  const score2 = parseInt(document.getElementById('score2').value);

  if (!matchId || isNaN(score1) || isNaN(score2)) {
    alert('请填写完整信息');
    return;
  }

  data.matches = data.matches.map(m => {
    if (m.id === matchId) {
      return { ...m, score1, score2, completed: true };
    }
    return m;
  });

  saveData();
  document.getElementById('score-match').value = '';
  document.getElementById('score1').value = '';
  document.getElementById('score2').value = '';
  document.getElementById('score-inputs').classList.add('hidden');
  alert('比分已记录！');
  renderScore();
}

function renderRanking() {
  const allMatches = data.matches.filter(m => m.completed);
  const rankings = data.players.map(p => {
    const stats = calculatePlayerStats(p.id, allMatches);
    return { ...p, ...stats };
  }).sort((a, b) => b.wins !== a.wins ? b.wins - a.wins : b.netScore - a.netScore);

  let html = '';
  rankings.forEach((p, i) => {
    html += `<tr>
      <td>${i + 1}</td>
      <td>${p.name}</td>
      <td style="text-align:center;">${p.wins}</td>
      <td style="text-align:center;">${p.netScore > 0 ? '+' : ''}${p.netScore}</td>
      <td style="text-align:center;">${p.active ? '参赛' : '未参赛'}</td>
    </tr>`;
  });
  document.getElementById('ranking-table').innerHTML = html;
}

function renderHistory() {
  const container = document.getElementById('history-content');
  if (data.matches.length === 0) {
    container.innerHTML = '<div class="card"><p>暂无历史记录</p></div>';
    return;
  }

  const maxRound = Math.max(...data.matches.map(m => m.round));
  let html = '';

  for (let r = maxRound; r >= 1; r--) {
    const roundMatches = data.matches.filter(m => m.round === r && m.completed);
    if (roundMatches.length === 0) continue;

    html += `<div class="card"><h2>第 ${r} 轮</h2>`;
    roundMatches.forEach(m => {
      html += `<div class="match-item match-completed">
        <span>${m.team1.map(getPlayerName).join(' / ')} vs ${m.team2.map(getPlayerName).join(' / ')}</span>
        <span style="font-weight:bold;">${m.score1} : ${m.score2}</span>
      </div>`;
    });
    html += '</div>';
  }

  container.innerHTML = html;
}

function renderAdmin() {
  document.getElementById('player-count').textContent = data.players.length;
  const activePlayers = data.players.filter(p => p.active);
  document.getElementById('active-count').textContent = activePlayers.length;
  
  let html = '';
  data.players.forEach(p => {
    const statusClass = p.active ? '' : 'player-inactive';
    const statusBtn = p.active 
      ? `<button onclick="togglePlayerActive('${p.id}')" class="btn-warning" style="padding:5px 10px;font-size:12px;">停用</button>`
      : `<button onclick="togglePlayerActive('${p.id}')" class="btn-info" style="padding:5px 10px;font-size:12px;">启用</button>`;
    
    html += `<div class="player-item ${statusClass}">
      <span>${p.name} ${p.active ? '' : '(未参赛)'}</span>
      <div style="display:flex;gap:5px;">
        ${statusBtn}
        <button onclick="deletePlayer('${p.id}')" class="btn-danger" style="padding:5px 10px;font-size:12px;">删除</button>
      </div>
    </div>`;
  });
  document.getElementById('player-list').innerHTML = html || '<p>暂无选手</p>';

  if (data.groups.length > 0) {
    html = '<h3>当前分组</h3>';
    data.groups.sort((a, b) => a.level - b.level).forEach(g => {
      html += `<div style="padding:10px;background:#f5f5f5;border-radius:6px;margin-bottom:8px;">
        <strong>第 ${g.level} 组（${g.playerIds.length}人）：</strong>${g.playerIds.map(getPlayerName).join(', ')}
      </div>`;
    });
    document.getElementById('current-groups').innerHTML = html;
  } else {
    document.getElementById('current-groups').innerHTML = '';
  }

  const currentMatches = data.matches.filter(m => m.round === data.currentRound);
  const hasStarted = currentMatches.some(m => m.completed);
  document.getElementById('btn-generate').disabled = hasStarted;

  document.getElementById('stat-round').textContent = data.currentRound;
  document.getElementById('stat-players').textContent = data.players.length;
  document.getElementById('stat-active').textContent = activePlayers.length;
  document.getElementById('stat-groups').textContent = data.groups.length;
  document.getElementById('stat-matches').textContent = currentMatches.length;
  document.getElementById('stat-completed').textContent = currentMatches.filter(m => m.completed).length;
}

function addPlayer() {
  const name = document.getElementById('new-player-name').value.trim();
  if (!name) {
    alert('请输入选手姓名');
    return;
  }
  data.players.push({ id: `player-${Date.now()}`, name, active: true });
  saveData();
  document.getElementById('new-player-name').value = '';
  alert('选手已添加！');
  renderAdmin();
}

function deletePlayer(id) {
  const password = prompt('删除选手需要管理员密码：');
  if (password !== data.adminPassword) {
    alert('密码错误！');
    return;
  }
  if (!confirm('确定要删除这名选手吗？')) return;
  data.players = data.players.filter(p => p.id !== id);
  saveData();
  renderAdmin();
}

function togglePlayerActive(id) {
  const player = data.players.find(p => p.id === id);
  if (player) {
    player.active = !player.active;
    saveData();
    renderAdmin();
  }
}

function generateWeeklyGroups() {
  const activePlayers = data.players.filter(p => p.active);
  
  if (activePlayers.length < 4) {
    alert('至少需要4名参赛选手才能分组');
    return;
  }

  data.matches = data.matches.filter(m => m.round !== data.currentRound);

  const allHistoryMatches = data.matches.filter(m => m.completed);
  const playerRankings = activePlayers.map(p => {
    const stats = calculatePlayerStats(p.id, allHistoryMatches);
    return { ...p, ...stats };
  }).sort((a, b) => b.wins !== a.wins ? b.wins - a.wins : b.netScore - a.netScore);

  data.groups = [];
  let groupIndex = 0;
  let playerIndex = 0;

  while (playerIndex < playerRankings.length) {
    const remaining = playerRankings.length - playerIndex;
    let groupSize;
    
    if (remaining === 7 || remaining === 3 || remaining === 2 || remaining === 1) {
      alert(`剩余 ${remaining} 人无法分组。\n分组只支持4、5、6人。\n建议调整参赛人数。`);
      return;
    } else if (remaining === 10) {
      groupSize = 5;
    } else if (remaining === 6) {
      groupSize = 6;
    } else if (remaining === 5) {
      groupSize = 5;
    } else {
      groupSize = 4;
    }

    const playerIds = playerRankings.slice(playerIndex, playerIndex + groupSize).map(p => p.id);
    data.groups.push({ id: `group-${groupIndex + 1}`, level: groupIndex + 1, playerIds });
    playerIndex += groupSize;
    groupIndex++;
  }

  const newMatches = [];
  data.groups.forEach(g => {
    newMatches.push(...generateMatches(g.id, g.playerIds, data.currentRound));
  });
  data.matches.push(...newMatches);

  saveData();
  alert(`已生成第 ${data.currentRound} 轮分组，共 ${data.groups.length} 个组，${newMatches.length} 场比赛`);
  renderAdmin();
}

function finishRound() {
  const currentMatches = data.matches.filter(m => m.round === data.currentRound);
  if (currentMatches.length === 0) {
    alert('本轮还没有比赛');
    return;
  }
  
  const incomplete = currentMatches.filter(m => !m.completed);
  if (incomplete.length > 0) {
    const msg = `还有 ${incomplete.length} 场比赛未完成。\n\n如果这些比赛不打了，请报分为 0:0\n如果打了但没打完，请报实际分数（如 15:12）\n\n确定要继续升降级吗？`;
    if (!confirm(msg)) return;
  }

  const groupRankings = data.groups.map(g => {
    const gm = currentMatches.filter(m => m.groupId === g.id);
    const rankings = g.playerIds.map(id => ({ id, ...calculatePlayerStats(id, gm) }))
      .sort((a, b) => b.wins !== a.wins ? b.wins - a.wins : b.netScore - a.netScore);
    return { groupId: g.id, level: g.level, rankings };
  });

  const sorted = groupRankings.sort((a, b) => a.level - b.level);
  
  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    
    if (i > 0 && current.rankings.length >= 1) {
      const promoted = current.rankings[0].id;
      const upper = sorted[i - 1];
      
      const currentGroup = data.groups.find(g => g.id === current.groupId);
      currentGroup.playerIds = currentGroup.playerIds.filter(id => id !== promoted);
      
      const upperGroup = data.groups.find(g => g.id === upper.groupId);
      upperGroup.playerIds.push(promoted);
    }
    
    if (i < sorted.length - 1 && current.rankings.length >= 1) {
      const relegated = current.rankings[current.rankings.length - 1].id;
      const lower = sorted[i + 1];
      
      const currentGroup = data.groups.find(g => g.id === current.groupId);
      currentGroup.playerIds = currentGroup.playerIds.filter(id => id !== relegated);
      
      const lowerGroup = data.groups.find(g => g.id === lower.groupId);
      lowerGroup.playerIds.push(relegated);
    }
  }

  data.currentRound++;
  saveData();
  alert(`第 ${data.currentRound - 1} 轮结束！升降级已完成。\n请在下次比赛前点击"生成本轮分组"开始第 ${data.currentRound} 轮`);
  renderAdmin();
}

function exportData() {
  const dataStr = JSON.stringify(data, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `badminton-ladder-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  alert('数据已导出！');
}

function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (confirm('确定要导入数据吗？当前数据将被覆盖！')) {
          data = imported;
          saveData();
          alert('数据导入成功！');
          renderAdmin();
        }
      } catch (err) {
        alert('导入失败：文件格式错误');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function changePassword() {
  const oldPassword = prompt('请输入当前管理员密码：');
  if (oldPassword !== data.adminPassword) {
    alert('密码错误！');
    return;
  }

  const newPassword = prompt('请输入新密码：');
  if (!newPassword || newPassword.length < 6) {
    alert('密码至少需要6个字符');
    return;
  }

  const confirmPassword = prompt('请再次输入新密码：');
  if (newPassword !== confirmPassword) {
    alert('两次输入的密码不一致');
    return;
  }

  data.adminPassword = newPassword;
  saveData();
  alert('密码修改成功！');
}

function resetAllData() {
  const password = prompt('请输入管理员密码：');
  if (password !== data.adminPassword) {
    alert('密码错误！');
    return;
  }

  if (!confirm('⚠️ 第一次确认：确定要清空所有数据吗？')) return;
  if (!confirm('⚠️ 第二次确认：此操作不可恢复！真的要清空吗？')) return;
  
  const finalConfirm = prompt('最后确认：请输入"确认删除"四个字：');
  if (finalConfirm !== '确认删除') {
    alert('已取消操作');
    return;
  }

  localStorage.removeItem('badminton_ladder_data');
  data = { players: [], groups: [], matches: [], currentRound: 1, adminPassword: 'badminton2024' };
  alert('数据已清空');
  renderAdmin();
}

init();
