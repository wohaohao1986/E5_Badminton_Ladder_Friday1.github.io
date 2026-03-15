
// Track which opens player rows are expanded
const expandedOpensPlayers = new Set();

// Opens page functions
function renderOpens() {
  const container = document.getElementById('opens-list');
  
  // Create form for adding new opens
  let html = `<div class="card" style="margin-bottom:20px;padding:15px;">
    <h3>添加新公开赛</h3>
    <form onsubmit="submitNewOpens(event)" style="display:grid;gap:10px;">
      <div>
        <label style="display:block;margin-bottom:5px;font-weight:bold;">场次名称</label>
        <input type="text" id="opens-name" placeholder="输入场次名称" required style="padding:8px;border:1px solid #ddd;border-radius:4px;width:100%;box-sizing:border-box;">
      </div>
      <div>
        <label style="display:block;margin-bottom:5px;font-weight:bold;">日期</label>
        <input type="date" id="opens-date" required style="padding:8px;border:1px solid #ddd;border-radius:4px;width:100%;box-sizing:border-box;">
      </div>
      <button type="submit" class="btn-primary" style="padding:10px;width:100%;">提交新公开赛</button>
    </form>
  </div>`;
  
  container.innerHTML = html;
  
  // Load and display existing opens
  displayOpensSelector(dataOpens, container);
}

// Display opens selector dropdown
function displayOpensSelector(dataOpens, container) {
  let html = '<div class="card" style="margin-bottom:20px;padding:15px;"><h3>选择公开赛</h3>';
  html += '<select id="opens-selector" onchange="handleOpensSelect()" style="padding:8px;border:1px solid #ddd;border-radius:4px;width:100%;">';
  html += '<option value="">-- 请选择公开赛 --</option>';
  
  if (dataOpens && dataOpens.length > 0) {
    dataOpens.forEach(opens => {
      html += `<option value="${opens.id}">${opens.name} (${opens.date})</option>`;
    });
  }
  
  html += '</select></div>';
  html += '<div id="opens-detail-container"></div>';
  html += '<div id="opens-list-existing"></div>';
  
  container.innerHTML += html;
  
  // Display existing opens list
  displayOpensList(dataOpens, container);
}

// Handle opens selection from dropdown
async function handleOpensSelect() {
  const opensId = document.getElementById('opens-selector').value;
  if (!opensId) {
    document.getElementById('opens-detail-container').innerHTML = '';
    return;
  }
  
  try {
    const opensResponse = await getFromServer(`/api/opens/${opensId}`);
    renderOpensDetail(opensResponse);
  } catch (err) {
    console.warn('Failed to fetch opens detail:', err);
  }
}

