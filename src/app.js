// 新版本 V2 - 基于排名系统
let data = { 
  players: [], 
  groups: [], 
  matches: [], 
  currentRound: 1, 
  adminPassword: 'e52026',
  rankingModified: false,
  roundHistory: []
};

const CATEGORIES = {
  male: '男双',
  female: '女双',
  fun: '娱乐'
};

// Server base URL for API calls. Default to localhost:3000 so client opened from file:// can reach server.
const SERVER_BASE = (function(){
  try {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return `${window.location.protocol}//${host}:3000`;
    }
  } catch (e) {}
  return 'http://localhost:3000';
})();

function addDataToServer(path, payload) {
  const url = `${SERVER_BASE}${path}`;
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(res => {
    if (!res.ok) throw new Error(`Server responded ${res.status}`);
    return res.json().catch(() => ({}));
  }).catch(err => {
    console.warn('sendToServer error:', err);
  });
}

function updateDataToServer(path, payload) {
  const url = `${SERVER_BASE}${path}`;
  return fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(res => {
    if (!res.ok) throw new Error(`Server responded ${res.status}`);
    return res.json().catch(() => ({}));
  }).catch(err => {
    console.warn('updateDataToServer error:', err);
  });
}


function getFromServer(path) {
  const url = `${SERVER_BASE}${path}`;
  return fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  }).then(res => {
    if (!res.ok) throw new Error(`Server responded ${res.status}`);
    return res.json();
  }).catch(err => {
    console.warn('getFromServer error:', err);
  });
}

