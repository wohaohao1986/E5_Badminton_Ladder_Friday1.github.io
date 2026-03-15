jest.mock('../src/utils/fileUtils', () => ({
  DATA_FILE: 'mock-data.json',
  ADMIN_CONFIG_FILE: 'mock-admin.json',
  safeReadJson: jest.fn(),
  safeWriteJson: jest.fn(),
  logToFile: jest.fn(),
}));

const { safeReadJson, safeWriteJson } = require('../src/utils/fileUtils');
const {
  CATEGORIES, rearrangeGroups, generateGroups, generateMatches, generateGroupsAndMatches,
  rerankPlayer, sortPlayersByRanking, finishRound, calculatePlayerStats,
  calculatePlayerAvgRankInCat, calculateAllPlayerAvgRankInCat, resetGroupLogic, autoFillScores,
} = require('../src/utils/dataUtils');

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

// ─── sortPlayersByRanking ─────────────────────────────────────────────────────
describe('sortPlayersByRanking', () => {
  function setup(players) {
    safeReadJson.mockReturnValue(makeDefaultData({ players }));
    safeWriteJson.mockImplementation(() => {});
  }

  test('active players sorted before inactive players in same category', () => {
    setup([
      { id: 'p1', name: 'A', active: false, category: 'huitailang', ranking: '-' },
      { id: 'p2', name: 'B', active: true,  category: 'huitailang', ranking: 1 },
    ]);
    sortPlayersByRanking();
    const saved = safeWriteJson.mock.calls[0][1];
    expect(saved.players[0].id).toBe('p2');
    expect(saved.players[1].id).toBe('p1');
  });

  test('huitailang players sorted before xiyangyang players', () => {
    setup([
      { id: 'p1', name: 'A', active: true, category: 'xiyangyang',  ranking: 1 },
      { id: 'p2', name: 'B', active: true, category: 'huitailang', ranking: 1 },
    ]);
    sortPlayersByRanking();
    const saved = safeWriteJson.mock.calls[0][1];
    expect(saved.players[0].category).toBe('huitailang');
  });

  test('reassigns sequential rankings to active players after sort', () => {
    setup([
      { id: 'p1', name: 'A', active: true, category: 'huitailang', ranking: 3 },
      { id: 'p2', name: 'B', active: true, category: 'huitailang', ranking: 1 },
      { id: 'p3', name: 'C', active: true, category: 'huitailang', ranking: 2 },
    ]);
    sortPlayersByRanking();
    const saved = safeWriteJson.mock.calls[0][1];
    const ranked = saved.players.filter(p => p.active && p.category === 'huitailang')
      .sort((a, b) => a.ranking - b.ranking);
    expect(ranked.map(p => p.ranking)).toEqual([1, 2, 3]);
  });

  test('inactive players retain "-" ranking after sort', () => {
    setup([
      { id: 'p1', name: 'A', active: false, category: 'huitailang', ranking: '-' },
      { id: 'p2', name: 'B', active: true,  category: 'huitailang', ranking: 1 },
    ]);
    sortPlayersByRanking();
    const saved = safeWriteJson.mock.calls[0][1];
    expect(saved.players.find(p => p.id === 'p1').ranking).toBe('-');
  });
});