// Render opens detail with tabs
function renderOpensDetail(opens) {
  const container = document.getElementById('opens-detail-container');
  
  let html = `<div class="card" style="margin-bottom:20px;padding:15px;">
    <h2>${opens.name} - ${opens.date}</h2>
    
    <div style="display:flex;gap:10px;margin-bottom:20px;border-bottom:1px solid #ddd;">
      <button onclick="switchOpensTab('players')" id="tab-players" class="tab-btn-active" style="padding:10px 20px;background:none;border:none;border-bottom:2px solid #4CAF50;cursor:pointer;font-weight:bold;">选手</button>
      <button onclick="switchOpensTab('matches')" id="tab-matches" class="tab-btn" style="padding:10px 20px;background:none;border:none;border-bottom:2px solid transparent;cursor:pointer;font-weight:bold;">比赛</button>
      <button onclick="switchOpensTab('scores')" id="tab-scores" class="tab-btn" style="padding:10px 20px;background:none;border:none;border-bottom:2px solid transparent;cursor:pointer;font-weight:bold;">报分</button>
    </div>
    
    <div id="tab-players-content">
      <div style="margin-bottom:20px;">
        <button onclick="importPlayersFromLadder()" class="btn-primary" style="padding:10px 20px;width:100%;">从Ladder导入选手</button>
      </div>
      <div style="display:flex;gap:20px;align-items:flex-start;">
        <div style="flex:1;">
          <h3 style="margin-top:0;">灰太狼</h3>
          <div id="players-huitailang"></div>
        </div>
        <div style="flex:1;">
          <h3 style="margin-top:0;">喜羊羊</h3>
          <div id="players-xiyangyang"></div>
        </div>
      </div>
    </div>
    
    <div id="tab-matches-content" style="display:none;">
      <div style="margin-bottom:16px;">
        <button onclick="generateOpensMatchesAndGroups()" class="btn-primary" style="padding:10px 20px;width:100%;">&#x2699; 生成分组和比赛</button>
      </div>
      <div id="matches-list"></div>
    </div>
    
    <div id="tab-scores-content" style="display:none;">
      <form onsubmit="submitOpensScore(event)" style="display:grid;gap:10px;">
        <div>
          <label style="display:block;margin-bottom:5px;font-weight:bold;">选择比赛</label>
          <select id="opens-score-match" onchange="updateOpensScoreForm()" style="padding:8px;border:1px solid #ddd;border-radius:4px;width:100%;">
            <option value="">-- 请选择 --</option>
          </select>
        </div>
        <div id="opens-score-inputs" style="display:none;">
          <div style="margin-bottom:15px;">
            <label style="display:block;margin-bottom:5px;font-weight:bold;" id="opens-team1-label">队伍1</label>
            <input type="number" id="opens-score1" min="0" placeholder="输入分数" style="padding:8px;border:1px solid #ddd;border-radius:4px;width:100%;">
          </div>
          <div style="margin-bottom:15px;">
            <label style="display:block;margin-bottom:5px;font-weight:bold;" id="opens-team2-label">队伍2</label>
            <input type="number" id="opens-score2" min="0" placeholder="输入分数" style="padding:8px;border:1px solid #ddd;border-radius:4px;width:100%;">
          </div>
          <button type="submit" class="btn-primary" style="width:100%;padding:10px;">提交比分</button>
        </div>
      </form>
    </div>
  </div>`;
  
  container.innerHTML = html;
  
  // Store current opens for reference
  window.currentOpens = opens;
  
  // Load content for all tabs
  loadOpenPlayersData(opens);
  loadOpenMatchesData(opens);
}

// Switch tabs in opens detail
function switchOpensTab(tabName) {
  // Hide all tabs
  document.getElementById('tab-players-content').style.display = 'none';
  document.getElementById('tab-matches-content').style.display = 'none';
  document.getElementById('tab-scores-content').style.display = 'none';
  
  // Remove active state from all buttons
  document.getElementById('tab-players').style.borderBottom = '2px solid transparent';
  document.getElementById('tab-matches').style.borderBottom = '2px solid transparent';
  document.getElementById('tab-scores').style.borderBottom = '2px solid transparent';
  
  // Show selected tab
  document.getElementById(`tab-${tabName}-content`).style.display = 'block';
  document.getElementById(`tab-${tabName}`).style.borderBottom = '2px solid #4CAF50';
}

