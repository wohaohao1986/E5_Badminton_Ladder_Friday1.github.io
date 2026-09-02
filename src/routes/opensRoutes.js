const express = require('express');
const path = require('path');
const { safeReadJson, safeWriteJson, logToFile } = require('../utils/fileUtils');
const { generateMalesPlan, generateFemalesPlanReduced, generateCrossPlan, generateFullPlan, generateAlternativePlans, generateNTeamPlan } = require('../utils/pairingUtils');
const router = express.Router();

const OPENS_FILE = path.join(__dirname, '../data/e5_opens.json');
const LADDER_FILE = path.join(__dirname, '../data/badminton_ladder_friday.json');
const PAIR_PLAN_FILE = path.join(__dirname, '../data/opens_pair_plan.json');
const DEFAULT_MAX_MALES_MATCHES = 16;

// Helper: load and init store
function loadStore() {
  return safeReadJson(OPENS_FILE, { opens: [] });
}

// Helper: save store
function saveStore(store) {
  safeWriteJson(OPENS_FILE, store);
}

// Helper: validate payload
function requirePayload(req, res) {
  const payload = req.body;
  if (!payload || Object.keys(payload).length === 0) {
    res.status(400).json({ error: 'Empty payload' });
    return null;
  }
  return payload;
}

// Distribute total females across male groups to keep female-per-male ratio balanced.
function allocateFemalesForCross(totalFemales, maleGroupSizes) {
  const n = maleGroupSizes.length;
  const allocation = new Array(n).fill(0);
  if (n === 0 || totalFemales <= 0) return allocation;

  let remaining = totalFemales;

  // Ensure coverage first: give 1 female to each non-empty male group if possible.
  for (let i = 0; i < n && remaining > 0; i++) {
    if (maleGroupSizes[i] > 0) {
      allocation[i]++;
      remaining--;
    }
  }

  // Then assign by lowest current female-per-male ratio.
  while (remaining > 0) {
    let bestIdx = -1;
    let bestRatio = Infinity;
    for (let i = 0; i < n; i++) {
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

function extractPlanRequirements(rules) {
  const result = {
    neutralMax: 0,
    maleMax: 0,
    femaleMax: 0,
    femaleMaxByGroup: {}
  };

  if (!Array.isArray(rules)) return result;

  for (const rule of rules) {
    for (const code of [...(rule.team1 || []), ...(rule.team2 || [])]) {
      const match = String(code).match(/^([AB])(F|M|)(\d+)(?:G(\d+))?$/);
      if (!match) continue;
      const [, , type, indexStr, groupStr] = match;
      const index = parseInt(indexStr, 10);
      if (type === 'M') {
        result.maleMax = Math.max(result.maleMax, index);
      } else if (type === 'F') {
        if (groupStr) {
          const groupKey = parseInt(groupStr, 10);
          result.femaleMaxByGroup[groupKey] = Math.max(result.femaleMaxByGroup[groupKey] || 0, index);
        } else {
          result.femaleMax = Math.max(result.femaleMax, index);
        }
      } else {
        result.neutralMax = Math.max(result.neutralMax, index);
      }
    }
  }

  return result;
}

// GET: Get all opens
router.get('/', (req, res) => {
  const store = loadStore();
  res.json(store.opens || []);
});

// GET: Get a specific opens by id
router.get('/:id', (req, res) => {
  const store = loadStore();
  const opens = (store.opens || []).find(o => o.id === req.params.id);
  if (opens) {
    res.json(opens);
  } else {
    res.status(404).json({ error: 'Opens not found' });
  }
});

// POST: Add a new opens
router.post('/', (req, res) => {
  const payload = requirePayload(req, res);
  if (!payload) return;

  if (!payload.name || !payload.date) {
    return res.status(400).json({ error: 'Name and date are required' });
  }

  const store = loadStore();
  if (!store.opens) {
    store.opens = [];
  }

  const newOpens = {
    id: `${payload.name}-${payload.date}`,
    name: payload.name,
    date: payload.date,
    // Bootstrap with 2 teams (A and B). importPlayers will replace categories entirely when N teams are selected.
    categories: [
      { id: 'A', males: [], females: [] },
      { id: 'B', males: [], females: [] }
    ],
    matches: []
  };

  const exists = store.opens.find(o => o.id === newOpens.id);
  if (!exists) {
    store.opens.push(newOpens);
    logToFile(`Request to add a new opens: ${newOpens.name} on ${newOpens.date}`);
    saveStore(store);
    res.status(201).json({ message: 'Opens added successfully'});
  } else {
    res.status(400).json({ error: 'Opens with this id already exists' });
  }
});

router.put('/importPlayers', (req, res) => {
    const { opensId, numTeams } = req.body;
    if (!opensId) return res.status(400).json({ error: 'opensId is required' });
    // Clamp to valid range [2, 6] rather than silently resetting to 2
    const safeNumTeams = (typeof numTeams === 'number' && Number.isInteger(numTeams))
        ? Math.min(Math.max(numTeams, 2), 6)
        : 2;
    logToFile(`Request to import players from ladder into opens: ${opensId} (${safeNumTeams} teams)`);
    try {
        const result = importPlayersFromLadder(opensId, safeNumTeams);
        res.json({ message: 'Players imported successfully', ...result });
    } catch (error) {
        logToFile(`Error in importPlayers: ${error.message}`);
        res.status(error.message.includes('not found') ? 404 : 500).json({ error: error.message });
    }
});

// PUT: Generate a pair plan for a given group size and save it to opens_pair_plan.json
router.put('/generatePairPlan', (req, res) => {
  const {
    nM,
    nF,
    numTeams,
    reducedFemales,
    femalesMaxAppearances,
    maxMalesMatches,
    maxFemalesMatches,
    maxCrossMatches,
    randomize,
    seed,
    alternativeCount,
    crossFemaleAllocation
  } = req.body;
  if (!nM || !nF) return res.status(400).json({ error: 'nM and nF are required' });
  if (typeof nM !== 'number' || typeof nF !== 'number' || nM < 2 || nF < 2) {
    return res.status(400).json({ error: 'nM and nF must be integers >= 2' });
  }
  // Clamp to valid range [2, 6] rather than silently resetting to 2
  const safeNumTeams = (typeof numTeams === 'number' && Number.isInteger(numTeams))
    ? Math.min(Math.max(numTeams, 2), 6)
    : 2;
  try {
    const baseOptions = {
      maxMalesMatches: (typeof maxMalesMatches === 'number' && maxMalesMatches >= 0)
        ? maxMalesMatches
        : DEFAULT_MAX_MALES_MATCHES,
      maxFemalesMatches: (typeof maxFemalesMatches === 'number' && maxFemalesMatches >= 0)
        ? maxFemalesMatches
        : undefined,
      maxCrossMatches: (typeof maxCrossMatches === 'number' && maxCrossMatches >= 0)
        ? maxCrossMatches
        : undefined,
      reducedFemales: !!reducedFemales,
      femalesMaxAppearances: typeof femalesMaxAppearances === 'number' ? femalesMaxAppearances : 3,
      randomize: !!randomize,
      seed
    };

    const altCount = (typeof alternativeCount === 'number' && alternativeCount > 1)
      ? Math.floor(alternativeCount)
      : 1;

    const safeCrossAllocation = Array.isArray(crossFemaleAllocation)
      ? crossFemaleAllocation
          .map(v => parseInt(v, 10))
          .filter(v => Number.isFinite(v) && v > 0)
      : null;

    function applyCrossAllocation(plan) {
      if (!safeCrossAllocation || safeCrossAllocation.length === 0) return plan;
      const updated = { ...plan };
      const randomizeCross = !!baseOptions.randomize;
      const maxCross = (typeof baseOptions.maxCrossMatches === 'number' && baseOptions.maxCrossMatches >= 0)
        ? baseOptions.maxCrossMatches
        : undefined;

      const isMultiGroup = safeCrossAllocation.length > 1;
      let fOffset = 0;
      safeCrossAllocation.forEach((fCount, idx) => {
        const groupSeed = baseOptions.seed != null ? `${baseOptions.seed}:cross-g${idx + 1}` : undefined;
        updated[`cross_matches_group${idx + 1}`] = generateCrossPlan(nM, fCount, {
          maxMatches: maxCross,
          randomize: randomizeCross,
          seed: groupSeed,
          femaleOffset: fOffset,
          femaleGroupId: isMultiGroup ? 1 : null
        });
        fOffset += fCount;
      });

      // Keep shared cross template aligned to group1 if allocation is provided.
      updated.cross_matches = updated.cross_matches_group1 || [];
      return updated;
    }

    if (altCount > 1) {
      const plans = generateAlternativePlans(nM, nF, { ...baseOptions, count: altCount })
        .map(applyCrossAllocation);
      if (!plans.length) return res.status(500).json({ error: 'Failed to generate alternative plans' });
      safeWriteJson(PAIR_PLAN_FILE, plans[0]);
      logToFile(`Generated ${plans.length} alternative pair plans: nM=${nM} nF=${nF}`);
      return res.json({ plans });
    }

    // N-team plan: generate C(N,2) sub-plans via generateNTeamPlan
    if (safeNumTeams > 2) {
      const teams = ['A', 'B', 'C', 'D', 'E', 'F'].slice(0, safeNumTeams).map(id => ({ id, nM, nF }));
      const result = generateNTeamPlan(teams, baseOptions);
      safeWriteJson(PAIR_PLAN_FILE, result);
      logToFile(`Generated N-team pair plan: ${safeNumTeams} teams, nM=${nM} nF=${nF}, ${result.pairings.length} pairings`);
      return res.json(result);
    }

    const plan = applyCrossAllocation(generateFullPlan(nM, nF, baseOptions));
    safeWriteJson(PAIR_PLAN_FILE, plan);
    logToFile(`Generated pair plan: nM=${nM} nF=${nF} males=${plan.males_matches.length} females=${plan.females_matches.length} cross=${plan.cross_matches.length}`);
    return res.json(plan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT: Generate groups and matches dynamically based on actual player counts
router.put('/generateMatchesAndGroups', (req, res) => {
  const { opensId, groupSize, maxMalesMatches, customPairPlan } = req.body;
  if (!opensId) return res.status(400).json({ error: 'opensId is required' });
  try {
    const store = loadStore();
    const opens = (store.opens || []).find(o => o.id === opensId);
    if (!opens) return res.status(404).json({ error: 'Opens not found' });

    // generateMatchesAndGroups only supports 2-team (A vs B) format.
    // N-team opens must use N-team plan generation and manual match entry.
    if ((opens.categories || []).length > 2) {
      return res.status(400).json({
        error: `generateMatchesAndGroups supports only 2-team opens (categories A and B). This opens has ${opens.categories.length} teams. Use the pair plan to generate matches for each team pairing separately.`
      });
    }

    const htCat = opens.categories.find(c => c.id === 'A') || { males: [], females: [] };
    const xyCat = opens.categories.find(c => c.id === 'B') || { males: [], females: [] };

    const GROUP_SIZE = (typeof groupSize === 'number' && groupSize >= 2) ? groupSize : 6;
    function splitGroups(arr) {
      const groups = [];
      for (let i = 0; i < arr.length; i += GROUP_SIZE) groups.push(arr.slice(i, i + GROUP_SIZE));
      return groups;
    }

    const htMG = splitGroups(htCat.males || []);
    const xyMG = splitGroups(xyCat.males || []);
    const htFG = splitGroups(htCat.females || []);
    const xyFG = splitGroups(xyCat.females || []);

    const warnings = [];
    const htMCount = (htCat.males || []).length;
    const xyMCount = (xyCat.males || []).length;
    const htFCount = (htCat.females || []).length;
    const xyFCount = (xyCat.females || []).length;
    if (htMCount % GROUP_SIZE !== 0 || xyMCount % GROUP_SIZE !== 0 || htMCount !== xyMCount) {
      warnings.push(`男子人数无法按每组${GROUP_SIZE}人均匀分组（灰太狼:${htMCount}，喜羊羊:${xyMCount}）`);
    }
    if (htFCount % GROUP_SIZE !== 0 || xyFCount % GROUP_SIZE !== 0 || htFCount !== xyFCount) {
      warnings.push(`女子人数无法按每组${GROUP_SIZE}人均匀分组（灰太狼:${htFCount}，喜羊羊:${xyFCount}）`);
    }

    // Resolve a code like A1, B2, AF2, BM3, AF1G1 to a player name
    function resolve(code, htM, xyM, htF, xyF, options = {}) {
      const m = code.match(/^([AB])(F|M|)(\d+)(?:G(\d+))?$/);
      if (!m) return code;
      const [, side, type, n, g] = m;
      const idx = parseInt(n) - 1;
      const groupIdx = g ? (parseInt(g, 10) - 1) : null;

      const pickFemale = (localArr, allGroups, globalStart) => {
        if (Number.isInteger(groupIdx) && Array.isArray(allGroups) && allGroups[groupIdx]) {
          return ((allGroups[groupIdx] || [])[idx] || {}).name || code;
        }
        if (typeof globalStart === 'number' && idx >= globalStart) {
          const localIdx = idx - globalStart;
          return (localArr[localIdx] || {}).name || code;
        }
        return (localArr[idx] || {}).name || code;
      };

      if (side === 'A') {
        if (type === 'F') {
          return pickFemale(htF, options.htFAllGroups, options.htFGlobalStartIndex || null);
        }
        if (type === 'M') return (htM[idx] || {}).name || code;
        return ((htM[idx] || htF[idx]) || {}).name || code;
      }
      if (type === 'F') {
        return pickFemale(xyF, options.xyFAllGroups, options.xyFGlobalStartIndex || null);
      }
      if (type === 'M') return (xyM[idx] || {}).name || code;
      return ((xyM[idx] || xyF[idx]) || {}).name || code;
    }

    function buildMatches(rules, htM, xyM, htF, xyF, type, group, resolveOptions = {}) {
      const safeRules = Array.isArray(rules)
        ? rules.filter(r => Array.isArray(r.team1) && Array.isArray(r.team2))
        : [];
      return safeRules.map(rule => ({
        type, group,
        team1: rule.team1.map(c => resolve(c, htM, xyM, htF, xyF, resolveOptions)),
        team2: rule.team2.map(c => resolve(c, htM, xyM, htF, xyF, resolveOptions)),
        completed: false, score1: null, score2: null
      }));
    }

    const matches = [];

    // Males: generate plan dynamically from actual group size
    const numMG = Math.min(htMG.length, xyMG.length);
    const maxMalesPerGroup = (typeof maxMalesMatches === 'number' && maxMalesMatches >= 0)
      ? maxMalesMatches
      : DEFAULT_MAX_MALES_MATCHES;
    for (let g = 0; g < numMG; g++) {
      const n = Math.min(htMG[g].length, xyMG[g].length);
      const customMales = customPairPlan && Array.isArray(customPairPlan.males_matches)
        ? customPairPlan.males_matches
        : null;
      const plan = customMales || generateMalesPlan(n, { maxMatches: maxMalesPerGroup });
      matches.push(...buildMatches(plan, htMG[g], xyMG[g], [], [], 'males', g + 1));
    }

    // Females: generate reduced plan dynamically from actual group size
    const numFG = Math.min(htFG.length, xyFG.length);
    for (let g = 0; g < numFG; g++) {
      const n = Math.min(htFG[g].length, xyFG[g].length);
      const customFemales = customPairPlan && Array.isArray(customPairPlan.females_matches)
        ? customPairPlan.females_matches
        : null;
      const plan = customFemales || generateFemalesPlanReduced(n);
      matches.push(...buildMatches(plan, [], [], htFG[g], xyFG[g], 'females', g + 1));
    }

    // Cross: pair each males group with an even split of the first females group.
    // For 2 male groups + 1 female group, this becomes first half vs second half.
    const htF0 = htFG[0] || [];
    const xyF0 = xyFG[0] || [];
    const numCrossGroups = Math.min(htMG.length, xyMG.length);
    const pairedFemaleCount = Math.min(htF0.length, xyF0.length);
    const htFCrossPool = htF0.slice(0, pairedFemaleCount);
    const xyFCrossPool = xyF0.slice(0, pairedFemaleCount);
    const maleGroupSizes = [];
    for (let g = 0; g < numCrossGroups; g++) {
      maleGroupSizes.push(Math.min(htMG[g].length, xyMG[g].length));
    }
    const femalesPerGroup = allocateFemalesForCross(pairedFemaleCount, maleGroupSizes);
    const crossSplit = {
      pairedFemaleCount,
      maleGroupSizes,
      femaleAllocationByCrossGroup: femalesPerGroup
    };

    if (customPairPlan) {
      const maleReq = extractPlanRequirements(customPairPlan.males_matches);
      const femaleReq = extractPlanRequirements(customPairPlan.females_matches);

      for (let g = 0; g < numMG; g++) {
        const actualMaleSize = Math.min(htMG[g].length, xyMG[g].length);
        if (maleReq.neutralMax > actualMaleSize) {
          return res.status(400).json({
            error: `所选男子配对方案需要至少${maleReq.neutralMax}名选手，但第${g + 1}个男子组只有${actualMaleSize}名选手`
          });
        }
      }

      for (let g = 0; g < numFG; g++) {
        const actualFemaleSize = Math.min(htFG[g].length, xyFG[g].length);
        if (femaleReq.neutralMax > actualFemaleSize) {
          return res.status(400).json({
            error: `所选女子配对方案需要至少${femaleReq.neutralMax}名选手，但第${g + 1}个女子组只有${actualFemaleSize}名选手`
          });
        }
      }

      for (let g = 0; g < numCrossGroups; g++) {
        const crossRules = Array.isArray(customPairPlan[`cross_matches_group${g + 1}`])
          ? customPairPlan[`cross_matches_group${g + 1}`]
          : customPairPlan.cross_matches;
        const crossReq = extractPlanRequirements(crossRules);
        const actualMaleSize = maleGroupSizes[g] || 0;
        const actualLocalFemaleSize = femalesPerGroup[g] || 0;

        if (crossReq.maleMax > actualMaleSize) {
          return res.status(400).json({
            error: `所选混合配对方案需要至少${crossReq.maleMax}名男子选手，但第${g + 1}个混合组只有${actualMaleSize}名男子选手`
          });
        }

        if (crossReq.femaleMax > actualLocalFemaleSize) {
          return res.status(400).json({
            error: `所选混合配对方案需要至少${crossReq.femaleMax}名本地女子选手，但第${g + 1}个混合组只分配到${actualLocalFemaleSize}名女子选手`
          });
        }

        for (const [groupKey, maxIdx] of Object.entries(crossReq.femaleMaxByGroup)) {
          const originalGroupIndex = parseInt(groupKey, 10) - 1;
          const actualOriginalFemaleSize = Math.min(
            (htFG[originalGroupIndex] || []).length,
            (xyFG[originalGroupIndex] || []).length
          );
          if (maxIdx > actualOriginalFemaleSize) {
            return res.status(400).json({
              error: `所选混合配对方案引用了原始女子组G${groupKey}的第${maxIdx}名选手，但该组只有${actualOriginalFemaleSize}名女子选手`
            });
          }
        }
      }
    }

    let femaleCursor = 0;
    for (let g = 0; g < numCrossGroups; g++) {
      const thisGroupFemaleCount = femalesPerGroup[g] || 0;
      const htFslice = htFCrossPool.slice(femaleCursor, femaleCursor + thisGroupFemaleCount);
      const xyFslice = xyFCrossPool.slice(femaleCursor, femaleCursor + thisGroupFemaleCount);
      const currentFemaleStart = femaleCursor; // 0-based index in original first female group
      femaleCursor += thisGroupFemaleCount;

      const nM = Math.min(htMG[g].length, xyMG[g].length);
      const nF = Math.min(htFslice.length, xyFslice.length);
      if (nM < 1 || nF < 1) continue;

      const customCrossByGroup = customPairPlan && Array.isArray(customPairPlan[`cross_matches_group${g + 1}`])
        ? customPairPlan[`cross_matches_group${g + 1}`]
        : null;
      const customCrossShared = customPairPlan && Array.isArray(customPairPlan.cross_matches)
        ? customPairPlan.cross_matches
        : null;
      const plan = customCrossByGroup || customCrossShared || generateCrossPlan(nM, nF);
      matches.push(...buildMatches(
        plan,
        htMG[g],
        xyMG[g],
        htFslice,
        xyFslice,
        'cross',
        g + 1,
        {
          htFAllGroups: htFG,
          xyFAllGroups: xyFG,
          htFGlobalStartIndex: currentFemaleStart,
          xyFGlobalStartIndex: currentFemaleStart
        }
      ));
    }

    opens.groups = {
      males:   htMG.map((htG, i) => ({ ht: htG, xy: xyMG[i] || [] })),
      females: htFG.map((htG, i) => ({ ht: htG, xy: xyFG[i] || [] }))
    };
    opens.matches = matches;
    saveStore(store);
    logToFile(`Generated groups and ${matches.length} matches for ${opensId}`);
    res.json({
      ...opens,
      warning: warnings.length ? warnings.join('；') : null,
      crossSplit
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT: Record a score for a specific match (targeted update — avoids concurrent overwrites)
router.put('/:id/score', (req, res) => {
  const opensId = req.params.id;
  const { matchIndex, score1, score2 } = req.body;
  if (matchIndex == null || score1 == null || score2 == null)
    return res.status(400).json({ error: 'matchIndex, score1, score2 required' });
  const mIdx = parseInt(matchIndex);
  if (isNaN(mIdx) || mIdx < 0) return res.status(400).json({ error: 'Invalid matchIndex' });
  if (typeof score1 !== 'number' || typeof score2 !== 'number')
    return res.status(400).json({ error: 'score1 and score2 must be numbers' });
  if (score1 < 0 || score2 < 0) return res.status(400).json({ error: 'Scores must be non-negative' });
  const store = loadStore();
  const opens = (store.opens || []).find(o => o.id === opensId);
  if (!opens) return res.status(404).json({ error: 'Opens not found' });
  if (!opens.matches || !opens.matches[mIdx]) return res.status(400).json({ error: 'Match not found' });
  opens.matches[mIdx].score1 = score1;
  opens.matches[mIdx].score2 = score2;
  opens.matches[mIdx].completed = true;
  saveStore(store);
  logToFile(`Opens ${opensId} match ${mIdx} score recorded: ${score1}:${score2}`);
  res.json(opens);
});

// PUT: Update an existing opens (full object replacement — used for bulk edits)
router.put('/:id', (req, res) => {
  const opensId = req.params.id;
  const payload = req.body;
  if (!payload || Object.keys(payload).length === 0)
    return res.status(400).json({ error: 'Empty payload' });
  const store = loadStore();
  const idx = (store.opens || []).findIndex(o => o.id === opensId);
  if (idx === -1) return res.status(404).json({ error: 'Opens not found' });
  store.opens[idx] = { ...store.opens[idx], ...payload };
  saveStore(store);
  logToFile(`Opens ${opensId} updated`);
  res.json(store.opens[idx]);
});

// DELETE: Delete an opens
router.delete('/:id', (req, res) => {
  const store = loadStore();
  if (!store.opens) {
    store.opens = [];
  }

  const opensIndex = store.opens.findIndex(o => o.id === req.params.id);
  if (opensIndex > -1) {
    const deletedOpens = store.opens[opensIndex];
    store.opens.splice(opensIndex, 1);
    logToFile(`Request to delete opens: ${req.params.id}`);
    saveStore(store);
    res.json({ message: 'Opens deleted successfully', opens: deletedOpens });
  } else {
    res.status(404).json({ error: 'Opens not found' });
  }
});

// PUT: Add a player manually to a category/gender
router.put('/player/add', (req, res) => {
  const { opensId, categoryId, gender, name } = req.body;
  if (!opensId || !categoryId || !gender || !name)
    return res.status(400).json({ error: 'opensId, categoryId, gender, name required' });
  const store = loadStore();
  const opens = (store.opens || []).find(o => o.id === opensId);
  if (!opens) return res.status(404).json({ error: 'Opens not found' });
  const cat = opens.categories.find(c => c.id === categoryId);
  if (!cat) return res.status(404).json({ error: 'Category not found' });
  if (!Array.isArray(cat[gender])) return res.status(400).json({ error: 'Invalid gender' });
  cat[gender].push({ id: `opens-${Date.now()}`, name });
  saveStore(store);
  logToFile(`Added player ${name} to ${opensId} ${categoryId} ${gender}`);
  res.json(opens);
});

// PUT: Move a player to a new position
router.put('/player/rank', (req, res) => {
  const { opensId, categoryId, gender, playerId, position } = req.body;
  if (!opensId || !categoryId || !gender || !playerId || position == null)
    return res.status(400).json({ error: 'opensId, categoryId, gender, playerId, position required' });
  const store = loadStore();
  const opens = (store.opens || []).find(o => o.id === opensId);
  if (!opens) return res.status(404).json({ error: 'Opens not found' });
  const cat = opens.categories.find(c => c.id === categoryId);
  if (!cat) return res.status(404).json({ error: 'Category not found' });
  const arr = cat[gender];
  if (!Array.isArray(arr)) return res.status(400).json({ error: 'Invalid gender' });
  const idx = arr.findIndex(p => p.id === playerId);
  if (idx === -1) return res.status(404).json({ error: 'Player not found' });
  const [player] = arr.splice(idx, 1);
  arr.splice(Math.max(0, Math.min(position - 1, arr.length)), 0, player);
  saveStore(store);
  logToFile(`Moved player ${playerId} to position ${position} in ${opensId} ${categoryId} ${gender}`);
  res.json(opens);
});

// PUT: Delete a player from a category/gender
router.put('/player/delete', (req, res) => {
  const { opensId, categoryId, gender, playerId } = req.body;
  if (!opensId || !categoryId || !gender || !playerId)
    return res.status(400).json({ error: 'opensId, categoryId, gender, playerId required' });
  const store = loadStore();
  const opens = (store.opens || []).find(o => o.id === opensId);
  if (!opens) return res.status(404).json({ error: 'Opens not found' });
  const cat = opens.categories.find(c => c.id === categoryId);
  if (!cat) return res.status(404).json({ error: 'Category not found' });
  if (!Array.isArray(cat[gender])) return res.status(400).json({ error: 'Invalid gender' });
  const before = cat[gender].length;
  cat[gender] = cat[gender].filter(p => p.id !== playerId);
  if (cat[gender].length === before) return res.status(404).json({ error: 'Player not found' });
  saveStore(store);
  logToFile(`Deleted player ${playerId} from ${opensId} ${categoryId} ${gender}`);
  res.json(opens);
});

// PUT: Add a registration entry (non-ladder players only)
router.put('/registration/add', (req, res) => {
  const { opensId, name, gender, fromLadder } = req.body;
  if (!opensId || !name || !gender)
    return res.status(400).json({ error: 'opensId, name, gender required' });
  if (!['males', 'females'].includes(gender))
    return res.status(400).json({ error: 'gender must be males or females' });
  if (fromLadder)
    return res.status(400).json({ error: 'Ladder players do not need to register' });
  const store = loadStore();
  const opens = (store.opens || []).find(o => o.id === opensId);
  if (!opens) return res.status(404).json({ error: 'Opens not found' });
  if (!Array.isArray(opens.registration)) opens.registration = [];
  const entry = {
    id: `reg-${Date.now()}`,
    name: name.trim(),
    gender,
    fromLadder: false
  };
  opens.registration.push(entry);
  saveStore(store);
  logToFile(`Registration added: ${entry.name} (${gender}) to ${opensId}`);
  res.json(opens);
});

// PUT: Delete a registration entry
router.put('/registration/delete', (req, res) => {
  const { opensId, entryId } = req.body;
  if (!opensId || !entryId)
    return res.status(400).json({ error: 'opensId and entryId required' });
  const store = loadStore();
  const opens = (store.opens || []).find(o => o.id === opensId);
  if (!opens) return res.status(404).json({ error: 'Opens not found' });
  if (!Array.isArray(opens.registration))
    return res.status(404).json({ error: 'No registrations found' });
  const before = opens.registration.length;
  opens.registration = opens.registration.filter(e => e.id !== entryId);
  if (opens.registration.length === before)
    return res.status(404).json({ error: 'Registration entry not found' });
  saveStore(store);
  logToFile(`Registration deleted: ${entryId} from ${opensId}`);
  res.json(opens);
});

function importPlayersFromLadder(opensId, numTeams = 2) {
    const ladderData = safeReadJson(LADDER_FILE, { players: [] });
    const store = loadStore();

    const opens = (store.opens || []).find(o => o.id === opensId);
    if (!opens) throw new Error(`Opens with id ${opensId} not found`);

    const TEAM_IDS = ['A', 'B', 'C', 'D', 'E', 'F'].slice(0, numTeams);
    const rank = p => (typeof p.avgRankInCat === 'number' ? p.avgRankInCat : Infinity);
    const toEntry = p => ({ id: p.id, name: p.name });

    // Step 1: Sort active ladder players by avgRankInCat
    const huitailangSorted = ladderData.players
        .filter(p => p.active && p.category === 'huitailang')
        .sort((a, b) => rank(a) - rank(b));

    const xiyangySorted = ladderData.players
        .filter(p => p.active && p.category === 'xiyangyang')
        .sort((a, b) => rank(a) - rank(b));

    // Step 2: Round-robin distribute huitailang players into teams (males)
    //   player i → teamMales[i % numTeams]  (team A gets i=0,N,2N,…; team B gets i=1,N+1,…)
    const teamMales = TEAM_IDS.map(() => []);
    huitailangSorted.forEach((p, i) => teamMales[i % numTeams].push(toEntry(p)));

    // Step 3: Round-robin distribute xiyangyang players into teams (females)
    //   Offset by 1 so that team B gets the top-ranked female — preserves original 2-team balance convention
    const teamFemales = TEAM_IDS.map(() => []);
    xiyangySorted.forEach((p, i) => teamFemales[(i + 1) % numTeams].push(toEntry(p)));

    // Step 4: Distribute non-ladder registrations to the team with the fewest players
    const nonLadderMales = (opens.registration || [])
        .filter(r => r.gender === 'males')
        .map(r => ({ id: r.id, name: r.name }));
    const nonLadderFemales = (opens.registration || [])
        .filter(r => r.gender === 'females')
        .map(r => ({ id: r.id, name: r.name }));

    for (const player of nonLadderMales) {
        const minIdx = teamMales.reduce((mi, arr, i, a) => arr.length < a[mi].length ? i : mi, 0);
        teamMales[minIdx].push(player);
    }
    for (const player of nonLadderFemales) {
        const minIdx = teamFemales.reduce((mi, arr, i, a) => arr.length < a[mi].length ? i : mi, 0);
        teamFemales[minIdx].push(player);
    }

    // Step 5: Rebuild opens.categories with the N teams (replaces previous categories entirely)
    opens.categories = TEAM_IDS.map((id, i) => ({
        id,
        males: teamMales[i],
        females: teamFemales[i]
    }));

    saveStore(store);

    // Return teams as an array so callers can enumerate without knowing numTeams in advance
    return {
        numTeams,
        teams: TEAM_IDS.map((id, i) => ({ id, males: teamMales[i], females: teamFemales[i] }))
    };
}

module.exports = router;