function deleteFromServer(path, payload) {
  // send DELETE to server and return the fetch promise so caller can await it
  try {
    return fetch(`${SERVER_BASE}${path}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: payload ? JSON.stringify(payload) : undefined
    }).then(res => res.json()).catch(err => {
      console.warn('Failed to notify server of deletion:', err);
      return null;
    });
  } catch (e) {
    console.warn('Error sending delete to server:', e);
    return Promise.resolve(null);
  }
}

async function syncDataFromServer() {
  data = await getFromServer('/api/main');
}

async function saveData(path, payload) {
  // always persist locally first for immediate UI responsiveness
  try {
    localStorage.setItem('badminton_ladder_v2', JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to write to localStorage:', e);
  }

  // if a server path is provided, send payload then refresh authoritative data
  if (path) {
    try {
      await addDataToServer(path, payload);
      await getFromServer('api/main');
    } catch (e) {
      console.warn('saveData: server sync failed', e);
    }
  }
}

async function init() {
  // Try to load authoritative player data from server first (falls back to localStorage)
  syncDataFromServer();
  if (!data.adminPassword) data.adminPassword = 'e52026';
  if (data.rankingModified === undefined) data.rankingModified = false;
  if (!data.roundHistory) data.roundHistory = [];
  
  data.players.forEach(p => {
    if (p.active === undefined) p.active = true;
    if (p.ranking === undefined) p.ranking = 999;
    if (!p.category) p.category = 'fun';
  });
  
  showPage('home');
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

function renderHome() {
  document.getElementById('home-round').textContent = data.currentRound;
  const container = document.getElementById('home-groups');
  
  let html = '';
  
  Object.keys(CATEGORIES).forEach(cat => {
    const catGroups = data.groups.filter(g => g.category === cat).sort((a, b) => a.level - b.level);
    
    if (catGroups.length === 0) return;
    
    html += `<h2 style="color:#4CAF50;margin-top:30px;margin-bottom:15px;">${CATEGORIES[cat]}</h2>`;
    
    const currentMatches = data.matches.filter(m => m.round === data.currentRound && m.category === cat);
    
    catGroups.forEach(group => {
      const groupMatches = currentMatches.filter(m => m.groupId === group.id);
      const rankings = group.playerIds.map(id => {
        const stats = calculatePlayerStats(id, groupMatches);
        return { id, name: getPlayerName(id), ...stats };
      }).sort((a, b) => b.netScore - a.netScore);

      html += `<div class="card">
        <h2>第 ${group.level} 组 (${group.playerIds.length}人)</h2>
        <table>
          <thead><tr><th>排名</th><th>选手</th><th style="text-align:center;">净胜分</th></tr></thead>
          <tbody>`;
      
      rankings.forEach((p, i) => {
        html += `<tr><td>${i+1}</td><td>${p.name}</td><td style="text-align:center;">${p.netScore > 0 ? '+' : ''}${p.netScore}</td></tr>`;
      });

      html += `</tbody></table>`;
      
      if (groupMatches.length > 0) {
        html += `<div class="mt-20"><h3>本组比赛</h3>`;
        groupMatches.forEach(m => {
          const status = m.completed ? 'match-completed' : 'match-pending';
          const score = m.completed ? `${m.score1} : ${m.score2}` : '待比赛';
          html += `<div class="match-item ${status}">
            <span>${m.team1.map(getPlayerName).join(' / ')} vs ${m.team2.map(getPlayerName).join(' / ')}</span>
            <span style="font-weight:bold;">${score}</span>
          </div>`;
        });
        html += `</div>`;
      } else {
        html += `<div class="mt-20"><p style="color:#ff9800;">人数不符合分组规则，暂无比赛</p></div>`;
      }
      
      html += `</div>`;
    });
  });
  
  if (!html) {
    html = '<div class="card"><p>暂无分组，请前往管理页面生成分组</p></div>';
  }

  container.innerHTML = html;
}

function renderScore() {
  const select = document.getElementById('score-match');
  const currentMatches = data.matches.filter(m => m.round === data.currentRound);
  const pending = currentMatches.filter(m => !m.completed);

  select.innerHTML = '<option value="">-- 请选择 --</option>';
  
  Object.keys(CATEGORIES).forEach(cat => {
    const catPending = pending.filter(m => m.category === cat);
    if (catPending.length > 0) {
      select.innerHTML += `<option disabled style="font-weight:bold;">--- ${CATEGORIES[cat]} ---</option>`;
      catPending.forEach(m => {
        select.innerHTML += `<option value="${m.id}">${m.team1.map(getPlayerName).join('/')} vs ${m.team2.map(getPlayerName).join('/')}</option>`;
      });
    }
  });

  const completed = currentMatches.filter(m => m.completed);
  let html = '';
  completed.forEach(m => {
    const time = m.timestamp ? new Date(m.timestamp).toLocaleString('zh-CN') : '';
    html += `<div class="match-item match-completed">
      <div>
        <div>${m.team1.map(getPlayerName).join(' / ')} vs ${m.team2.map(getPlayerName).join(' / ')}</div>
        <div style="font-size:12px;color:#666;">${time}</div>
      </div>
      <div>
        <span style="font-weight:bold;color:#4CAF50;">${m.score1} : ${m.score2}</span>
        <button onclick="editScore('${m.id}')" class="btn-warning" style="padding:5px 10px;font-size:12px;margin-left:10px;">修改</button>
      </div>
    </div>`;
  });
  document.getElementById('completed-matches').innerHTML = html || '<p>暂无已完成比赛</p>';
}

function renderRanking() {
  const container = document.getElementById('ranking-list');
  let html = '';
  
  Object.keys(CATEGORIES).forEach(cat => {
    const catPlayers = data.players.filter(p => p.category === cat).sort((a, b) => a.ranking - b.ranking);
    if (catPlayers.length === 0) return;
    
    html += `<h2 style="color:#4CAF50;margin-top:20px;margin-bottom:15px;">${CATEGORIES[cat]}</h2>`;
    catPlayers.forEach((p, index) => {
      const statusClass = p.active ? '' : 'player-inactive';
      html += `<div class="ranking-item ${statusClass}">
        <span style="font-weight:bold;min-width:40px;">#${index + 1}</span>
        <span style="flex:1;">${p.name}</span>
        <span style="color:#666;">${p.active ? '参赛' : '未参赛'}</span>
      </div>`;
    });
  });
  
  container.innerHTML = html || '<p>暂无选手</p>';
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
    
    const roundHistory = data.roundHistory.find(rh => rh.round === r);
    if (roundHistory) {
      html += '<h3 style="margin-top:15px;">本轮排名与升降级</h3>';
      
      Object.keys(CATEGORIES).forEach(cat => {
        const catRankings = roundHistory.rankings.filter(item => item.category === cat);
        if (catRankings.length === 0) return;
        
        html += `<h4 style="color:#4CAF50;margin-top:15px;">${CATEGORIES[cat]}</h4>`;
        html += '<table style="margin-bottom:15px;"><thead><tr><th>排名</th><th>选手</th><th style="text-align:center;">组别</th><th style="text-align:center;">净胜分</th><th style="text-align:center;">升降级</th></tr></thead><tbody>';
        catRankings.forEach((item, index) => {
          let changeIcon = '';
          if (item.change === 'promoted') changeIcon = '<span style="color:#4CAF50;">↑ 升级</span>';
          else if (item.change === 'relegated') changeIcon = '<span style="color:#f44336;">↓ 降级</span>';
          else changeIcon = '<span style="color:#999;">-</span>';
          
          html += `<tr>
            <td>${index + 1}</td>
            <td>${item.name}</td>
            <td style="text-align:center;">第${item.group}组</td>
            <td style="text-align:center;">${item.netScore > 0 ? '+' : ''}${item.netScore}</td>
            <td style="text-align:center;">${changeIcon}</td>
          </tr>`;
        });
        html += '</tbody></table>';
      });
    }
    
    html += '<h3>比赛结果</h3>';
    roundMatches.forEach(m => {
      const time = m.timestamp ? new Date(m.timestamp).toLocaleString('zh-CN') : '';
      html += `<div class="match-item match-completed">
        <div>
          <div>${m.team1.map(getPlayerName).join(' / ')} vs ${m.team2.map(getPlayerName).join(' / ')}</div>
          <div style="font-size:12px;color:#666;">${time}</div>
        </div>
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
  Object.keys(CATEGORIES).forEach(cat => {
    const catPlayers = data.players.filter(p => p.category === cat).sort((a, b) => a.ranking - b.ranking);
    if (catPlayers.length === 0) return;
    
    html += `<h3 style="color:#4CAF50;margin-top:20px;margin-bottom:10px;">${CATEGORIES[cat]}</h3>`;
    catPlayers.forEach((p, index) => {
      const statusClass = p.active ? '' : 'player-inactive';
      const statusBtn = p.active 
        ? `<button onclick="togglePlayerActive('${p.id}')" class="btn-warning" style="padding:5px 10px;font-size:12px;">停用</button>`
        : `<button onclick="togglePlayerActive('${p.id}')" class="btn-info" style="padding:5px 10px;font-size:12px;">启用</button>`;
      
      html += `<div class="ranking-item ${statusClass}">
        <span style="font-weight:bold;min-width:40px;">#${index + 1}</span>
        <span style="flex:1;">${p.name}</span>
        <span style="color:#666;margin-right:10px;">${CATEGORIES[p.category]}</span>
        <div style="display:flex;gap:5px;">
          <button onclick="changePlayerCategory('${p.id}')" class="btn-info" style="padding:5px 10px;font-size:12px;">改类别</button>
          ${statusBtn}
          <button onclick="deletePlayer('${p.id}')" class="btn-danger" style="padding:5px 10px;font-size:12px;">删除</button>
        </div>
      </div>`;
    });
  });
  document.getElementById('player-ranking-list').innerHTML = html || '<p>暂无选手</p>';

  if (data.groups.length > 0) {
    html = '<h3>当前分组</h3>';
    Object.keys(CATEGORIES).forEach(cat => {
      const catGroups = data.groups.filter(g => g.category === cat).sort((a, b) => a.level - b.level);
      if (catGroups.length === 0) return;
      html += `<h4 style="color:#4CAF50;margin-top:15px;">${CATEGORIES[cat]}</h4>`;
      catGroups.forEach(g => {
        html += `<div style="padding:10px;background:#f5f5f5;border-radius:6px;margin-bottom:8px;">
          <strong>第 ${g.level} 组（${g.playerIds.length}人）：</strong>${g.playerIds.map(getPlayerName).join('、')}
        </div>`;
      });
    });
    document.getElementById('current-groups').innerHTML = html;
  } else {
    document.getElementById('current-groups').innerHTML = '';
  }

  const currentMatches = data.matches.filter(m => m.round === data.currentRound);
  document.getElementById('btn-generate').disabled = hasAnyMatchStarted();

  document.getElementById('stat-round').textContent = data.currentRound;
  document.getElementById('stat-players').textContent = data.players.length;
  document.getElementById('stat-active').textContent = activePlayers.length;
  document.getElementById('stat-groups').textContent = data.groups.length;
  document.getElementById('stat-matches').textContent = currentMatches.length;
  document.getElementById('stat-completed').textContent = currentMatches.filter(m => m.completed).length;
}

function renderGroupEditor() {
  const container = document.getElementById('edit-groups-content');
  let html = '';
  
  data.groups.forEach((group, gIndex) => {
    html += `<div style="margin-bottom:20px;padding:15px;background:#f9f9f9;border-radius:6px;">
      <h4>第 ${group.level} 组</h4>`;
    
    group.playerIds.forEach((playerId, pIndex) => {
      const playerName = getPlayerName(playerId);
      html += `<div style="display:flex;align-items:center;gap:10px;margin:10px 0;">
        <span style="flex:1;">${playerName}</span>
        <select onchange="movePlayerToGroup('${playerId}', ${gIndex}, this.value)" style="width:150px;">
          <option value="">移动到...</option>`;
      
      data.groups.forEach((g, idx) => {
        if (idx !== gIndex) {
          html += `<option value="${idx}">第 ${g.level} 组</option>`;
        }
      });
      
      html += `</select>
      </div>`;
    });
    
    html += `</div>`;
  });
  
  container.innerHTML = html;
}

// helper to get player name by ID 
function getPlayerName(id) {
  const player = data.players.find(p => p.id === id);
  return player ? player.name : '未知';
}

function hasAnyMatchStarted() {
  const currentMatches = data.matches.filter(m => m.round === data.currentRound);
  return currentMatches.some(m => m.completed);
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
  } else if (playerIds.length === 6) {
    const [p1, p2, p3, p4, p5, p6] = playerIds;
    return [
      { id: `${round}-${groupId}-1`, round, groupId, team1: [p1, p2], team2: [p3, p4], score1: null, score2: null, completed: false, timestamp: null },
      { id: `${round}-${groupId}-2`, round, groupId, team1: [p1, p3], team2: [p4, p5], score1: null, score2: null, completed: false, timestamp: null },
      { id: `${round}-${groupId}-3`, round, groupId, team1: [p1, p4], team2: [p2, p6], score1: null, score2: null, completed: false, timestamp: null },
      { id: `${round}-${groupId}-4`, round, groupId, team1: [p1, p5], team2: [p2, p3], score1: null, score2: null, completed: false, timestamp: null },
      { id: `${round}-${groupId}-5`, round, groupId, team1: [p1, p6], team2: [p2, p4], score1: null, score2: null, completed: false, timestamp: null },
      { id: `${round}-${groupId}-6`, round, groupId, team1: [p2, p5], team2: [p3, p6], score1: null, score2: null, completed: false, timestamp: null },
      { id: `${round}-${groupId}-7`, round, groupId, team1: [p3, p5], team2: [p4, p6], score1: null, score2: null, completed: false, timestamp: null },
      { id: `${round}-${groupId}-8`, round, groupId, team1: [p5, p6], team2: [p1, p2], score1: null, score2: null, completed: false, timestamp: null }
    ];
  }
  return [];
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
      return { ...m, score1, score2, completed: true, timestamp: Date.now() };
    }
    return m;
  });

  updateDataToServer('/api/match', { id: matchId, score1, score2, completed: true, timestamp: Date.now() });
  document.getElementById('score-match').value = '';
  document.getElementById('score1').value = '';
  document.getElementById('score2').value = '';
  document.getElementById('score-inputs').classList.add('hidden');
  alert('比分已记录！');
  renderScore();
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
      return { ...m, score1: s1, score2: s2, timestamp: Date.now() };
    }
    return m;
  });

  updateDataToServer('/api/match', { id: matchId, score1: s1, score2: s2, timestamp: Date.now() });
  alert('比分已修改！');
  renderScore();
}