// Load players data for opens
function loadOpenPlayersData(opens) {
  if (!opens.categories) return;

  opens.categories.forEach(category => {
    const container = document.getElementById(`players-${category.id}`);
    if (!container) return;

    const males = category.males || [];
    const females = category.females || [];

    function renderList(players, gender, bg) {
      let h = '';
      if (players.length === 0) {
        h += '<p style="color:#999;margin:0 0 8px 0;">暂无选手</p>';
      } else {
        players.forEach((p, i) => {
          const uid = `${category.id}-${gender}-${p.id}`;
          const isExpanded = expandedOpensPlayers.has(uid);
          const icon = isExpanded ? '▼' : '▶';
          h += `<div style="margin-bottom:4px;background:${bg};border-radius:6px;overflow:hidden;">
            <div style="padding:5px 10px;cursor:pointer;display:flex;align-items:center;gap:8px;" onclick="toggleOpensPlayerButtons('${uid}', event)">
              <span style="font-size:13px;width:14px;display:inline-block;text-align:center;">${icon}</span>
              <span style="font-size:14px;">${i + 1}. ${p.name || p.id}</span>
            </div>
            <fieldset style="display:${isExpanded ? 'block' : 'none'};border:none;padding:4px 10px 8px 32px;margin:0;" class="opens-player-btns-${uid}" onclick="event.stopPropagation()">
              <button onclick="editOpensPlayerRank('${category.id}','${gender}','${p.id}')" class="btn-info" style="padding:3px 8px;font-size:12px;margin-right:5px;">改排名</button>
              <button onclick="deleteOpensPlayer('${category.id}','${gender}','${p.id}')" class="btn-danger" style="padding:3px 8px;font-size:12px;">删除</button>
            </fieldset>
          </div>`;
        });
      }
      return h;
    }

    let html = '';
    html += `<div style="margin-bottom:16px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <h4 style="margin:0;color:#555;">男子 (${males.length}人)</h4>
        <button onclick="addOpensPlayer('${category.id}','males')" class="btn-info" style="padding:3px 10px;font-size:12px;">+ 添加</button>
      </div>
      ${renderList(males, 'males', '#e8f5e9')}
    </div>`;
    html += `<div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <h4 style="margin:0;color:#555;">女子 (${females.length}人)</h4>
        <button onclick="addOpensPlayer('${category.id}','females')" class="btn-info" style="padding:3px 10px;font-size:12px;">+ 添加</button>
      </div>
      ${renderList(females, 'females', '#fce4ec')}
    </div>`;

    container.innerHTML = html;
  });
}

function toggleOpensPlayerButtons(uid, event) {
  event.stopPropagation();
  if (expandedOpensPlayers.has(uid)) {
    expandedOpensPlayers.delete(uid);
  } else {
    expandedOpensPlayers.add(uid);
  }
  loadOpenPlayersData(window.currentOpens);
}

async function addOpensPlayer(categoryId, gender) {
  const name = prompt('请输入选手姓名：');
  if (!name || !name.trim()) return;
  const result = await sendAuthenticatedRequest('/api/opens/player/add', {
    opensId: window.currentOpens.id,
    categoryId,
    gender,
    name: name.trim()
  });
  if (result) {
    window.currentOpens = result;
    loadOpenPlayersData(result);
  }
}

async function editOpensPlayerRank(categoryId, gender, playerId) {
  const cat = window.currentOpens.categories.find(c => c.id === categoryId);
  const arr = cat ? (cat[gender] || []) : [];
  const currentPos = arr.findIndex(p => p.id === playerId) + 1;
  const input = prompt(`当前位置: ${currentPos}，请输入新位置（1-${arr.length}）：`);
  if (!input) return;
  const position = parseInt(input);
  if (isNaN(position) || position < 1 || position > arr.length) { alert('无效的位置'); return; }
  const result = await sendAuthenticatedRequest('/api/opens/player/rank', {
    opensId: window.currentOpens.id,
    categoryId,
    gender,
    playerId,
    position
  });
  if (result) {
    window.currentOpens = result;
    loadOpenPlayersData(result);
  }
}

async function deleteOpensPlayer(categoryId, gender, playerId) {
  if (!confirm('确认删除该选手？')) return;
  const result = await sendAuthenticatedRequest('/api/opens/player/delete', {
    opensId: window.currentOpens.id,
    categoryId,
    gender,
    playerId
  });
  if (result) {
    window.currentOpens = result;
    loadOpenPlayersData(result);
  }
}

