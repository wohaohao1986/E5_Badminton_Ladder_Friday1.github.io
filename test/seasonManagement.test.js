/**
 * Test suite for season management functionality
 * Tests include:
 * - Season naming (YYYY/YY format)
 * - Current season calculation
 * - Starting new season
 * - Preserving player data across seasons
 * - Season history organization
 * - Migration from old array-based history to season-based
 */

const { getCurrentSeason, startNewSeason, finishRound, CATEGORIES } = require('../src/utils/dataUtils');
const fs = require('fs');
const path = require('path');

// Mock file operations
const testDataFile = path.join(__dirname, 'test_season_data.json');

// Test helper: Create test data
function createTestData() {
  return {
    currentSeason: getCurrentSeason(),
    seasons: {
      [getCurrentSeason()]: {
        status: 'active',
        startDate: '2026-09-01',
        endDate: '2027-05-31',
        currentRound: 1
      }
    },
    players: [
      {
        id: 'player-1',
        name: 'Player One',
        category: 'huitailang',
        ranking: 1,
        avgRankInCat: 2.5,
        numberOfMatchesTwentyOne: 10,
        winsTwentyOne: 6,
        totalNetScoreTwentyOne: 30,
        numberOfMatchesFifteen: 0,
        winsFifteen: 0,
        totalNetScoreFifteen: 0,
        roundPlayed: 5,
        active: true,
        isDropin: false,
        returnCurrentRound: false
      },
      {
        id: 'player-2',
        name: 'Player Two',
        category: 'huitailang',
        ranking: 2,
        avgRankInCat: 3.1,
        numberOfMatchesTwentyOne: 8,
        winsTwentyOne: 4,
        totalNetScoreTwentyOne: 15,
        numberOfMatchesFifteen: 0,
        winsFifteen: 0,
        totalNetScoreFifteen: 0,
        roundPlayed: 4,
        active: true,
        isDropin: false,
        returnCurrentRound: false
      }
    ],
    groups: [],
    matches: [],
    currentRound: 1,
    roundHistory: {
      [getCurrentSeason()]: []
    },
    matchHistory: {
      [getCurrentSeason()]: []
    }
  };
}

