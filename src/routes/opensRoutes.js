const express = require('express');
const path = require('path');
const { safeReadJson, safeWriteJson, logToFile } = require('../utils/fileUtils');
const router = express.Router();

const OPENS_FILE = path.join(__dirname, '../data/e5_opens.json');
const LADDER_FILE = path.join(__dirname, '../data/badminton_ladder_friday.json');
const PAIR_PLAN_FILE = path.join(__dirname, '../data/opens_pair_plan.json');

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
    categories: [
      { id: 'huitailang',
        males: [],
        females: []
       },
      { id: 'xiyangyang',
        males: [],
        females: []
      }
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
    const { opensId } = req.body;
    if (!opensId) return res.status(400).json({ error: 'opensId is required' });
    logToFile(`Request to import players from ladder into opens: ${opensId}`);
    try {
        const result = importPlayersFromLadder(opensId);
        res.json({ message: 'Players imported successfully', ...result });
    } catch (error) {
        res.status(error.message.includes('not found') ? 404 : 500).json({ error: error.message });
    }
});

// PUT: Generate groups and matches from pair plan
router.put('/generateMatchesAndGroups', (req, res) => {
  const { opensId } = req.body;
  if (!opensId) return res.status(400).json({ error: 'opensId is required' });
  try {
    const store = loadStore();
    const opens = (store.opens || []).find(o => o.id === opensId);
    if (!opens) return res.status(404).json({ error: 'Opens not found' });

    const pairPlan = safeReadJson(PAIR_PLAN_FILE, {});
    const htCat = opens.categories.find(c => c.id === 'huitailang') || { males: [], females: [] };
    const xyCat = opens.categories.find(c => c.id === 'xiyangyang') || { males: [], females: [] };

    const GROUP_SIZE = 6;
    function splitGroups(arr) {
      const groups = [];
      for (let i = 0; i < arr.length; i += GROUP_SIZE) groups.push(arr.slice(i, i + GROUP_SIZE));
      return groups;
    }

    const htMG = splitGroups(htCat.males || []);
    const xyMG = splitGroups(xyCat.males || []);
    const htFG = splitGroups(htCat.females || []);
    const xyFG = splitGroups(xyCat.females || []);

    // Resolve a code like A1, B2, AF2, BM3 to a player name
    function resolve(code, htM, xyM, htF, xyF) {
      const m = code.match(/^([AB])(F|M|)(\d+)$/);
      if (!m) return code;
      const [, side, type, n] = m;
      const idx = parseInt(n) - 1;
      if (side === 'A') return ((type === 'F' ? htF[idx] : htM[idx]) || {}).name || code;
      else              return ((type === 'F' ? xyF[idx] : xyM[idx]) || {}).name || code;
    }

    function buildMatches(rules, htM, xyM, htF, xyF, type, group) {
      return rules.map(rule => ({
        type, group,
        team1: rule.team1.map(c => resolve(c, htM, xyM, htF, xyF)),
        team2: rule.team2.map(c => resolve(c, htM, xyM, htF, xyF)),
        completed: false, score1: null, score2: null
      }));
    }

    const matches = [];

    // Males: each group pair — A/B codes map to htM/xyM
    const numMG = Math.min(htMG.length, xyMG.length);
    for (let g = 0; g < numMG; g++)
      matches.push(...buildMatches(pairPlan.males_matches || [], htMG[g], xyMG[g], [], [], 'males', g + 1));

    // Females: codes use AF/BF notation — pass female players as htF/xyF
    const numFG = Math.min(htFG.length, xyFG.length);
    for (let g = 0; g < numFG; g++)
      matches.push(...buildMatches(pairPlan.females_matches || [], [], [], htFG[g], xyFG[g], 'females', g + 1));

    // Cross: male group 1 + first 3 females, male group 2 + last 3 females
    const htF0 = htFG[0] || [], xyF0 = xyFG[0] || [];
    if (htMG[0] && xyMG[0])
      matches.push(...buildMatches(pairPlan.cross_matches || [], htMG[0], xyMG[0], htF0.slice(0, 3), xyF0.slice(0, 3), 'cross', 1));
    if (htMG[1] && xyMG[1])
      matches.push(...buildMatches(pairPlan.cross_matches || [], htMG[1], xyMG[1], htF0.slice(3, 6), xyF0.slice(3, 6), 'cross', 2));

    opens.groups = {
      males:   htMG.map((htG, i) => ({ ht: htG, xy: xyMG[i] || [] })),
      females: htFG.map((htG, i) => ({ ht: htG, xy: xyFG[i] || [] }))
    };
    opens.matches = matches;
    saveStore(store);
    logToFile(`Generated groups and ${matches.length} matches for ${opensId}`);
    res.json(opens);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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

function importPlayersFromLadder(opensId) {
    const ladderData = safeReadJson(LADDER_FILE, { players: [] });
    const store = loadStore();

    const opens = (store.opens || []).find(o => o.id === opensId);
    if (!opens) throw new Error(`Opens with id ${opensId} not found`);

    // Step 1: All active players, sorted by avgRankInCat (non-numeric treated as Infinity)
    const activePlayers = ladderData.players.filter(p => p.active);
    const rank = p => (typeof p.avgRankInCat === 'number' ? p.avgRankInCat : Infinity);
    const toEntry = p => ({ id: p.id, name: p.name });

    const huitailangSorted = activePlayers
        .filter(p => p.category === 'huitailang')
        .sort((a, b) => rank(a) - rank(b));

    const xiyangySorted = activePlayers
        .filter(p => p.category === 'xiyangyang')
        .sort((a, b) => rank(a) - rank(b));

    // Step 2: From huitailang sorted players —
    //   even indexes (0,2,4…) → this opens' huitailang.males
    //   odd  indexes (1,3,5…) → this opens' xiyangyang.males
    const htMales = huitailangSorted.filter((_, i) => i % 2 === 0).map(toEntry);
    const xyMales = huitailangSorted.filter((_, i) => i % 2 === 1).map(toEntry);

    // Step 3: From xiyangyang sorted players —
    //   odd  indexes (1,3,5…) → this opens' huitailang.females
    //   even indexes (0,2,4…) → this opens' xiyangyang.females
    const htFemales = xiyangySorted.filter((_, i) => i % 2 === 1).map(toEntry);
    const xyFemales = xiyangySorted.filter((_, i) => i % 2 === 0).map(toEntry);

    // Replace (not append) the player lists in the opens categories
    const htCat = opens.categories.find(c => c.id === 'huitailang');
    const xyCat = opens.categories.find(c => c.id === 'xiyangyang');
    if (htCat) { htCat.males = htMales; htCat.females = htFemales; }
    if (xyCat) { xyCat.males = xyMales; xyCat.females = xyFemales; }

    saveStore(store);
    return { htMales, xyMales, htFemales, xyFemales };
}

module.exports = router;