// Load matches data for opens
function loadOpenMatchesData(opens) {
  const container = document.getElementById('matches-list');
  let html = '';

  // Groups summary
  if (opens.groups) {
    const renderGroupSection = (groupPairs, label) => {
      if (!groupPairs || groupPairs.length === 0) return '';
      let h = `<h4 style="margin:0 0 8px 0;color:#444;">${label}分组</h4>`;
      groupPairs.forEach((g, i) => {
        h += `<div style="margin-bottom:8px;border-radius:8px;overflow:hidden;border:1px solid #ddd;">
          <div style="padding:5px 10px;background:#e0e0e0;font-size:13px;font-weight:bold;">第${i + 1}组</div>
          <div style="display:flex;">
            <div style="flex:1;padding:8px 12px;background:#e8eaf6;border-right:2px solid #fff;">
              <div style="font-size:11px;font-weight:bold;color:#5c6bc0;margin-bottom:4px;text-transform:uppercase;letter-spacing:1px;">灰太狼</div>
              ${(g.ht || []).map((p, j) => `<div style="font-size:13px;padding:2px 0;">${j + 1}. ${p.name}</div>`).join('')}
            </div>
            <div style="flex:1;padding:8px 12px;background:#fce4ec;">
              <div style="font-size:11px;font-weight:bold;color:#e91e8c;margin-bottom:4px;text-transform:uppercase;letter-spacing:1px;">喜羊羊</div>
              ${(g.xy || []).map((p, j) => `<div style="font-size:13px;padding:2px 0;">${j + 1}. ${p.name}</div>`).join('')}
            </div>
          </div>
        </div>`;
      });
      return h;
    };
    html += '<div style="margin-bottom:20px;">';
    html += renderGroupSection(opens.groups.males, '男子');
    html += renderGroupSection(opens.groups.females, '女子');
    html += '</div>';
  }

  if (!opens.matches || opens.matches.length === 0) {
    html += '<p style="color:#999;">暂无比赛，请先生成</p>';
    container.innerHTML = html;
    const scoreSelect = document.getElementById('opens-score-match');
    if (scoreSelect) scoreSelect.innerHTML = '<option value="">—— 请选择 ——</option>';
    return;
  }

  const typeLabel = { males: '男子', females: '女子', cross: '混合' };
  const typeBg   = { males: '#e3f2fd',  females: '#fce4ec', cross: '#f3e5f5' };

  // Collect ordered sections
  const sections = [];
  const keyIndex = new Map();
  opens.matches.forEach((match, idx) => {
    const key = `${match.type || ''}-${match.group || ''}`;
    if (!keyIndex.has(key)) { keyIndex.set(key, sections.length); sections.push({ type: match.type, group: match.group, indices: [] }); }
    sections[keyIndex.get(key)].indices.push(idx);
  });

  sections.forEach(sec => {
    const label = (typeLabel[sec.type] || sec.type || '比赛') + (sec.group ? ` 第${sec.group}组` : '');
    const bg = typeBg[sec.type] || '#f5f5f5';
    const done = sec.indices.filter(i => opens.matches[i].completed).length;
    html += `<h4 style="margin:16px 0 6px 0;color:#555;">${label} — ${done}/${sec.indices.length} 已完成</h4>`;
    sec.indices.forEach(idx => {
      const m = opens.matches[idx];
      const scoreText = m.completed ? `${m.score1} : ${m.score2}` : '未完成';
      const scoreColor = m.completed ? '#4CAF50' : '#aaa';
      html += `<div style="padding:7px 10px;margin-bottom:3px;background:${bg};border-radius:6px;font-size:13px;display:flex;justify-content:space-between;align-items:center;">
        <span>${(m.team1 || []).join(' / ')} <strong>vs</strong> ${(m.team2 || []).join(' / ')}</span>
        <span style="color:${scoreColor};font-size:12px;min-width:60px;text-align:right;">${scoreText}</span>
      </div>`;
    });
  });

  container.innerHTML = html;

  // Populate score dropdown
  const scoreSelect = document.getElementById('opens-score-match');
  if (scoreSelect) {
    scoreSelect.innerHTML = '<option value="">—— 请选择 ——</option>';
    opens.matches.forEach((match, index) => {
      if (!match.completed) {
        const sec = `[${typeLabel[match.type] || ''}G${match.group || ''}]`;
        scoreSelect.innerHTML += `<option value="${index}">${sec} ${(match.team1 || []).join('/')} vs ${(match.team2 || []).join('/')}</option>`;
      }
    });
  }
}