async function changePlayerCategory(id) {
  if (hasAnyMatchStarted()) {
    alert('比赛已开始，无法修改选手类别');
    return;
  }

  const player = data.players.find(p => p.id === id);
  if (!player) return;
  
  const newCat = prompt(`${player.name} 当前类别：${CATEGORIES[player.category]}\n\n请输入新类别：\n1 - 男双\n2 - 女双\n3 - 娱乐`);
  
  const catMap = {'1': 'male', '2': 'female', '3': 'fun'};
  const selectedCat = catMap[newCat];
  
  if (!selectedCat) {
    alert('无效的类别');
    return;
  }
  
  if (selectedCat === player.category) {
    alert('类别未改变');
    return;
  }
  
  const oldCat = player.category;
  
  data.groups.forEach(g => {
    if (g.playerIds.includes(id)) {
      g.playerIds = g.playerIds.filter(pid => pid !== id);
    }
  });
  
  const newCatPlayers = data.players.filter(p => p.category === selectedCat);
  player.category = selectedCat;
  player.ranking = newCatPlayers.length + 1;
  
  // send update to server and handle any server-side warnings
  const serverRes = await updateDataToServer('/api/player', player);
  await syncDataFromServer();
  if (serverRes && serverRes.status === 'warning') {
    alert(serverRes.message);
  } else {
    alert(`${player.name} 已改为${CATEGORIES[selectedCat]}，排名第${player.ranking}名`);
    renderAdmin();
    renderHome();
  }
}

