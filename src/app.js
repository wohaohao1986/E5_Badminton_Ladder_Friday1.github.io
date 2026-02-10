const CATEGORIES = {
  male: '男双',
  female: '女双',
  fun: '娱乐'
};

const SERVER_BASE = (function(){
  try {
    const host = window.location.host;
    return `${window.location.protocol}//${host}:80`;
  } catch (e) {}
  return 'http://localhost:80';
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
    }).then(res =>{
    if (!res.ok) throw new Error(`Server responded ${res.status}`);
    return res.json();
    }).catch(err => {
      console.warn('Failed to notify server of deletion:', err);
      return null;
    });
  } catch (e) {
    console.warn('Error sending delete to server:', e);
    return Promise.resolve(null);
  }
}

async function sendAuthenticatedRequest(endpoint, payload) {
  const name = prompt('请输入管理员用户名：');
  const password = prompt('请输入管理员密码：');

  const adminResponse = await addDataToServer('/api/admin/', { adminName: name, adminPassword: password });
  if (adminResponse && adminResponse.authenticated) {
    return addDataToServer(endpoint, payload);
  } else {
    alert('管理员验证失败，请检查用户名和密码！');
  }
}

async function syncDataFromServer() {
  data = await getFromServer('/api/main');
}

async function init() {
  await syncDataFromServer();
  showPage('home');
}

// Navigation and rendering pages
function showPage(page) {
  ['home', 'match', 'score', 'ranking', 'history', 'admin'].forEach(p => {
    document.getElementById(`page-${p}`).classList.add('hidden');
    document.getElementById(`nav-${p}`).classList.remove('active');
  });
  document.getElementById(`page-${page}`).classList.remove('hidden');
  document.getElementById(`nav-${page}`).classList.add('active');

  if (page === 'match') renderMatch();
  if (page === 'score') renderScore();
  if (page === 'ranking') renderRanking();
  if (page === 'history') renderHistory();
  if (page === 'admin') renderAdmin();
}

