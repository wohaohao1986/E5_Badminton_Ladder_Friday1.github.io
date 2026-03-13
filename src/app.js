const CATEGORIES = {
  huitailang: '灰太狼',
  xiyangyang: '喜羊羊'
};

// Track expanded players in admin view
let expandedPlayers = new Set();

// Cached admin credentials for this page session (cleared on page refresh)
let _cachedAdminCredentials = null;

// Main data store — populated by syncDataFromServer() on page load
let data;

const SERVER_BASE = (function(){
  try {
    return `${window.location.protocol}//${window.location.host}`;
  } catch (e) {}
  return 'http://localhost:80';
})();

// Initialize website
async function init() {
  await syncDataFromServer();
  showPage('home');
}

// HTTP POST request
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

//HTTP PUT request
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

//HTTP GET request
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

//HTTP DELETE request
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

// Handle admin authentication for sensitive operations
async function sendAuthenticatedRequest(endpoint, payload) {
  // Use cached credentials if already verified this session
  let credentials = _cachedAdminCredentials;
  if (!credentials) {
    credentials = await promptForAdminCredentials();
    if (!credentials) return;
  }

  const adminResponse = await addDataToServer('/api/admin/', { adminName: credentials.name, adminPassword: credentials.password });
  if (adminResponse && adminResponse.authenticated) {
    _cachedAdminCredentials = credentials; // cache on first successful verify
    return updateDataToServer(endpoint, payload);
  } else {
    _cachedAdminCredentials = null; // clear cache so user can re-enter
    alert('管理员验证失败，请检查用户名和密码！');
  }
}

async function syncDataFromServer() {
  data = await getFromServer('/api/main');
}

