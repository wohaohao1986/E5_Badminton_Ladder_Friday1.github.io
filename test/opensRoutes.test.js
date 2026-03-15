jest.mock('../src/utils/fileUtils', () => ({
  safeReadJson: jest.fn(),
  safeWriteJson: jest.fn(),
  logToFile: jest.fn(),
}));

const request = require('supertest');
const express = require('express');
const { safeReadJson, safeWriteJson } = require('../src/utils/fileUtils');
const opensRouter = require('../src/routes/opensRoutes');

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/', opensRouter);
  return app;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const sampleOpens = (overrides = {}) => ({
  id: 'TestOpens-2026-06-01',
  name: 'TestOpens',
  date: '2026-06-01',
  categories: [
    { id: 'huitailang', males: [], females: [] },
    { id: 'xiyangyang', males: [], females: [] },
  ],
  matches: [],
  ...overrides,
});

const samplePlayer = (id, name, category, avgRankInCat = '-', active = true) => ({
  id, name, category, active, avgRankInCat,
});

let mockOpensStore;
let mockLadderStore;
let mockPairPlan;

beforeEach(() => {
  jest.clearAllMocks();
  mockOpensStore  = { opens: [] };
  mockLadderStore = { players: [] };
  mockPairPlan    = {};

  safeReadJson.mockImplementation((file, defaultVal) => {
    if (file.includes('e5_opens'))         return JSON.parse(JSON.stringify(mockOpensStore));
    if (file.includes('badminton_ladder')) return JSON.parse(JSON.stringify(mockLadderStore));
    if (file.includes('opens_pair_plan'))  return JSON.parse(JSON.stringify(mockPairPlan));
    return defaultVal;
  });
  safeWriteJson.mockImplementation((file, data) => {
    if (file.includes('e5_opens')) mockOpensStore = JSON.parse(JSON.stringify(data));
  });
});

