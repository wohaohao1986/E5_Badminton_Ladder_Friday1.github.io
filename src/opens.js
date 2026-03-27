
// Track which opens player rows are expanded
const expandedOpensPlayers = new Set();
let currentPairPlans = [];
let selectedPairPlanIndex = 0;

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
      <button onclick="switchOpensTab('registration')" id="tab-registration" class="tab-btn" style="padding:10px 20px;background:none;border:none;border-bottom:2px solid transparent;cursor:pointer;font-weight:bold;">报名</button>  
      <button onclick="switchOpensTab('players')" id="tab-players" class="tab-btn-active" style="padding:10px 20px;background:none;border:none;border-bottom:2px solid #4CAF50;cursor:pointer;font-weight:bold;">选手</button>
      <button onclick="switchOpensTab('pairplan')" id="tab-pairplan" class="tab-btn" style="padding:10px 20px;background:none;border:none;border-bottom:2px solid transparent;cursor:pointer;font-weight:bold;">生成配对方案</button>
      <button onclick="switchOpensTab('matches')" id="tab-matches" class="tab-btn" style="padding:10px 20px;background:none;border:none;border-bottom:2px solid transparent;cursor:pointer;font-weight:bold;">比赛</button>
      <button onclick="switchOpensTab('scores')" id="tab-scores" class="tab-btn" style="padding:10px 20px;background:none;border:none;border-bottom:2px solid transparent;cursor:pointer;font-weight:bold;">报分</button>
    </div>
    
    <div id="tab-registration-content" style="display:none;"></div>

    <div id="tab-players-content">
      <div style="margin-bottom:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
        <label style="font-weight:bold;white-space:nowrap;">队伍数量</label>
        <select id="import-num-teams" style="padding:6px 10px;border:1px solid #ddd;border-radius:4px;">
          <option value="2">2队</option>
          <option value="3">3队</option>
          <option value="4">4队</option>
          <option value="5">5队</option>
          <option value="6">6队</option>
        </select>
        <button onclick="importPlayersFromLadder()" class="btn-primary" style="padding:8px 20px;flex:1;">从Ladder导入选手</button>
      </div>
      <div id="opens-teams-container"></div>
    </div>
    
    <div id="tab-pairplan-content" style="display:none;">
      <form onsubmit="submitGeneratePairPlan(event)" style="display:grid;gap:10px;">
        <div style="display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));">
          <div>
            <label style="display:block;margin-bottom:5px;font-weight:bold;">队伍数量</label>
            <select id="pairplan-num-teams" style="padding:8px;border:1px solid #ddd;border-radius:4px;width:100%;">
              <option value="2">2队（经典 A vs B）</option>
              <option value="3">3队</option>
              <option value="4">4队</option>
              <option value="5">5队</option>
              <option value="6">6队</option>
            </select>
          </div>
          <div>
            <label style="display:block;margin-bottom:5px;font-weight:bold;">男子人数 nM</label>
            <input type="number" id="pairplan-nm" min="2" value="6" required style="padding:8px;border:1px solid #ddd;border-radius:4px;width:100%;">
          </div>
          <div>
            <label style="display:block;margin-bottom:5px;font-weight:bold;">女子人数 nF</label>
            <input type="number" id="pairplan-nf" min="2" value="6" required style="padding:8px;border:1px solid #ddd;border-radius:4px;width:100%;">
          </div>
          <div>
            <label style="display:block;margin-bottom:5px;font-weight:bold;">男子场次上限</label>
            <input type="number" id="pairplan-max-males" min="0" value="16" style="padding:8px;border:1px solid #ddd;border-radius:4px;width:100%;">
          </div>
          <div>
            <label style="display:block;margin-bottom:5px;font-weight:bold;">女子场次上限</label>
            <input type="number" id="pairplan-max-females" min="0" placeholder="可选" style="padding:8px;border:1px solid #ddd;border-radius:4px;width:100%;">
          </div>
          <div>
            <label style="display:block;margin-bottom:5px;font-weight:bold;">每个混合组场次上限</label>
            <input type="number" id="pairplan-max-cross" min="0" placeholder="可选" style="padding:8px;border:1px solid #ddd;border-radius:4px;width:100%;">
          </div>
          <div>
            <label style="display:block;margin-bottom:5px;font-weight:bold;">候选方案数量</label>
            <input type="number" id="pairplan-alternatives" min="1" max="10" value="3" style="padding:8px;border:1px solid #ddd;border-radius:4px;width:100%;">
          </div>
          <div>
            <label style="display:block;margin-bottom:5px;font-weight:bold;">随机种子（可选）</label>
            <input type="text" id="pairplan-seed" placeholder="例如 opens-2026-03-16" style="padding:8px;border:1px solid #ddd;border-radius:4px;width:100%;">
          </div>
          <div>
            <label style="display:block;margin-bottom:5px;font-weight:bold;">女子最多出场次数</label>
            <input type="number" id="pairplan-female-appear" min="1" value="3" style="padding:8px;border:1px solid #ddd;border-radius:4px;width:100%;">
          </div>
        </div>
        <div style="display:flex;gap:20px;flex-wrap:wrap;">
          <label style="display:flex;align-items:center;gap:6px;"><input type="checkbox" id="pairplan-randomize" checked>开启随机平衡</label>
          <label style="display:flex;align-items:center;gap:6px;"><input type="checkbox" id="pairplan-reduced-females">限制女子出场次数</label>
        </div>
        <button type="submit" class="btn-primary" style="width:100%;padding:10px;">生成配对方案</button>
      </form>
      <div id="pairplan-result" style="margin-top:14px;"></div>
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
  loadRegistrationData(opens);
}