async function generateOpensMatchesAndGroups() {
  if (!window.currentOpens) { alert('请先选择公开赛'); return; }
  if (!confirm('生成分组和比赛将覆盖现有数据，确认继续？')) return;
  const result = await sendAuthenticatedRequest('/api/opens/generateMatchesAndGroups', { opensId: window.currentOpens.id });
  if (result && result.matches) {
    window.currentOpens = result;
    loadOpenMatchesData(result);
    alert(`生成成功！共 ${result.matches.length} 场比赛`);
  }
}

// Update opens score form
function updateOpensScoreForm() {
  const matchIndex = document.getElementById('opens-score-match').value;
  const inputs = document.getElementById('opens-score-inputs');
  
  if (!matchIndex) {
    inputs.style.display = 'none';
    return;
  }
  
  const match = window.currentOpens.matches[matchIndex];
  document.getElementById('opens-team1-label').textContent = (match.team1 ? match.team1.join(' / ') : '队伍1') + ' 得分';
  document.getElementById('opens-team2-label').textContent = (match.team2 ? match.team2.join(' / ') : '队伍2') + ' 得分';
  inputs.style.display = 'grid';
}

// Submit opens score
async function submitOpensScore(event) {
  event.preventDefault();
  
  const matchIndex = document.getElementById('opens-score-match').value;
  const score1 = parseInt(document.getElementById('opens-score1').value);
  const score2 = parseInt(document.getElementById('opens-score2').value);
  
  if (!matchIndex || isNaN(score1) || isNaN(score2)) {
    alert('请填写完整信息');
    return;
  }
  
  // Update match score
  window.currentOpens.matches[matchIndex].score1 = score1;
  window.currentOpens.matches[matchIndex].score2 = score2;
  window.currentOpens.matches[matchIndex].completed = true;
  
  // Update on server
  await updateDataToServer(`/api/opens/${window.currentOpens.id}`, window.currentOpens);
  alert('比分提交成功！');
  loadOpenMatchesData(window.currentOpens);
}

// Submit new opens to server
async function submitNewOpens(event) {
  event.preventDefault();
  
  const opensName = document.getElementById('opens-name').value;
  const opensDate = document.getElementById('opens-date').value;
  
  if (!opensName || !opensDate) {
    alert('请填写完整信息');
    return;
  }
  
  const dataOpens = {
    name: opensName,
    date: opensDate
  };
  
  const result = await addDataToServer('/api/opens', dataOpens);
  if (result) {
    alert('公开赛添加成功！');
    await syncDataFromServer();
    renderOpens();
  } else {
    alert('添加失败');
  }
}

async function importPlayersFromLadder() {
  if (!window.currentOpens) {
    alert('请先选择公开赛');
    return;
  }
  const result = await sendAuthenticatedRequest('/api/opens/importPlayers', { opensId: window.currentOpens.id });
  if (result) {
    alert('选手导入成功！');
    const refreshed = await getFromServer(`/api/opens/${window.currentOpens.id}`);
    if (refreshed) {
      window.currentOpens = refreshed;
      loadOpenPlayersData(refreshed);
    }
  } else {
    alert('选手导入失败');
  }
}

// Display opens list
function displayOpensList(dataOpens, container) {
  let html = '<div class="card" style="margin-top:20px;padding:15px;"><h3 style="margin-top:0;">已有公开赛列表</h3>';
  
  if (!dataOpens || dataOpens.length === 0) {
    html += '<p>暂无公开赛</p>';
  } else {
    html += '<div style="display:grid;gap:10px;margin-top:10px;">';
    dataOpens.forEach(opens => {
      html += `<div style="padding:10px;background:#f5f5f5;border-radius:6px;">
        <h4 style="margin:0 0 5px 0;">${opens.name || '未命名'}</h4>
        <p style="margin:0;color:#666;">日期：${opens.date}</p>
      </div>`;
    });
    html += '</div>';
  }
  html += '</div>';
  
  const existingContainer = document.getElementById('opens-list-existing');
  if (existingContainer) {
    existingContainer.innerHTML = html;
  }
}