// Navigation and rendering pages
function showPage(page) {
  ['home', 'match', 'score', 'ranking', 'history', 'admin', 'opens'].forEach(p => {
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
  if (page === 'opens') renderOpens();
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
          const clickHandler = status === 'match-pending' ? ` onclick="selectMatchForScoring('${m.id}')" style="cursor:pointer;"` : '';
          html += `<div class="match-item ${status}"${clickHandler}>
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

const rankingSortState = {};

function sortRankingBy(cat, field) {
  if (!rankingSortState[cat]) rankingSortState[cat] = { field: 'ranking', dir: 'asc' };
  if (rankingSortState[cat].field === field) {
    rankingSortState[cat].dir = rankingSortState[cat].dir === 'asc' ? 'desc' : 'asc';
  } else {
    rankingSortState[cat].field = field;
    rankingSortState[cat].dir = 'asc';
  }
  renderRanking();
}

function renderRanking() {
  const container = document.getElementById('ranking-list');
  let html = '';

  Object.keys(CATEGORIES).forEach(cat => {
    const catPlayers = data.players.filter(p => p.category === cat).sort((a, b) => {
      const ra = typeof a.ranking === 'number' ? a.ranking : Infinity;
      const rb = typeof b.ranking === 'number' ? b.ranking : Infinity;
      return ra - rb;
    });
    if (catPlayers.length === 0) return;

    const state = rankingSortState[cat] || { field: 'ranking', dir: 'asc' };
    const indicator = (field) => {
      if (state.field === field) return state.dir === 'asc' ? ' <span style="color:#4CAF50;font-size:11px;">▲</span>' : ' <span style="color:#4CAF50;font-size:11px;">▼</span>';
      return ' <span style="color:#bbb;font-size:11px;">⇅</span>';
    };

    // Sort a display-only copy — original data is never mutated
    const displayPlayers = [...catPlayers].sort((a, b) => {
      const dir = state.dir === 'asc' ? 1 : -1;
      if (state.field === 'avgRank') {
        const ra = typeof a.avgRankInCat === 'number' ? a.avgRankInCat : Infinity;
        const rb = typeof b.avgRankInCat === 'number' ? b.avgRankInCat : Infinity;
        return (ra - rb) * dir;
      }
      if (state.field === 'roundPlayed') {
        return ((a.roundPlayed || 0) - (b.roundPlayed || 0)) * dir;
      }
      // default: ranking
      const ra = typeof a.ranking === 'number' ? a.ranking : Infinity;
      const rb = typeof b.ranking === 'number' ? b.ranking : Infinity;
      return (ra - rb) * dir;
    });

    const thSort = 'padding:7px 8px;text-align:center;border:1px solid #ddd;cursor:pointer;user-select:none;background-color:#f0f7f0;white-space:nowrap;font-size:13px;';
    const thSortAttrs = `onmouseover="this.style.backgroundColor='#d8eed8'" onmouseout="this.style.backgroundColor='#f0f7f0'"`;
    const thFixed = 'padding:7px 8px;text-align:center;border:1px solid #ddd;white-space:nowrap;font-size:13px;';
    const thLeft  = 'padding:7px 8px;text-align:left;border:1px solid #ddd;white-space:nowrap;font-size:13px;';
    const thSub   = 'padding:4px 6px;text-align:center;border:1px solid #ddd;font-size:12px;white-space:nowrap;';
    const td      = 'padding:6px 8px;text-align:center;font-size:13px;';
    const tdName  = 'padding:6px 8px;text-align:left;font-size:13px;white-space:nowrap;';

    html += `<h2 style="color:#4CAF50;margin-top:20px;margin-bottom:15px;">${CATEGORIES[cat]}</h2>`;
    html += `<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;"><table style="width:100%;min-width:560px;border-collapse:collapse;margin-bottom:20px;"><thead>
      <tr style="background-color:#f5f5f5;">
        <th style="${thSort}" ${thSortAttrs} onclick="sortRankingBy('${cat}','ranking')">当前排名${indicator('ranking')}</th>
        <th style="${thLeft}">选手</th>
        <th style="${thSort}" ${thSortAttrs} onclick="sortRankingBy('${cat}','avgRank')">平均排名<br>(最近10轮)${indicator('avgRank')}</th>
        <th style="${thSort}" ${thSortAttrs} onclick="sortRankingBy('${cat}','roundPlayed')">参赛轮次${indicator('roundPlayed')}</th>
        <th colspan="3" style="${thFixed}background-color:#e8f5e9;">21分制</th>
        <th colspan="3" style="${thFixed}background-color:#e3f2fd;">15分制</th>
        <th style="${thFixed}">状态</th>
      </tr>
      <tr style="background-color:#f5f5f5;">
        <th style="${thSub}"></th>
        <th style="${thSub}"></th>
        <th style="${thSub}"></th>
        <th style="${thSub}"></th>
        <th style="${thSub}">场数</th><th style="${thSub}">胜</th><th style="${thSub}">净分</th>
        <th style="${thSub}">场数</th><th style="${thSub}">胜</th><th style="${thSub}">净分</th>
        <th style="${thSub}"></th>
      </tr></thead><tbody>`;

    displayPlayers.forEach(p => {
      const statusClass = p.active ? '' : 'player-inactive';
      const statusText = p.active ? '参赛' : '未参赛';
      const rankDisplay = typeof p.ranking === 'number' ? p.ranking : '-';
      const avgRankInCat = typeof p.avgRankInCat === 'number' ? p.avgRankInCat : '-';
      const roundPlayed = p.roundPlayed || 0;
      const numberOfMatchesTwentyOne = p.numberOfMatchesTwentyOne || 0;
      const winsTwentyOne = p.winsTwentyOne || 0;
      const totalNetScoreTwentyOne = p.totalNetScoreTwentyOne || 0;
      const numberOfMatchesFifteen = p.numberOfMatchesFifteen || 0;
      const winsFifteen = p.winsFifteen || 0;
      const totalNetScoreFifteen = p.totalNetScoreFifteen || 0;
      html += `<tr class="${statusClass}" style="border-bottom:1px solid #ddd;">
        <td style="${td}">#${rankDisplay}</td>
        <td style="${tdName}">${p.name}</td>
        <td style="${td}">${avgRankInCat}</td>
        <td style="${td}">${roundPlayed}</td>
        <td style="${td}">${numberOfMatchesTwentyOne}</td>
        <td style="${td}">${winsTwentyOne}</td>
        <td style="${td}">${totalNetScoreTwentyOne}</td>
        <td style="${td}">${numberOfMatchesFifteen}</td>
        <td style="${td}">${winsFifteen}</td>
        <td style="${td}">${totalNetScoreFifteen}</td>
        <td style="${td}color:#666;">${statusText}</td>
      </tr>`;
    });
    html += '</tbody></table></div>';
  });

  container.innerHTML = html || '<p>暂无选手</p>';
}

function renderHistory() {
  const container = document.getElementById('history-content');
  const select = document.getElementById('round-select');
  if (!data || !data.matchHistory || data.matchHistory.length === 0) {
    container.innerHTML = '<div class="card"><p>暂无历史记录</p></div>';
    return;
  }
  select.innerHTML = '<option value="">-- 请选择 --</option>';
  for (let r = data.currentRound - 1; r > 0; r--) {
    select.innerHTML += `<option value="${r}">第${r}轮</option>`;
  }
}

function updateRoundHistory(){
  const container = document.getElementById('round-history');
  const round = document.getElementById('round-select').value;

  const roundHistory = data.roundHistory.filter(item => item.round.toString() === round)[0];
  const roundMatches = data.matchHistory.filter(m => m.round.toString() === round && m.completed);

  let html = `<div class="card"><h2>第 ${round} 轮</h2>`;

  Object.keys(CATEGORIES).forEach(cat =>{
    const rankings = roundHistory.rankings.filter(item => item.category === cat);
    if (rankings.length === 0) return;
    html += `<h3 style="color:#4CAF50;margin-top:15px;">${CATEGORIES[cat]}</h3>`;
    html += '<table style="margin-bottom:15px;"><thead><tr><th>排名</th><th>选手</th><th style="text-align:center;">组别</th><th style="text-align:center;">净胜分</th><th style="text-align:center;">升降级</th></tr></thead><tbody>';
    rankings.forEach((item, index) => {
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
  container.innerHTML = html;
  container.classList.remove('hidden');
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
      const backgroundColor = p.isDropin ? '#E1BEE7' : '#C8E6C9';
      const isExpanded = expandedPlayers.has(p.id);
      const toggleIcon1 = isExpanded ? '▼' : '▶';
      
      html += `<div class="ranking-item ${statusClass}" style="background-color:${backgroundColor}!important;flex-direction:column;align-items:flex-start;" onclick="togglePlayerButtons('${p.id}', event)">
        <div style="display:flex;align-items:center;gap:10px;width:100%;">
          <span style="font-weight:bold;min-width:40px;">#${p.ranking}</span>
          <span style="flex:1;cursor:pointer;display:flex;align-items:center;gap:8px;"><span style="font-size:14px;width:16px;display:inline-block;text-align:center;">${toggleIcon1}</span>${p.name}</span>
        </div>
        <fieldset style="display:${isExpanded ? 'block' : 'none'};border:none;padding:0;margin:10px 0 0 0;padding-left:60px;" class="player-buttons-${p.id}" onclick="event.stopPropagation();">
          <button onclick="changePlayerCategory('${p.id}')" class="btn-info" style="padding:5px 10px;font-size:12px;margin-right:5px;">改类别</button>
          <button onclick="editPlayerRanking('${p.id}')" class="btn-info" style="padding:5px 10px;font-size:12px;margin-right:5px;">改排名</button>
          ${statusBtn}
          <button onclick="deletePlayer('${p.id}')" class="btn-danger" style="padding:5px 10px;font-size:12px;">删除</button>
        </fieldset>
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
    
    // Add rearrange buttons for each category with groups
    let buttonsHtml = '';
    Object.keys(CATEGORIES).forEach(cat => {
      const catGroups = data.groups.filter(g => g.category === cat);
      if (catGroups.length > 0) {
        buttonsHtml += `<button onclick="showRearrangeGroupsModal('${cat}')" class="btn-info" style="margin-right:10px;margin-top:10px;">重新排列${CATEGORIES[cat]}组</button>`;
      }
    });
    if (buttonsHtml) {
      document.getElementById('current-groups').innerHTML += '<div style="margin-top:15px;">' + buttonsHtml + '</div>';
    }
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

// Toggle player buttons visibility
function togglePlayerButtons(playerId, event) {
  event.preventDefault();
  if (expandedPlayers.has(playerId)) {
    expandedPlayers.delete(playerId);
  } else {
    expandedPlayers.add(playerId);
  }
  renderAdmin();
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

// OnChange Function for '选择比赛' dropdown
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

// OnClick Function for '提交比分' button
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

// OnClick Function to select a match from the match list and navigate to score page
function selectMatchForScoring(matchId) {
  console.log('selectMatchForScoring called with matchId:', matchId);
  
  // First, render the score form to populate the dropdown options
  renderScore();
  console.log('renderScore completed');

  // Navigate to the score page
  showPage('score');
  
  // Then set the match selection dropdown to the clicked match
  const select = document.getElementById('score-match');
  select.value = matchId;
  console.log('Dropdown value set to:', select.value);
  updateScoreForm();

}

// OnClick Function for '修改比分' button
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

// OnClick Function for '改类别' button
async function changePlayerCategory(id) {
  if (hasAnyMatchStarted()) {
    alert('比赛已开始，无法修改选手类别');
    return;
  }

  const player = data.players.find(p => p.id === id);
  if (!player) return;
  
  const newCat = prompt(`${player.name} 当前类别：${CATEGORIES[player.category]}\n\n请输入新类别：\n1 - 灰太狼\n2 - 喜羊羊`);
  
  const catMap = {'1': 'huitailang', '2': 'xiyangyang'};
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
  alert(serverRes.message);
  renderAdmin();
  renderMatch();
}

// OnClick Function for '添加选手' button
async function addPlayer() {
  if (hasAnyMatchStarted()) {
    alert('比赛已开始，无法添加选手');
    return;
  }

  const category = document.getElementById('new-player-category').value;
  const name = document.getElementById('new-player-name').value.trim();
  const isDropin = document.getElementById('dropin-checkbox').checked;
  if (!name) {
    alert('请输入选手姓名');
    return;
  }
  const newPlayer = { 
    id: `player-${Date.now()}`, 
    name, 
    active: true,
    category: category,
    isDropin: isDropin,
    numberOfMatchesTwentyOne: 0,
    winsTwentyOne: 0,
    totalNetScoreTwentyOne: 0,
    numberOfMatchesFifteen: 0,
    winsFifteen: 0,
    totalNetScoreFifteen: 0
  };
  
  const response = await addDataToServer('/api/player', newPlayer);
  if (response) {
    alert(response.message);
  }
  await syncDataFromServer();
  document.getElementById('new-player-name').value = '';
  renderAdmin();

}

// OnClick Function for '删除' button
async function deletePlayer(id) {
  if (hasAnyMatchStarted()) {
    alert('比赛已开始，无法删除选手');
    return;
  }

  if (!confirm('确定要删除这名选手吗？')) return;
  alert('删除选手需要管理员身份');
  try {
    const result = await sendAuthenticatedRequest('/api/player/delete', { id: id });
    alert(result.message);
    await syncDataFromServer();
    renderAdmin();
    renderMatch();
  } catch (err) {
    console.warn('Server delete failed', err);
  }
}

// OnClick Function for '启用/停用' button
async function togglePlayerActive(id) {
  if (hasAnyMatchStarted()) {
    alert('比赛已开始，无法启用/停用选手');
    return;
  }

  const player = data.players.find(p => p.id === id);
  const newActiveStatus = !player.active;

  const response = await updateDataToServer('/api/player/', { id, active: newActiveStatus });
  alert(response.message);
  await syncDataFromServer();
  renderAdmin();
  renderMatch();
  renderScore();
}


// OnClick Function for '修改排名' button
async function editPlayerRanking(playerId) {
  if (hasAnyMatchStarted()) {
    alert('比赛已开始，无法修改排名');
    return;
  }

  const player = data.players.find(p => p.id === playerId);
  if (player.active === false) {
    alert('选手未参赛，无法修改排名');
    return;
  }
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

  const result = await sendAuthenticatedRequest('/api/player/', { id: playerId, ranking: newRankNum });
  if (result) {
    alert(result.message);
    await syncDataFromServer();
    alert('请注意：修改排名后需要重新生成分组和比赛！');
    renderAdmin();
    renderMatch();
  }
}

// OnClick Function for '重置一个分组' button
async function resetPlayersInGroup() {
  const groups = data.groups;
  
  if (groups.length === 0) {
    alert('没有可用的分组');
    return;
  }

  const result = await showGroupPlayerSelector(groups);
  if (!result) return;

  const response = await sendAuthenticatedRequest('/api/resetGroup', {
    groupId: result.groupId,
    playerIds: result.playerIds
  });
  
  alert(response.message || '分组已重置');
  await syncDataFromServer();
  renderAdmin();
}

// OnClick Function for '生成分组' button
async function generateGroups() {
  if (hasAnyMatchStarted()) {
    alert('比赛已开始，无法修改');
    return;
  }
  const rep = await sendAuthenticatedRequest('/api/grouping', {});
  alert(rep.message);
  await syncDataFromServer();
  renderAdmin();
  renderMatch();
  renderScore();
}

// OnClick Function for '生成比赛' button
async function generateMatches() {
  if (hasAnyMatchStarted()) {
    alert('比赛已开始，无法修改');
    return;
  }
  const rep = await sendAuthenticatedRequest('/api/generateMatch', {});
  alert(rep.message);
  await syncDataFromServer();
  renderMatch();
  renderScore();
}

// OnClick Function for '生成分组和比赛' button - generates both groups and matches
async function generateGroupsAndMatches() {
  if (hasAnyMatchStarted()) {
    alert('比赛已开始，无法修改');
    return;
  }
  Object.keys(CATEGORIES).forEach(cat => {
    const activePlayers = data.players.filter(p => p.active && p.category === cat);
    const total = activePlayers.length;
    
    if (total < 4 || total === 0 || total === 6 || total === 11) 
      return alert(`当前 ${CATEGORIES[cat]} 类别的选手人数为 ${total}，不适合进行分组和比赛，建议调整选手数量后再生成分组和比赛`);
  });
  const rep = await sendAuthenticatedRequest('/api/generateGroupsAndMatches', {});
  alert(rep.message);
  await syncDataFromServer();
  renderAdmin();
  renderMatch();
  renderScore();
}

// OnClick Function for '结束本轮'按钮
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
  renderHistory();
  renderRanking();
}

async function calculateAvgRanking() {
  const response = await sendAuthenticatedRequest('/api/calculateAvgRank', {});
  alert(response.message);
  await syncDataFromServer();
  renderRanking();
}

// Helper function -- for resetPlayersInGroup to show group and player selector modal
function showGroupPlayerSelector(groups) {
  return new Promise((resolve) => {
    const container = document.createElement('div');
    container.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000; overflow-y: auto;';
    
    const modal = document.createElement('div');
    modal.style.cssText = 'background: white; padding: 25px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); max-width: 500px; width: 90%; margin: 20px auto;';
    
    const title = document.createElement('h3');
    title.textContent = '重置分组';
    title.style.cssText = 'margin-top: 0; margin-bottom: 20px; color: #333;';
    
    const groupLabel = document.createElement('div');
    groupLabel.textContent = '选择分组：';
    groupLabel.style.cssText = 'margin-bottom: 8px; font-size: 14px; color: #666; font-weight: bold;';
    
    const groupSelect = document.createElement('select');
    groupSelect.style.cssText = 'width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; margin-bottom: 20px;';
    groupSelect.innerHTML = '<option value="">-- 请选择 --</option>';
    
    groups.forEach(g => {
      const categoryName = CATEGORIES[g.category] || g.category;
      const option = document.createElement('option');
      option.value = g.id;
      option.textContent = `${categoryName} 第 ${g.level} 组`;
      groupSelect.appendChild(option);
    });
    
    const playersContainer = document.createElement('div');
    playersContainer.style.cssText = 'display: none; margin-bottom: 20px;';
    
    const playersLabel = document.createElement('div');
    playersLabel.textContent = '选择选手（未选择的选手将会被停用）：';
    playersLabel.style.cssText = 'margin-bottom: 10px; font-size: 14px; color: #666; font-weight: bold;';
    playersContainer.appendChild(playersLabel);
    
    const playersList = document.createElement('div');
    playersList.style.cssText = 'border: 1px solid #ddd; border-radius: 4px; padding: 10px; max-height: 300px; overflow-y: auto;';
    playersContainer.appendChild(playersList);
    
    groupSelect.addEventListener('change', () => {
      const selectedGroup = groups.find(g => g.id === groupSelect.value);
      
      if (selectedGroup) {
        playersList.innerHTML = '';
        selectedGroup.playerIds.forEach(playerId => {
          const playerName = getPlayerName(playerId);
          const checkboxDiv = document.createElement('div');
          checkboxDiv.style.cssText = 'margin-bottom: 10px; padding: 12px; display: flex; align-items: center; background: #fafafa; border: 1px solid #eee; border-radius: 4px; transition: all 0.2s ease; cursor: pointer;';
          
          // Add hover effect
          checkboxDiv.addEventListener('mouseenter', () => {
            checkboxDiv.style.backgroundColor = '#f0f0f0';
            checkboxDiv.style.borderColor = '#4CAF50';
          });
          checkboxDiv.addEventListener('mouseleave', () => {
            checkboxDiv.style.backgroundColor = '#fafafa';
            checkboxDiv.style.borderColor = '#eee';
          });
          
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.value = playerId;
          checkbox.checked = true;
          checkbox.style.cssText = 'width: 18px; height: 18px; margin-right: 12px; cursor: pointer; accent-color: #4CAF50;';
          
          const label = document.createElement('label');
          label.textContent = playerName;
          label.style.cssText = 'font-size: 15px; font-weight: 500; cursor: pointer; flex: 1; color: #333;';
          label.htmlFor = checkbox.id;
          
          // Toggle checkbox when clicking anywhere on the div
          checkboxDiv.addEventListener('click', (e) => {
            if (e.target !== checkbox) {
              checkbox.checked = !checkbox.checked;
            }
          });
          
          checkboxDiv.appendChild(checkbox);
          checkboxDiv.appendChild(label);
          playersList.appendChild(checkboxDiv);
        });
        
        playersContainer.style.display = 'block';
      } else {
        playersContainer.style.display = 'none';
      }
    });
    
    const btnContainer = document.createElement('div');
    btnContainer.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end;';
    
    const okBtn = document.createElement('button');
    okBtn.textContent = '确定';
    okBtn.style.cssText = 'padding: 8px 20px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;';
    okBtn.onclick = () => {
      const selectedGroupId = groupSelect.value;
      if (!selectedGroupId) {
        alert('请选择一个分组');
        return;
      }
      
      const selectedPlayerIds = Array.from(playersList.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
      
      if (selectedPlayerIds.length === 0) {
        alert('请至少选择一个选手');
        return;
      }
      
      document.body.removeChild(container);
      resolve({ groupId: selectedGroupId, playerIds: selectedPlayerIds });
    };
    
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '取消';
    cancelBtn.style.cssText = 'padding: 8px 20px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;';
    cancelBtn.onclick = () => {
      document.body.removeChild(container);
      resolve(null);
    };
    
    btnContainer.appendChild(okBtn);
    btnContainer.appendChild(cancelBtn);
    
    modal.appendChild(title);
    modal.appendChild(groupLabel);
    modal.appendChild(groupSelect);
    modal.appendChild(playersContainer);
    modal.appendChild(btnContainer);
    container.appendChild(modal);
    document.body.appendChild(container);
    
  });
}

// Helper function for admin operation to show a modal dialog
//Helper function to check if any match is completed
function hasAnyMatchStarted() {
  const currentMatches = data.matches.filter(m => m.round === data.currentRound);
  return currentMatches.some(m => m.completed);
}

async function calculatePlayerStats() {
  await sendAuthenticatedRequest('/api/calculateStats', {});
  await syncDataFromServer();
  renderRanking();
}

// helper to get player name by ID 
function getPlayerName(id) {
  const player = data.players.find(p => p.id === id);
  return player ? player.name : '未知';
}

async function autoFillScores() {
  if (!confirm('确定要为所有未完成的比赛随机生成分数吗？')) return;

  const result = await sendAuthenticatedRequest('/api/randomScoring', {});
  alert(result.message);
  
  await syncDataFromServer();
  renderScore();
}

// ========== GROUP REARRANGEMENT FUNCTIONS ==========

// Get current group sizes for a category
function getGroupSizes(category) {
  const catGroups = data.groups.filter(g => g.category === category).sort((a, b) => a.level - b.level);
  return catGroups.map(g => g.playerIds.length);
}

// Show rearrangement UI
function showRearrangeGroupsModal(category) {
  const currentSizes = getGroupSizes(category);
  
  let html = `
    <div class="modal-overlay" id="rearrangeModal">
      <div class="modal-content" style="max-width:500px;">
        <h2>重新排列 ${CATEGORIES[category]} 组人数</h2>
        <p>当前组人数: ${currentSizes.join(', ')}</p>
        <p style="color:#666;">拖拽调整组的顺序 (总人数: ${currentSizes.reduce((a,b)=>a+b,0)}人)</p>
        
        <div class="form-group">
          <div id="groupSizesList" style="display:flex; flex-wrap:wrap; gap:10px;">
    `;
  
  currentSizes.forEach((size, idx) => {
    html += `<div class="group-size-item" draggable="true" data-index="${idx}" style="padding:10px; background:#4CAF50; color:white; border-radius:5px; cursor:move;">
      ${size}人
    </div>`;
  });
  
  html += `
          </div>
        </div>
        
        <div style="margin-top:20px;">
          <button onclick="submitNewGroupSizes('${category}')" class="btn-primary">确认</button>
          <button onclick="closeRearrangeModal()" class="btn-secondary" style="margin-left:10px;">取消</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', html);
  initDragAndDrop();
}

// Initialize drag and drop for group sizes
function initDragAndDrop() {
  const items = document.querySelectorAll('.group-size-item');
  let draggedItem = null;
  
  items.forEach(item => {
    item.addEventListener('dragstart', (e) => {
      draggedItem = item;
      item.style.opacity = '0.5';
    });
    
    item.addEventListener('dragend', (e) => {
      item.style.opacity = '1';
      draggedItem = null;
    });
    
    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (draggedItem && draggedItem !== item) {
        const allItems = Array.from(document.querySelectorAll('.group-size-item'));
        const draggedIdx = allItems.indexOf(draggedItem);
        const targetIdx = allItems.indexOf(item);
        
        if (draggedIdx < targetIdx) {
          item.parentNode.insertBefore(draggedItem, item.nextSibling);
        } else {
          item.parentNode.insertBefore(draggedItem, item);
        }
      }
    });
  });
}

// Submit rearranged group sizes
async function submitNewGroupSizes(category) {
  // Get the new sizes from the DOM elements
  const items = Array.from(document.querySelectorAll('.group-size-item'));
  const newSizes = items.map(item => {
    const text = item.textContent.trim();
    return parseInt(text);
  });
  
  // Validate
  const currentSizes = getGroupSizes(category);
  const totalCurrent = currentSizes.reduce((a, b) => a + b, 0);
  const totalNew = newSizes.reduce((a, b) => a + b, 0);
  
  if (totalNew !== totalCurrent) {
    alert(`总人数必须相同！当前: ${totalCurrent}人，新: ${totalNew}人`);
    return;
  }
  
  if (newSizes.some(s => s < 4 || s > 5)) {
    alert('每组必须是4-5人');
    return;
  }
  
  const rearrangeData = {
    category: category,
    newGroupSizes: newSizes,
    currentRound: data.currentRound
  };
  
  try {
    const result = await updateDataToServer('/api/rearrangeGroups', rearrangeData);
    if (result && result.success) {
      alert('分组重新排列成功！');
      await syncDataFromServer();
      renderMatch();
      closeRearrangeModal();
      renderAdmin();
    } else {
      alert('重新排列失败：' + (result?.message || '未知错误'));
    }
  } catch (error) {
    console.error('Error:', error);
    alert('提交失败！');
  }
}

function closeRearrangeModal() {
  const modal = document.getElementById('rearrangeModal');
  if (modal) modal.remove();
}

init();