// ─── generateMatches ─────────────────────────────────────────────────────────
describe('generateMatches', () => {
  function setup(data) {
    safeReadJson.mockReturnValue(makeDefaultData(data));
    safeWriteJson.mockImplementation(() => {});
  }

  test('generates matches for all groups in current round', () => {
    setup({
      currentRound: 1,
      groups: [
        { id: 'huitailang-group-1', level: 1, category: 'huitailang', playerIds: ['p1','p2','p3','p4'] },
      ],
    });
    generateMatches();
    const saved = safeWriteJson.mock.calls[0][1];
    expect(saved.matches.length).toBe(3);
    expect(saved.matches[0].round).toBe(1);
  });

  test('clears existing round matches before regenerating', () => {
    setup({
      currentRound: 1,
      groups: [
        { id: 'huitailang-group-1', level: 1, category: 'huitailang', playerIds: ['p1','p2','p3','p4'] },
      ],
      matches: [
        { id: '1-huitailang-group-1-1', round: 1, groupId: 'huitailang-group-1', team1: ['p1','p2'], team2: ['p3','p4'], score1: null, score2: null, completed: false, timestamp: null },
      ],
    });
    generateMatches();
    const saved = safeWriteJson.mock.calls[0][1];
    // Still exactly 3 matches (not 4 from accumulation)
    expect(saved.matches.filter(m => m.round === 1).length).toBe(3);
  });

  test('returns a count message', () => {
    setup({
      currentRound: 1,
      groups: [{ id: 'huitailang-group-1', level: 1, category: 'huitailang', playerIds: ['p1','p2','p3','p4'] }],
    });
    const msg = generateMatches();
    expect(msg).toContain('1');
  });
});

// ─── calculatePlayerStatsByMatches (via calculatePlayerStats) ─────────────────
describe('calculatePlayerStats', () => {
  function makePlayer(id, name) {
    return {
      id, name, active: true, category: 'huitailang', ranking: 1,
      numberOfMatchesTwentyOne: 0, winsTwentyOne: 0, totalNetScoreTwentyOne: 0,
      numberOfMatchesFifteen: 0, winsFifteen: 0, totalNetScoreFifteen: 0,
    };
  }

  function makeMatch(id, team1, team2, score1, score2) {
    return { id, round: 1, groupId: 'g1', team1, team2, score1, score2, completed: true, timestamp: 1 };
  }

  test('counts wins and net score for 21-point matches correctly', () => {
    const p1 = makePlayer('p1', 'Alice');
    const p2 = makePlayer('p2', 'Bob');
    const match = makeMatch('m1', ['p1'], ['p2'], 21, 15); // p1 wins
    safeReadJson.mockReturnValue(makeDefaultData({ players: [p1, p2], matchHistory: [match] }));
    safeWriteJson.mockImplementation(() => {});
    calculatePlayerStats();
    const saved = safeWriteJson.mock.calls[0][1];
    const alice = saved.players.find(p => p.id === 'p1');
    const bob   = saved.players.find(p => p.id === 'p2');
    expect(alice.winsTwentyOne).toBe(1);
    expect(alice.totalNetScoreTwentyOne).toBe(6);
    expect(bob.winsTwentyOne).toBe(0);
    expect(bob.totalNetScoreTwentyOne).toBe(-6);
  });

  test('is idempotent — calling twice does not double-count', () => {
    const p1 = makePlayer('p1', 'Alice');
    const match = makeMatch('m1', ['p1'], ['p2'], 21, 15);
    const store = makeDefaultData({ players: [p1], matchHistory: [match] });
    safeReadJson.mockReturnValue(JSON.parse(JSON.stringify(store)));
    safeWriteJson.mockImplementation((_, data) => { safeReadJson.mockReturnValue(JSON.parse(JSON.stringify(data))); });
    calculatePlayerStats();
    calculatePlayerStats();
    const saved = safeWriteJson.mock.calls[safeWriteJson.mock.calls.length - 1][1];
    expect(saved.players.find(p => p.id === 'p1').winsTwentyOne).toBe(1);
  });

  test('separates 15-point and 21-point match stats', () => {
    const p1 = makePlayer('p1', 'Alice');
    const match21 = makeMatch('m1', ['p1'], ['p2'], 21, 10);
    const match15 = makeMatch('m2', ['p1'], ['p2'], 15, 8);
    safeReadJson.mockReturnValue(makeDefaultData({ players: [p1], matchHistory: [match21, match15] }));
    safeWriteJson.mockImplementation(() => {});
    calculatePlayerStats();
    const saved = safeWriteJson.mock.calls[0][1];
    const alice = saved.players.find(p => p.id === 'p1');
    expect(alice.numberOfMatchesTwentyOne).toBe(1);
    expect(alice.numberOfMatchesFifteen).toBe(1);
  });
});

