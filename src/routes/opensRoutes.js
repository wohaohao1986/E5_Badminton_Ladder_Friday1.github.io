const express = require('express');
const path = require('path');
const { safeReadJson, safeWriteJson, logToFile } = require('../utils/fileUtils');
const router = express.Router();

const OPENS_FILE = path.join(__dirname, '../data/e5_opens.json');

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
    importPlayersFromLadder();
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

function importPlayersFromLadder() {
    // This is a temporary function, real imlementation will come in the future
    
}

module.exports = router;
