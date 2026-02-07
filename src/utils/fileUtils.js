const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'badminton_ladder_friday.json');
const ADMIN_CONFIG_FILE = path.join(__dirname, '..', 'data', 'admin_config.json');

// Safe read helpers (create default if missing)
function safeReadJson(filePath, defaultValue) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
      return defaultValue;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw || JSON.stringify(defaultValue));
  } catch (err) {
    return defaultValue;
  }
}

function safeWriteJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

module.exports = {
  DATA_FILE,
  ADMIN_CONFIG_FILE,
  safeReadJson,
  safeWriteJson
};
