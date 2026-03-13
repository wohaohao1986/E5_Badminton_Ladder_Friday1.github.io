
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
      <div style="margin-bottom:15px;">
        <h3>灰太狼</h3>
        <div id="players-huitailang" style="display:grid;gap:10px;"></div>
      </div>
      <div>
        <h3>喜羊羊</h3>
        <div id="players-xiyangyang" style="display:grid;gap:10px;"></div>
      </div>
    </div>
    
    <div id="tab-matches-content" style="display:none;">
      <div id="matches-list" style="display:grid;gap:10px;"></div>
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
    const categoryName = CATEGORIES[category.id] || category.id;
    const playersHtml = `<p>该公开赛中${categoryName}的选手列表</p>`;
    document.getElementById(`players-${category.id}`).innerHTML = playersHtml;
  });
}

// Load matches data for opens
function loadOpenMatchesData(opens) {
  const container = document.getElementById('matches-list');
  
  if (!opens.matches || opens.matches.length === 0) {
    container.innerHTML = '<p>暂无比赛</p>';
    return;
  }
  
  let html = '';
  opens.matches.forEach(match => {
    const status = match.completed ? '已完成' : '进行中';
    const score = match.completed ? `${match.score1} : ${match.score2}` : '待比赛';
    html += `<div style="padding:10px;background:#f5f5f5;border-radius:6px;">
      <p><strong>${status}</strong></p>
      <p>${match.team1 ? match.team1.join(' / ') : '队伍1'} vs ${match.team2 ? match.team2.join(' / ') : '队伍2'}</p>
      <p><strong>${score}</strong></p>
    </div>`;
  });
  
  container.innerHTML = html;
  
  // Populate score dropdown
  const scoreSelect = document.getElementById('opens-score-match');
  scoreSelect.innerHTML = '<option value="">-- 请选择 --</option>';
  opens.matches.forEach((match, index) => {
    if (!match.completed) {
      scoreSelect.innerHTML += `<option value="${index}">${match.team1 ? match.team1.join(' / ') : '队伍1'} vs ${match.team2 ? match.team2.join(' / ') : '队伍2'}</option>`;
    }
  });
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
    const result = await sendAuthenticatedRequest('api/opens/importPlayers');
    if (result) {
      alert('选手导入成功！');
      await syncDataFromServer();
      renderOpens();
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

