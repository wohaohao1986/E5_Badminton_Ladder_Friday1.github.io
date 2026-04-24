const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'badminton_ladder_friday.json');
const ADMIN_CONFIG_FILE = path.join(__dirname, '..', 'data', 'admin_config.json');
const LOG_FILE = path.join(__dirname, '..', 'data', 'application.log');

function formatMatchArrayMiddleGround(matches, baseIndent = '') {
  if (!Array.isArray(matches) || matches.length === 0) return '[]';
  const lines = matches.map((m, idx) => {
    const comma = idx < matches.length - 1 ? ',' : '';
    const t1 = JSON.stringify((m && m.team1) || []);
    const t2 = JSON.stringify((m && m.team2) || []);
    return `${baseIndent}  { "team1": ${t1}, "team2": ${t2} }${comma}`;
  });
  return `[
${lines.join('\n')}
${baseIndent}]`;
}

function formatPairPlanMiddleGroundJson(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return JSON.stringify(data, null, 2);
  }

  const formatPlanObject = (plan, indent = '') => {
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

    const out = [];
    out.push(`${indent}{`);
    ordered.forEach((k, idx) => {
      const value = plan[k];
      const comma = idx < ordered.length - 1 ? ',' : '';
      if (Array.isArray(value) && (value.length === 0 || (value[0] && Array.isArray(value[0].team1)))) {
        out.push(`${indent}  "${k}": ${formatMatchArrayMiddleGround(value, `${indent}  `)}${comma}`);
      } else {
        out.push(`${indent}  "${k}": ${JSON.stringify(value)}${comma}`);
      }
    });
    out.push(`${indent}}`);
    return out.join('\n');
  };

  if (Array.isArray(data.plans)) {
    const lines = ['{', '  "plans": ['];
    data.plans.forEach((plan, idx) => {
      const comma = idx < data.plans.length - 1 ? ',' : '';
      lines.push(`${formatPlanObject(plan, '    ')}${comma}`);
    });
    lines.push('  ]');
    lines.push('}');
    return lines.join('\n');
  }

  return formatPlanObject(data);
}

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
    logToFile(`Failed to read/parse JSON from ${filePath}: ${err.message}`);
    return defaultValue;
  }
}

function safeWriteJson(filePath, data) {
  try {
    if (path.basename(filePath) === 'opens_pair_plan.json') {
      fs.writeFileSync(filePath, formatPairPlanMiddleGroundJson(data));
      return;
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    logToFile(`Failed to write JSON to ${filePath}: ${err.message}`);
    throw err;
  }
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