async function addPlayer() {
  if (hasAnyMatchStarted()) {
    alert('比赛已开始，无法添加选手');
    return;
  }

  const category = document.getElementById('new-player-category').value;
  const name = document.getElementById('new-player-name').value.trim();
  if (!name) {
    alert('请输入选手姓名');
    return;
  }
  
  const catPlayers = data.players.filter(p => p.category === category);
  const newPlayer = { 
    id: `player-${Date.now()}`, 
    name, 
    active: true,
    category: category,
    ranking: catPlayers.length + 1
  };
  // add locally for immediate UI update, then sync to server
  const response = await addDataToServer('/api/player', newPlayer);
  if (response) {
    alert(response.message);
  }
  await syncDataFromServer();
  document.getElementById('new-player-name').value = '';
  renderAdmin();

}

async function deletePlayer(id) {
  if (hasAnyMatchStarted()) {
    alert('比赛已开始，无法删除选手');
    return;
  }

  const password = prompt('删除选手需要管理员密码：');
  if (password !== data.adminPassword) {
    alert('密码错误！');
    return;
  }
  if (!confirm('确定要删除这名选手吗？')) return;

  // prefer server-side deletion when available
  try {
    const result = await deleteFromServer(`/api/player`, { id });
    if (result) {
      // reload from server to reflect authoritative state
      await syncDataFromServer();
      renderAdmin();
      renderHome();
      return;
    }
  } catch (err) {
    console.warn('Server delete failed, falling back to local removal', err);
  }

  // fallback: remove locally
  data.players = data.players.filter(p => p.id !== id);
  data.players.forEach((p, index) => { p.ranking = index + 1; });
  data.rankingModified = true;
  renderAdmin();
}