function renderMatch() {
  document.getElementById('home-round').textContent = data.currentRound;
  const container = document.getElementById('home-groups');
  
  let html = '';
  
  Object.keys(CATEGORIES).forEach(cat => {
    let catGroups = [];
    if (data.groups && data.groups.length > 0)
      catGroups = data.groups.filter(g => g.category === cat).sort((a, b) => a.level - b.level);
    if (catGroups.length === 0) return;
    
    html += `<h2 style="color:#4CAF50;margin-top:30px;margin-bottom:15px;">${CATEGORIES[cat]}</h2>`;
    
    const currentRoundMatches = data.matches.filter(m => m.round === data.currentRound);
    
    catGroups.forEach(group => {
      const groupMatches = currentRoundMatches.filter(m => m.groupId === group.id);
      const rankings = group.playerIds.map(id => {
        return { id, name: getPlayerName(id)};
      }).sort((a, b) => b.netScore - a.netScore);

      html += `<div class="card">
        <h2>第 ${group.level} 组 (${group.playerIds.length}人)</h2>
        <table>
          <thead><tr><th>排名</th><th>选手</th></tr></thead>
          <tbody>`;
      
      rankings.forEach((p, i) => {
        html += `<tr><td>${i+1}</td><td>${p.name}</td><td style="text-align:center;"></td></tr>`;
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
        html += `<div class="mt-20"><p style="color:#ff9800;">暂无比赛</p></div>`;
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
  let currentRoundMatches = [] ;
  let html = '';
  if(data.matches && data.matches.length > 0)
    currentRoundMatches = data.matches.filter(m => m.round === data.currentRound);
  select.innerHTML = '<option value="">-- 请选择 --</option>';

  Object.keys(CATEGORIES).forEach(cat => {
    const pendingMatchIndicateHead = '<option disabled><strong>' + CATEGORIES[cat];
    const completedMatchIndicateHead = '<div><strong>' + CATEGORIES[cat];
    const groupInCat = data.groups.filter(g => g.category === cat);
    groupInCat.forEach(g => {
      const pendingMatchesInGroup = currentRoundMatches.filter(m => m.groupId === g.id && !m.completed);
      if(pendingMatchesInGroup.length > 0){
        const pendingMatchIndicateHtml = pendingMatchIndicateHead + ' Group ' + g.id.split('-').at(-1) + '</strong></option>';
        select.innerHTML += pendingMatchIndicateHtml;
        pendingMatchesInGroup.forEach(m => {
          select.innerHTML += `<option value="${m.id}">${m.team1.map(getPlayerName).join('/')} vs ${m.team2.map(getPlayerName).join('/')}</option>`;
        });
      }

      const completedMatchesInGroup = currentRoundMatches.filter(m => m.groupId === g.id && m.completed);
      if (completedMatchesInGroup.length > 0){
        const completedMatchIndicateHtml = completedMatchIndicateHead + ' Group ' + g.id.split('-').at(-1) + '</strong></div>';
        html += completedMatchIndicateHtml;
        completedMatchesInGroup.forEach(m => {
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
      }
    });
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
  if (!data || !data.matches || data.matches.length === 0) {
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
        <span style="font-weight:bold;min-width:40px;">#${p.ranking}</span>
        <span style="flex:1;">${p.name}</span>
        <span style="color:#666;margin-right:10px;">${CATEGORIES[p.category]}</span>
        <div style="display:flex;gap:5px;">
          <button onclick="changePlayerCategory('${p.id}')" class="btn-info" style="padding:5px 10px;font-size:12px;">改类别</button>
          <button onclick="editPlayerRanking('${p.id}')" class="btn-info" style="padding:5px 10px;font-size:12px;">改排名</button>
          ${statusBtn}
          <button onclick="deletePlayer('${p.id}')" class="btn-danger" style="padding:5px 10px;font-size:12px;">删除</button>
        </div>
      </div>`;
    });
  });
  document.getElementById('player-ranking-list').innerHTML = html || '<p>暂无选手</p>';

  if (data && data.groups && data.groups.length > 0) {
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

  const currentMatches = data && data.matches ? data.matches.filter(m => m.round === data.currentRound) : [];
  const currentGroups = data && data.groups ? data.groups : [];
  document.getElementById('stat-round').textContent = data.currentRound;
  document.getElementById('stat-players').textContent = data.players.length;
  document.getElementById('stat-active').textContent = activePlayers.length;
  document.getElementById('stat-groups').textContent = currentGroups.length;
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

function hasAnyMatchStarted() {
  const currentMatches = data.matches.filter(m => m.round === data.currentRound);
  return currentMatches.some(m => m.completed);
}

// Function to render page after selecting a match
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

// Submit score for selected match
async function submitScore(e) {
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

  await updateDataToServer('/api/match', { id: matchId, score1, score2, completed: true, timestamp: Date.now() });
  await syncDataFromServer();
  document.getElementById('score-match').value = '';
  document.getElementById('score1').value = '';
  document.getElementById('score2').value = '';
  document.getElementById('score-inputs').classList.add('hidden');
  alert('比分已记录！');
  renderScore();
}

async function editScore(matchId) {
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

  await updateDataToServer('/api/match', { id: matchId, score1: s1, score2: s2, timestamp: Date.now() });
  await syncDataFromServer();
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
  
  // send update to server and handle any server-side warnings
  const serverRes = await updateDataToServer('/api/player', {id: id, category: selectedCat});
  await syncDataFromServer();
  if (serverRes && serverRes.status === 'warning') {
    alert(serverRes.message);
  } else {
    alert(`${player.name} 已改为${CATEGORIES[selectedCat]}，排名第${player.ranking}名`);
    renderAdmin();
    renderMatch();
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
  const newPlayer = { 
    id: `player-${Date.now()}`, 
    name, 
    active: true,
    category: category,
  };
  
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

  if (!confirm('确定要删除这名选手吗？')) return;
  alert('删除选手需要管理员身份：');
  // prefer server-side deletion when available
  try {
    const name = prompt('请输入管理员用户名：');
    const password = prompt('请输入管理员密码：');

    const adminResponse = await addDataToServer('/api/admin/', { adminName: name, adminPassword: password });
    if (adminResponse && adminResponse.authenticated) {
      const result = await deleteFromServer('/api/player/', { id: id });
      alert(result.message);
      await syncDataFromServer();
      renderAdmin();
      renderMatch();
    } else {
      alert('管理员验证失败，请检查用户名和密码！');
      return;
    }
  } catch (err) {
    console.warn('Server delete failed', err);
  }
}

async function togglePlayerActive(id) {
  if (hasAnyMatchStarted()) {
    alert('比赛已开始，无法启用/停用选手');
    return;
  }

  const player = data.players.find(p => p.id === id);
  player.active = !player.active;

  const response = await updateDataToServer('/api/player/', { id, active:player.active});
  alert(response.message);
  await syncDataFromServer();
  renderAdmin();
  renderMatch();
  renderScore();
}


// Edit player ranking in current category
async function editPlayerRanking(playerId) {
  if (hasAnyMatchStarted()) {
    alert('比赛已开始，无法修改排名');
    return;
  }

  const player = data.players.find(p => p.id === playerId);
  const currentRank = player.ranking;
  const activePlayersInCategory = data.players.filter(p => p.category === player.category && typeof p.ranking === 'number');
  const newRank = prompt(`${player.name} 当前排名：第 ${currentRank} 名\n\n请输入新排名（1-${activePlayersInCategory.length}）：`);
  if (!newRank) return;
  
  const newRankNum = parseInt(newRank);
  if (isNaN(newRankNum) || newRankNum < 1 || newRankNum > activePlayersInCategory.length) {
    alert('无效的排名');
    return;
  }
  
  if (newRankNum === currentRank) {
    alert('排名未改变');
    return;
  }

  const name = prompt('请输入管理员用户名：');
  const password = prompt('请输入管理员密码：');
  const adminResponse = await addDataToServer('/api/admin/', { adminName: name, adminPassword: password });
  if (adminResponse && adminResponse.authenticated) {
      const result = await updateDataToServer('/api/player/', { id: playerId, ranking: newRankNum });
      alert(result.message);
      await syncDataFromServer();
      alert('请注意：修改排名后需要重新生成分组和比赛！');
      renderAdmin();
      renderMatch();
    } else {
      alert('管理员验证失败，请检查用户名和密码！');
      return;
    }
  
}

async function generateGroups() {
  const rep = await sendAuthenticatedRequest('/api/grouping', {});
  alert(rep.message);
  await syncDataFromServer();
  renderAdmin();
}

async function generateMatches() {
  const rep = await sendAuthenticatedRequest('/api/generateMatch', {});
  alert(rep.message);
  syncDataFromServer();
}

async function finishRound() {
  const currentMatches = data.matches.filter(m => m.round === data.currentRound);
  if (currentMatches.length === 0) {
    alert('本轮还没有比赛');
    return;
  }
  
  const incomplete = currentMatches.filter(m => !m.completed);
  if (incomplete.length > 0) {
    const msg = `还有 ${incomplete.length} 场比赛未完成。\n\n如果这些比赛不打了，请报分为 0:0\n如果打了但没打完，请报实际分数（如 15:12）`;
    alert(msg);
    return;
  }

  const msg = await sendAuthenticatedRequest('/api/finishRound', {});
  alert(msg.message);
  await syncDataFromServer();
  renderAdmin();
  renderMatch();
  renderRanking();
}

// helper to get player name by ID 
function getPlayerName(id) {
  const player = data.players.find(p => p.id === id);
  return player ? player.name : '未知';
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
