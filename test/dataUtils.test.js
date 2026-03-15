jest.mock('../src/utils/fileUtils', () => ({
  DATA_FILE: 'mock-data.json',
  ADMIN_CONFIG_FILE: 'mock-admin.json',
  safeReadJson: jest.fn(),
  safeWriteJson: jest.fn(),
  logToFile: jest.fn(),
}));

const { safeReadJson, safeWriteJson } = require('../src/utils/fileUtils');
const { CATEGORIES, rearrangeGroups, generateGroups, rerankPlayer } = require('../src/utils/dataUtils');

const makeDefaultData = (overrides = {}) => ({
  players: [], groups: [], matches: [], currentRound: 1, roundHistory: [], matchHistory: [],
  ...overrides,
});

beforeEach(() => { jest.clearAllMocks(); });

// ─── CATEGORIES ───────────────────────────────────────────────────────────────
describe('CATEGORIES', () => {
  test('huitailang maps to 灰太狼', () => expect(CATEGORIES.huitailang).toBe('灰太狼'));
  test('xiyangyang maps to 喜羊羊', () => expect(CATEGORIES.xiyangyang).toBe('喜羊羊'));
});

// ─── rearrangeGroups ──────────────────────────────────────────────────────────
describe('rearrangeGroups', () => {
  const makeTwoGroups = () => makeDefaultData({
    groups: [
      { id: 'huitailang-group-1', level: 1, category: 'huitailang', playerIds: ['p1','p2','p3','p4'] },
      { id: 'huitailang-group-2', level: 2, category: 'huitailang', playerIds: ['p5','p6','p7','p8'] },
    ],
  });

  test('succeeds with a valid [4,4] rearrangement', () => {
    const data = makeTwoGroups();
    expect(rearrangeGroups(data, 'huitailang', [4, 4], 1).success).toBe(true);
  });

  test('preserves all player IDs after rearrangement', () => {
    const data = makeTwoGroups();
    rearrangeGroups(data, 'huitailang', [4, 4], 1);
    const all = data.groups.filter(g => g.category === 'huitailang').flatMap(g => g.playerIds);
    expect(all.sort()).toEqual(['p1','p2','p3','p4','p5','p6','p7','p8'].sort());
  });

  test('fails when newGroupSizes total does not match player count', () => {
    const data = makeDefaultData({
      groups: [{ id: 'huitailang-group-1', level: 1, category: 'huitailang', playerIds: ['p1','p2','p3','p4'] }],
    });
    const result = rearrangeGroups(data, 'huitailang', [5], 1);
    expect(result.success).toBe(false);
    expect(result.message).toContain('不匹配');
  });

  test('fails when a group size is below 4', () => {
    const data = makeTwoGroups();
    const result = rearrangeGroups(data, 'huitailang', [5, 3], 1);
    expect(result.success).toBe(false);
    expect(result.message).toContain('4-5');
  });

  test('fails when a group size is above 5', () => {
    // 9 players in three groups, one group has 6
    const data = makeDefaultData({
      groups: [
        { id: 'huitailang-group-1', level: 1, category: 'huitailang', playerIds: ['p1','p2','p3','p4','p5'] },
        { id: 'huitailang-group-2', level: 2, category: 'huitailang', playerIds: ['p6','p7','p8','p9'] },
      ],
    });
    const result = rearrangeGroups(data, 'huitailang', [9], 1);
    expect(result.success).toBe(false);
  });

  test('generates 3 matches for a single 4-player group', () => {
    const data = makeDefaultData({
      groups: [{ id: 'huitailang-group-1', level: 1, category: 'huitailang', playerIds: ['p1','p2','p3','p4'] }],
    });
    rearrangeGroups(data, 'huitailang', [4], 1);
    expect(data.matches.length).toBe(3);
  });

  test('generates 5 matches for a single 5-player group', () => {
    const data = makeDefaultData({
      groups: [{ id: 'huitailang-group-1', level: 1, category: 'huitailang', playerIds: ['p1','p2','p3','p4','p5'] }],
    });
    rearrangeGroups(data, 'huitailang', [5], 1);
    expect(data.matches.length).toBe(5);
  });

  test('generates 6 matches for two 4-player groups', () => {
    const data = makeTwoGroups();
    rearrangeGroups(data, 'huitailang', [4, 4], 1);
    expect(data.matches.length).toBe(6);
  });

  test('does not modify other category groups', () => {
    const data = makeDefaultData({
      groups: [
        { id: 'huitailang-group-1', level: 1, category: 'huitailang', playerIds: ['p1','p2','p3','p4'] },
        { id: 'xiyangyang-group-1', level: 1, category: 'xiyangyang', playerIds: ['p5','p6','p7','p8'] },
      ],
    });
    rearrangeGroups(data, 'huitailang', [4], 1);
    const xyGroup = data.groups.find(g => g.category === 'xiyangyang');
    expect(xyGroup).toBeDefined();
    expect(xyGroup.playerIds).toEqual(['p5','p6','p7','p8']);
  });

  test('removes old round matches for the category and replaces with fresh ones', () => {
    // Seed a completed round-1 match for huitailang and a xiyangyang match that must survive.
    const data = makeDefaultData({
      groups: [{ id: 'huitailang-group-1', level: 1, category: 'huitailang', playerIds: ['p1','p2','p3','p4'] }],
      matches: [
        { id: '1-huitailang-group-1-1', round: 1, groupId: 'huitailang-group-1', team1: ['p1','p2'], team2: ['p3','p4'], score1: 21, score2: 15, completed: true, timestamp: 12345 },
        { id: '1-xiyangyang-group-1-1', round: 1, groupId: 'xiyangyang-group-1', team1: [], team2: [], score1: null, score2: null, completed: false, timestamp: null },
      ],
    });
    rearrangeGroups(data, 'huitailang', [4], 1);
    // xiyangyang match is untouched
    expect(data.matches.find(m => m.id === '1-xiyangyang-group-1-1')).toBeDefined();
    // All round-1 huitailang matches are now fresh (unscored) — old completed one was replaced
    const htMatches = data.matches.filter(m => m.groupId === 'huitailang-group-1' && m.round === 1);
    expect(htMatches.length).toBe(3);
    htMatches.forEach(m => expect(m.completed).toBe(false));
  });

  test('all newly generated matches start uncompleted with null scores', () => {
    const data = makeDefaultData({
      groups: [{ id: 'huitailang-group-1', level: 1, category: 'huitailang', playerIds: ['p1','p2','p3','p4'] }],
    });
    rearrangeGroups(data, 'huitailang', [4], 1);
    data.matches.forEach(m => {
      expect(m.score1).toBeNull();
      expect(m.score2).toBeNull();
      expect(m.completed).toBe(false);
    });
  });
});