async function togglePlayerActive(id) {
  if (hasAnyMatchStarted()) {
    alert('比赛已开始，无法启用/停用选手');
    return;
  }
  const player = data.players.find(p => p.id === id);
  if (!player) return;
  
  player.active = !player.active;
  data.rankingModified = true;
  const response = await updateDataToServer('/api/player', player);
  alert(response.message);
  await syncDataFromServer();
  renderAdmin();
  renderHome();
  renderScore();
}

function editPlayerRanking() {
  if (hasAnyMatchStarted()) {
    alert('比赛已开始，无法修改排名');
    return;
  }

  const password = prompt('修改排名需要管理员密码：');
  if (password !== data.adminPassword) {
    alert('密码错误！');
    return;
  }
  
  const catChoice = prompt('请选择类别：\n1 - 男双\n2 - 女双\n3 - 娱乐');
  const catMap = {'1': 'male', '2': 'female', '3': 'fun'};
  const selectedCat = catMap[catChoice];
  
  if (!selectedCat) {
    alert('无效的类别');
    return;
  }
  
  const catPlayers = data.players.filter(p => p.category === selectedCat).sort((a, b) => a.ranking - b.ranking);
  
  if (catPlayers.length === 0) {
    alert(`${CATEGORIES[selectedCat]}暂无选手`);
    return;
  }
  
  let options = '';
  catPlayers.forEach((p, i) => {
    options += `${i + 1}. ${p.name}\n`;
  });
  
  const selected = prompt(`${CATEGORIES[selectedCat]}选手列表（按当前排名）：\n\n${options}\n请输入序号选择要修改排名的选手：`);
  if (!selected) return;
  
  const selectedIndex = parseInt(selected) - 1;
  if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= catPlayers.length) {
    alert('无效的选择');
    return;
  }
  
  const player = catPlayers[selectedIndex];
  const currentRank = selectedIndex + 1;
  const newRank = prompt(`${player.name} 当前排名：第 ${currentRank} 名\n\n请输入新排名（1-${catPlayers.length}）：`);
  if (!newRank) return;
  
  const newRankNum = parseInt(newRank);
  if (isNaN(newRankNum) || newRankNum < 1 || newRankNum > catPlayers.length) {
    alert('无效的排名');
    return;
  }
  
  if (newRankNum === currentRank) {
    alert('排名未改变');
    return;
  }
  
  catPlayers.splice(selectedIndex, 1);
  catPlayers.splice(newRankNum - 1, 0, player);
  
  catPlayers.forEach((p, index) => {
    p.ranking = index + 1;
  });
  
  data.rankingModified = true;
  
  const oldGroups = JSON.parse(JSON.stringify(data.groups.filter(g => g.category === selectedCat)));
  
  data.groups = data.groups.filter(g => g.category !== selectedCat);
  
  const activePlayers = catPlayers.filter(p => p.active);
  const total = activePlayers.length;
  
  if (total >= 4 && total !== 7) {
    const groupSizes = [];
    if (total === 4) groupSizes.push(4);
    else if (total === 5) groupSizes.push(5);
    else if (total === 6) groupSizes.push(6);
    else if (total === 8) groupSizes.push(4, 4);
    else if (total === 9) groupSizes.push(4, 5);
    else if (total === 10) groupSizes.push(5, 5);
    else if (total === 11) groupSizes.push(6, 5);
    else if (total === 12) groupSizes.push(4, 4, 4);
    else if (total === 13) groupSizes.push(4, 4, 5);
    else if (total === 14) groupSizes.push(4, 5, 5);
    else if (total === 15) groupSizes.push(5, 5, 5);
    else if (total === 16) groupSizes.push(4, 4, 4, 4);
    else if (total === 17) groupSizes.push(4, 4, 4, 5);
    else if (total === 18) groupSizes.push(4, 4, 5, 5);
    else if (total === 19) groupSizes.push(4, 5, 5, 5);
    else if (total === 20) groupSizes.push(4, 4, 4, 4, 4);
    else {
      const numFives = total % 4;
      const numFours = (total - numFives * 5) / 4;
      for (let i = 0; i < numFours; i++) groupSizes.push(4);
      for (let i = 0; i < numFives; i++) groupSizes.push(5);
    }

    let playerIndex = 0;
    groupSizes.forEach((size, index) => {
      const playerIds = activePlayers.slice(playerIndex, playerIndex + size).map(p => p.id);
      const groupId = `${selectedCat}-group-${index + 1}`;
      data.groups.push({ id: groupId, level: index + 1, playerIds, category: selectedCat });
      playerIndex += size;
    });
  }
  
  const newGroups = data.groups.filter(g => g.category === selectedCat);
  let groupsChanged = oldGroups.length !== newGroups.length;
  
  if (!groupsChanged && oldGroups.length > 0) {
    for (let i = 0; i < oldGroups.length; i++) {
      if (oldGroups[i].playerIds.length !== newGroups[i].playerIds.length ||
          !oldGroups[i].playerIds.every((id, idx) => id === newGroups[i].playerIds[idx])) {
        groupsChanged = true;
        break;
      }
    }
  }
  
  saveData();
  alert(`${player.name} 已调整为第 ${newRankNum} 名！`);
  renderAdmin();
  renderHome();
  
  if (groupsChanged) {
    if (confirm('排名修改导致分组变化，是否重新生成比赛对阵？')) {
      data.matches = data.matches.filter(m => m.round !== data.currentRound || m.category !== selectedCat);
      const newMatches = [];
      newGroups.forEach(g => {
        newMatches.push(...generateMatches(g.id, g.playerIds, data.currentRound).map(m => ({...m, category: selectedCat})));
      });
      data.matches.push(...newMatches);
      saveData();
      alert('比赛对阵已重新生成！');
      renderHome();
      renderScore();
    }
  }
}