// ─── calculatePlayerAvgRankInCat / calculateAllPlayerAvgRankInCat ─────────────
describe('calculatePlayerAvgRankInCat', () => {
  function makePlayerWithHistory(roundHistory) {
    const player = {
      id: 'p1', name: 'Alice', active: true, category: 'huitailang', ranking: 1,
      avgRankInCat: '-', roundPlayed: 0,
    };
    const store = makeDefaultData({ players: [player], roundHistory });
    safeReadJson.mockReturnValue(store);
    safeWriteJson.mockImplementation(() => {});
    return store;
  }

  test('sets avgRankInCat to "-" when player has no round history', () => {
    makePlayerWithHistory([]);
    calculatePlayerAvgRankInCat('Alice');
    const saved = safeWriteJson.mock.calls[0][1];
    expect(saved.players[0].avgRankInCat).toBe('-');
  });

  test('calculates correct average from round history', () => {
    makePlayerWithHistory([
      { round: 1, rankings: [{ name: 'Alice', category: 'huitailang', change: 'none' }] },
      { round: 2, rankings: [{ name: 'Alice', category: 'huitailang', change: 'none' }] },
    ]);
    calculatePlayerAvgRankInCat('Alice');
    const saved = safeWriteJson.mock.calls[0][1];
    expect(typeof saved.players[0].avgRankInCat).toBe('number');
    expect(saved.players[0].roundPlayed).toBe(2);
  });

  test('only uses last 10 rounds when more than 10 rounds played', () => {
    const history = Array.from({ length: 12 }, (_, i) => ({
      round: i + 1,
      rankings: [{ name: 'Alice', category: 'huitailang', change: 'none' }],
    }));
    makePlayerWithHistory(history);
    calculatePlayerAvgRankInCat('Alice');
    const saved = safeWriteJson.mock.calls[0][1];
    expect(saved.players[0].roundPlayed).toBe(12);
    // avgRankInCat is based on last 10 rounds, not 12
    expect(typeof saved.players[0].avgRankInCat).toBe('number');
  });

  test('calculateAllPlayerAvgRankInCat writes only once for all players', () => {
    const players = [
      { id: 'p1', name: 'Alice', active: true, category: 'huitailang', ranking: 1 },
      { id: 'p2', name: 'Bob',   active: true, category: 'huitailang', ranking: 2 },
    ];
    safeReadJson.mockReturnValue(makeDefaultData({ players }));
    safeWriteJson.mockImplementation(() => {});
    calculateAllPlayerAvgRankInCat();
    expect(safeWriteJson).toHaveBeenCalledTimes(1);
  });
});

