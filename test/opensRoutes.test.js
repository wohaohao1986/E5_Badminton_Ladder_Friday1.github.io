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
    { id: 'A', males: [], females: [] },
    { id: 'B', males: [], females: [] },
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

  test('initialises Team A and Team B categories with empty player lists', async () => {
    await request(buildApp()).post('/').send({ name: 'Summer', date: '2026-08-01' });
    const o = mockOpensStore.opens[0];
    const ht = o.categories.find(c => c.id === 'A');
    const xy = o.categories.find(c => c.id === 'B');
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
      opensId: 'TestOpens-2026-06-01', categoryId: 'A', gender: 'males', name: 'Alice',
    });
    expect(res.status).toBe(200);
    const htCat = res.body.categories.find(c => c.id === 'A');
    expect(htCat.males.some(p => p.name === 'Alice')).toBe(true);
  });

  test('persists the new player to the store', async () => {
    await request(buildApp()).put('/player/add').send({
      opensId: 'TestOpens-2026-06-01', categoryId: 'B', gender: 'females', name: 'Bob',
    });
    const xyCat = mockOpensStore.opens[0].categories.find(c => c.id === 'B');
    expect(xyCat.females.some(p => p.name === 'Bob')).toBe(true);
  });

  test('returns 400 when required fields are missing', async () => {
    const res = await request(buildApp()).put('/player/add').send({ opensId: 'TestOpens-2026-06-01' });
    expect(res.status).toBe(400);
  });

  test('returns 404 when opens is not found', async () => {
    const res = await request(buildApp()).put('/player/add').send({
      opensId: 'no-such-id', categoryId: 'A', gender: 'males', name: 'Alice',
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
      opensId: 'TestOpens-2026-06-01', categoryId: 'A', gender: 'robots', name: 'Alice',
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
          id: 'A',
          males: [
            { id: 'p1', name: 'Alice' },
            { id: 'p2', name: 'Bob' },
            { id: 'p3', name: 'Carol' },
          ],
          females: [],
        },
        { id: 'B', males: [], females: [] },
      ],
    })];
  });

  test('moves player to the requested position', async () => {
    const res = await request(buildApp()).put('/player/rank').send({
      opensId: 'TestOpens-2026-06-01', categoryId: 'A', gender: 'males',
      playerId: 'p3', position: 1,
    });
    expect(res.status).toBe(200);
    const htCat = res.body.categories.find(c => c.id === 'A');
    expect(htCat.males[0].id).toBe('p3');
  });

  test('persists the reorder to the store', async () => {
    await request(buildApp()).put('/player/rank').send({
      opensId: 'TestOpens-2026-06-01', categoryId: 'A', gender: 'males',
      playerId: 'p1', position: 3,
    });
    const htCat = mockOpensStore.opens[0].categories.find(c => c.id === 'A');
    expect(htCat.males[2].id).toBe('p1');
  });

  test('returns 404 when player is not found', async () => {
    const res = await request(buildApp()).put('/player/rank').send({
      opensId: 'TestOpens-2026-06-01', categoryId: 'A', gender: 'males',
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
      opensId: 'TestOpens-2026-06-01', categoryId: 'A', gender: 'males',
      playerId: 'p1', position: 999,
    });
    expect(res.status).toBe(200);
    const htCat = res.body.categories.find(c => c.id === 'A');
    expect(htCat.males[htCat.males.length - 1].id).toBe('p1');
  });
});