let editGroupsPasswordVerified = false;

function toggleEditGroups() {
  if (hasAnyMatchStarted()) {
    alert('比赛已开始，无法手动调整分组');
    return;
  }

  const panel = document.getElementById('edit-groups-panel');
  const isHidden = panel.classList.contains('hidden');
  
  if (isHidden) {
    if (!editGroupsPasswordVerified) {
      const password = prompt('调整分组需要管理员密码：');
      if (password !== data.adminPassword) {
        alert('密码错误！');
        return;
      }
      editGroupsPasswordVerified = true;
    }
    
    if (data.groups.length === 0) {
      alert('请先生成分组');
      return;
    }
    panel.classList.remove('hidden');
    renderGroupEditor();
  } else {
    panel.classList.add('hidden');
    editGroupsPasswordVerified = false;
  }
}

function movePlayerToGroup(playerId, fromGroupIndex, toGroupIndex) {
  if (toGroupIndex === '') return;
  
  toGroupIndex = parseInt(toGroupIndex);
  
  data.groups[fromGroupIndex].playerIds = data.groups[fromGroupIndex].playerIds.filter(id => id !== playerId);
  
  if (toGroupIndex > fromGroupIndex) {
    data.groups[toGroupIndex].playerIds.unshift(playerId);
  } else {
    data.groups[toGroupIndex].playerIds.push(playerId);
  }
  
  saveData();
  renderGroupEditor();
}