// ─── generateGroups ───────────────────────────────────────────────────────────
describe('generateGroups', () => {
  function setupMock(players) {
    safeReadJson.mockReturnValue(makeDefaultData({ players }));
    safeWriteJson.mockImplementation(() => {});
  }

  function makePlayers(n, category = 'huitailang') {
    return Array.from({ length: n }, (_, i) => ({
      id: `p${i + 1}`, name: `Player${i + 1}`, active: true, category, ranking: i + 1,
    }));
  }

  test('generates 1 group of 4 for 4 active players', () => {
    setupMock(makePlayers(4));
    generateGroups();
    const saved = safeWriteJson.mock.calls[0][1];
    expect(saved.groups.length).toBe(1);
    expect(saved.groups[0].playerIds.length).toBe(4);
  });

  test('generates 1 group of 5 for 5 active players', () => {
    setupMock(makePlayers(5));
    generateGroups();
    const saved = safeWriteJson.mock.calls[0][1];
    expect(saved.groups.length).toBe(1);
    expect(saved.groups[0].playerIds.length).toBe(5);
  });

  test('generates 2 groups of 4 for 8 active players', () => {
    setupMock(makePlayers(8));
    generateGroups();
    const saved = safeWriteJson.mock.calls[0][1];
    const htGroups = saved.groups.filter(g => g.category === 'huitailang');
    expect(htGroups.length).toBe(2);
    htGroups.forEach(g => expect(g.playerIds.length).toBe(4));
  });

  test('generates 3 groups for 12 active players', () => {
    setupMock(makePlayers(12));
    generateGroups();
    const saved = safeWriteJson.mock.calls[0][1];
    expect(saved.groups.length).toBe(3);
  });

  test('returns a warning message for fewer than 4 players', () => {
    setupMock(makePlayers(3));
    const msg = generateGroups();
    expect(msg).toContain('只有');
    expect(msg).toContain('3');
  });

  test('returns an error message for 6 players (invalid grouping count)', () => {
    setupMock(makePlayers(6));
    const msg = generateGroups();
    expect(msg).toContain('无法分组');
  });

  test('returns an error message for 7 players (invalid grouping count)', () => {
    setupMock(makePlayers(7));
    const msg = generateGroups();
    expect(msg).toContain('无法分组');
  });

  test('inactive players are excluded from groups', () => {
    const players = [
      ...makePlayers(4),
      { id: 'inactive-1', name: 'Inactive', active: false, category: 'huitailang', ranking: '-' },
    ];
    setupMock(players);
    generateGroups();
    const saved = safeWriteJson.mock.calls[0][1];
    const allIds = saved.groups.flatMap(g => g.playerIds);
    expect(allIds).not.toContain('inactive-1');
    expect(allIds.length).toBe(4);
  });
});

