const os  = require('os');
const fs  = require('fs');
const path = require('path');
const { safeReadJson, safeWriteJson, logToFile, LOG_FILE } = require('../src/utils/fileUtils');

// ─── safeReadJson ─────────────────────────────────────────────────────────────
describe('safeReadJson', () => {
  let tmpFile;

  beforeEach(() => {
    tmpFile = path.join(os.tmpdir(), `bmt-test-${Date.now()}.json`);
  });

  afterEach(() => {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  });

  test('returns default value when file does not exist', () => {
    const result = safeReadJson(tmpFile, { default: true });
    expect(result).toEqual({ default: true });
  });

  test('creates file with default value when file does not exist', () => {
    safeReadJson(tmpFile, { created: true });
    expect(fs.existsSync(tmpFile)).toBe(true);
    expect(JSON.parse(fs.readFileSync(tmpFile, 'utf8'))).toEqual({ created: true });
  });

  test('reads and parses an existing valid JSON file', () => {
    fs.writeFileSync(tmpFile, JSON.stringify({ hello: 'world' }));
    expect(safeReadJson(tmpFile, {})).toEqual({ hello: 'world' });
  });

  test('returns default value when the file contains malformed JSON', () => {
    fs.writeFileSync(tmpFile, 'not-valid-json{{{');
    expect(safeReadJson(tmpFile, { fallback: true })).toEqual({ fallback: true });
  });

  test('returns default value when the file is empty', () => {
    fs.writeFileSync(tmpFile, '');
    expect(safeReadJson(tmpFile, { empty: true })).toEqual({ empty: true });
  });
});

// ─── safeWriteJson ────────────────────────────────────────────────────────────
describe('safeWriteJson', () => {
  let tmpFile;

  beforeEach(() => {
    tmpFile = path.join(os.tmpdir(), `bmt-test-${Date.now()}.json`);
  });

  afterEach(() => {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  });

  test('writes JSON-serialised data to the file', () => {
    safeWriteJson(tmpFile, { key: 'value' });
    expect(JSON.parse(fs.readFileSync(tmpFile, 'utf8'))).toEqual({ key: 'value' });
  });

  test('overwrites an existing file', () => {
    safeWriteJson(tmpFile, { first: true });
    safeWriteJson(tmpFile, { second: true });
    expect(JSON.parse(fs.readFileSync(tmpFile, 'utf8'))).toEqual({ second: true });
  });

  test('round-trips nested objects correctly', () => {
    const data = { players: [{ id: 'p1', name: 'Test' }], currentRound: 3 };
    safeWriteJson(tmpFile, data);
    expect(JSON.parse(fs.readFileSync(tmpFile, 'utf8'))).toEqual(data);
  });

  test('writes opens_pair_plan.json in middle-ground format', () => {
    const planFile = path.join(os.tmpdir(), 'opens_pair_plan.json');
    const data = {
      males_matches: [
        { team1: ['A1', 'A2'], team2: ['B1', 'B2'] }
      ],
      females_matches: [],
      cross_matches: []
    };

    try {
      safeWriteJson(planFile, data);
      const raw = fs.readFileSync(planFile, 'utf8');
      expect(raw).toContain('{ "team1": ["A1","A2"], "team2": ["B1","B2"] }');
      expect(JSON.parse(raw)).toEqual(data);
    } finally {
      if (fs.existsSync(planFile)) fs.unlinkSync(planFile);
    }
  });
});

// ─── logToFile ────────────────────────────────────────────────────────────────
describe('logToFile', () => {
  test('does not throw for a normal message', () => {
    expect(() => logToFile('jest-test-message')).not.toThrow();
  });

  test('appends a timestamped entry to the log file', () => {
    const before = fs.existsSync(LOG_FILE) ? fs.statSync(LOG_FILE).size : 0;
    logToFile('jest-test-unique-entry');
    expect(fs.existsSync(LOG_FILE)).toBe(true);
    expect(fs.statSync(LOG_FILE).size).toBeGreaterThan(before);
  });
});