// Switch tabs in opens detail
function switchOpensTab(tabName) {
  // Hide all tabs
  ['players', 'matches', 'scores', 'pairplan', 'registration'].forEach(name => {
    document.getElementById(`tab-${name}-content`).style.display = 'none';
    document.getElementById(`tab-${name}`).style.borderBottom = '2px solid transparent';
  });
  // Show selected tab
  document.getElementById(`tab-${tabName}-content`).style.display = 'block';
  document.getElementById(`tab-${tabName}`).style.borderBottom = '2px solid #4CAF50';
}

function parseOptionalNumber(inputId) {
  const raw = document.getElementById(inputId).value;
  if (raw === '' || raw == null) return undefined;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? undefined : n;
}

function checkCurrentOpensEvenSplit(groupSize = 6) {
  if (!window.currentOpens || !Array.isArray(window.currentOpens.categories)) return { ok: true, messages: [] };
  const ht = window.currentOpens.categories.find(c => c.id === 'A') || { males: [], females: [] };
  const xy = window.currentOpens.categories.find(c => c.id === 'B') || { males: [], females: [] };

  const htM = (ht.males || []).length;
  const xyM = (xy.males || []).length;
  const htF = (ht.females || []).length;
  const xyF = (xy.females || []).length;

  const messages = [];
  if (htM % groupSize !== 0 || xyM % groupSize !== 0 || htM !== xyM) {
    messages.push(`男子人数不能按每组${groupSize}人均匀分组（A队:${htM}，B队:${xyM}）`);
  }
  if (htF % groupSize !== 0 || xyF % groupSize !== 0 || htF !== xyF) {
    messages.push(`女子人数不能按每组${groupSize}人均匀分组（A队:${htF}，B队:${xyF}）`);
  }
  return { ok: messages.length === 0, messages };
}

function splitPlayersForValidation(opens, groupSize = 6) {
  const ht = opens.categories.find(c => c.id === 'A') || { males: [], females: [] };
  const xy = opens.categories.find(c => c.id === 'B') || { males: [], females: [] };
  const split = (arr) => {
    const groups = [];
    for (let i = 0; i < arr.length; i += groupSize) groups.push(arr.slice(i, i + groupSize));
    return groups;
  };
  return {
    htMG: split(ht.males || []),
    xyMG: split(xy.males || []),
    htFG: split(ht.females || []),
    xyFG: split(xy.females || [])
  };
}

function allocateFemalesForCrossUi(totalFemales, maleGroupSizes) {
  const allocation = new Array(maleGroupSizes.length).fill(0);
  let remaining = totalFemales;
  for (let i = 0; i < maleGroupSizes.length && remaining > 0; i++) {
    if (maleGroupSizes[i] > 0) {
      allocation[i]++;
      remaining--;
    }
  }
  while (remaining > 0) {
    let bestIdx = -1;
    let bestRatio = Infinity;
    for (let i = 0; i < maleGroupSizes.length; i++) {
      if (maleGroupSizes[i] <= 0) continue;
      const ratio = allocation[i] / maleGroupSizes[i];
      if (ratio < bestRatio) {
        bestRatio = ratio;
        bestIdx = i;
      }
    }
    if (bestIdx === -1) break;
    allocation[bestIdx]++;
    remaining--;
  }
  return allocation;
}

function extractPlanRequirementsUi(rules) {
  const result = { neutralMax: 0, maleMax: 0, femaleMax: 0, femaleMaxByGroup: {} };
  if (!Array.isArray(rules)) return result;
  rules.forEach((rule) => {
    [...(rule.team1 || []), ...(rule.team2 || [])].forEach((code) => {
      const match = String(code).match(/^([AB])(F|M|)(\d+)(?:G(\d+))?$/);
      if (!match) return;
      const [, , type, idxStr, groupStr] = match;
      const idx = parseInt(idxStr, 10);
      if (type === 'M') result.maleMax = Math.max(result.maleMax, idx);
      else if (type === 'F') {
        if (groupStr) {
          const g = parseInt(groupStr, 10);
          result.femaleMaxByGroup[g] = Math.max(result.femaleMaxByGroup[g] || 0, idx);
        } else {
          result.femaleMax = Math.max(result.femaleMax, idx);
        }
      } else {
        result.neutralMax = Math.max(result.neutralMax, idx);
      }
    });
  });
  return result;
}