// ─── rerankPlayer (enable with no avgRankInCat) ───────────────────────────────
describe('rerankPlayer – enable player without average rank', () => {
  function makeStoreWithInactivePlayer() {
    return {
      players: [
        { id: 'p1', name: 'Alice', active: true,  category: 'huitailang', ranking: 1, avgRankInCat: 1.5 },
        { id: 'p2', name: 'Bob',   active: true,  category: 'huitailang', ranking: 2, avgRankInCat: 2.0 },
        { id: 'p3', name: 'Carol', active: true,  category: 'huitailang', ranking: 3, avgRankInCat: 3.0 },
        { id: 'p4', name: 'Dave',  active: false, category: 'huitailang', ranking: '-', avgRankInCat: '-' },
      ],
      groups: [], matches: [], currentRound: 1,
      roundHistory: [], matchHistory: [],
    };
  }

  test('enabling a player with no average rank places them at the end, not 1st', () => {
    const store = makeStoreWithInactivePlayer();
    safeReadJson.mockReturnValue(store);
    safeWriteJson.mockImplementation((_, data) => { Object.assign(store, data); });

    const playerIndex = store.players.findIndex(p => p.id === 'p4');
    rerankPlayer(playerIndex, null, true);

    const saved = safeWriteJson.mock.calls[safeWriteJson.mock.calls.length - 1][1];
    const dave = saved.players.find(p => p.id === 'p4');
    const activeCount = saved.players.filter(p => p.active && p.category === 'huitailang').length;

    expect(dave.active).toBe(true);
    // Dave has no avgRankInCat so must land at the end, not rank 1
    expect(dave.ranking).not.toBe(1);
    expect(dave.ranking).toBe(activeCount);
  });

  test('enabling a player with no average rank gives a valid numeric ranking', () => {
    const store = makeStoreWithInactivePlayer();
    safeReadJson.mockReturnValue(store);
    safeWriteJson.mockImplementation((_, data) => { Object.assign(store, data); });

    const playerIndex = store.players.findIndex(p => p.id === 'p4');
    rerankPlayer(playerIndex, null, true);

    const saved = safeWriteJson.mock.calls[safeWriteJson.mock.calls.length - 1][1];
    const dave = saved.players.find(p => p.id === 'p4');
    expect(typeof dave.ranking).toBe('number');
    expect(isNaN(dave.ranking)).toBe(false);
  });
});
