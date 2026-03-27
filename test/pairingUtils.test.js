'use strict';

const {
  generateMalesPlan,
  generateFemalesPlan,
  generateFemalesPlanReduced,
  generateCrossPlan,
  generateFullPlan,
  generateAlternativePlans,
  generateNTeamPlan
} = require('../src/utils/pairingUtils');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Count appearances of every player code in an array of matches */
function countAppearances(matches) {
  const counts = {};
  for (const m of matches) {
    for (const code of [...m.team1, ...m.team2]) {
      counts[code] = (counts[code] || 0) + 1;
    }
  }
  return counts;
}

/** Rank sum for a 2-player team (codes like "A3", "BM2", "AF1", "AF4G1") */
function rankSum(team) {
  return team.reduce((s, c) => {
    // Strip optional Gn group suffix before extracting rank index
    const stripped = c.replace(/G\d+$/, '');
    const match = stripped.match(/(\d+)$/);
    return s + (match ? parseInt(match[1]) : 0);
  }, 0);
}

/** Absolute rank imbalance for a match (|sum1 - sum2|) */
function rankImbalance(match) {
  return Math.abs(rankSum(match.team1) - rankSum(match.team2));
}

function canonicalTeamKey(team) {
  return (Array.isArray(team) ? [...team] : []).map(String).sort().join('+');
}

function canonicalMatchesKey(matches) {
  return (Array.isArray(matches) ? matches : [])
    .map(m => `${canonicalTeamKey(m.team1)}|${canonicalTeamKey(m.team2)}`)
    .sort()
    .join('||');
}

function canonicalPlanSignature(plan) {
  return JSON.stringify({
    males: canonicalMatchesKey(plan.males_matches),
    females: canonicalMatchesKey(plan.females_matches),
    cross: canonicalMatchesKey(plan.cross_matches)
  });
}

// ---------------------------------------------------------------------------
// generateMalesPlan
// ---------------------------------------------------------------------------

describe('generateMalesPlan', () => {
  test('returns empty array for n < 2', () => {
    expect(generateMalesPlan(0)).toEqual([]);
    expect(generateMalesPlan(1)).toEqual([]);
  });

  test.each([2, 3, 4, 5, 6, 8])('n=%i produces C(n,2) matches', n => {
    const matches = generateMalesPlan(n);
    const expected = (n * (n - 1)) / 2;
    expect(matches).toHaveLength(expected);
  });

  test.each([2, 3, 4, 5, 6, 8])('n=%i: every match has team1 of 2 A codes and team2 of 2 B codes', n => {
    for (const m of generateMalesPlan(n)) {
      expect(m.team1).toHaveLength(2);
      expect(m.team2).toHaveLength(2);
      expect(m.team1.every(c => /^A\d+$/.test(c))).toBe(true);
      expect(m.team2.every(c => /^B\d+$/.test(c))).toBe(true);
    }
  });

  test.each([4, 5, 6, 8])('n=%i: each A player appears exactly n-1 times', n => {
    const counts = countAppearances(generateMalesPlan(n));
    for (let i = 1; i <= n; i++) {
      expect(counts[`A${i}`]).toBe(n - 1);
    }
  });

  test.each([4, 5, 6, 8])('n=%i: all C(n,2) A-partner pairs covered exactly once', n => {
    const matches = generateMalesPlan(n);
    const aPairs = new Set();
    for (const m of matches) {
      const ranks = m.team1.map(c => parseInt(c.slice(1))).sort((a, b) => a - b);
      const key = ranks.join('-');
      expect(aPairs.has(key)).toBe(false); // no repeats
      aPairs.add(key);
    }
    expect(aPairs.size).toBe((n * (n - 1)) / 2);
  });

  test.each([4, 5, 6, 8])('n=%i: all C(n,2) B-partner pairs used exactly once', n => {
    const matches = generateMalesPlan(n);
    const bPairs = new Set();
    for (const m of matches) {
      const ranks = m.team2.map(c => parseInt(c.slice(1))).sort((a, b) => a - b);
      const key = ranks.join('-');
      expect(bPairs.has(key)).toBe(false);
      bPairs.add(key);
    }
    expect(bPairs.size).toBe((n * (n - 1)) / 2);
  });

  test('n=6: all matches are perfectly rank-balanced (diff = 0)', () => {
    const matches = generateMalesPlan(6);
    for (const m of matches) {
      expect(rankImbalance(m)).toBe(0);
    }
  });

  test('n=4: all matches are perfectly rank-balanced', () => {
    for (const m of generateMalesPlan(4)) {
      expect(rankImbalance(m)).toBe(0);
    }
  });

  test('max rank imbalance stays small for n=8', () => {
    const maxDiff = Math.max(...generateMalesPlan(8).map(rankImbalance));
    expect(maxDiff).toBeLessThanOrEqual(4);
  });
});