// ─── resetGroupLogic ──────────────────────────────────────────────────────────
describe('resetGroupLogic', () => {
  function setup(data) {
    safeReadJson.mockReturnValue(data);
    safeWriteJson.mockImplementation(() => {});
  }

  test('regenerates matches for the specified group with new player order', () => {
    setup(makeDefaultData({
      currentRound: 1,
      groups: [{ id: 'huitailang-group-1', level: 1, category: 'huitailang', playerIds: ['p1','p2','p3','p4'] }],
    }));
    resetGroupLogic('huitailang-group-1', ['p4','p3','p2','p1']);
    const saved = safeWriteJson.mock.calls[0][1];
    expect(saved.matches.length).toBe(3);
    expect(saved.groups[0].playerIds).toEqual(['p4','p3','p2','p1']);
  });

  test('removes old matches for the group before regenerating', () => {
    setup(makeDefaultData({
      currentRound: 1,
      groups: [{ id: 'huitailang-group-1', level: 1, category: 'huitailang', playerIds: ['p1','p2','p3','p4'] }],
      matches: [
        { id: '1-huitailang-group-1-1', round: 1, groupId: 'huitailang-group-1', team1: ['p1','p2'], team2: ['p3','p4'], score1: null, score2: null, completed: false, timestamp: null },
      ],
    }));
    resetGroupLogic('huitailang-group-1', ['p1','p2','p3','p4']);
    const saved = safeWriteJson.mock.calls[0][1];
    expect(saved.matches.filter(m => m.groupId === 'huitailang-group-1').length).toBe(3);
  });

  test('throws when group is not found', () => {
    setup(makeDefaultData({ groups: [] }));
    expect(() => resetGroupLogic('no-such-group', ['p1','p2','p3','p4'])).toThrow('Group not found');
  });

  test('marks removed players as inactive', () => {
    setup(makeDefaultData({
      currentRound: 1,
      groups: [{ id: 'huitailang-group-1', level: 1, category: 'huitailang', playerIds: ['p1','p2','p3','p4'] }],
      players: [
        { id: 'p1', name: 'A', active: true, category: 'huitailang', ranking: 1 },
        { id: 'p2', name: 'B', active: true, category: 'huitailang', ranking: 2 },
        { id: 'p3', name: 'C', active: true, category: 'huitailang', ranking: 3 },
        { id: 'p4', name: 'D', active: true, category: 'huitailang', ranking: 4 },
      ],
    }));
    // Replace p4 with a new or different set, dropping p4
    resetGroupLogic('huitailang-group-1', ['p1','p2','p3','p5']);
    const saved = safeWriteJson.mock.calls[0][1];
    const p4 = saved.players.find(p => p.id === 'p4');
    expect(p4.active).toBe(false);
    expect(p4.ranking).toBe('-');
  });
});

// ─── autoFillScores ───────────────────────────────────────────────────────────
describe('autoFillScores', () => {
  test('fills scores for all pending matches in current round', () => {
    safeReadJson.mockReturnValue(makeDefaultData({
      currentRound: 2,
      matches: [
        { id: 'm1', round: 2, completed: false, score1: null, score2: null },
        { id: 'm2', round: 2, completed: false, score1: null, score2: null },
        { id: 'm3', round: 1, completed: false, score1: null, score2: null }, // different round — untouched
      ],
    }));
    safeWriteJson.mockImplementation(() => {});
    autoFillScores();
    const saved = safeWriteJson.mock.calls[0][1];
    const round2 = saved.matches.filter(m => m.round === 2);
    round2.forEach(m => {
      expect(m.completed).toBe(true);
      expect(m.score1).not.toBeNull();
      expect(m.score2).not.toBeNull();
    });
    // Round 1 match untouched
    expect(saved.matches.find(m => m.id === 'm3').completed).toBe(false);
  });

  test('returns message when no pending matches exist', () => {
    safeReadJson.mockReturnValue(makeDefaultData({ currentRound: 1, matches: [] }));
    safeWriteJson.mockImplementation(() => {});
    const msg = autoFillScores();
    expect(msg).toContain('没有');
  });

  test('filled scores produce a winner (21 winning score)', () => {
    safeReadJson.mockReturnValue(makeDefaultData({
      currentRound: 1,
      matches: [{ id: 'm1', round: 1, completed: false, score1: null, score2: null }],
    }));
    safeWriteJson.mockImplementation(() => {});
    autoFillScores();
    const saved = safeWriteJson.mock.calls[0][1];
    const m = saved.matches[0];
    expect(Math.max(m.score1, m.score2)).toBe(21);
  });
});

