const { DATA_FILE, safeReadJson, safeWriteJson } = require('./fileUtils');
const CATEGORIES = {
  male: '男双',
  female: '女双',
  fun: '娱乐'
};
// remove all matches of current round in given category
function removeMatchesOnly(category) {
  const data = safeReadJson(DATA_FILE, { players: [], groups: [], matches: [] });
  data.matches = data.matches.filter(m => m.round !== data.currentRound || m.category !== category);
  safeWriteJson(DATA_FILE, data);
}

module.exports = {
  CATEGORIES,
  removeMatchesOnly
};