// ---------------------------------------------------------------------------
// generateFemalesPlan (alias of generateMalesPlan with same logic)
// ---------------------------------------------------------------------------

describe('generateFemalesPlan', () => {
  test.each([4, 5, 6])('n=%i: produces C(n,2) matches with balanced codes', n => {
    const matches = generateFemalesPlan(n);
    expect(matches).toHaveLength((n * (n - 1)) / 2);
    for (const m of matches) {
      expect(m.team1.every(c => /^A\d+$/.test(c))).toBe(true);
      expect(m.team2.every(c => /^B\d+$/.test(c))).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// generateFemalesPlanReduced
// ---------------------------------------------------------------------------

describe('generateFemalesPlanReduced', () => {
  test('returns empty array for n < 2', () => {
    expect(generateFemalesPlanReduced(1)).toEqual([]);
  });

  test.each([4, 5, 6, 8])('n=%i: each player appears at most 3 times (default)', n => {
    const counts = countAppearances(generateFemalesPlanReduced(n));
    for (const [, count] of Object.entries(counts)) {
      expect(count).toBeLessThanOrEqual(3);
    }
  });

  test('n=6: produces a reasonable number of matches (>= 6)', () => {
    // Algorithm caps both A and B appearances at maxAppearances; exact count
    // depends on how many balanced B pairs remain available.
    expect(generateFemalesPlanReduced(6).length).toBeGreaterThanOrEqual(6);
  });

  test('n=6: all players appearing >0 times appear at most 3 times', () => {
    const counts = countAppearances(generateFemalesPlanReduced(6));
    for (const [, count] of Object.entries(counts)) {
      expect(count).toBeLessThanOrEqual(3);
    }
  });

  test('customising maxAppearances=2 limits appearances', () => {
    const counts = countAppearances(generateFemalesPlanReduced(6, 2));
    for (const [, count] of Object.entries(counts)) {
      expect(count).toBeLessThanOrEqual(2);
    }
  });

  test('codes are A/B prefixed with rank numbers', () => {
    for (const m of generateFemalesPlanReduced(6)) {
      expect(m.team1.every(c => /^A\d+$/.test(c))).toBe(true);
      expect(m.team2.every(c => /^B\d+$/.test(c))).toBe(true);
    }
  });

  test('no repeated A-partner pairs', () => {
    const matches = generateFemalesPlanReduced(6);
    const aPairs = new Set();
    for (const m of matches) {
      const key = m.team1.map(c => parseInt(c.slice(1))).sort((a, b) => a - b).join('-');
      expect(aPairs.has(key)).toBe(false);
      aPairs.add(key);
    }
  });
});

// ---------------------------------------------------------------------------
// generateCrossPlan
// ---------------------------------------------------------------------------

describe('generateCrossPlan', () => {
  test('returns empty array when nM < 1 or nF < 1', () => {
    expect(generateCrossPlan(0, 3)).toEqual([]);
    expect(generateCrossPlan(3, 0)).toEqual([]);
  });

  test.each([
    [6, 3],
    [3, 6],
    [4, 4],
    [3, 3],
    [4, 3],
    [5, 2]
  ])('nM=%i nF=%i: produces max(nM,nF) matches', (nM, nF) => {
    expect(generateCrossPlan(nM, nF)).toHaveLength(Math.max(nM, nF));
  });

  test.each([
    [6, 3],
    [4, 4],
    [3, 3]
  ])('nM=%i nF=%i: valid AM/AF/BM/BF codes in range', (nM, nF) => {
    for (const m of generateCrossPlan(nM, nF)) {
      const [am, af] = m.team1;
      const [bm, bf] = m.team2;
      expect(am).toMatch(/^AM\d+$/); expect(parseInt(am.slice(2))).toBeGreaterThanOrEqual(1); expect(parseInt(am.slice(2))).toBeLessThanOrEqual(nM);
      expect(af).toMatch(/^AF\d+$/); expect(parseInt(af.slice(2))).toBeGreaterThanOrEqual(1); expect(parseInt(af.slice(2))).toBeLessThanOrEqual(nF);
      expect(bm).toMatch(/^BM\d+$/); expect(parseInt(bm.slice(2))).toBeGreaterThanOrEqual(1); expect(parseInt(bm.slice(2))).toBeLessThanOrEqual(nM);
      expect(bf).toMatch(/^BF\d+$/); expect(parseInt(bf.slice(2))).toBeGreaterThanOrEqual(1); expect(parseInt(bf.slice(2))).toBeLessThanOrEqual(nF);
    }
  });

  test('nM=6 nF=3: no repeated B-team combinations', () => {
    const matches = generateCrossPlan(6, 3);
    const bTeams = new Set(matches.map(m => m.team2.join('+')));
    expect(bTeams.size).toBe(matches.length);
  });

  test('nM=6 nF=3: each BM player appears at most twice', () => {
    const counts = countAppearances(generateCrossPlan(6, 3));
    for (let i = 1; i <= 6; i++) {
      expect(counts[`BM${i}`] || 0).toBeLessThanOrEqual(2);
    }
  });

  test('nM=6 nF=3: rank imbalance per match is 0', () => {
    for (const m of generateCrossPlan(6, 3)) {
      expect(rankImbalance(m)).toBe(0);
    }
  });

  test('nM=4 nF=4: rank imbalance per match is 0', () => {
    for (const m of generateCrossPlan(4, 4)) {
      expect(rankImbalance(m)).toBe(0);
    }
  });

  test('all players appear at least once (nM=6 nF=3)', () => {
    const counts = countAppearances(generateCrossPlan(6, 3));
    for (let i = 1; i <= 6; i++) expect(counts[`AM${i}`] || 0).toBeGreaterThanOrEqual(1);
    for (let i = 1; i <= 3; i++) expect(counts[`AF${i}`] || 0).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// generateCrossPlan — femaleOffset and femaleGroupId options
// ---------------------------------------------------------------------------

describe('generateCrossPlan — femaleOffset option', () => {
  test('femaleOffset shifts AF/BF codes by the given amount', () => {
    const matches = generateCrossPlan(6, 3, { femaleOffset: 3 });
    for (const m of matches) {
      const af = m.team1[1]; const bf = m.team2[1];
      expect(af).toMatch(/^AF[4-6]$/);
      expect(bf).toMatch(/^BF[4-6]$/);
    }
  });

  test('femaleOffset=0 produces the same codes as no offset', () => {
    const withZero = generateCrossPlan(6, 3, { femaleOffset: 0 });
    const noOption = generateCrossPlan(6, 3);
    expect(withZero).toEqual(noOption);
  });

  test('femaleGroupId appends G-suffix to AF/BF codes', () => {
    const matches = generateCrossPlan(6, 3, { femaleGroupId: 1 });
    for (const m of matches) {
      expect(m.team1[1]).toMatch(/^AF\dG1$/);
      expect(m.team2[1]).toMatch(/^BF\dG1$/);
    }
  });

  test('femaleOffset=3 + femaleGroupId=1 produces AF4G1..AF6G1 codes', () => {
    const matches = generateCrossPlan(6, 3, { femaleOffset: 3, femaleGroupId: 1 });
    for (const m of matches) {
      expect(m.team1[1]).toMatch(/^AF[4-6]G1$/);
      expect(m.team2[1]).toMatch(/^BF[4-6]G1$/);
      // AM codes are unaffected
      expect(m.team1[0]).toMatch(/^AM[1-6]$/);
      expect(m.team2[0]).toMatch(/^BM[1-6]$/);
    }
  });

  test('rank balance is preserved with femaleOffset (rankImbalance=0)', () => {
    for (const m of generateCrossPlan(6, 3, { femaleOffset: 3, femaleGroupId: 1 })) {
      expect(rankImbalance(m)).toBe(0);
    }
  });

  test('simulated split: group1 + group2 cover global AF1G1-AF6G1 without overlap', () => {
    const g1 = generateCrossPlan(6, 3, { femaleOffset: 0, femaleGroupId: 1 });
    const g2 = generateCrossPlan(6, 3, { femaleOffset: 3, femaleGroupId: 1 });
    const allAF = [...g1, ...g2].map(m => m.team1[1]);
    // Group1 uses AF1G1-AF3G1, group2 uses AF4G1-AF6G1 — no code appears in both sets
    const g1Codes = new Set(g1.map(m => m.team1[1]));
    const g2Codes = new Set(g2.map(m => m.team1[1]));
    for (const code of g1Codes) expect(g2Codes.has(code)).toBe(false);
    expect(allAF.length).toBe(g1.length + g2.length);
  });
});

// ---------------------------------------------------------------------------
// generateFullPlan
// ---------------------------------------------------------------------------

describe('generateFullPlan', () => {
  test('returns object with males_matches, females_matches, cross_matches arrays', () => {
    const plan = generateFullPlan(6, 6);
    expect(plan).toHaveProperty('males_matches');
    expect(plan).toHaveProperty('females_matches');
    expect(plan).toHaveProperty('cross_matches');
    expect(Array.isArray(plan.males_matches)).toBe(true);
    expect(Array.isArray(plan.females_matches)).toBe(true);
    expect(Array.isArray(plan.cross_matches)).toBe(true);
  });

  test('nM=6 nF=6: males plan has C(6,2)=15 matches', () => {
    expect(generateFullPlan(6, 6).males_matches).toHaveLength(15);
  });

  test('nM=6 nF=6: females plan has C(6,2)=15 matches (not reduced by default)', () => {
    expect(generateFullPlan(6, 6).females_matches).toHaveLength(15);
  });

  test('nM=6 nF=6 with reducedFemales: females plan is shorter', () => {
    const plan = generateFullPlan(6, 6, { reducedFemales: true });
    expect(plan.females_matches.length).toBeLessThan(15);
  });

  test('nM=6 nF=3: cross plan has 6 matches', () => {
    expect(generateFullPlan(6, 3).cross_matches).toHaveLength(6);
  });

  test('nM=4 nF=4: all sub-plans are non-empty', () => {
    const plan = generateFullPlan(4, 4);
    expect(plan.males_matches.length).toBeGreaterThan(0);
    expect(plan.females_matches.length).toBeGreaterThan(0);
    expect(plan.cross_matches.length).toBeGreaterThan(0);
  });

  test('maxMalesMatches caps males matches', () => {
    const plan = generateFullPlan(6, 6, { maxMalesMatches: 6 });
    expect(plan.males_matches).toHaveLength(6);
  });

  test('maxFemalesMatches caps females matches', () => {
    const plan = generateFullPlan(6, 6, { maxFemalesMatches: 5 });
    expect(plan.females_matches).toHaveLength(5);
  });

  test('maxCrossMatches caps cross matches', () => {
    const plan = generateFullPlan(6, 3, { maxCrossMatches: 3 });
    expect(plan.cross_matches).toHaveLength(3);
  });

  test('maxCrossMatches can exceed max(nM,nF) up to nM*nF', () => {
    const plan = generateFullPlan(4, 3, { maxCrossMatches: 10 });
    expect(plan.cross_matches).toHaveLength(10); // capped at 4*3=12
  });
});

// ---------------------------------------------------------------------------
// maxMatches options — generateMalesPlan / generateFemalesPlan
// ---------------------------------------------------------------------------

describe('generateMalesPlan — maxMatches option', () => {
  test('maxMatches=0 returns empty array', () => {
    expect(generateMalesPlan(6, { maxMatches: 0 })).toHaveLength(0);
  });

  test('maxMatches > C(n,2) returns full plan', () => {
    expect(generateMalesPlan(6, { maxMatches: 100 })).toHaveLength(15);
  });

  test('maxMatches=6 for n=6: exactly 6 matches', () => {
    expect(generateMalesPlan(6, { maxMatches: 6 })).toHaveLength(6);
  });

  test('maxMatches=3 for n=6: first 3 matches are a perfect matching (all 6 players once)', () => {
    const matches = generateMalesPlan(6, { maxMatches: 3 });
    expect(matches).toHaveLength(3);
    const seen = new Set();
    for (const m of matches) {
      for (const code of m.team1) {
        expect(seen.has(code)).toBe(false);
        seen.add(code);
      }
    }
    expect(seen.size).toBe(6);
  });

  test('maxMatches: appearances are as even as possible', () => {
    const matches = generateMalesPlan(6, { maxMatches: 9 });
    const counts = countAppearances(matches);
    const aVals = Object.entries(counts).filter(([k]) => k.startsWith('A')).map(([, v]) => v);
    const maxA = Math.max(...aVals);
    const minA = Math.min(...aVals);
    expect(maxA - minA).toBeLessThanOrEqual(1); // appearances differ by at most 1
  });

  test('maxMatches: no repeated A-partner pairs', () => {
    const matches = generateMalesPlan(6, { maxMatches: 8 });
    const aPairs = new Set();
    for (const m of matches) {
      const key = m.team1.map(c => parseInt(c.slice(1))).sort((a, b) => a - b).join('-');
      expect(aPairs.has(key)).toBe(false);
      aPairs.add(key);
    }
  });

  test('maxMatches: rank imbalance stays 0 for n=6, maxMatches=9', () => {
    for (const m of generateMalesPlan(6, { maxMatches: 9 })) {
      expect(rankImbalance(m)).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// maxMatches options — generateCrossPlan
// ---------------------------------------------------------------------------

describe('generateCrossPlan — maxMatches option', () => {
  test('maxMatches=0 returns empty array', () => {
    expect(generateCrossPlan(6, 3, { maxMatches: 0 })).toHaveLength(0);
  });

  test('maxMatches below default produces fewer matches', () => {
    expect(generateCrossPlan(6, 3, { maxMatches: 3 })).toHaveLength(3);
  });

  test('maxMatches above default produces more matches', () => {
    expect(generateCrossPlan(6, 3, { maxMatches: 12 })).toHaveLength(12);
  });

  test('maxMatches capped at nM*nF', () => {
    // 4*3=12 is the hard cap; requesting 100 should give 12
    expect(generateCrossPlan(4, 3, { maxMatches: 100 })).toHaveLength(12);
  });

  test('coverage-first: with maxMatches=3 all 3 AM players covered (nM=3 nF=3)', () => {
    const matches = generateCrossPlan(3, 3, { maxMatches: 3 });
    const amCodes = new Set(matches.map(m => m.team1[0]));
    expect(amCodes.size).toBe(3); // each AM player appears once
  });

  test('more matches: each player still appears at most ceil(maxMatches*2/total) times', () => {
    const nM = 6, nF = 3, maxMatches = 12;
    const matches = generateCrossPlan(nM, nF, { maxMatches });
    const counts = countAppearances(matches);
    const expectedMax = Math.ceil(maxMatches / nM) + 1; // small tolerance
    for (let i = 1; i <= nM; i++) {
      expect(counts[`AM${i}`] || 0).toBeLessThanOrEqual(expectedMax);
    }
  });
});

// ---------------------------------------------------------------------------
// Randomized alternatives (balance-preserving tie-breaks)
// ---------------------------------------------------------------------------

describe('randomized plan generation', () => {
  test('seeded randomization is reproducible for males plan', () => {
    const a = generateMalesPlan(8, { maxMatches: 16, randomize: true, seed: 'same-seed' });
    const b = generateMalesPlan(8, { maxMatches: 16, randomize: true, seed: 'same-seed' });
    expect(a).toEqual(b);
  });

  test('different seeds can produce different males plans', () => {
    const a = generateMalesPlan(8, { maxMatches: 16, randomize: true, seed: 'seed-a' });
    const b = generateMalesPlan(8, { maxMatches: 16, randomize: true, seed: 'seed-b' });
    expect(a).not.toEqual(b);
  });

  test('randomized cross plan keeps perfect rank balance for nM=6 nF=3', () => {
    const matches = generateCrossPlan(6, 3, { randomize: true, seed: 'cross-balance' });
    for (const m of matches) {
      expect(rankImbalance(m)).toBe(0);
    }
  });

  test('generateAlternativePlans returns multiple unique alternatives when possible', () => {
    const plans = generateAlternativePlans(8, 6, {
      count: 3,
      maxMalesMatches: 16,
      reducedFemales: true,
      seed: 'alts'
    });
    expect(plans.length).toBe(3);
    const sigs = new Set(plans.map(canonicalPlanSignature));
    expect(sigs.size).toBe(plans.length);
  });

  test('randomized full males plan can vary across different seeds', () => {
    const a = generateMalesPlan(6, { randomize: true, seed: 'full-a' });
    const b = generateMalesPlan(6, { randomize: true, seed: 'full-b' });
    expect(a).not.toEqual(b);
  });

  test('generateFullPlan uses different random streams for males and females', () => {
    const plan = generateFullPlan(6, 6, { randomize: true, seed: 'stream-split' });
    expect(plan.males_matches).not.toEqual(plan.females_matches);
  });
});

// ---------------------------------------------------------------------------
// generateNTeamPlan
// ---------------------------------------------------------------------------

describe('generateNTeamPlan', () => {
  test('throws for fewer than 2 teams', () => {
    expect(() => generateNTeamPlan([])).toThrow();
    expect(() => generateNTeamPlan([{ id: 'A', nM: 6, nF: 6 }])).toThrow();
  });

  test('throws when a team is missing id, nM, or nF', () => {
    expect(() => generateNTeamPlan([{ id: 'A', nM: 6, nF: 6 }, { nM: 6, nF: 6 }])).toThrow();
    expect(() => generateNTeamPlan([{ id: 'A', nM: 0, nF: 6 }, { id: 'B', nM: 6, nF: 6 }])).toThrow();
  });

  test('2 teams: produces 1 pairing', () => {
    const { pairings } = generateNTeamPlan([
      { id: 'A', nM: 6, nF: 6 },
      { id: 'B', nM: 6, nF: 6 }
    ]);
    expect(pairings).toHaveLength(1);
    expect(pairings[0].team1Id).toBe('A');
    expect(pairings[0].team2Id).toBe('B');
  });

  test('3 teams: produces C(3,2)=3 pairings', () => {
    const teams = [
      { id: 'A', nM: 6, nF: 6 },
      { id: 'B', nM: 6, nF: 6 },
      { id: 'C', nM: 6, nF: 6 }
    ];
    const { pairings } = generateNTeamPlan(teams);
    expect(pairings).toHaveLength(3);
    const pairs = pairings.map(p => `${p.team1Id}v${p.team2Id}`);
    expect(pairs).toContain('AvB');
    expect(pairs).toContain('AvC');
    expect(pairs).toContain('BvC');
  });

  test('4 teams: produces C(4,2)=6 pairings', () => {
    const teams = ['A', 'B', 'C', 'D'].map(id => ({ id, nM: 6, nF: 6 }));
    expect(generateNTeamPlan(teams).pairings).toHaveLength(6);
  });

  test('each pairing uses its own team IDs as codes (not generic A/B)', () => {
    const teams = [
      { id: 'A', nM: 6, nF: 6 },
      { id: 'B', nM: 6, nF: 6 },
      { id: 'C', nM: 6, nF: 6 }
    ];
    const { pairings } = generateNTeamPlan(teams);
    const bvc = pairings.find(p => p.team1Id === 'B' && p.team2Id === 'C');
    // males_matches should use B/C codes, not A/B codes
    for (const m of bvc.males_matches) {
      expect(m.team1.every(c => c.startsWith('B'))).toBe(true);
      expect(m.team2.every(c => c.startsWith('C'))).toBe(true);
    }
  });

  test('2-team plan matches generateFullPlan with same sideA/sideB', () => {
    const plan2 = generateNTeamPlan([
      { id: 'X', nM: 4, nF: 4 },
      { id: 'Y', nM: 4, nF: 4 }
    ]).pairings[0];
    const ref = generateFullPlan(4, 4, { sideA: 'X', sideB: 'Y' });
    expect(plan2.males_matches).toEqual(ref.males_matches);
    expect(plan2.females_matches).toEqual(ref.females_matches);
    expect(plan2.cross_matches).toEqual(ref.cross_matches);
  });

  test('rank balance is preserved across all pairings (n=6, imbalance=0)', () => {
    const teams = ['A', 'B', 'C'].map(id => ({ id, nM: 6, nF: 6 }));
    const { pairings } = generateNTeamPlan(teams);
    for (const p of pairings) {
      for (const m of [...p.males_matches, ...p.females_matches]) {
        expect(rankImbalance(m)).toBe(0);
      }
    }
  });

  test('smaller player count used when teams differ in size', () => {
    const { pairings } = generateNTeamPlan([
      { id: 'A', nM: 4, nF: 4 },
      { id: 'B', nM: 6, nF: 6 }
    ]);
    // nM=min(4,6)=4 → C(4,2)=6 males matches
    expect(pairings[0].males_matches).toHaveLength(6);
  });

  test('seeded randomization is reproducible across teams', () => {
    const teams = ['A', 'B', 'C'].map(id => ({ id, nM: 6, nF: 6 }));
    const r1 = generateNTeamPlan(teams, { randomize: true, seed: 'n-team-seed' });
    const r2 = generateNTeamPlan(teams, { randomize: true, seed: 'n-team-seed' });
    expect(r1).toEqual(r2);
  });

  test('each pairing sub-plan has the correct structure', () => {
    const { pairings } = generateNTeamPlan([
      { id: 'A', nM: 6, nF: 6 },
      { id: 'B', nM: 6, nF: 6 }
    ]);
    for (const p of pairings) {
      expect(p).toHaveProperty('team1Id');
      expect(p).toHaveProperty('team2Id');
      expect(Array.isArray(p.males_matches)).toBe(true);
      expect(Array.isArray(p.females_matches)).toBe(true);
      expect(Array.isArray(p.cross_matches)).toBe(true);
    }
  });
});