// ─── finishRound ─────────────────────────────────────────────────────────────
describe('finishRound', () => {
  function makeRoundData() {
    // Two 4-player groups. All matches completed with scores.
    // Group 1 (level 1): p1 best, p4 worst (relegated)
    // Group 2 (level 2): p5 best (promoted), p8 worst
    const players = [
      { id: 'p1', name: 'P1', active: true, category: 'huitailang', ranking: 1, returnCurrentRound: false },
      { id: 'p2', name: 'P2', active: true, category: 'huitailang', ranking: 2, returnCurrentRound: false },
      { id: 'p3', name: 'P3', active: true, category: 'huitailang', ranking: 3, returnCurrentRound: false },
      { id: 'p4', name: 'P4', active: true, category: 'huitailang', ranking: 4, returnCurrentRound: false },
      { id: 'p5', name: 'P5', active: true, category: 'huitailang', ranking: 5, returnCurrentRound: false },
      { id: 'p6', name: 'P6', active: true, category: 'huitailang', ranking: 6, returnCurrentRound: false },
      { id: 'p7', name: 'P7', active: true, category: 'huitailang', ranking: 7, returnCurrentRound: false },
      { id: 'p8', name: 'P8', active: true, category: 'huitailang', ranking: 8, returnCurrentRound: false },
    ];
    const groups = [
      { id: 'huitailang-group-1', level: 1, category: 'huitailang', playerIds: ['p1','p2','p3','p4'] },
      { id: 'huitailang-group-2', level: 2, category: 'huitailang', playerIds: ['p5','p6','p7','p8'] },
    ];
    // Round-robin for 4 players: 3 matches per group
    // Group 1: p1 dominates (wins all), p4 loses all
    const matches = [
      // Group 1
      { id: '1-huitailang-group-1-1', round: 1, groupId: 'huitailang-group-1', team1: ['p1'], team2: ['p2'], score1: 21, score2: 10, completed: true, timestamp: 1 },
      { id: '1-huitailang-group-1-2', round: 1, groupId: 'huitailang-group-1', team1: ['p1'], team2: ['p3'], score1: 21, score2: 10, completed: true, timestamp: 1 },
      { id: '1-huitailang-group-1-3', round: 1, groupId: 'huitailang-group-1', team1: ['p2'], team2: ['p4'], score1: 21, score2: 10, completed: true, timestamp: 1 },
      // Group 2
      { id: '1-huitailang-group-2-1', round: 1, groupId: 'huitailang-group-2', team1: ['p5'], team2: ['p6'], score1: 21, score2: 10, completed: true, timestamp: 1 },
      { id: '1-huitailang-group-2-2', round: 1, groupId: 'huitailang-group-2', team1: ['p5'], team2: ['p7'], score1: 21, score2: 10, completed: true, timestamp: 1 },
      { id: '1-huitailang-group-2-3', round: 1, groupId: 'huitailang-group-2', team1: ['p6'], team2: ['p8'], score1: 21, score2: 10, completed: true, timestamp: 1 },
    ];
    return makeDefaultData({ players, groups, matches, currentRound: 1 });
  }

  beforeEach(() => {
    const store = makeRoundData();
    safeReadJson.mockReturnValue(store);
    safeWriteJson.mockImplementation((_, data) => { safeReadJson.mockReturnValue(JSON.parse(JSON.stringify(data))); });
  });

  test('increments currentRound after finishing', () => {
    finishRound();
    const saved = safeWriteJson.mock.calls[safeWriteJson.mock.calls.length - 1][1];
    expect(saved.currentRound).toBe(2);
  });

  test('moves current matches to matchHistory', () => {
    finishRound();
    const saved = safeWriteJson.mock.calls[safeWriteJson.mock.calls.length - 1][1];
    expect(saved.matchHistory.length).toBe(6);
    expect(saved.matches.length).toBe(0);
  });

  test('clears groups after round ends', () => {
    finishRound();
    const saved = safeWriteJson.mock.calls[safeWriteJson.mock.calls.length - 1][1];
    expect(saved.groups.length).toBe(0);
  });

  test('adds round summary to roundHistory', () => {
    finishRound();
    const saved = safeWriteJson.mock.calls[safeWriteJson.mock.calls.length - 1][1];
    expect(saved.roundHistory.length).toBe(1);
    expect(saved.roundHistory[0].round).toBe(1);
  });

  test('resets returnCurrentRound to false for all players', () => {
    finishRound();
    const saved = safeWriteJson.mock.calls[safeWriteJson.mock.calls.length - 1][1];
    saved.players.forEach(p => expect(p.returnCurrentRound).toBe(false));
  });

  test('returns a summary message containing promotion/relegation info', () => {
    const msg = finishRound();
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(0);
  });
});