function saveGroupEdits() {
  const hasEmptyGroup = data.groups.some(g => g.playerIds.length === 0);
  if (hasEmptyGroup) {
    alert('有空组，请调整后再保存');
    return;
  }
  
  const hasInvalidSize = data.groups.some(g => g.playerIds.length < 4 || g.playerIds.length > 6 || g.playerIds.length === 7);
  if (hasInvalidSize) {
    alert('每组必须是4、5或6人，请调整');
    return;
  }
  
  data.matches = data.matches.filter(m => m.round !== data.currentRound);
  
  const newMatches = [];
  data.groups.forEach(g => {
    newMatches.push(...generateMatches(g.id, g.playerIds, data.currentRound));
  });
  data.matches.push(...newMatches);
  
  saveData();
  document.getElementById('edit-groups-panel').classList.add('hidden');
  editGroupsPasswordVerified = false;
  alert('分组已保存，比赛已重新生成！');
  renderAdmin();
}

async function generateWeeklyGroups() {
  if (hasAnyMatchStarted()) {
    alert('比赛已开始，无法重新生成分组');
    return;
  }
  
  if (!data.rankingModified && data.groups.length > 0) {
    alert('排名未修改且已有分组，无需重新生成。\n如需重新分组，请先修改排名或调整人员。');
    return;
  }

  data.matches = data.matches.filter(m => m.round !== data.currentRound);
  data.groups = [];
  
  const newMatches = [];
  let totalGroups = 0;
  
  Object.keys(CATEGORIES).forEach(cat => {
    const activePlayers = data.players.filter(p => p.active && p.category === cat).sort((a, b) => a.ranking - b.ranking);
    const total = activePlayers.length;
    
    if (total < 4) return;
    if (total === 7) {
      alert(`${CATEGORIES[cat]}有7人无法分组，请调整人数`);
      return;
    }
    
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
      // total = 4k + 2: use (k-1) 4s and two 5s
      for (let i = 0; i < (total / 4 | 0) - 1; i++) groupSizes.push(4);
      groupSizes.push(5, 5);
    } else {
      // remainder === 3: total = 4k + 3: use k 4s and one 5
      for (let i = 0; i < total / 4 | 0; i++) groupSizes.push(4);
      groupSizes.push(5);
    }

    let playerIndex = 0;
    groupSizes.forEach((size, index) => {
      const playerIds = activePlayers.slice(playerIndex, playerIndex + size).map(p => p.id);
      const groupId = `${cat}-group-${index + 1}`;
      data.groups.push({ id: groupId, level: index + 1, playerIds, category: cat });
      newMatches.push(...generateMatches(groupId, playerIds, data.currentRound).map(m => ({...m, category: cat})));
      playerIndex += size;
      totalGroups++;
    });
  });
  
  data.matches.push(...newMatches);
  data.rankingModified = false;
  await addDataToServer('/api/match', newMatches);
  alert(`已生成第 ${data.currentRound} 轮分组，共 ${totalGroups} 个组，${newMatches.length} 场比赛`);
  await syncDataFromServer();
  renderAdmin();
  renderHome();
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

  const roundRankings = [];
  
  Object.keys(CATEGORIES).forEach(cat => {
    const catGroups = data.groups.filter(g => g.category === cat).sort((a, b) => a.level - b.level);
    if (catGroups.length === 0) return;
    
    const groupRankings = catGroups.map(g => {
      const gm = currentMatches.filter(m => m.groupId === g.id);
      const rankings = g.playerIds.map(id => {
        const stats = calculatePlayerStats(id, gm);
        return { id, netScore: stats.netScore };
      }).sort((a, b) => b.netScore - a.netScore);
      return { groupId: g.id, level: g.level, rankings };
    });
    
    groupRankings.forEach((group, idx) => {
      group.rankings.forEach((r, rankIdx) => {
        const player = data.players.find(p => p.id === r.id);
        let change = 'none';
        if (idx > 0 && rankIdx === 0) change = 'promoted';
        if (idx < groupRankings.length - 1 && rankIdx === group.rankings.length - 1) change = 'relegated';
        roundRankings.push({
          name: player.name,
          category: cat,
          group: group.level,
          netScore: r.netScore,
          change: change
        });
      });
    });
    
    const newRanking = [];
    for (let i = 0; i < groupRankings.length; i++) {
      const rankings = groupRankings[i].rankings;
      if (i === 0) {
        newRanking.push(...rankings.map(r => r.id));
      } else {
        const promoted = rankings[0].id;
        const relegated = groupRankings[i - 1].rankings[groupRankings[i - 1].rankings.length - 1].id;
        newRanking.splice(newRanking.length - 1, 1, promoted, relegated);
        newRanking.push(...rankings.slice(1).map(r => r.id));
      }
    }
    
    newRanking.forEach((playerId, index) => {
      const player = data.players.find(p => p.id === playerId);
      if (player) {
        player.ranking = index + 1;
      }
    });
  });
  
  data.roundHistory.push({ round: data.currentRound, rankings: roundRankings });
  data.currentRound++;
  data.rankingModified = false;
  
  data.groups = [];
  const newMatches = [];
  let totalGroups = 0;
  
  // regenerate groups based on updated rankings
  Object.keys(CATEGORIES).forEach(cat => {
    const activePlayers = data.players.filter(p => p.active && p.category === cat).sort((a, b) => a.ranking - b.ranking);
    const total = activePlayers.length;
    if (total < 4 || total === 7) return;
    
    const groupSizes = [];
    if (total === 4) groupSizes.push(4);
    else if (total === 5) groupSizes.push(5);
    else if (total === 6) groupSizes.push(6);
    else if (total === 8) groupSizes.push(4, 4);
    else if (total === 9) groupSizes.push(4, 5);
    else if (total === 10) groupSizes.push(5, 5);
    else if (total === 11) groupSizes.push(6, 5);
    else if (total === 12) groupSizes.push(4, 4, 4);
    else if (total === 13) groupSizes.push(4, 4, 5);
    else if (total === 14) groupSizes.push(4, 5, 5);
    else if (total === 15) groupSizes.push(5, 5, 5);
    else if (total === 16) groupSizes.push(4, 4, 4, 4);
    else if (total === 17) groupSizes.push(4, 4, 4, 5);
    else if (total === 18) groupSizes.push(4, 4, 5, 5);
    else if (total === 19) groupSizes.push(4, 5, 5, 5);
    else if (total === 20) groupSizes.push(4, 4, 4, 4, 4);
    else {
      const numFives = total % 4;
      const numFours = (total - numFives * 5) / 4;
      for (let i = 0; i < numFours; i++) groupSizes.push(4);
      for (let i = 0; i < numFives; i++) groupSizes.push(5);
    }

    let playerIndex = 0;
    groupSizes.forEach((size, index) => {
      const playerIds = activePlayers.slice(playerIndex, playerIndex + size).map(p => p.id);
      const groupId = `${cat}-group-${index + 1}`;
      data.groups.push({ id: groupId, level: index + 1, playerIds, category: cat });
      newMatches.push(...generateMatches(groupId, playerIds, data.currentRound).map(m => ({...m, category: cat})));
      playerIndex += size;
      totalGroups++;
    });
  });
  
  data.matches.push(...newMatches);
  saveData();
  alert(`第 ${data.currentRound - 1} 轮结束！升降级已完成。\n已自动生成第 ${data.currentRound} 轮分组，共 ${totalGroups} 个组，${newMatches.length} 场比赛`);
  renderAdmin();
  renderHome();
  renderRanking();
}