function validateSelectedPairPlanAgainstCurrentOpens(plan) {
  if (!window.currentOpens || !plan) return { ok: true, message: '' };
  const { htMG, xyMG, htFG, xyFG } = splitPlayersForValidation(window.currentOpens, 6);
  const numMG = Math.min(htMG.length, xyMG.length);
  const numFG = Math.min(htFG.length, xyFG.length);
  const numCrossGroups = numMG;
  const maleGroupSizes = [];
  for (let g = 0; g < numMG; g++) maleGroupSizes.push(Math.min(htMG[g].length, xyMG[g].length));
  const pairedFemaleCount = Math.min((htFG[0] || []).length, (xyFG[0] || []).length);
  const femaleAlloc = allocateFemalesForCrossUi(pairedFemaleCount, maleGroupSizes);

  const maleReq = extractPlanRequirementsUi(plan.males_matches);
  for (let g = 0; g < numMG; g++) {
    if (maleReq.neutralMax > maleGroupSizes[g]) {
      return { ok: false, message: `所选男子配对方案需要至少${maleReq.neutralMax}名选手，但第${g + 1}个男子组只有${maleGroupSizes[g]}名选手` };
    }
  }

  const femaleReq = extractPlanRequirementsUi(plan.females_matches);
  for (let g = 0; g < numFG; g++) {
    const actualFemaleSize = Math.min(htFG[g].length, xyFG[g].length);
    if (femaleReq.neutralMax > actualFemaleSize) {
      return { ok: false, message: `所选女子配对方案需要至少${femaleReq.neutralMax}名选手，但第${g + 1}个女子组只有${actualFemaleSize}名选手` };
    }
  }

  for (let g = 0; g < numCrossGroups; g++) {
    const crossRules = Array.isArray(plan[`cross_matches_group${g + 1}`]) ? plan[`cross_matches_group${g + 1}`] : plan.cross_matches;
    const crossReq = extractPlanRequirementsUi(crossRules);
    if (crossReq.maleMax > maleGroupSizes[g]) {
      return { ok: false, message: `所选混合配对方案需要至少${crossReq.maleMax}名男子选手，但第${g + 1}个混合组只有${maleGroupSizes[g]}名男子选手` };
    }
    if (crossReq.femaleMax > (femaleAlloc[g] || 0)) {
      return { ok: false, message: `所选混合配对方案需要至少${crossReq.femaleMax}名本地女子选手，但第${g + 1}个混合组只分配到${femaleAlloc[g] || 0}名女子选手` };
    }
    for (const [groupKey, maxIdx] of Object.entries(crossReq.femaleMaxByGroup)) {
      const originalIdx = parseInt(groupKey, 10) - 1;
      const originalFemaleSize = Math.min((htFG[originalIdx] || []).length, (xyFG[originalIdx] || []).length);
      if (maxIdx > originalFemaleSize) {
        return { ok: false, message: `所选混合配对方案引用了原始女子组G${groupKey}的第${maxIdx}名选手，但该组只有${originalFemaleSize}名女子选手` };
      }
    }
  }

  return { ok: true, message: '' };
}

function buildCurrentOpensCrossSplitPreview() {
  if (!window.currentOpens || !Array.isArray(window.currentOpens.categories)) return null;

  const { htMG, xyMG, htFG, xyFG } = splitPlayersForValidation(window.currentOpens, 6);
  const numCrossGroups = Math.min(htMG.length, xyMG.length);
  if (numCrossGroups === 0) return null;

  const maleGroupSizes = [];
  for (let g = 0; g < numCrossGroups; g++) {
    maleGroupSizes.push(Math.min(htMG[g].length, xyMG[g].length));
  }

  const pairedFemaleCount = Math.min((htFG[0] || []).length, (xyFG[0] || []).length);
  if (pairedFemaleCount <= 0) return null;

  const femaleAllocation = allocateFemalesForCrossUi(pairedFemaleCount, maleGroupSizes);
  let femaleCursor = 0;
  const groups = femaleAllocation.map((femaleCount, index) => {
    const start = femaleCount > 0 ? femaleCursor + 1 : null;
    const end = femaleCount > 0 ? femaleCursor + femaleCount : null;
    femaleCursor += femaleCount;
    return {
      group: index + 1,
      maleCount: maleGroupSizes[index] || 0,
      femaleCount,
      femaleStart: start,
      femaleEnd: end
    };
  });

  return {
    pairedFemaleCount,
    maleGroupSizes,
    femaleAllocation,
    groups
  };
}

