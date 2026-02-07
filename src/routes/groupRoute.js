const express = require('express');
const { DATA_FILE, safeReadJson, safeWriteJson } = require('../utils/fileUtils');
const router = express.Router();

// POST: Add a new group or multiple groups
router.post('/', (req, res) => {
  const payload = req.body;
  if (!payload || (Array.isArray(payload) ? payload.length === 0 : Object.keys(payload).length === 0)) {
    return res.status(400).json({ error: 'Empty payload' });
  }

  const groupsStore = safeReadJson(DATA_FILE, { groups: [] });
  const groupsToAdd = Array.isArray(payload) ? payload : [payload];
  const duplicates = [];
  const added = [];
  
  groupsToAdd.forEach(group => {
    if (!group.id) {
      duplicates.push(`Group missing id`);
      return;
    }
    const exist = groupsStore.groups.find(g => g.id === group.id);
    if (!exist) {
      groupsStore.groups.push(group);
      added.push(group.id);
    } else {
      duplicates.push(group.id);
    }
  });

  if (added.length > 0) {
    safeWriteJson(DATA_FILE, groupsStore);
  }

  if (duplicates.length === 0) {
    res.status(201).json({ message: `${added.length} group(s) added successfully`, addedIds: added });
  } else {
    res.status(207).json({ 
      message: `${added.length} group(s) added, ${duplicates.length} duplicate(s) found`,
      addedIds: added,
      duplicates: duplicates 
    });
  }
});

// DELETE: Remove a group or multiple groups
router.delete('/', (req, res) => {
  const payload = req.body;
  if (!payload || (Array.isArray(payload) ? payload.length === 0 : !payload.id)) {
    return res.status(400).json({ error: 'Empty or invalid payload' });
  }

  const groupsStore = safeReadJson(DATA_FILE, { groups: [] });
  const idsToDelete = Array.isArray(payload) ? payload.map(g => g.id) : [payload.id];
  const notFound = [];
  const deleted = [];

  idsToDelete.forEach(id => {
    const existIndex = groupsStore.groups.findIndex(g => g.id === id);
    if (existIndex !== -1) {
      groupsStore.groups.splice(existIndex, 1);
      deleted.push(id);
    } else {
      notFound.push(id);
    }
  });

  if (deleted.length > 0) {
    safeWriteJson(DATA_FILE, groupsStore);
  }

  if (notFound.length === 0) {
    res.json({ message: `${deleted.length} group(s) deleted successfully`, deletedIds: deleted });
  } else {
    res.status(207).json({ 
      message: `${deleted.length} group(s) deleted, ${notFound.length} not found`,
      deletedIds: deleted,
      notFound: notFound 
    });
  }
});

module.exports = router;