function exportData() {
  const dataStr = JSON.stringify(data, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `badminton-ladder-v2-backup-${new Date().toISOString().slice(0,10)}.json`;
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
          location.reload();
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

  localStorage.removeItem('badminton_ladder_v2');
  data = { players: [], groups: [], matches: [], currentRound: 1, adminPassword: 'e52026', rankingModified: false, roundHistory: [] };
  alert('数据已清空');
  location.reload();
}


function autoFillScores() {
  const password = prompt('随机报分需要管理员密码：');
  if (password !== data.adminPassword) {
    alert('密码错误！');
    return;
  }
  
  if (!confirm('确定要为所有未完成的比赛随机生成分数吗？')) return;
  
  const currentMatches = data.matches.filter(m => m.round === data.currentRound && !m.completed);
  
  if (currentMatches.length === 0) {
    alert('没有待报分的比赛');
    return;
  }
  
  currentMatches.forEach(m => {
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
    
    const score1 = winner === 1 ? winScore : loseScore;
    const score2 = winner === 2 ? winScore : loseScore;
    
    data.matches = data.matches.map(match => {
      if (match.id === m.id) {
        return { ...match, score1, score2, completed: true, timestamp: Date.now() };
      }
      return match;
    });
  });
  
  saveData();
  alert(`已为 ${currentMatches.length} 场比赛随机生成分数！`);
  renderScore();
}

init();
