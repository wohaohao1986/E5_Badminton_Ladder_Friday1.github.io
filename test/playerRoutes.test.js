jest.mock('../src/utils/fileUtils', () => ({
  DATA_FILE: 'mock-data.json',
  safeReadJson: jest.fn(),
  safeWriteJson: jest.fn(),
  logToFile: jest.fn(),
}));

jest.mock('../src/utils/dataUtils', () => ({
  CATEGORIES: { huitailang: '灰太狼', xiyangyang: '喜羊羊' },
  currentDateTime: '01/01/2026',
  rerankPlayer: jest.fn(),
  sortPlayersByRanking: jest.fn(),
  calculatePlayerAvgRankInCat: jest.fn(),
}));

const request = require('supertest');
const express = require('express');
const { safeReadJson, safeWriteJson } = require('../src/utils/fileUtils');
const { rerankPlayer, calculatePlayerAvgRankInCat } = require('../src/utils/dataUtils');
const playerRouter = require('../src/routes/playerRoutes');

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/', playerRouter);
  return app;
};

const samplePlayer = (overrides = {}) => ({
  id: 'player-1234',
  name: 'Test Player',
  category: 'huitailang',
  active: true,
  isDropin: false,
  ranking: 1,
  avgRankInCat: '-',
  numberOfMatchesTwentyOne: 0,
  winsTwentyOne: 0,
  totalNetScoreTwentyOne: 0,
  numberOfMatchesFifteen: 0,
  winsFifteen: 0,
  totalNetScoreFifteen: 0,
  ...overrides,
});

let mockStore;

beforeEach(() => {
  jest.clearAllMocks();
  mockStore = { players: [], groups: [], matches: [], currentRound: 1 };
  safeReadJson.mockImplementation(() => JSON.parse(JSON.stringify(mockStore)));
  safeWriteJson.mockImplementation((_, data) => { mockStore = data; });
});

// ─── POST / ───────────────────────────────────────────────────────────────────
describe('POST / — add player', () => {
  test('returns 201 when player is new', async () => {
    const res = await request(buildApp()).post('/').send(samplePlayer());
    expect(res.status).toBe(201);
    expect(res.body.message).toBeDefined();
  });

  test('saves new player to the store', async () => {
    await request(buildApp()).post('/').send(samplePlayer());
    expect(safeWriteJson).toHaveBeenCalled();
    const saved = safeWriteJson.mock.calls[0][1];
    expect(saved.players.some(p => p.id === 'player-1234')).toBe(true);
  });

  test('assigns ranking as last position among active players in category', async () => {
    mockStore.players = [
      samplePlayer({ id: 'p1', ranking: 1 }),
      samplePlayer({ id: 'p2', ranking: 2 }),
    ];
    await request(buildApp()).post('/').send(samplePlayer({ id: 'p-new', name: 'New Player' }));
    const saved = safeWriteJson.mock.calls[0][1];
    expect(saved.players.find(p => p.id === 'p-new').ranking).toBe(3);
  });

  test('sets returnCurrentRound to false on new player', async () => {
    await request(buildApp()).post('/').send(samplePlayer());
    const saved = safeWriteJson.mock.calls[0][1];
    expect(saved.players.find(p => p.id === 'player-1234').returnCurrentRound).toBe(false);
  });

  test('returns 201 with duplicate message when player already exists', async () => {
    mockStore.players = [samplePlayer()];
    const res = await request(buildApp()).post('/').send(samplePlayer());
    expect(res.status).toBe(201);
    expect(res.body.message).toContain('已存在');
  });

  test('returns 400 for empty payload', async () => {
    const res = await request(buildApp()).post('/').send({});
    expect(res.status).toBe(400);
  });
});

// ─── PUT / ────────────────────────────────────────────────────────────────────
describe('PUT / — update player', () => {
  beforeEach(() => {
    mockStore.players = [samplePlayer()];
  });

  test('returns 404 when player id is not found', async () => {
    const res = await request(buildApp()).put('/').send({ id: 'unknown-id' });
    expect(res.status).toBe(404);
  });

  test('returns 400 for empty payload', async () => {
    const res = await request(buildApp()).put('/').send({});
    expect(res.status).toBe(400);
  });

  test('returns 200 with "OK" when no recognized field is present', async () => {
    const res = await request(buildApp()).put('/').send({ id: 'player-1234', name: 'New Name' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('OK');
  });

  test('calls rerankPlayer when ranking is updated', async () => {
    const res = await request(buildApp()).put('/').send({ id: 'player-1234', ranking: 2 });
    expect(res.status).toBe(200);
    expect(rerankPlayer).toHaveBeenCalled();
  });

  test('calls rerankPlayer with correct args when deactivating player', async () => {
    const res = await request(buildApp()).put('/').send({ id: 'player-1234', active: false });
    expect(res.status).toBe(200);
    expect(rerankPlayer).toHaveBeenCalledWith(0, null, false);
  });

  test('calls rerankPlayer with correct args when activating player', async () => {
    mockStore.players = [samplePlayer({ active: false })];
    const res = await request(buildApp()).put('/').send({ id: 'player-1234', active: true });
    expect(res.status).toBe(200);
    expect(rerankPlayer).toHaveBeenCalledWith(0, null, true);
  });
});

// ─── PUT / — category change ────────────────────────────────────────────────
describe('PUT / — category change', () => {
  beforeEach(() => {
    mockStore.players = [samplePlayer({ category: 'huitailang' })];
  });

  test('returns 200 and includes old and new category names in message', async () => {
    const res = await request(buildApp()).put('/').send({ id: 'player-1234', category: 'xiyangyang' });
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('灰太狼');
    expect(res.body.message).toContain('喜羊羊');
  });

  test('calls calculatePlayerAvgRankInCat for the moved player', async () => {
    await request(buildApp()).put('/').send({ id: 'player-1234', category: 'xiyangyang' });
    expect(calculatePlayerAvgRankInCat).toHaveBeenCalledWith('Test Player');
  });

  test('calls rerankPlayer after category change', async () => {
    await request(buildApp()).put('/').send({ id: 'player-1234', category: 'xiyangyang' });
    expect(rerankPlayer).toHaveBeenCalled();
  });
});

// ─── PUT /delete ──────────────────────────────────────────────────────────────
describe('PUT /delete — remove player', () => {
  beforeEach(() => {
    mockStore.players = [samplePlayer()];
  });

  test('returns 201 and confirms deletion', async () => {
    const res = await request(buildApp()).put('/delete').send({ id: 'player-1234' });
    expect(res.status).toBe(201);
    expect(res.body.message).toContain('已被删除');
  });

  test('removes player from the store', async () => {
    await request(buildApp()).put('/delete').send({ id: 'player-1234' });
    expect(mockStore.players.find(p => p.id === 'player-1234')).toBeUndefined();
  });

  test('returns 404 when player does not exist', async () => {
    const res = await request(buildApp()).put('/delete').send({ id: 'ghost-player' });
    expect(res.status).toBe(404);
  });

  test('returns 400 for empty payload', async () => {
    const res = await request(buildApp()).put('/delete').send({});
    expect(res.status).toBe(400);
  });
});