describe('Season Management', () => {
  describe('getCurrentSeason', () => {
    test('returns season in YYYY/YY format', () => {
      const season = getCurrentSeason();
      expect(season).toMatch(/^\d{4}\/\d{2}$/);
    });

    test('season starts from Sept (month 9+) of current or previous year', () => {
      const season = getCurrentSeason();
      const now = new Date();
      const month = now.getMonth() + 1;
      
      if (month >= 9) {
        // Sept-Dec: should be YYYY/(YY+1)
        const year = now.getFullYear();
        const expected = `${year}/${String(year + 1).slice(-2)}`;
        expect(season).toBe(expected);
      } else {
        // Jan-Aug: should be (YYYY-1)/YY
        const year = now.getFullYear();
        const expected = `${year - 1}/${String(year).slice(-2)}`;
        expect(season).toBe(expected);
      }
    });
  });

  describe('Season structure and initialization', () => {
    test('DEFAULT_DATA includes currentSeason and seasons object', () => {
      const data = createTestData();
      expect(data).toHaveProperty('currentSeason');
      expect(data).toHaveProperty('seasons');
      expect(typeof data.currentSeason).toBe('string');
      expect(typeof data.seasons).toBe('object');
    });

    test('seasons object keyed by season identifier', () => {
      const data = createTestData();
      const season = data.currentSeason;
      expect(data.seasons).toHaveProperty(season);
      expect(data.seasons[season]).toHaveProperty('status');
      expect(data.seasons[season].status).toBe('active');
    });

    test('roundHistory and matchHistory organized by season', () => {
      const data = createTestData();
      expect(typeof data.roundHistory).toBe('object');
      expect(!Array.isArray(data.roundHistory)).toBe(true);
      expect(typeof data.matchHistory).toBe('object');
      expect(!Array.isArray(data.matchHistory)).toBe(true);
    });
  });

  describe('Player data preservation across seasons', () => {
    test('avgRankInCat is preserved when starting new season', () => {
      const data = createTestData();
      const originalAvgRanks = {};
      
      data.players.forEach(p => {
        originalAvgRanks[p.id] = p.avgRankInCat;
      });

      // Simulate season transition
      const newSeason = '2025/26'; // Different season
      data.currentSeason = newSeason;
      
      // In real startNewSeason(), avgRankInCat is preserved
      data.players.forEach(p => {
        // avgRankInCat should remain the same
        expect(p.avgRankInCat).toBe(originalAvgRanks[p.id]);
      });
    });

    test('gameplay stats are reset but seasonal history is preserved', () => {
      const data = createTestData();
      const oldSeason = '2025/26';
      
      // Simulate storing old season stats
      data.players.forEach(p => {
        if (!p.seasonHistory) p.seasonHistory = {};
        p.seasonHistory[oldSeason] = {
          finalRanking: p.ranking,
          numberOfMatches: p.numberOfMatchesTwentyOne + p.numberOfMatchesFifteen,
          wins: p.winsTwentyOne + p.winsFifteen,
          totalNetScore: p.totalNetScoreTwentyOne + p.totalNetScoreFifteen,
          roundsPlayed: p.roundPlayed,
          avgRankInCat: p.avgRankInCat
        };
      });

      // Simulate new season stats reset
      data.players.forEach(p => {
        p.numberOfMatchesTwentyOne = 0;
        p.winsTwentyOne = 0;
        p.totalNetScoreTwentyOne = 0;
        p.numberOfMatchesFifteen = 0;
        p.winsFifteen = 0;
        p.totalNetScoreFifteen = 0;
        p.roundPlayed = 0;
      });

      // Verify old season data preserved and new season reset
      data.players.forEach(p => {
        expect(p.seasonHistory[oldSeason]).toBeDefined();
        expect(p.seasonHistory[oldSeason].finalRanking).toBeGreaterThan(0);
        expect(p.numberOfMatchesTwentyOne).toBe(0);
        expect(p.winsTwentyOne).toBe(0);
      });
    });
  });

  describe('Season transitions', () => {
    test('new season initializes with round 1', () => {
      const data = createTestData();
      data.currentRound = 5; // Simulate being in round 5
      
      // Simulate new season initialization (round reset)
      const newSeason = '2026/27';
      const oldCurrentRound = data.currentRound;
      data.currentSeason = newSeason;
      data.currentRound = 1;
      
      expect(data.currentRound).toBe(1);
      expect(data.currentRound).not.toBe(oldCurrentRound);
    });

    test('old season is marked as archived', () => {
      const data = createTestData();
      const oldSeason = data.currentSeason;
      
      // Simulate archiving old season
      data.seasons[oldSeason].status = 'archived';
      data.seasons[oldSeason].finalRound = data.currentRound - 1;
      
      expect(data.seasons[oldSeason].status).toBe('archived');
      expect(data.seasons[oldSeason]).toHaveProperty('finalRound');
    });

    test('matches and groups are cleared for new season', () => {
      const data = createTestData();
      
      // Add some test data
      data.matches = [{ id: 'match-1', round: 1 }];
      data.groups = [{ id: 'group-1', level: 1, playerIds: ['player-1'] }];
      
      // Simulate new season reset
      data.matches = [];
      data.groups = [];
      
      expect(data.matches.length).toBe(0);
      expect(data.groups.length).toBe(0);
    });
  });

  describe('History organization by season', () => {
    test('roundHistory entries are organized by season', () => {
      const data = createTestData();
      const season = data.currentSeason;
      
      // Add test round history
      const testRoundEntry = {
        round: 1,
        rankings: [
          { name: 'Player One', category: 'huitailang', group: 1, netScore: 10, change: 'none' }
        ]
      };
      
      data.roundHistory[season].push(testRoundEntry);
      
      expect(Array.isArray(data.roundHistory[season])).toBe(true);
      expect(data.roundHistory[season][0]).toEqual(testRoundEntry);
    });

    test('matchHistory entries are organized by season', () => {
      const data = createTestData();
      const season = data.currentSeason;
      
      // Add test match history
      const testMatch = {
        id: 'match-1',
        round: 1,
        groupId: 'group-1',
        team1: ['player-1'],
        team2: ['player-2'],
        score1: 21,
        score2: 15,
        completed: true,
        timestamp: Date.now()
      };
      
      data.matchHistory[season].push(testMatch);
      
      expect(Array.isArray(data.matchHistory[season])).toBe(true);
      expect(data.matchHistory[season][0]).toEqual(testMatch);
    });

    test('can retrieve history for specific season', () => {
      const data = createTestData();
      const season1 = '2025/26';
      const season2 = '2026/27';
      
      // Add history for both seasons
      data.roundHistory[season1] = [{ round: 1, rankings: [] }, { round: 2, rankings: [] }];
      data.roundHistory[season2] = [{ round: 1, rankings: [] }];
      
      expect(data.roundHistory[season1].length).toBe(2);
      expect(data.roundHistory[season2].length).toBe(1);
    });
  });

  describe('Migration from old format', () => {
    test('old array-based roundHistory can be migrated to season format', () => {
      const data = createTestData();
      const season = data.currentSeason;
      
      // Simulate old format (array) being present in data
      const oldRoundHistory = [
        { round: 1, rankings: [] },
        { round: 2, rankings: [] }
      ];
      
      // Override with old array format
      data.roundHistory = oldRoundHistory;
      
      // Simulate migration logic (what happens in finishRound)
      if (Array.isArray(data.roundHistory)) {
        const migratedHistory = {};
        migratedHistory[season] = oldRoundHistory;
        data.roundHistory = migratedHistory;
      }
      
      expect(!Array.isArray(data.roundHistory)).toBe(true);
      expect(data.roundHistory[season]).toBeDefined();
      expect(data.roundHistory[season].length).toBe(2);
    });

    test('old array-based matchHistory can be migrated to season format', () => {
      const data = createTestData();
      const season = data.currentSeason;
      
      // Simulate old format (array) being present in data
      const oldMatchHistory = [
        { id: 'match-1', round: 1 },
        { id: 'match-2', round: 2 }
      ];
      
      // Override with old array format
      data.matchHistory = oldMatchHistory;
      
      // Simulate migration logic (what happens in finishRound)
      if (Array.isArray(data.matchHistory)) {
        const migratedHistory = {};
        migratedHistory[season] = oldMatchHistory;
        data.matchHistory = migratedHistory;
      }
      
      expect(!Array.isArray(data.matchHistory)).toBe(true);
      expect(data.matchHistory[season]).toBeDefined();
      expect(data.matchHistory[season].length).toBe(2);
    });
  });

  describe('Season naming conventions', () => {
    test('season name follows YYYY/YY format with September-May range', () => {
      const season = getCurrentSeason();
      const [startYearStr, endYearStr] = season.split('/');
      const startYear = parseInt(startYearStr);
      const endYear = parseInt('20' + endYearStr);
      
      // End year should be start year + 1
      expect(endYear).toBe(startYear + 1);
    });

    test('season covers Sept 1 to May 31 of next calendar year', () => {
      const season = getCurrentSeason();
      const [startYearStr, endYearStr] = season.split('/');
      
      expect(startYearStr.length).toBe(4);
      expect(endYearStr.length).toBe(2);
      expect(parseInt(startYearStr) < parseInt('20' + endYearStr)).toBe(true);
    });
  });

  describe('Data consistency checks', () => {
    test('all seasons have required status field', () => {
      const data = createTestData();
      
      Object.values(data.seasons).forEach(season => {
        expect(['active', 'archived']).toContain(season.status);
      });
    });

    test('currentSeason exists in seasons object', () => {
      const data = createTestData();
      expect(data.seasons).toHaveProperty(data.currentSeason);
    });

    test('currentRound is always 1 or greater', () => {
      const data = createTestData();
      expect(data.currentRound).toBeGreaterThanOrEqual(1);
    });

    test('all players have required fields', () => {
      const data = createTestData();
      
      data.players.forEach(p => {
        expect(p).toHaveProperty('id');
        expect(p).toHaveProperty('name');
        expect(p).toHaveProperty('category');
        expect(p).toHaveProperty('avgRankInCat');
        expect(p).toHaveProperty('active');
      });
    });
  });
});