// ─── GET / ───────────────────────────────────────────────────────────────────
describe('GET / — list all opens', () => {
  test('returns empty array when no opens exist', async () => {
    const res = await request(buildApp()).get('/');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('returns all opens', async () => {
    mockOpensStore.opens = [sampleOpens(), sampleOpens({ id: 'Other-2026-07-01', name: 'Other', date: '2026-07-01' })];
    const res = await request(buildApp()).get('/');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });
});

// ─── GET /:id ─────────────────────────────────────────────────────────────────
describe('GET /:id — get a specific opens', () => {
  beforeEach(() => {
    mockOpensStore.opens = [sampleOpens()];
  });

  test('returns the opens when found', async () => {
    const res = await request(buildApp()).get('/TestOpens-2026-06-01');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('TestOpens-2026-06-01');
  });

  test('returns 404 when opens is not found', async () => {
    const res = await request(buildApp()).get('/no-such-id');
    expect(res.status).toBe(404);
  });
});

// ─── POST / ──────────────────────────────────────────────────────────────────
describe('POST / — add new opens', () => {
  test('returns 201 on success', async () => {
    const res = await request(buildApp()).post('/').send({ name: 'Summer', date: '2026-08-01' });
    expect(res.status).toBe(201);
    expect(res.body.message).toBeDefined();
  });

  test('derives id from name and date', async () => {
    await request(buildApp()).post('/').send({ name: 'Summer', date: '2026-08-01' });
    expect(mockOpensStore.opens[0].id).toBe('Summer-2026-08-01');
  });

  test('initialises huitailang and xiyangyang categories with empty player lists', async () => {
    await request(buildApp()).post('/').send({ name: 'Summer', date: '2026-08-01' });
    const o = mockOpensStore.opens[0];
    const ht = o.categories.find(c => c.id === 'huitailang');
    const xy = o.categories.find(c => c.id === 'xiyangyang');
    expect(ht.males).toEqual([]);
    expect(xy.females).toEqual([]);
  });

  test('returns 400 when name is missing', async () => {
    const res = await request(buildApp()).post('/').send({ date: '2026-08-01' });
    expect(res.status).toBe(400);
  });

  test('returns 400 when date is missing', async () => {
    const res = await request(buildApp()).post('/').send({ name: 'Summer' });
    expect(res.status).toBe(400);
  });

  test('returns 400 for empty payload', async () => {
    const res = await request(buildApp()).post('/').send({});
    expect(res.status).toBe(400);
  });

  test('returns 400 when opens with the same id already exists', async () => {
    mockOpensStore.opens = [sampleOpens({ id: 'Summer-2026-08-01', name: 'Summer', date: '2026-08-01' })];
    const res = await request(buildApp()).post('/').send({ name: 'Summer', date: '2026-08-01' });
    expect(res.status).toBe(400);
  });
});

// ─── PUT /:id ─────────────────────────────────────────────────────────────────
describe('PUT /:id — update opens', () => {
  beforeEach(() => {
    mockOpensStore.opens = [sampleOpens()];
  });

  test('merges payload into existing opens and returns the updated record', async () => {
    const res = await request(buildApp()).put('/TestOpens-2026-06-01').send({ matches: [{ id: 'm1' }] });
    expect(res.status).toBe(200);
    expect(res.body.matches).toHaveLength(1);
  });

  test('persists the update to the store', async () => {
    await request(buildApp()).put('/TestOpens-2026-06-01').send({ matches: [{ id: 'm1' }] });
    expect(mockOpensStore.opens[0].matches).toHaveLength(1);
  });

  test('does not overwrite fields not included in the payload', async () => {
    await request(buildApp()).put('/TestOpens-2026-06-01').send({ matches: [] });
    expect(mockOpensStore.opens[0].name).toBe('TestOpens');
  });

  test('returns 404 when opens is not found', async () => {
    const res = await request(buildApp()).put('/no-such-id').send({ matches: [] });
    expect(res.status).toBe(404);
  });

  test('returns 400 for empty payload', async () => {
    const res = await request(buildApp()).put('/TestOpens-2026-06-01').send({});
    expect(res.status).toBe(400);
  });
});

// ─── DELETE /:id ─────────────────────────────────────────────────────────────
describe('DELETE /:id — delete opens', () => {
  beforeEach(() => {
    mockOpensStore.opens = [sampleOpens()];
  });

  test('removes the opens and returns a confirmation with the deleted record', async () => {
    const res = await request(buildApp()).delete('/TestOpens-2026-06-01');
    expect(res.status).toBe(200);
    expect(res.body.opens.id).toBe('TestOpens-2026-06-01');
  });

  test('removes the record from the store', async () => {
    await request(buildApp()).delete('/TestOpens-2026-06-01');
    expect(mockOpensStore.opens).toHaveLength(0);
  });

  test('returns 404 when opens is not found', async () => {
    const res = await request(buildApp()).delete('/no-such-id');
    expect(res.status).toBe(404);
  });
});

// ─── PUT /player/add ─────────────────────────────────────────────────────────
describe('PUT /player/add — add a player to a category/gender', () => {
  beforeEach(() => {
    mockOpensStore.opens = [sampleOpens()];
  });

  test('adds the player to the correct category and gender list', async () => {
    const res = await request(buildApp()).put('/player/add').send({
      opensId: 'TestOpens-2026-06-01', categoryId: 'huitailang', gender: 'males', name: 'Alice',
    });
    expect(res.status).toBe(200);
    const htCat = res.body.categories.find(c => c.id === 'huitailang');
    expect(htCat.males.some(p => p.name === 'Alice')).toBe(true);
  });

  test('persists the new player to the store', async () => {
    await request(buildApp()).put('/player/add').send({
      opensId: 'TestOpens-2026-06-01', categoryId: 'xiyangyang', gender: 'females', name: 'Bob',
    });
    const xyCat = mockOpensStore.opens[0].categories.find(c => c.id === 'xiyangyang');
    expect(xyCat.females.some(p => p.name === 'Bob')).toBe(true);
  });

  test('returns 400 when required fields are missing', async () => {
    const res = await request(buildApp()).put('/player/add').send({ opensId: 'TestOpens-2026-06-01' });
    expect(res.status).toBe(400);
  });

  test('returns 404 when opens is not found', async () => {
    const res = await request(buildApp()).put('/player/add').send({
      opensId: 'no-such-id', categoryId: 'huitailang', gender: 'males', name: 'Alice',
    });
    expect(res.status).toBe(404);
  });

  test('returns 404 when category is not found', async () => {
    const res = await request(buildApp()).put('/player/add').send({
      opensId: 'TestOpens-2026-06-01', categoryId: 'invalid-cat', gender: 'males', name: 'Alice',
    });
    expect(res.status).toBe(404);
  });

  test('returns 400 for invalid gender', async () => {
    const res = await request(buildApp()).put('/player/add').send({
      opensId: 'TestOpens-2026-06-01', categoryId: 'huitailang', gender: 'robots', name: 'Alice',
    });
    expect(res.status).toBe(400);
  });
});

// ─── PUT /player/rank ────────────────────────────────────────────────────────
describe('PUT /player/rank — move a player to a new position', () => {
  beforeEach(() => {
    mockOpensStore.opens = [sampleOpens({
      categories: [
        {
          id: 'huitailang',
          males: [
            { id: 'p1', name: 'Alice' },
            { id: 'p2', name: 'Bob' },
            { id: 'p3', name: 'Carol' },
          ],
          females: [],
        },
        { id: 'xiyangyang', males: [], females: [] },
      ],
    })];
  });

  test('moves player to the requested position', async () => {
    const res = await request(buildApp()).put('/player/rank').send({
      opensId: 'TestOpens-2026-06-01', categoryId: 'huitailang', gender: 'males',
      playerId: 'p3', position: 1,
    });
    expect(res.status).toBe(200);
    const htCat = res.body.categories.find(c => c.id === 'huitailang');
    expect(htCat.males[0].id).toBe('p3');
  });

  test('persists the reorder to the store', async () => {
    await request(buildApp()).put('/player/rank').send({
      opensId: 'TestOpens-2026-06-01', categoryId: 'huitailang', gender: 'males',
      playerId: 'p1', position: 3,
    });
    const htCat = mockOpensStore.opens[0].categories.find(c => c.id === 'huitailang');
    expect(htCat.males[2].id).toBe('p1');
  });

  test('returns 404 when player is not found', async () => {
    const res = await request(buildApp()).put('/player/rank').send({
      opensId: 'TestOpens-2026-06-01', categoryId: 'huitailang', gender: 'males',
      playerId: 'no-such-player', position: 1,
    });
    expect(res.status).toBe(404);
  });

  test('returns 400 when required fields are missing', async () => {
    const res = await request(buildApp()).put('/player/rank').send({ opensId: 'TestOpens-2026-06-01' });
    expect(res.status).toBe(400);
  });

  test('clamps position to the valid range', async () => {
    const res = await request(buildApp()).put('/player/rank').send({
      opensId: 'TestOpens-2026-06-01', categoryId: 'huitailang', gender: 'males',
      playerId: 'p1', position: 999,
    });
    expect(res.status).toBe(200);
    const htCat = res.body.categories.find(c => c.id === 'huitailang');
    expect(htCat.males[htCat.males.length - 1].id).toBe('p1');
  });
});

// ─── PUT /player/delete ──────────────────────────────────────────────────────
describe('PUT /player/delete — remove a player', () => {
  beforeEach(() => {
    mockOpensStore.opens = [sampleOpens({
      categories: [
        { id: 'huitailang', males: [{ id: 'p1', name: 'Alice' }], females: [] },
        { id: 'xiyangyang', males: [], females: [] },
      ],
    })];
  });

  test('removes the player and returns the updated opens', async () => {
    const res = await request(buildApp()).put('/player/delete').send({
      opensId: 'TestOpens-2026-06-01', categoryId: 'huitailang', gender: 'males', playerId: 'p1',
    });
    expect(res.status).toBe(200);
    const htCat = res.body.categories.find(c => c.id === 'huitailang');
    expect(htCat.males.find(p => p.id === 'p1')).toBeUndefined();
  });

  test('persists the deletion to the store', async () => {
    await request(buildApp()).put('/player/delete').send({
      opensId: 'TestOpens-2026-06-01', categoryId: 'huitailang', gender: 'males', playerId: 'p1',
    });
    const htCat = mockOpensStore.opens[0].categories.find(c => c.id === 'huitailang');
    expect(htCat.males).toHaveLength(0);
  });

  test('returns 404 when player is not found', async () => {
    const res = await request(buildApp()).put('/player/delete').send({
      opensId: 'TestOpens-2026-06-01', categoryId: 'huitailang', gender: 'males', playerId: 'no-such',
    });
    expect(res.status).toBe(404);
  });

  test('returns 400 when required fields are missing', async () => {
    const res = await request(buildApp()).put('/player/delete').send({ opensId: 'TestOpens-2026-06-01' });
    expect(res.status).toBe(400);
  });

  test('returns 404 when opens is not found', async () => {
    const res = await request(buildApp()).put('/player/delete').send({
      opensId: 'no-such-opens', categoryId: 'huitailang', gender: 'males', playerId: 'p1',
    });
    expect(res.status).toBe(404);
  });
});

// ─── PUT /importPlayers ───────────────────────────────────────────────────────
describe('PUT /importPlayers — import players from ladder', () => {
  beforeEach(() => {
    mockOpensStore.opens = [sampleOpens()];
    // 4 huitailang players sorted by avgRankInCat
    // even indices (0,2) → htMales;  odd indices (1,3) → xyMales
    mockLadderStore.players = [
      samplePlayer('h1', 'HT-1', 'huitailang', 1),
      samplePlayer('h2', 'HT-2', 'huitailang', 2),
      samplePlayer('h3', 'HT-3', 'huitailang', 3),
      samplePlayer('h4', 'HT-4', 'huitailang', 4),
      // 4 xiyangyang players sorted by avgRankInCat
      // odd indices (1,3) → htFemales;  even indices (0,2) → xyFemales
      samplePlayer('x1', 'XY-1', 'xiyangyang', 1),
      samplePlayer('x2', 'XY-2', 'xiyangyang', 2),
      samplePlayer('x3', 'XY-3', 'xiyangyang', 3),
      samplePlayer('x4', 'XY-4', 'xiyangyang', 4),
    ];
  });

  test('returns 400 when opensId is missing', async () => {
    const res = await request(buildApp()).put('/importPlayers').send({});
    expect(res.status).toBe(400);
  });

  test('returns 404 when opens is not found', async () => {
    const res = await request(buildApp()).put('/importPlayers').send({ opensId: 'no-such' });
    expect(res.status).toBe(404);
  });

  test('distributes huitailang players into htMales (even) and xyMales (odd)', async () => {
    const res = await request(buildApp()).put('/importPlayers').send({ opensId: 'TestOpens-2026-06-01' });
    expect(res.status).toBe(200);
    // htMales: h1 (idx 0), h3 (idx 2)
    expect(res.body.htMales.map(p => p.id)).toEqual(['h1', 'h3']);
    // xyMales: h2 (idx 1), h4 (idx 3)
    expect(res.body.xyMales.map(p => p.id)).toEqual(['h2', 'h4']);
  });

  test('distributes xiyangyang players into htFemales (odd) and xyFemales (even)', async () => {
    const res = await request(buildApp()).put('/importPlayers').send({ opensId: 'TestOpens-2026-06-01' });
    // htFemales: x2 (idx 1), x4 (idx 3)
    expect(res.body.htFemales.map(p => p.id)).toEqual(['x2', 'x4']);
    // xyFemales: x1 (idx 0), x3 (idx 2)
    expect(res.body.xyFemales.map(p => p.id)).toEqual(['x1', 'x3']);
  });

  test('persists the imported players to the opens store', async () => {
    await request(buildApp()).put('/importPlayers').send({ opensId: 'TestOpens-2026-06-01' });
    const htCat = mockOpensStore.opens[0].categories.find(c => c.id === 'huitailang');
    const xyCat = mockOpensStore.opens[0].categories.find(c => c.id === 'xiyangyang');
    expect(htCat.males.length).toBeGreaterThan(0);
    expect(xyCat.males.length).toBeGreaterThan(0);
  });

  test('excludes inactive players', async () => {
    mockLadderStore.players.push(samplePlayer('h5', 'HT-inactive', 'huitailang', 5, false));
    const res = await request(buildApp()).put('/importPlayers').send({ opensId: 'TestOpens-2026-06-01' });
    const allImported = [...res.body.htMales, ...res.body.xyMales];
    expect(allImported.find(p => p.id === 'h5')).toBeUndefined();
  });
});

// ─── PUT /generateMatchesAndGroups ───────────────────────────────────────────
describe('PUT /generateMatchesAndGroups — generate groups and matches', () => {
  const htMales = Array.from({ length: 6 }, (_, i) => ({ id: `hm${i + 1}`, name: `HM${i + 1}` }));
  const xyMales = Array.from({ length: 6 }, (_, i) => ({ id: `xm${i + 1}`, name: `XM${i + 1}` }));

  beforeEach(() => {
    mockOpensStore.opens = [sampleOpens({
      categories: [
        { id: 'huitailang', males: htMales, females: [] },
        { id: 'xiyangyang', males: xyMales, females: [] },
      ],
    })];
    // Simple pair plan: one males match pairing A1+A2 vs B1+B2
    mockPairPlan = {
      males_matches: [{ team1: ['A1', 'A2'], team2: ['B1', 'B2'] }],
      females_matches: [],
      cross_matches: [],
    };
  });

  test('returns 400 when opensId is missing', async () => {
    const res = await request(buildApp()).put('/generateMatchesAndGroups').send({});
    expect(res.status).toBe(400);
  });

  test('returns 404 when opens is not found', async () => {
    const res = await request(buildApp()).put('/generateMatchesAndGroups').send({ opensId: 'no-such' });
    expect(res.status).toBe(404);
  });

  test('generates males matches from the pair plan', async () => {
    const res = await request(buildApp()).put('/generateMatchesAndGroups').send({ opensId: 'TestOpens-2026-06-01' });
    expect(res.status).toBe(200);
    const malesMatches = res.body.matches.filter(m => m.type === 'males');
    expect(malesMatches.length).toBe(1);
  });

  test('resolves player codes to actual names in matches', async () => {
    const res = await request(buildApp()).put('/generateMatchesAndGroups').send({ opensId: 'TestOpens-2026-06-01' });
    const m = res.body.matches[0];
    // A1 = htMales[0] = HM1, A2 = htMales[1] = HM2
    expect(m.team1).toContain('HM1');
    expect(m.team1).toContain('HM2');
    // B1 = xyMales[0] = XM1, B2 = xyMales[1] = XM2
    expect(m.team2).toContain('XM1');
    expect(m.team2).toContain('XM2');
  });

  test('populates groups with ht/xy partitions', async () => {
    const res = await request(buildApp()).put('/generateMatchesAndGroups').send({ opensId: 'TestOpens-2026-06-01' });
    expect(res.body.groups.males).toBeDefined();
    expect(res.body.groups.males[0].ht.length).toBe(6);
    expect(res.body.groups.males[0].xy.length).toBe(6);
  });

  test('all generated matches start as not completed with null scores', async () => {
    const res = await request(buildApp()).put('/generateMatchesAndGroups').send({ opensId: 'TestOpens-2026-06-01' });
    res.body.matches.forEach(m => {
      expect(m.completed).toBe(false);
      expect(m.score1).toBeNull();
      expect(m.score2).toBeNull();
    });
  });

  test('produces no matches when pair plan is empty', async () => {
    mockPairPlan = {};
    const res = await request(buildApp()).put('/generateMatchesAndGroups').send({ opensId: 'TestOpens-2026-06-01' });
    expect(res.status).toBe(200);
    expect(res.body.matches).toHaveLength(0);
  });

  test('persists generated matches and groups to the store', async () => {
    await request(buildApp()).put('/generateMatchesAndGroups').send({ opensId: 'TestOpens-2026-06-01' });
    expect(mockOpensStore.opens[0].matches.length).toBeGreaterThan(0);
    expect(mockOpensStore.opens[0].groups).toBeDefined();
  });
});
