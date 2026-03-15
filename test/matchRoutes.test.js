jest.mock('../src/utils/fileUtils', () => ({
  DATA_FILE: 'mock-data.json',
  safeReadJson: jest.fn(),
  safeWriteJson: jest.fn(),
}));

const request = require('supertest');
const express = require('express');
const { safeReadJson, safeWriteJson } = require('../src/utils/fileUtils');
const matchRouter = require('../src/routes/matchRoutes');

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/', matchRouter);
  return app;
};

const sampleMatch = (overrides = {}) => ({
  id: 'match-1',
  round: 1,
  groupId: 'huitailang-group-1',
  team1: ['p1', 'p2'],
  team2: ['p3', 'p4'],
  score1: null,
  score2: null,
  completed: false,
  timestamp: null,
  ...overrides,
});

let mockStore;

beforeEach(() => {
  jest.clearAllMocks();
  mockStore = { matches: [] };
  safeReadJson.mockImplementation(() => JSON.parse(JSON.stringify(mockStore)));
  safeWriteJson.mockImplementation((_, data) => { mockStore = data; });
});

// ─── POST / ───────────────────────────────────────────────────────────────────
describe('POST / — add match(es)', () => {
  test('adds a single match object and returns 201', async () => {
    const res = await request(buildApp()).post('/').send(sampleMatch());
    expect(res.status).toBe(201);
    expect(res.body.addedIds).toContain('match-1');
  });

  test('saves the match to the store', async () => {
    await request(buildApp()).post('/').send(sampleMatch());
    expect(mockStore.matches.some(m => m.id === 'match-1')).toBe(true);
  });

  test('adds an array of matches and returns 201', async () => {
    const matches = [sampleMatch({ id: 'match-1' }), sampleMatch({ id: 'match-2' })];
    const res = await request(buildApp()).post('/').send(matches);
    expect(res.status).toBe(201);
    expect(res.body.addedIds).toHaveLength(2);
  });

  test('returns 207 and lists duplicate(s) when a match id already exists', async () => {
    mockStore.matches = [sampleMatch()];
    const res = await request(buildApp()).post('/').send(sampleMatch());
    expect(res.status).toBe(207);
    expect(res.body.duplicates).toContain('match-1');
  });

  test('returns 207 with partial success when payload is a mixed array', async () => {
    mockStore.matches = [sampleMatch({ id: 'match-1' })];
    const res = await request(buildApp()).post('/').send([
      sampleMatch({ id: 'match-1' }),  // duplicate
      sampleMatch({ id: 'match-2' }),  // new
    ]);
    expect(res.status).toBe(207);
    expect(res.body.addedIds).toContain('match-2');
    expect(res.body.duplicates).toContain('match-1');
  });

  test('returns 400 for an empty object payload', async () => {
    const res = await request(buildApp()).post('/').send({});
    expect(res.status).toBe(400);
  });

  test('returns 400 for an empty array payload', async () => {
    const res = await request(buildApp()).post('/').send([]);
    expect(res.status).toBe(400);
  });

  test('records match as duplicate when id is missing', async () => {
    const res = await request(buildApp()).post('/').send([{ round: 1 }]);
    expect(res.status).toBe(207);
    expect(res.body.duplicates[0]).toContain('missing id');
  });
});

// ─── PUT / ────────────────────────────────────────────────────────────────────
describe('PUT / — update match', () => {
  beforeEach(() => {
    mockStore.matches = [sampleMatch()];
  });

  test('updates match fields and returns 200', async () => {
    const res = await request(buildApp()).put('/').send({ id: 'match-1', score1: 21, score2: 15, completed: true });
    expect(res.status).toBe(200);
    expect(res.body.entry.score1).toBe(21);
    expect(res.body.entry.score2).toBe(15);
    expect(res.body.entry.completed).toBe(true);
  });

  test('persists the update to the store', async () => {
    await request(buildApp()).put('/').send({ id: 'match-1', score1: 21, score2: 15, completed: true });
    expect(mockStore.matches[0].score1).toBe(21);
    expect(mockStore.matches[0].completed).toBe(true);
  });

  test('does not overwrite fields not included in the payload', async () => {
    await request(buildApp()).put('/').send({ id: 'match-1', score1: 21, score2: 15, completed: true });
    expect(mockStore.matches[0].team1).toEqual(['p1', 'p2']);
  });

  test('returns 404 when match id does not exist', async () => {
    const res = await request(buildApp()).put('/').send({ id: 'no-such-match' });
    expect(res.status).toBe(404);
  });
});