function renderCurrentOpensCrossSplitPreview() {
  const preview = buildCurrentOpensCrossSplitPreview();
  if (!preview) return '';

  let html = '<div style="margin-bottom:12px;padding:10px;border:1px solid #e4eefb;border-radius:8px;background:#f7fbff;">';
  html += '<h4 style="margin:0 0 8px 0;color:#285ea8;">混合跨组平衡拆分预览</h4>';
  html += `<div style="font-size:13px;color:#444;margin-bottom:8px;">基于当前公开赛名单预估：可配对女子总数 ${preview.pairedFemaleCount}</div>`;
  html += '<div style="overflow-x:auto;">';
  html += '<table style="width:100%;border-collapse:collapse;font-size:13px;background:#fff;border:1px solid #e7eef7;">';
  html += '<thead><tr style="background:#eef5ff;"><th style="padding:7px;text-align:left;border-bottom:1px solid #e7eef7;">Cross组</th><th style="padding:7px;text-align:left;border-bottom:1px solid #e7eef7;">男子人数</th><th style="padding:7px;text-align:left;border-bottom:1px solid #e7eef7;">分配女子人数</th><th style="padding:7px;text-align:left;border-bottom:1px solid #e7eef7;">原始女子索引</th></tr></thead>';
  html += '<tbody>';
  preview.groups.forEach((item) => {
    const rangeText = item.femaleCount > 0 ? `${item.femaleStart}-${item.femaleEnd}` : '无';
    html += `<tr><td style="padding:7px;border-bottom:1px solid #f0f4fa;">第${item.group}组</td><td style="padding:7px;border-bottom:1px solid #f0f4fa;">${item.maleCount}</td><td style="padding:7px;border-bottom:1px solid #f0f4fa;">${item.femaleCount}</td><td style="padding:7px;border-bottom:1px solid #f0f4fa;">${rangeText}</td></tr>`;
  });
  html += '</tbody></table></div>';
  html += '</div>';
  return html;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPlanMiddleGroundJson(obj) {
  const q = (s) => JSON.stringify(s);
  const fmtTeam = (t) => `[${(t || []).map(q).join(', ')}]`;
  const fmtMatch = (m) => `{ "team1": ${fmtTeam(m.team1)}, "team2": ${fmtTeam(m.team2)} }`;
  const fmtMatchArray = (arr, indent = '    ') => {
    if (!Array.isArray(arr) || arr.length === 0) return '[]';
    return '[\n' + arr.map((m) => `${indent}${fmtMatch(m)}`).join(',\n') + '\n  ]';
  };

  const formatSinglePlan = (plan, planIndent = '') => {
    const keys = Object.keys(plan || {});
    const preferred = ['males_matches', 'females_matches', 'cross_matches'];
    const extra = keys
      .filter(k => !preferred.includes(k))
      .sort((a, b) => {
        const am = a.match(/^cross_matches_group(\d+)$/);
        const bm = b.match(/^cross_matches_group(\d+)$/);
        if (am && bm) return parseInt(am[1], 10) - parseInt(bm[1], 10);
        return a.localeCompare(b);
      });
    const ordered = [...preferred.filter(k => keys.includes(k)), ...extra];

    let s = `${planIndent}{\n`;
    ordered.forEach((k, idx) => {
      const comma = idx < ordered.length - 1 ? ',' : '';
      if (Array.isArray(plan[k]) && (plan[k].length === 0 || (plan[k][0] && Array.isArray(plan[k][0].team1)))) {
        s += `${planIndent}  "${k}": ${fmtMatchArray(plan[k], `${planIndent}    `)}${comma}\n`;
      } else {
        s += `${planIndent}  "${k}": ${JSON.stringify(plan[k])}${comma}\n`;
      }
    });
    s += `${planIndent}}`;
    return s;
  };

  if (Array.isArray(obj?.plans)) {
    let out = '{\n  "plans": [\n';
    out += obj.plans.map((plan) => formatSinglePlan(plan, '    ')).join(',\n');
    out += '\n  ]\n}';
    return out;
  }

  return formatSinglePlan(obj || {});
}

function renderOnePlanTable(plan) {
  const sections = [
    { key: 'males_matches', label: '男子配对' },
    { key: 'females_matches', label: '女子配对' }
  ];

  const crossGroupKeys = Object.keys(plan || {}).filter(k => /^cross_matches_group\d+$/.test(k));
  crossGroupKeys.sort((a, b) => {
    const ai = parseInt(a.replace('cross_matches_group', ''), 10);
    const bi = parseInt(b.replace('cross_matches_group', ''), 10);
    return ai - bi;
  });
  if (crossGroupKeys.length) {
    crossGroupKeys.forEach((k, idx) => sections.push({ key: k, label: `混合配对 第${idx + 1}组` }));
  } else {
    sections.push({ key: 'cross_matches', label: '混合配对' });
  }

  let html = '<div style="margin-top:12px;">';
  sections.forEach((sec) => {
    const rows = Array.isArray(plan?.[sec.key]) ? plan[sec.key] : [];
    html += `<h5 style="margin:10px 0 6px 0;color:#444;">${sec.label} (${rows.length}场)</h5>`;
    if (!rows.length) {
      html += '<p style="margin:0 0 8px 0;color:#999;">暂无</p>';
      return;
    }
    html += '<div style="overflow-x:auto;border:1px solid #eee;border-radius:6px;background:#fff;">';
    html += '<table style="width:100%;border-collapse:collapse;font-size:13px;">';
    html += '<thead><tr style="background:#f7f7f7;"><th style="padding:8px;border-bottom:1px solid #eee;text-align:left;">#</th><th style="padding:8px;border-bottom:1px solid #eee;text-align:left;">Team 1</th><th style="padding:8px;border-bottom:1px solid #eee;text-align:left;">Team 2</th></tr></thead>';
    html += '<tbody>';
    rows.forEach((m, i) => {
      html += `<tr><td style="padding:8px;border-bottom:1px solid #f1f1f1;">${i + 1}</td><td style="padding:8px;border-bottom:1px solid #f1f1f1;">${escapeHtml((m.team1 || []).join(' / '))}</td><td style="padding:8px;border-bottom:1px solid #f1f1f1;">${escapeHtml((m.team2 || []).join(' / '))}</td></tr>`;
    });
    html += '</tbody></table></div>';
  });
  html += '</div>';
  return html;
}

function renderNTeamPairPlanResult(response) {
  const container = document.getElementById('pairplan-result');
  if (!container) return;
  const pairings = Array.isArray(response.pairings) ? response.pairings : [];

  let html = `<div style="padding:10px;border:1px solid #e0e0e0;border-radius:8px;background:#f9f9f9;">`;
  html += `<h4 style="margin:0 0 10px 0;">N队循环赛配对方案（${pairings.length} 场对阵）</h4>`;

  pairings.forEach(pairing => {
    const males = (pairing.males_matches || []).length;
    const females = (pairing.females_matches || []).length;
    const cross = (pairing.cross_matches || []).length;
    html += `<div style="margin-bottom:10px;padding:10px;border:1px solid #ddd;border-radius:6px;background:#fff;">`;
    html += `<h5 style="margin:0 0 6px 0;">Team ${pairing.team1Id} vs Team ${pairing.team2Id}</h5>`;
    html += `<div style="font-size:13px;color:#555;margin-bottom:6px;">男子: ${males} 场 | 女子: ${females} 场 | 混合: ${cross} 场</div>`;
    html += `<details><summary style="cursor:pointer;font-size:13px;color:#4CAF50;">查看配对详情</summary>`;
    html += renderOnePlanTable(pairing);
    html += `</details></div>`;
  });

  html += `<details style="margin-top:10px;"><summary style="cursor:pointer;">查看完整JSON</summary>`;
  html += `<pre style="margin-top:8px;max-height:320px;overflow:auto;background:#1f2937;color:#e5e7eb;padding:10px;border-radius:6px;">${escapeHtml(JSON.stringify(response, null, 2))}</pre>`;
  html += `</details></div>`;
  container.innerHTML = html;

  // N-team plans are reference-only; "apply to opens" uses the 2-team flow
  currentPairPlans = null;
  selectedPairPlanIndex = 0;
}

function renderPairPlanResult(response) {
  const container = document.getElementById('pairplan-result');
  if (!container) return;

  // N-team plan format: { pairings: [{team1Id, team2Id, males_matches, ...}] }
  if (Array.isArray(response?.pairings)) {
    renderNTeamPairPlanResult(response);
    return;
  }

  const plans = Array.isArray(response?.plans) ? response.plans : [response];
  if (!plans || !plans.length || !plans[0]) {
    container.innerHTML = '<p style="color:#d32f2f;">未生成方案，请重试。</p>';
    return;
  }

  let html = `<div style="padding:10px;border:1px solid #e0e0e0;border-radius:8px;background:#f9f9f9;">`;
  html += `<h4 style="margin:0 0 10px 0;">共生成 ${plans.length} 套方案</h4>`;
  html += renderCurrentOpensCrossSplitPreview();
  plans.forEach((plan, idx) => {
    const males = (plan.males_matches || []).length;
    const females = (plan.females_matches || []).length;
    const crossGroupKeys = Object.keys(plan || {}).filter(k => /^cross_matches_group\d+$/.test(k));
    const cross = crossGroupKeys.length
      ? ((plan[crossGroupKeys[0]] || []).length)
      : ((plan.cross_matches || []).length);
    html += `<div id="pairplan-card-${idx}" onclick="selectPairPlan(${idx})" style="margin-bottom:8px;padding:8px;border-radius:6px;background:#fff;border:1px solid #eee;cursor:pointer;transition:all .15s ease;">`;
    html += `<div style="font-weight:bold;margin-bottom:4px;">方案 ${idx + 1}（点击查看详情）</div>`;
    html += `<div style="font-size:13px;color:#555;">男子: ${males} 场 | 女子: ${females} 场 | 混合(每组): ${cross} 场${crossGroupKeys.length ? ` | 混合组数: ${crossGroupKeys.length}` : ''}</div>`;
    html += `</div>`;
  });

  html += '<div id="pairplan-table-view"></div>';
  html += '<div style="margin-top:10px;">';
  html += '<button onclick="applySelectedPairPlanToCurrentOpens()" class="btn-primary" style="width:100%;padding:10px;">使用当前选中方案生成分组和比赛</button>';
  html += '</div>';

  html += `<details style="margin-top:10px;"><summary style="cursor:pointer;">查看完整JSON</summary>`;
  html += `<pre style="margin-top:8px;max-height:320px;overflow:auto;background:#1f2937;color:#e5e7eb;padding:10px;border-radius:6px;">${escapeHtml(formatPlanMiddleGroundJson(response))}</pre>`;
  html += `</details></div>`;
  container.innerHTML = html;

  currentPairPlans = plans;
  selectedPairPlanIndex = 0;
  selectPairPlan(0);
}

function selectPairPlan(index) {
  const plans = Array.isArray(currentPairPlans) ? currentPairPlans : [];
  const tableContainer = document.getElementById('pairplan-table-view');
  if (!tableContainer || !plans[index]) return;
  selectedPairPlanIndex = index;

  plans.forEach((_, i) => {
    const card = document.getElementById(`pairplan-card-${i}`);
    if (!card) return;
    const isSelected = i === index;
    card.style.border = isSelected ? '2px solid #4CAF50' : '1px solid #eee';
    card.style.background = isSelected ? '#f1fff2' : '#fff';
    card.style.boxShadow = isSelected ? '0 0 0 2px rgba(76,175,80,0.15)' : 'none';
  });

  tableContainer.innerHTML = `<div style="padding:10px;border:1px solid #e7e7e7;border-radius:8px;background:#fff;"><h4 style="margin:0 0 8px 0;">方案 ${index + 1} 详细表</h4>${renderOnePlanTable(plans[index])}</div>`;
}

async function applySelectedPairPlanToCurrentOpens() {
  if (!window.currentOpens || !window.currentOpens.id) {
    alert('请先选择公开赛');
    return;
  }
  const plans = Array.isArray(currentPairPlans) ? currentPairPlans : [];
  const selectedPlan = plans[selectedPairPlanIndex];
  if (!selectedPlan) {
    alert('请先在“生成配对方案”中生成并选择一个方案');
    return;
  }

  // 2-team plans cannot be applied to opens that have more than 2 teams.
  if ((window.currentOpens.categories || []).length > 2) {
    alert(`当前公开赛有 ${window.currentOpens.categories.length} 支队伍，无法使用2队方案生成比赛。\n请在"生成配对方案"中选择对应的队伍数量，分别为每对队伍生成方案。`);
    return;
  }

  const planFit = validateSelectedPairPlanAgainstCurrentOpens(selectedPlan);
  if (!planFit.ok) {
    alert(planFit.message);
    return;
  }

  const splitCheck = checkCurrentOpensEvenSplit(6);
  if (!splitCheck.ok) {
    alert(`人数分组预警：\n${splitCheck.messages.join('\n')}`);
    return;
  }

  if (!confirm('将使用当前选中方案生成分组和比赛，确认继续？')) return;
  const result = await sendAuthenticatedRequest('/api/opens/generateMatchesAndGroups', {
    opensId: window.currentOpens.id,
    customPairPlan: selectedPlan
  });
  if (result && result.matches) {
    window.currentOpens = result;
    loadOpenMatchesData(result);
    switchOpensTab('matches');
    const tip = result.warning ? `\n\n${result.warning}` : '';
    alert(`生成成功！共 ${result.matches.length} 场比赛${tip}`);
  }
}

async function submitGeneratePairPlan(event) {
  event.preventDefault();
  const nM = parseInt(document.getElementById('pairplan-nm').value, 10);
  const nF = parseInt(document.getElementById('pairplan-nf').value, 10);
  if (Number.isNaN(nM) || Number.isNaN(nF) || nM < 2 || nF < 2) {
    alert('nM/nF 请输入大于等于2的整数');
    return;
  }

  const numTeams = parseInt(document.getElementById('pairplan-num-teams').value, 10);

  const payload = {
    nM,
    nF,
    numTeams,
    maxMalesMatches: parseOptionalNumber('pairplan-max-males'),
    maxFemalesMatches: parseOptionalNumber('pairplan-max-females'),
    maxCrossMatches: parseOptionalNumber('pairplan-max-cross'),
    alternativeCount: parseOptionalNumber('pairplan-alternatives') || 1,
    randomize: document.getElementById('pairplan-randomize').checked,
    reducedFemales: document.getElementById('pairplan-reduced-females').checked,
    femalesMaxAppearances: parseOptionalNumber('pairplan-female-appear') || 3
  };
  const seed = (document.getElementById('pairplan-seed').value || '').trim();
  if (seed) payload.seed = seed;

  // crossFemaleAllocation is only relevant for 2-team plans
  if ((payload.numTeams || 2) === 2) {
    const preview = buildCurrentOpensCrossSplitPreview();
    if (preview && Array.isArray(preview.femaleAllocation) && preview.femaleAllocation.length) {
      payload.crossFemaleAllocation = preview.femaleAllocation;
    }
  }

  const result = await sendAuthenticatedRequest('/api/opens/generatePairPlan', payload);
  if (!result) {
    alert('生成失败，请检查输入');
    return;
  }
  renderPairPlanResult(result);
}

// Load players data for opens
function loadOpenPlayersData(opens) {
  const teamsContainer = document.getElementById('opens-teams-container');
  if (!opens.categories) return;

  // Rebuild team columns dynamically (supports N teams after import)
  if (teamsContainer) {
    const colHtml = opens.categories.map(cat =>
      `<div style="flex:1;min-width:200px;"><h3 style="margin-top:0;">Team ${cat.id}</h3><div id="players-${cat.id}"></div></div>`
    ).join('');
    teamsContainer.innerHTML = `<div style="display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap;">${colHtml}</div>`;
  }

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

  if (opens.crossSplit) {
    const pairedFemaleCount = opens.crossSplit.pairedFemaleCount || 0;
    const maleGroupSizes = Array.isArray(opens.crossSplit.maleGroupSizes) ? opens.crossSplit.maleGroupSizes : [];
    const femaleAllocation = Array.isArray(opens.crossSplit.femaleAllocationByCrossGroup)
      ? opens.crossSplit.femaleAllocationByCrossGroup
      : [];

    html += `<div style="margin-bottom:14px;padding:10px;border:1px solid #dcefdc;border-radius:8px;background:#f6fff7;">`;
    html += `<h4 style="margin:0 0 8px 0;color:#2f6f31;">跨组分配说明</h4>`;
    html += `<div style="font-size:13px;color:#444;margin-bottom:6px;">可配对女子总数: ${pairedFemaleCount}</div>`;
    if (maleGroupSizes.length && femaleAllocation.length) {
      html += '<div style="overflow-x:auto;">';
      html += '<table style="width:100%;border-collapse:collapse;font-size:13px;background:#fff;border:1px solid #e6f3e6;">';
      html += '<thead><tr style="background:#edf9ee;"><th style="padding:7px;border-bottom:1px solid #e6f3e6;text-align:left;">Cross组</th><th style="padding:7px;border-bottom:1px solid #e6f3e6;text-align:left;">男子人数</th><th style="padding:7px;border-bottom:1px solid #e6f3e6;text-align:left;">分配女子人数</th></tr></thead>';
      html += '<tbody>';
      const count = Math.min(maleGroupSizes.length, femaleAllocation.length);
      for (let i = 0; i < count; i++) {
        html += `<tr><td style="padding:7px;border-bottom:1px solid #f0f5f0;">第${i + 1}组</td><td style="padding:7px;border-bottom:1px solid #f0f5f0;">${maleGroupSizes[i]}</td><td style="padding:7px;border-bottom:1px solid #f0f5f0;">${femaleAllocation[i]}</td></tr>`;
      }
      html += '</tbody></table></div>';
    }
    html += '</div>';
  }

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
              <div style="font-size:11px;font-weight:bold;color:#5c6bc0;margin-bottom:4px;text-transform:uppercase;letter-spacing:1px;">Team A</div>
              ${(g.ht || []).map((p, j) => `<div style="font-size:13px;padding:2px 0;">${j + 1}. ${p.name}</div>`).join('')}
            </div>
            <div style="flex:1;padding:8px 12px;background:#fce4ec;">
              <div style="font-size:11px;font-weight:bold;color:#e91e8c;margin-bottom:4px;text-transform:uppercase;letter-spacing:1px;">Team B</div>
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
  // generateMatchesAndGroups only supports 2-team format — block N-team opens here
  // so the user gets a clear message instead of a silent no-op.
  if ((window.currentOpens.categories || []).length > 2) {
    alert(`当前公开赛有 ${window.currentOpens.categories.length} 支队伍，无法直接生成比赛。\n请在"生成配对方案"中为每对队伍分别生成方案。`);
    return;
  }
  const splitCheck = checkCurrentOpensEvenSplit(6);
  if (!splitCheck.ok) {
    alert(`人数分组预警：\n${splitCheck.messages.join('\n')}`);
    return;
  }
  if (!confirm('生成分组和比赛将覆盖现有数据，确认继续？')) return;
  const result = await sendAuthenticatedRequest('/api/opens/generateMatchesAndGroups', { opensId: window.currentOpens.id });
  if (result && result.matches) {
    window.currentOpens = result;
    loadOpenMatchesData(result);
    const tip = result.warning ? `\n\n${result.warning}` : '';
    alert(`生成成功！共 ${result.matches.length} 场比赛${tip}`);
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
  const numTeamsEl = document.getElementById('import-num-teams');
  const numTeams = numTeamsEl ? parseInt(numTeamsEl.value, 10) : 2;
  const result = await sendAuthenticatedRequest('/api/opens/importPlayers', { opensId: window.currentOpens.id, numTeams });
  if (result) {
    alert(`选手导入成功！已分为 ${numTeams} 支队伍`);
    const refreshed = await getFromServer(`/api/opens/${window.currentOpens.id}`);
    if (refreshed) {
      window.currentOpens = refreshed;
      loadOpenPlayersData(refreshed);
      // Keep pair-plan team count in sync with import so the user doesn't generate
      // a 2-team plan for a 3-team roster without noticing.
      const pptSel = document.getElementById('pairplan-num-teams');
      if (pptSel) pptSel.value = String(numTeams);
    }
  } else {
    alert('选手导入失败');
  }
}

// Load registration tab data
function loadRegistrationData(opens) {
  const container = document.getElementById('tab-registration-content');
  if (!container) return;

  const registrations = Array.isArray(opens.registration) ? opens.registration : [];

  const maleRegs = registrations.filter(r => r.gender === 'males');
  const femaleRegs = registrations.filter(r => r.gender === 'females');

  const shareUrl = `${window.location.origin}${window.location.pathname}?opensId=${encodeURIComponent(opens.id)}&tab=registration`;

  let html = `<div style="margin-bottom:16px;padding:10px 14px;border:1px solid #c8e6c9;border-radius:8px;background:#f1fff3;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
    <span style="font-size:13px;color:#2e7d32;font-weight:bold;white-space:nowrap;">📋 分享报名链接：</span>
    <span id="reg-share-url" style="font-size:12px;color:#555;word-break:break-all;flex:1;">${escapeHtml(shareUrl)}</span>
    <button onclick="copyRegistrationLink()" style="padding:4px 12px;background:#4CAF50;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;white-space:nowrap;">复制链接</button>
  </div>`;

  html += `<div style="margin-bottom:14px;padding:10px 14px;border:1px solid #ffe082;border-radius:8px;background:#fffde7;font-size:13px;color:#795548;">
    📢 当前 ladder 选手不用报名，如果不参加请提前在微信群告知
  </div>`;

  html += `<div style="margin-bottom:20px;padding:15px;border:1px solid #e0e0e0;border-radius:8px;background:#fafafa;">
    <h4 style="margin:0 0 12px 0;">报名（仅限非 Ladder 选手）</h4>
    <form onsubmit="submitRegistration(event)" style="display:grid;gap:12px;">
      <div>
        <label style="font-weight:bold;display:block;margin-bottom:5px;">姓名</label>
        <input type="text" id="reg-external-name" placeholder="输入选手姓名" style="padding:8px;border:1px solid #ddd;border-radius:4px;width:100%;box-sizing:border-box;">
      </div>

      <div>
        <label style="font-weight:bold;display:block;margin-bottom:5px;">性别</label>
        <select id="reg-gender" style="padding:8px;border:1px solid #ddd;border-radius:4px;width:100%;box-sizing:border-box;">
          <option value="males">男</option>
          <option value="females">女</option>
        </select>
      </div>

      <button type="submit" class="btn-primary" style="padding:10px;width:100%;">提交报名</button>
    </form>
  </div>`;

  html += `<div><h4 style="margin:0 0 10px 0;">已报名选手（${registrations.length}人）</h4>`;

  if (registrations.length === 0) {
    html += '<p style="color:#999;">暂无报名</p>';
  } else {
    if (maleRegs.length > 0) {
      html += `<h5 style="margin:10px 0 6px 0;color:#555;">男子（${maleRegs.length}人）</h5>`;
      maleRegs.forEach((r, i) => {
        html += `<div style="padding:7px 10px;margin-bottom:4px;background:#e3f2fd;border-radius:6px;font-size:13px;display:flex;justify-content:space-between;align-items:center;">
          <span>${i + 1}. ${escapeHtml(r.name)}</span>
          <button onclick="deleteRegistration('${escapeHtml(r.id)}')" class="btn-danger" style="padding:2px 8px;font-size:12px;">删除</button>
        </div>`;
      });
    }
    if (femaleRegs.length > 0) {
      html += `<h5 style="margin:10px 0 6px 0;color:#555;">女子（${femaleRegs.length}人）</h5>`;
      femaleRegs.forEach((r, i) => {
        html += `<div style="padding:7px 10px;margin-bottom:4px;background:#fce4ec;border-radius:6px;font-size:13px;display:flex;justify-content:space-between;align-items:center;">
          <span>${i + 1}. ${escapeHtml(r.name)}</span>
          <button onclick="deleteRegistration('${escapeHtml(r.id)}')" class="btn-danger" style="padding:2px 8px;font-size:12px;">删除</button>
        </div>`;
      });
    }
  }
  html += '</div>';

  container.innerHTML = html;
}

function copyRegistrationLink() {
  const url = document.getElementById('reg-share-url').textContent;
  navigator.clipboard.writeText(url).then(() => {
    alert('链接已复制！');
  }).catch(() => {
    prompt('请手动复制链接：', url);
  });
}

function handleRegSourceChange() {
  const fromLadder = document.querySelector('input[name="reg-from-ladder"]:checked').value === 'yes';
  document.getElementById('reg-ladder-field').style.display = fromLadder ? 'block' : 'none';
  document.getElementById('reg-external-field').style.display = fromLadder ? 'none' : 'block';
}

async function submitRegistration(event) {
  event.preventDefault();
  if (!window.currentOpens) { alert('请先选择公开赛'); return; }

  const gender = document.getElementById('reg-gender').value;
  const name = (document.getElementById('reg-external-name').value || '').trim();
  if (!name) { alert('请输入选手姓名'); return; }

  const payload = { opensId: window.currentOpens.id, name, gender, fromLadder: false };

  const result = await updateDataToServer('/api/opens/registration/add', payload);
  if (result) {
    window.currentOpens = result;
    loadRegistrationData(result);
  }
}

async function deleteRegistration(entryId) {
  if (!confirm('确认删除该报名？')) return;
  const result = await sendAuthenticatedRequest('/api/opens/registration/delete', {
    opensId: window.currentOpens.id,
    entryId
  });
  if (result) {
    window.currentOpens = result;
    loadRegistrationData(result);
  }
}

// Navigate directly to a specific opens and tab via URL params
async function deepLinkToOpens(opensId, tab) {
  const selector = document.getElementById('opens-selector');
  if (selector) selector.value = opensId;
  try {
    const opensData = await getFromServer(`/api/opens/${opensId}`);
    if (opensData && !opensData.error) {
      renderOpensDetail(opensData);
      if (tab) switchOpensTab(tab);
    }
  } catch (err) {
    console.warn('Failed to deep-link to opens:', err);
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