// ─── PUT /player/delete ──────────────────────────────────────────────────────
describe('PUT /player/delete — remove a player', () => {
  beforeEach(() => {
    mockOpensStore.opens = [sampleOpens({
      categories: [
        { id: 'A', males: [{ id: 'p1', name: 'Alice' }], females: [] },
        { id: 'B', males: [], females: [] },
      ],
    })];
  });

  test('removes the player and returns the updated opens', async () => {
    const res = await request(buildApp()).put('/player/delete').send({
      opensId: 'TestOpens-2026-06-01', categoryId: 'A', gender: 'males', playerId: 'p1',
    });
    expect(res.status).toBe(200);
    const htCat = res.body.categories.find(c => c.id === 'A');
    expect(htCat.males.find(p => p.id === 'p1')).toBeUndefined();
  });

  test('persists the deletion to the store', async () => {
    await request(buildApp()).put('/player/delete').send({
      opensId: 'TestOpens-2026-06-01', categoryId: 'A', gender: 'males', playerId: 'p1',
    });
    const htCat = mockOpensStore.opens[0].categories.find(c => c.id === 'A');
    expect(htCat.males).toHaveLength(0);
  });

  test('returns 404 when player is not found', async () => {
    const res = await request(buildApp()).put('/player/delete').send({
      opensId: 'TestOpens-2026-06-01', categoryId: 'A', gender: 'males', playerId: 'no-such',
    });
    expect(res.status).toBe(404);
  });

  test('returns 400 when required fields are missing', async () => {
    const res = await request(buildApp()).put('/player/delete').send({ opensId: 'TestOpens-2026-06-01' });
    expect(res.status).toBe(400);
  });

  test('returns 404 when opens is not found', async () => {
    const res = await request(buildApp()).put('/player/delete').send({
      opensId: 'no-such-opens', categoryId: 'A', gender: 'males', playerId: 'p1',
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

  test('distributes huitailang players into Team A males (idx 0,2) and Team B males (idx 1,3)', async () => {
    const res = await request(buildApp()).put('/importPlayers').send({ opensId: 'TestOpens-2026-06-01' });
    expect(res.status).toBe(200);
    const teamA = res.body.teams.find(t => t.id === 'A');
    const teamB = res.body.teams.find(t => t.id === 'B');
    // Team A males: h1 (idx 0), h3 (idx 2)
    expect(teamA.males.map(p => p.id)).toEqual(['h1', 'h3']);
    // Team B males: h2 (idx 1), h4 (idx 3)
    expect(teamB.males.map(p => p.id)).toEqual(['h2', 'h4']);
  });

  test('distributes xiyangyang players into Team A females (odd offset) and Team B females (even offset)', async () => {
    const res = await request(buildApp()).put('/importPlayers').send({ opensId: 'TestOpens-2026-06-01' });
    const teamA = res.body.teams.find(t => t.id === 'A');
    const teamB = res.body.teams.find(t => t.id === 'B');
    // With 2 teams and offset 1: team A gets idx 1,3 (x2,x4), team B gets idx 0,2 (x1,x3)
    expect(teamA.females.map(p => p.id)).toEqual(['x2', 'x4']);
    expect(teamB.females.map(p => p.id)).toEqual(['x1', 'x3']);
  });

  test('persists the imported players to the opens store', async () => {
    await request(buildApp()).put('/importPlayers').send({ opensId: 'TestOpens-2026-06-01' });
    const htCat = mockOpensStore.opens[0].categories.find(c => c.id === 'A');
    const xyCat = mockOpensStore.opens[0].categories.find(c => c.id === 'B');
    expect(htCat.males.length).toBeGreaterThan(0);
    expect(xyCat.males.length).toBeGreaterThan(0);
  });

  test('excludes inactive players', async () => {
    mockLadderStore.players.push(samplePlayer('h5', 'HT-inactive', 'huitailang', 5, false));
    const res = await request(buildApp()).put('/importPlayers').send({ opensId: 'TestOpens-2026-06-01' });
    const allImported = res.body.teams.flatMap(t => t.males);
    expect(allImported.find(p => p.id === 'h5')).toBeUndefined();
  });

  test('splits into 3 teams when numTeams=3', async () => {
    // Add 2 extra huitailang players so each team gets exactly 2 males (A=[0,3], B=[1,4], C=[2,5])
    mockLadderStore.players.push(
      samplePlayer('h5', 'HT-5', 'huitailang', 5),
      samplePlayer('h6', 'HT-6', 'huitailang', 6)
    );
    const res = await request(buildApp()).put('/importPlayers').send({ opensId: 'TestOpens-2026-06-01', numTeams: 3 });
    expect(res.status).toBe(200);
    expect(res.body.numTeams).toBe(3);
    const allMales = res.body.teams.flatMap(t => t.males);
    expect(allMales).toHaveLength(6);
    // Each team should have exactly 2 males
    res.body.teams.forEach(t => expect(t.males).toHaveLength(2));
    // All 6 huitailang players should be present
    const ids = allMales.map(p => p.id).sort();
    expect(ids).toEqual(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
    // store should have 3 categories
    expect(mockOpensStore.opens[0].categories).toHaveLength(3);
    expect(mockOpensStore.opens[0].categories.map(c => c.id)).toEqual(['A', 'B', 'C']);
  });

  test('clamps numTeams above 6 down to 6', async () => {
    const res = await request(buildApp()).put('/importPlayers').send({ opensId: 'TestOpens-2026-06-01', numTeams: 10 });
    expect(res.status).toBe(200);
    expect(res.body.numTeams).toBe(6); // clamped to max 6
  });
});

// ─── PUT /generatePairPlan ───────────────────────────────────────────────────
describe('PUT /generatePairPlan — generate pair plan options', () => {
  test('applies maxMalesMatches, maxFemalesMatches, maxCrossMatches caps', async () => {
    const res = await request(buildApp()).put('/generatePairPlan').send({
      nM: 8,
      nF: 6,
      maxMalesMatches: 16,
      maxFemalesMatches: 5,
      maxCrossMatches: 4
    });
    expect(res.status).toBe(200);
    expect(res.body.males_matches).toHaveLength(16);
    expect(res.body.females_matches).toHaveLength(5);
    expect(res.body.cross_matches).toHaveLength(4);
  });

  test('returns alternative plans array when alternativeCount > 1', async () => {
    const res = await request(buildApp()).put('/generatePairPlan').send({
      nM: 8,
      nF: 6,
      maxMalesMatches: 16,
      reducedFemales: true,
      randomize: true,
      alternativeCount: 3,
      seed: 'routes-alt'
    });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.plans)).toBe(true);
    expect(res.body.plans.length).toBeGreaterThanOrEqual(2);
  });

  test('returns grouped cross plans with female indices limited by crossFemaleAllocation', async () => {
    const res = await request(buildApp()).put('/generatePairPlan').send({
      nM: 6,
      nF: 6,
      crossFemaleAllocation: [3, 3],
      maxCrossMatches: 6,
    });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.cross_matches_group1)).toBe(true);
    expect(Array.isArray(res.body.cross_matches_group2)).toBe(true);
    expect(res.body.cross_matches_group1.length).toBeGreaterThan(0);
    expect(res.body.cross_matches_group2.length).toBeGreaterThan(0);

    const extractFemaleIndex = (code) => {
      const m = String(code).match(/^[AB]F(\d+)/);
      return m ? parseInt(m[1], 10) : null;
    };

    for (const match of res.body.cross_matches_group1) {
      const femaleIdx = [...match.team1, ...match.team2]
        .map(extractFemaleIndex)
        .filter(v => v !== null);
      expect(femaleIdx.length).toBe(2);
      for (const idx of femaleIdx) {
        expect(idx).toBeLessThanOrEqual(3);
      }
    }

    for (const match of res.body.cross_matches_group2) {
      const femaleIdx = [...match.team1, ...match.team2]
        .map(extractFemaleIndex)
        .filter(v => v !== null);
      expect(femaleIdx.length).toBe(2);
      for (const idx of femaleIdx) {
        // group2 uses the second half of the female pool: indices 4-6
        expect(idx).toBeGreaterThanOrEqual(4);
        expect(idx).toBeLessThanOrEqual(6);
      }
    }
  });
});

// ─── PUT /generateMatchesAndGroups ───────────────────────────────────────────
describe('PUT /generateMatchesAndGroups — generate groups and matches', () => {
  const htMales = Array.from({ length: 6 }, (_, i) => ({ id: `hm${i + 1}`, name: `HM${i + 1}` }));
  const xyMales = Array.from({ length: 6 }, (_, i) => ({ id: `xm${i + 1}`, name: `XM${i + 1}` }));

  beforeEach(() => {
    mockOpensStore.opens = [sampleOpens({
      categories: [
        { id: 'A', males: htMales, females: [] },
        { id: 'B', males: xyMales, females: [] },
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

  test('returns 400 when opens has more than 2 teams', async () => {
    mockOpensStore.opens = [sampleOpens({
      categories: [
        { id: 'A', males: htMales, females: [] },
        { id: 'B', males: xyMales, females: [] },
        { id: 'C', males: htMales, females: [] },
      ],
    })];
    const res = await request(buildApp()).put('/generateMatchesAndGroups').send({ opensId: 'TestOpens-2026-06-01' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/3 teams/);
  });

  test('generates males matches dynamically from player count', async () => {
    // 6 males per side → C(6,2) = 15 male matches
    const res = await request(buildApp()).put('/generateMatchesAndGroups').send({ opensId: 'TestOpens-2026-06-01' });
    expect(res.status).toBe(200);
    const malesMatches = res.body.matches.filter(m => m.type === 'males');
    expect(malesMatches.length).toBe(15);
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

  test('produces no matches when opens has no players', async () => {
    mockOpensStore.opens = [sampleOpens({
      categories: [
        { id: 'A', males: [], females: [] },
        { id: 'B', males: [], females: [] },
      ],
    })];
    const res = await request(buildApp()).put('/generateMatchesAndGroups').send({ opensId: 'TestOpens-2026-06-01' });
    expect(res.status).toBe(200);
    expect(res.body.matches).toHaveLength(0);
  });

  test('persists generated matches and groups to the store', async () => {
    await request(buildApp()).put('/generateMatchesAndGroups').send({ opensId: 'TestOpens-2026-06-01' });
    expect(mockOpensStore.opens[0].matches.length).toBeGreaterThan(0);
    expect(mockOpensStore.opens[0].groups).toBeDefined();
  });

  test('cross matches split one female group into halves for two male groups', async () => {
    const htMales12 = Array.from({ length: 12 }, (_, i) => ({ id: `hm${i + 1}`, name: `HM${i + 1}` }));
    const xyMales12 = Array.from({ length: 12 }, (_, i) => ({ id: `xm${i + 1}`, name: `XM${i + 1}` }));
    const htFemales6 = Array.from({ length: 6 }, (_, i) => ({ id: `hf${i + 1}`, name: `HF${i + 1}` }));
    const xyFemales6 = Array.from({ length: 6 }, (_, i) => ({ id: `xf${i + 1}`, name: `XF${i + 1}` }));

    mockOpensStore.opens = [sampleOpens({
      categories: [
        { id: 'A', males: htMales12, females: htFemales6 },
        { id: 'B', males: xyMales12, females: xyFemales6 },
      ],
    })];

    const res = await request(buildApp()).put('/generateMatchesAndGroups').send({ opensId: 'TestOpens-2026-06-01' });
    expect(res.status).toBe(200);

    const crossMatches = res.body.matches.filter(m => m.type === 'cross');
    expect(crossMatches.length).toBeGreaterThan(0);

    const crossGroups = new Set(crossMatches.map(m => m.group));
    expect(crossGroups).toEqual(new Set([1, 2]));

    const group1Females = new Set(
      crossMatches
        .filter(m => m.group === 1)
        .flatMap(m => [...m.team1, ...m.team2])
        .filter(name => /^HF\d+$/.test(name) || /^XF\d+$/.test(name))
    );
    const group2Females = new Set(
      crossMatches
        .filter(m => m.group === 2)
        .flatMap(m => [...m.team1, ...m.team2])
        .filter(name => /^HF\d+$/.test(name) || /^XF\d+$/.test(name))
    );

    for (const name of group1Females) {
      const idx = parseInt(name.slice(2), 10);
      expect(idx).toBeGreaterThanOrEqual(1);
      expect(idx).toBeLessThanOrEqual(3);
    }
    for (const name of group2Females) {
      const idx = parseInt(name.slice(2), 10);
      expect(idx).toBeGreaterThanOrEqual(4);
      expect(idx).toBeLessThanOrEqual(6);
    }
  });

  test('caps male matches at 16 by default for 8-player male groups', async () => {
    const htMales8 = Array.from({ length: 8 }, (_, i) => ({ id: `hm${i + 1}`, name: `HM${i + 1}` }));
    const xyMales8 = Array.from({ length: 8 }, (_, i) => ({ id: `xm${i + 1}`, name: `XM${i + 1}` }));

    mockOpensStore.opens = [sampleOpens({
      categories: [
        { id: 'A', males: htMales8, females: [] },
        { id: 'B', males: xyMales8, females: [] },
      ],
    })];

    const res = await request(buildApp()).put('/generateMatchesAndGroups').send({ opensId: 'TestOpens-2026-06-01' });
    expect(res.status).toBe(200);

    const malesMatches = res.body.matches.filter(m => m.type === 'males');
    expect(malesMatches).toHaveLength(16);
  });

  test('uses customPairPlan when provided to generate matches', async () => {
    const htFemales = Array.from({ length: 6 }, (_, i) => ({ id: `hf${i + 1}`, name: `HF${i + 1}` }));
    const xyFemales = Array.from({ length: 6 }, (_, i) => ({ id: `xf${i + 1}`, name: `XF${i + 1}` }));

    mockOpensStore.opens = [sampleOpens({
      categories: [
        { id: 'A', males: htMales, females: htFemales },
        { id: 'B', males: xyMales, females: xyFemales },
      ],
    })];

    const customPairPlan = {
      males_matches: [{ team1: ['A1', 'A2'], team2: ['B1', 'B2'] }],
      females_matches: [{ team1: ['A1', 'A2'], team2: ['B1', 'B2'] }],
      cross_matches: [{ team1: ['AM1', 'AF1'], team2: ['BM1', 'BF1'] }]
    };

    const res = await request(buildApp()).put('/generateMatchesAndGroups').send({
      opensId: 'TestOpens-2026-06-01',
      customPairPlan
    });
    expect(res.status).toBe(200);
    expect(res.body.matches.filter(m => m.type === 'males')).toHaveLength(1);
    expect(res.body.matches.filter(m => m.type === 'females')).toHaveLength(1);
    expect(res.body.matches.filter(m => m.type === 'cross')).toHaveLength(1);
  });

  test('returns warning when roster cannot be evenly split into groups', async () => {
    const htMales7 = Array.from({ length: 7 }, (_, i) => ({ id: `hm${i + 1}`, name: `HM${i + 1}` }));
    const xyMales7 = Array.from({ length: 7 }, (_, i) => ({ id: `xm${i + 1}`, name: `XM${i + 1}` }));

    mockOpensStore.opens = [sampleOpens({
      categories: [
        { id: 'A', males: htMales7, females: [] },
        { id: 'B', males: xyMales7, females: [] },
      ],
    })];

    const res = await request(buildApp()).put('/generateMatchesAndGroups').send({ opensId: 'TestOpens-2026-06-01' });
    expect(res.status).toBe(200);
    expect(typeof res.body.warning).toBe('string');
    expect(res.body.warning).toContain('男子人数无法按每组');
  });

  test('single female group is split across multiple male groups for cross matches', async () => {
    const htMales18 = Array.from({ length: 18 }, (_, i) => ({ id: `hm${i + 1}`, name: `HM${i + 1}` }));
    const xyMales18 = Array.from({ length: 18 }, (_, i) => ({ id: `xm${i + 1}`, name: `XM${i + 1}` }));
    const htFemales6 = Array.from({ length: 6 }, (_, i) => ({ id: `hf${i + 1}`, name: `HF${i + 1}` }));
    const xyFemales6 = Array.from({ length: 6 }, (_, i) => ({ id: `xf${i + 1}`, name: `XF${i + 1}` }));

    mockOpensStore.opens = [sampleOpens({
      categories: [
        { id: 'A', males: htMales18, females: htFemales6 },
        { id: 'B', males: xyMales18, females: xyFemales6 },
      ],
    })];

    const res = await request(buildApp()).put('/generateMatchesAndGroups').send({ opensId: 'TestOpens-2026-06-01' });
    expect(res.status).toBe(200);

    const crossMatches = res.body.matches.filter(m => m.type === 'cross');
    expect(crossMatches.length).toBeGreaterThan(0);
    const groups = new Set(crossMatches.map(m => m.group));
    expect(groups).toEqual(new Set([1, 2, 3]));

    expect(res.body.crossSplit).toBeDefined();
    expect(res.body.crossSplit.pairedFemaleCount).toBe(6);
    expect(res.body.crossSplit.maleGroupSizes).toEqual([6, 6, 6]);
    expect(res.body.crossSplit.femaleAllocationByCrossGroup).toEqual([2, 2, 2]);

    const femaleNames = new Set(
      crossMatches.flatMap(m => [...m.team1, ...m.team2]).filter(n => /^HF\d+$/.test(n) || /^XF\d+$/.test(n))
    );
    expect(femaleNames.size).toBeGreaterThanOrEqual(6);
    expect(femaleNames.has('HF1')).toBe(true);
    expect(femaleNames.has('HF6')).toBe(true);
  });

  test('custom cross plan with AF4G1 notation resolves against original female group indices', async () => {
    const htMales12 = Array.from({ length: 12 }, (_, i) => ({ id: `hm${i + 1}`, name: `HM${i + 1}` }));
    const xyMales12 = Array.from({ length: 12 }, (_, i) => ({ id: `xm${i + 1}`, name: `XM${i + 1}` }));
    const htFemales6 = Array.from({ length: 6 }, (_, i) => ({ id: `hf${i + 1}`, name: `HF${i + 1}` }));
    const xyFemales6 = Array.from({ length: 6 }, (_, i) => ({ id: `xf${i + 1}`, name: `XF${i + 1}` }));

    mockOpensStore.opens = [sampleOpens({
      categories: [
        { id: 'A', males: htMales12, females: htFemales6 },
        { id: 'B', males: xyMales12, females: xyFemales6 },
      ],
    })];

    const customPairPlan = {
      males_matches: [],
      females_matches: [],
      cross_matches_group1: [{ team1: ['AM1', 'AF1G1'], team2: ['BM1', 'BF1G1'] }],
      cross_matches_group2: [{ team1: ['AM1', 'AF4G1'], team2: ['BM1', 'BF4G1'] }]
    };

    const res = await request(buildApp()).put('/generateMatchesAndGroups').send({
      opensId: 'TestOpens-2026-06-01',
      customPairPlan
    });
    expect(res.status).toBe(200);

    const crossG1 = res.body.matches.find(m => m.type === 'cross' && m.group === 1);
    const crossG2 = res.body.matches.find(m => m.type === 'cross' && m.group === 2);
    expect(crossG1).toBeDefined();
    expect(crossG2).toBeDefined();
    expect([...crossG1.team1, ...crossG1.team2]).toContain('HF1');
    expect([...crossG2.team1, ...crossG2.team2]).toContain('HF4');
  });

  test('rejects custom male plan that needs more players than actual male group size', async () => {
    mockOpensStore.opens = [sampleOpens({
      categories: [
        { id: 'A', males: htMales, females: [] },
        { id: 'B', males: xyMales, females: [] },
      ],
    })];

    const customPairPlan = {
      males_matches: [{ team1: ['A7', 'A8'], team2: ['B7', 'B8'] }],
      females_matches: [],
      cross_matches: []
    };

    const res = await request(buildApp()).put('/generateMatchesAndGroups').send({
      opensId: 'TestOpens-2026-06-01',
      customPairPlan
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('男子配对方案需要至少8名选手');
  });
});

// ─── PUT /registration/add ───────────────────────────────────────────────────
describe('PUT /registration/add — add a registration entry', () => {
  beforeEach(() => {
    mockOpensStore.opens = [sampleOpens()];
  });

  test('rejects a ladder registration entry (fromLadder: true is not allowed via this endpoint)', async () => {
    const res = await request(buildApp()).put('/registration/add').send({
      opensId: 'TestOpens-2026-06-01',
      name: 'Scott Ding',
      gender: 'males',
      fromLadder: true,
      playerId: 'player-001',
    });
    expect(res.status).toBe(400);
  });

  test('adds an external registration entry without playerId', async () => {
    const res = await request(buildApp()).put('/registration/add').send({
      opensId: 'TestOpens-2026-06-01',
      name: 'Jane Doe',
      gender: 'females',
      fromLadder: false,
    });
    expect(res.status).toBe(200);
    expect(res.body.registration[0].fromLadder).toBe(false);
    expect(res.body.registration[0].playerId).toBeUndefined();
  });

  test('persists the entry to the store', async () => {
    await request(buildApp()).put('/registration/add').send({
      opensId: 'TestOpens-2026-06-01',
      name: 'Alice',
      gender: 'females',
      fromLadder: false,
    });
    expect(mockOpensStore.opens[0].registration).toHaveLength(1);
    expect(mockOpensStore.opens[0].registration[0].name).toBe('Alice');
  });

  test('generates a unique id for each entry', async () => {
    const app = buildApp();
    await request(app).put('/registration/add').send({ opensId: 'TestOpens-2026-06-01', name: 'A', gender: 'males', fromLadder: false });
    await request(app).put('/registration/add').send({ opensId: 'TestOpens-2026-06-01', name: 'B', gender: 'females', fromLadder: false });
    const ids = mockOpensStore.opens[0].registration.map(e => e.id);
    expect(new Set(ids).size).toBe(2);
  });

  test('returns 400 when required fields are missing', async () => {
    const res = await request(buildApp()).put('/registration/add').send({ opensId: 'TestOpens-2026-06-01', gender: 'males' });
    expect(res.status).toBe(400);
  });

  test('returns 400 for invalid gender', async () => {
    const res = await request(buildApp()).put('/registration/add').send({
      opensId: 'TestOpens-2026-06-01', name: 'Alice', gender: 'robots', fromLadder: false,
    });
    expect(res.status).toBe(400);
  });

  test('returns 404 when opens is not found', async () => {
    const res = await request(buildApp()).put('/registration/add').send({
      opensId: 'no-such-id', name: 'Alice', gender: 'males', fromLadder: false,
    });
    expect(res.status).toBe(404);
  });
});

// ─── PUT /registration/delete ────────────────────────────────────────────────
describe('PUT /registration/delete — delete a registration entry', () => {
  beforeEach(() => {
    mockOpensStore.opens = [sampleOpens({
      registration: [
        { id: 'reg-001', name: 'Scott Ding', gender: 'males', fromLadder: true, playerId: 'player-001' },
        { id: 'reg-002', name: 'Jane Doe', gender: 'females', fromLadder: false },
      ],
    })];
  });

  test('removes the entry and returns the updated opens', async () => {
    const res = await request(buildApp()).put('/registration/delete').send({
      opensId: 'TestOpens-2026-06-01', entryId: 'reg-001',
    });
    expect(res.status).toBe(200);
    expect(res.body.registration).toHaveLength(1);
    expect(res.body.registration[0].id).toBe('reg-002');
  });

  test('persists the deletion to the store', async () => {
    await request(buildApp()).put('/registration/delete').send({
      opensId: 'TestOpens-2026-06-01', entryId: 'reg-001',
    });
    expect(mockOpensStore.opens[0].registration).toHaveLength(1);
  });

  test('returns 404 when entry is not found', async () => {
    const res = await request(buildApp()).put('/registration/delete').send({
      opensId: 'TestOpens-2026-06-01', entryId: 'no-such-entry',
    });
    expect(res.status).toBe(404);
  });

  test('returns 400 when required fields are missing', async () => {
    const res = await request(buildApp()).put('/registration/delete').send({ opensId: 'TestOpens-2026-06-01' });
    expect(res.status).toBe(400);
  });

  test('returns 404 when opens is not found', async () => {
    const res = await request(buildApp()).put('/registration/delete').send({
      opensId: 'no-such-id', entryId: 'reg-001',
    });
    expect(res.status).toBe(404);
  });
});
