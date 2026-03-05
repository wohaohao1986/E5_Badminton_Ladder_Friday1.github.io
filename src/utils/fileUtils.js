const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'badminton_ladder_friday.json');
const ADMIN_CONFIG_FILE = path.join(__dirname, '..', 'data', 'admin_config.json');
const LOG_FILE = path.join(__dirname, '..', 'data', 'application.log');

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

// Logging utility - appends to log file
function logToFile(message) {
  try {
    const timestamp = new Date().toLocaleString('en-US', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    const logEntry = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(LOG_FILE, logEntry, 'utf8');
  } catch (err) {
    console.error('Failed to write to log file:', err.message);
  }
}

module.exports = {
  DATA_FILE,
  ADMIN_CONFIG_FILE,
  LOG_FILE,
  safeReadJson,
  safeWriteJson,
  logToFile
};
