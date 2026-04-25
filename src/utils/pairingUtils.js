/**
 * pairingUtils.js
 *
 * Generates balanced doubles pairing plans for Opens tournaments.
 *
 * Notation (same as opens_pair_plan.json):
 *   A = huitailang side, B = xiyangyang side
 *   M = males, F = females  (omitted for single-gender functions)
 *   Number = 1-based rank index within that gender/side group
 *
 * e.g. "A1"   = best-ranked huitailang player (gender-neutral)
 *      "AM2"  = 2nd-ranked huitailang male (cross matches)
 *      "BF3"  = 3rd-ranked xiyangyang female (cross matches)
 *
 * Balance principle:
 *   For each match, team1 rank-sum ≈ team2 rank-sum.
 *   (rank-sum = sum of rank indices of the two players on that team)
 *   When an exact balanced match is possible it is always preferred.
 */

'use strict';

/** Create a deterministic RNG from a numeric/string seed. */
function createRng(seed = Date.now()) {
  const str = String(seed);
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function rng() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/** Pick one index from candidate indices. Deterministic when rng is not provided. */
function pickCandidateIndex(indices, rng) {
  if (!indices.length) return -1;
  if (typeof rng !== 'function') return indices[0];
  const r = Math.floor(rng() * indices.length);
  return indices[r];
}

/**
 * Generate all C(n,2) A-side partner pairs.
 * @param {number} n - number of players per side
 * @returns {Array<[number,number]>} sorted list of [i,j] pairs, i < j
 */
function allPairs(n) {
  const pairs = [];
  for (let i = 1; i <= n; i++) {
    for (let j = i + 1; j <= n; j++) {
      pairs.push([i, j]);
    }
  }
  return pairs;
}

/**
 * Select A-side pairs in coverage-first order up to maxMatches.
 *
 * At each step the pair [i,j] with the lowest total appearance count
 * (aCount[i] + aCount[j]) is chosen. Ties fall back to lexicographic order
 * (the natural ordering of allPairs). This guarantees that when
 * maxMatches < C(n,2), appearances are distributed as evenly as possible
 * and the first floor(n/2) matches always form a perfect matching
 * (every player appears exactly once).
 *
 * @param {number} n
 * @param {number} maxMatches - desired number of A pairs (clamped to C(n,2))
 * @returns {Array<[number,number]>}
 */
function selectAPairsForCoverage(n, maxMatches, options = {}) {
  const total = (n * (n - 1)) / 2;
  const target = Math.min(maxMatches, total);
  if (target >= total && !options.randomize) return allPairs(n); // deterministic full plan

  const remaining = allPairs(n); // lexicographic order — tie-break baseline
  const aCount = new Array(n + 1).fill(0);
  const selected = [];
  const rng = options.randomize ? options.rng : null;

  while (selected.length < target && remaining.length > 0) {
    let bestScore = Infinity;
    const bestIdxs = [];
    for (let k = 0; k < remaining.length; k++) {
      const [i, j] = remaining[k];
      const score = aCount[i] + aCount[j];
      if (score < bestScore) {
        bestScore = score;
        bestIdxs.length = 0;
        bestIdxs.push(k);
      } else if (score === bestScore) {
        bestIdxs.push(k);
      }
    }
    const bestIdx = pickCandidateIndex(bestIdxs, rng);
    const [ai, aj] = remaining.splice(bestIdx, 1)[0];
    aCount[ai]++;
    aCount[aj]++;
    selected.push([ai, aj]);
  }
  return selected;
}

/**
 * Pick the best available B-pair from the pool that minimises rank-sum difference
 * with the target A-pair, tiebreaking by preferring under-used B players.
 *
 * @param {number} targetSum - rank sum of the A-pair
 * @param {Set<string>} usedB - set of already-assigned B-pair keys "i-j"
 * @param {number[]} bCount - appearance counts indexed by rank (1-based, index 0 unused)
 * @param {number} n - pool size
 * @returns {[number,number]|null} best [bi,bj] or null if pool exhausted
 */
function pickBPair(targetSum, usedB, bCount, n, options = {}) {
  const rng = options.randomize ? options.rng : null;
  const candidates = [];
  let bestScore = Infinity;
  for (let i = 1; i <= n; i++) {
    for (let j = i + 1; j <= n; j++) {
      const key = `${i}-${j}`;
      if (usedB.has(key)) continue;
      const diff = Math.abs(i + j - targetSum);
      // Penalise by total appearances of both B players to keep usage balanced
      const balancePenalty = bCount[i] + bCount[j];
      const score = diff * 1000 + balancePenalty;
      if (score < bestScore) {
        bestScore = score;
        candidates.length = 0;
        candidates.push([i, j]);
      } else if (score === bestScore) {
        candidates.push([i, j]);
      }
    }
  }
  if (!candidates.length) return null;
  return candidates[pickCandidateIndex(candidates.map((_, idx) => idx), rng)];
}

/**
 * Generate a singles-gender doubles pairing plan for n players per side.
 *
 * When maxMatches >= C(n,2) (or omitted) the full plan is produced — every
 * A-side partner pair exactly once, zero rank imbalance, all B pairs used once.
 *
 * When maxMatches < C(n,2) the coverage-first selection is used: pairs are
 * chosen so that player appearances stay as even as possible. The first
 * floor(n/2) matches always form a disjoint "round" (every player once).
 *
 * @param {number} n - number of players per side (min 2)
 * @param {string} [sidePrefix=''] - '' for neutral codes (A1), 'M'/'F' for cross
 * @param {Object} [options={}]
 * @param {number} [options.maxMatches] - cap total matches; default C(n,2)
 * @returns {Array<{team1: string[], team2: string[]}>}
 */
function generateGenderPlan(n, sidePrefix = '', options = {}) {
  if (n < 2) return [];

  const cap = (n * (n - 1)) / 2;
  const maxMatches = (typeof options.maxMatches === 'number' && options.maxMatches >= 0)
    ? Math.min(options.maxMatches, cap)
    : cap;

  const randomize = !!options.randomize;
  const rng = randomize ? (typeof options.rng === 'function' ? options.rng : createRng(options.seed)) : null;

  const aPairs = selectAPairsForCoverage(n, maxMatches, { randomize, rng });
  const usedB = new Set();
  const bCount = new Array(n + 1).fill(0); // 1-based
  const matches = [];
  const sideA = options.sideA || 'A';
  const sideB = options.sideB || 'B';

  for (const [ai, aj] of aPairs) {
    const best = pickBPair(ai + aj, usedB, bCount, n, { randomize, rng });
    if (!best) continue;
    const [bi, bj] = best;
    usedB.add(`${bi}-${bj}`);
    bCount[bi]++;
    bCount[bj]++;
    matches.push({
      team1: [`${sideA}${sidePrefix}${ai}`, `${sideA}${sidePrefix}${aj}`],
      team2: [`${sideB}${sidePrefix}${bi}`, `${sideB}${sidePrefix}${bj}`]
    });
  }
  return matches;
}

/**
 * Generate a males pairing plan for n players per side.
 * Codes: A1–An (huitailang), B1–Bn (xiyangyang).
 *
 * @param {number} n
 * @param {Object} [options={}]
 * @param {number} [options.maxMatches] - cap total matches; default C(n,2)
 * @returns {Array<{team1: string[], team2: string[]}>}
 */
function generateMalesPlan(n, options = {}) {
  return generateGenderPlan(n, '', options);
}

/**
 * Generate a females pairing plan for n players per side.
 * Same match structure as males. For an appearances-capped variant use
 * generateFemalesPlanReduced(n, maxAppearances) instead.
 *
 * @param {number} n
 * @param {Object} [options={}]
 * @param {number} [options.maxMatches] - cap total matches; default C(n,2)
 * @returns {Array<{team1: string[], team2: string[]}>}
 */
function generateFemalesPlan(n, options = {}) {
  return generateGenderPlan(n, '', options);
}

/**
 * Generate a reduced females plan where each player appears at most `maxAppearances`
 * times (default 3, matching the historic 6-player females scheme).
 *
 * Algorithm:
 *   1. List all C(n,2) A pairs ordered by rank sum.
 *   2. Greedily accept each pair while neither player exceeds maxAppearances.
 *   3. Assign the best available B pair with same rank-balance logic.
 *
 * @param {number} n
 * @param {number} [maxAppearances=3]
 * @returns {Array<{team1: string[], team2: string[]}>}
 */
function generateFemalesPlanReduced(n, maxAppearances = 3, options = {}) {
  if (n < 2) return [];

  const randomize = !!options.randomize;
  const rng = randomize ? (typeof options.rng === 'function' ? options.rng : createRng(options.seed)) : null;

  const aPairs = allPairs(n)
    .sort((a, b) => (a[0] + a[1]) - (b[0] + b[1])); // ascending by rank sum

  const aCount = new Array(n + 1).fill(0); // A player appearances
  const usedB = new Set();
  const bCount = new Array(n + 1).fill(0);
  const matches = [];
  const sideA = options.sideA || 'A';
  const sideB = options.sideB || 'B';

  for (const [ai, aj] of aPairs) {
    if (aCount[ai] >= maxAppearances || aCount[aj] >= maxAppearances) continue;

    // Find best B pair that also respects the maxAppearances limit on B side
    const candidates = [];
    let bestScore = Infinity;
    for (let bi = 1; bi <= n; bi++) {
      for (let bj = bi + 1; bj <= n; bj++) {
        const key = `${bi}-${bj}`;
        if (usedB.has(key)) continue;
        if (bCount[bi] >= maxAppearances || bCount[bj] >= maxAppearances) continue;
        const diff = Math.abs(bi + bj - (ai + aj));
        const balancePenalty = bCount[bi] + bCount[bj];
        const score = diff * 1000 + balancePenalty;
        if (score < bestScore) {
          bestScore = score;
          candidates.length = 0;
          candidates.push([bi, bj]);
        } else if (score === bestScore) {
          candidates.push([bi, bj]);
        }
      }
    }
    const best = candidates.length
      ? candidates[pickCandidateIndex(candidates.map((_, idx) => idx), rng)]
      : null;
    if (!best) continue;
    const [bi, bj] = best;
    usedB.add(`${bi}-${bj}`);
    aCount[ai]++;
    aCount[aj]++;
    bCount[bi]++;
    bCount[bj]++;
    matches.push({
      team1: [`${sideA}${ai}`, `${sideA}${aj}`],
      team2: [`${sideB}${bi}`, `${sideB}${bj}`]
    });
  }
  return matches;
}

/**
 * Generate cross-gender match pairings.
 *
 * Each team = 1 male + 1 female from the same side.
 *
 * Default match count = max(nM, nF), which ensures every player appears at
 * least once. Use maxMatches to produce fewer or more matches:
 *   - maxMatches < max(nM,nF)  → fewer matches; some players may be skipped
 *   - maxMatches > max(nM,nF)  → more matches, up to nM×nF (all combinations)
 *
 * A-teams are selected with coverage-first ordering so appearances stay as
 * even as possible regardless of maxMatches.
 *
 * Codes: AM1–AMnM, AF1–AFnF (huitailang), BM1–BMnM, BF1–BFnF (xiyangyang).
 *
 * @param {number} nM - number of males per side
 * @param {number} nF - number of females per side
 * @param {Object} [options={}]
 * @param {number} [options.maxMatches] - cap total matches; default max(nM,nF)
 * @returns {Array<{team1: string[], team2: string[]}>}
 */
function generateCrossPlan(nM, nF, options = {}) {
  if (nM < 1 || nF < 1) return [];

  const randomize = !!options.randomize;
  const rng = randomize ? (typeof options.rng === 'function' ? options.rng : createRng(options.seed)) : null;

  const defaultMatches = Math.max(nM, nF);
  const absoluteMax = nM * nF; // upper bound: all A-team combos vs all B-team combos
  const numMatches = (typeof options.maxMatches === 'number' && options.maxMatches >= 0)
    ? Math.min(options.maxMatches, absoluteMax)
    : defaultMatches;

  // Build all possible A-team combinations, then select in coverage-first order
  const aTeamPool = [];
  for (let mi = 1; mi <= nM; mi++) {
    for (let fi = 1; fi <= nF; fi++) {
      aTeamPool.push([mi, fi]);
    }
  }

  const aMCount = new Array(nM + 1).fill(0);
  const aFCount = new Array(nF + 1).fill(0);
  const aTeams = [];

  while (aTeams.length < numMatches && aTeamPool.length > 0) {
    let bestScore = Infinity;
    const bestIdxs = [];
    for (let k = 0; k < aTeamPool.length; k++) {
      const [mi, fi] = aTeamPool[k];
      const score = aMCount[mi] + aFCount[fi];
      if (score < bestScore) {
        bestScore = score;
        bestIdxs.length = 0;
        bestIdxs.push(k);
      } else if (score === bestScore) {
        bestIdxs.push(k);
      }
    }
    const bestIdx = pickCandidateIndex(bestIdxs, rng);
    const [mi, fi] = aTeamPool.splice(bestIdx, 1)[0];
    aMCount[mi]++;
    aFCount[fi]++;
    aTeams.push([mi, fi]);
  }

  // Assign B-teams greedily: minimise rank-sum imbalance, penalise over-used B players
  const bMCount = new Array(nM + 1).fill(0);
  const bFCount = new Array(nF + 1).fill(0);
  const usedB = new Set();
  const matches = [];
  const femaleOffset = typeof options.femaleOffset === 'number' ? options.femaleOffset : 0;
  const femaleGroupId = options.femaleGroupId != null ? options.femaleGroupId : null;
  const fSuffix = femaleGroupId != null ? `G${femaleGroupId}` : '';
  const sideA = options.sideA || 'A';
  const sideB = options.sideB || 'B';

  for (const [ami, afi] of aTeams) {
    const targetSum = ami + afi;
    const candidates = [];
    let bestScore = Infinity;

    for (let bm = 1; bm <= nM; bm++) {
      for (let bf = 1; bf <= nF; bf++) {
        const key = `${bm},${bf}`;
        if (usedB.has(key)) continue;
        const diff = Math.abs(bm + bf - targetSum);
        const balancePenalty = bMCount[bm] + bFCount[bf];
        const score = diff * 100 + balancePenalty;
        if (score < bestScore) {
          bestScore = score;
          candidates.length = 0;
          candidates.push([bm, bf]);
        } else if (score === bestScore) {
          candidates.push([bm, bf]);
        }
      }
    }

    const best = candidates.length
      ? candidates[pickCandidateIndex(candidates.map((_, idx) => idx), rng)]
      : null;
    if (!best) continue;
    usedB.add(`${best[0]},${best[1]}`);
    bMCount[best[0]]++;
    bFCount[best[1]]++;
    matches.push({
      team1: [`${sideA}M${ami}`, `${sideA}F${afi + femaleOffset}${fSuffix}`],
      team2: [`${sideB}M${best[0]}`, `${sideB}F${best[1] + femaleOffset}${fSuffix}`]
    });
  }
  return matches;
}

/**
 * Generate a complete pair plan for a single group.
 *
 * @param {number} nM - number of males per side in this group
 * @param {number} nF - number of females per side in this group
 * @param {Object} [options={}]
 * @param {number}  [options.maxMalesMatches]        - cap for males matches; default C(nM,2)
 * @param {number}  [options.maxFemalesMatches]      - cap for females matches; default C(nF,2)
 * @param {number}  [options.maxCrossMatches]        - cap for cross matches; default max(nM,nF)
 * @param {boolean} [options.reducedFemales=false]   - use appearance-capped females plan instead
 * @param {number}  [options.femalesMaxAppearances=3] - max appearances per player (reducedFemales)
 * @returns {{ males_matches: Array, females_matches: Array, cross_matches: Array }}
 */
function generateFullPlan(nM, nF, options = {}) {
  const {
    maxMalesMatches,
    maxFemalesMatches,
    maxCrossMatches,
    reducedFemales = false,
    femalesMaxAppearances = 3,
    randomize = false,
    seed,
    sideA = 'A',
    sideB = 'B'
  } = options;

  const maleSeed = seed != null ? `${seed}:males` : undefined;
  const femaleSeed = seed != null ? `${seed}:females` : undefined;
  const crossSeed = seed != null ? `${seed}:cross` : undefined;

  const males_matches = generateMalesPlan(nM,
    typeof maxMalesMatches === 'number'
      ? { maxMatches: maxMalesMatches, randomize, seed: maleSeed, sideA, sideB }
      : { randomize, seed: maleSeed, sideA, sideB });

  let females_matches;
  if (reducedFemales) {
    females_matches = generateFemalesPlanReduced(nF, femalesMaxAppearances, { randomize, seed: femaleSeed, sideA, sideB });
  } else {
    females_matches = generateFemalesPlan(nF,
      typeof maxFemalesMatches === 'number'
        ? { maxMatches: maxFemalesMatches, randomize, seed: femaleSeed, sideA, sideB }
        : { randomize, seed: femaleSeed, sideA, sideB });
  }

  const cross_matches = generateCrossPlan(nM, nF,
    typeof maxCrossMatches === 'number'
      ? { maxMatches: maxCrossMatches, randomize, seed: crossSeed, sideA, sideB }
      : { randomize, seed: crossSeed, sideA, sideB });

  const taggedAll = [
    ...males_matches.map(m => ({ ...m, matchType: 'males' })),
    ...females_matches.map(m => ({ ...m, matchType: 'females' })),
    ...cross_matches.map(m => ({ ...m, matchType: 'cross' }))
  ];
  const rounds = groupMatchesIntoRounds(taggedAll);
  return { males_matches, females_matches, cross_matches, rounds };
}

function canonicalTeamKey(team) {
  return (Array.isArray(team) ? [...team] : [])
    .map(String)
    .sort()
    .join('+');
}

function canonicalMatchesKey(matches) {
  return (Array.isArray(matches) ? matches : [])
    .map(m => `${canonicalTeamKey(m && m.team1)}|${canonicalTeamKey(m && m.team2)}`)
    .sort()
    .join('||');
}

function planSignature(plan) {
  const p = plan || {};
  return JSON.stringify({
    males: canonicalMatchesKey(p.males_matches),
    females: canonicalMatchesKey(p.females_matches),
    cross: canonicalMatchesKey(p.cross_matches)
  });
}

/**
 * Generate multiple balanced alternative plans using seed-based tie-break randomness.
 *
 * @param {number} nM
 * @param {number} nF
 * @param {Object} [options={}]
 * @param {number} [options.count=3] - desired number of unique plans
 * @param {number} [options.maxAttempts] - max tries to find unique alternatives
 * @returns {Array<{ males_matches: Array, females_matches: Array, cross_matches: Array }>}
 */
function generateAlternativePlans(nM, nF, options = {}) {
  const {
    count = 3,
    maxAttempts = Math.max(10, count * 10),
    ...baseOptions
  } = options;

  const plans = [];
  const seen = new Set();
  for (let i = 0; i < maxAttempts && plans.length < count; i++) {
    const seed = baseOptions.seed != null ? `${baseOptions.seed}-${i}` : `alt-${Date.now()}-${i}`;
    const plan = generateFullPlan(nM, nF, { ...baseOptions, randomize: true, seed });
    const sig = planSignature(plan);
    if (seen.has(sig)) continue;
    seen.add(sig);
    plans.push(plan);
  }
  return plans;
}

/**
 * Generate round-robin pairing plans for N teams (N ≥ 2).
 *
 * Produces one sub-plan for every unique team pair – C(N,2) total. Each
 * sub-plan uses the existing two-side algorithm with the pair's team IDs
 * substituted for the generic A/B codes, so codes look like "C1", "DM2"
 * instead of "A1", "BM2".
 *
 * When two paired teams have different player counts the smaller count is
 * used for both sides in that sub-plan (safe common denominator).
 *
 * @param {Array<{id: string, nM: number, nF: number}>} teams
 *   At least 2 teams. Each must have a unique string `id` and positive
 *   integer player counts `nM` (males per side) and `nF` (females per side).
 * @param {Object} [options={}]
 *   Forwarded to generateFullPlan for each pair
 *   (maxMalesMatches, maxFemalesMatches, maxCrossMatches, reducedFemales, …).
 * @returns {{ pairings: Array<{team1Id, team2Id, males_matches, females_matches, cross_matches}> }}
 */
function generateNTeamPlan(teams, options = {}) {
  if (!Array.isArray(teams) || teams.length < 2) {
    throw new Error('generateNTeamPlan requires at least 2 teams');
  }
  for (const t of teams) {
    if (!t.id || typeof t.id !== 'string') throw new Error('Each team must have a string id');
    if (!Number.isInteger(t.nM) || t.nM < 1) throw new Error(`Team ${t.id}: nM must be a positive integer`);
    if (!Number.isInteger(t.nF) || t.nF < 1) throw new Error(`Team ${t.id}: nF must be a positive integer`);
  }

  const pairings = [];
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      const t1 = teams[i];
      const t2 = teams[j];
      const nM = Math.min(t1.nM, t2.nM);
      const nF = Math.min(t1.nF, t2.nF);
      const pairSeed = options.seed != null ? `${options.seed}:${t1.id}v${t2.id}` : undefined;
      const plan = generateFullPlan(nM, nF, { ...options, sideA: t1.id, sideB: t2.id, seed: pairSeed });
      pairings.push({
        team1Id: t1.id,
        team2Id: t2.id,
        males_matches: plan.males_matches,
        females_matches: plan.females_matches,
        cross_matches: plan.cross_matches
      });
    }
  }
  return { pairings };
}

/**
 * Normalize a player code for cross-type round conflict detection.
 *
 * Males and females share the same code namespace (A1, B1 etc.) but are
 * different physical people. Cross matches share players with both genders
 * via AM/AF codes. To detect real conflicts while avoiding false ones:
 *
 *   males   A1  → M:A1,  B1  → M:B1
 *   females A1  → F:A1,  B1  → F:B1
 *   cross   AM1 → M:A1, AF1G1 → F:A1G1, BM2 → M:B2, BF3 → F:B3
 *
 * @param {string} code
 * @param {string} matchType - 'males' | 'females' | 'cross'
 * @returns {string}
 */
function normalizeCodeForRound(code, matchType) {
  if (matchType === 'cross') {
    // AM1 → M:A1,  AF1G1 → F:A1G1,  BM2 → M:B2,  BF3G1 → F:B3G1
    return code.replace(/^([AB])([MF])/, (_, side, gender) => `${gender}:${side}`);
  }
  return `${matchType === 'males' ? 'M' : 'F'}:${code}`;
}

/**
 * Group a flat list of matches into rounds so that no player appears more
 * than once per round. Handles mixed match types (males, females, cross)
 * using type-aware code normalization to avoid false conflicts between
 * the separate male/female player pools.
 *
 * Uses a greedy first-fit algorithm: each match is placed in the earliest
 * round that has no player conflict. The number of rounds equals the
 * chromatic index of the match conflict graph.
 *
 * @param {Array<{team1: string[], team2: string[], matchType: string}>} matches
 *   Each match must have a `matchType` of 'males', 'females', or 'cross'.
 * @returns {Array<{round: number, matches: Array}>}
 */
function groupMatchesIntoRounds(matches) {
  // Each round stores original matches plus a set of normalized player keys
  const rounds = [];
  for (const match of matches) {
    const type = match.matchType || 'males';
    const keys = new Set(
      [...(match.team1 || []), ...(match.team2 || [])].map(c => normalizeCodeForRound(c, type))
    );
    let assigned = false;
    for (const round of rounds) {
      const hasConflict = [...keys].some(k => round.playerKeys.has(k));
      if (!hasConflict) {
        round.matches.push(match);
        for (const k of keys) round.playerKeys.add(k);
        assigned = true;
        break;
      }
    }
    if (!assigned) {
      rounds.push({ round: rounds.length + 1, matches: [match], playerKeys: new Set(keys) });
    }
  }
  return rounds.map(({ round, matches }) => ({ round, matches }));
}

module.exports = {
  generateMalesPlan,
  generateFemalesPlan,
  generateFemalesPlanReduced,
  generateCrossPlan,
  generateFullPlan,
  generateAlternativePlans,
  generateNTeamPlan,
  groupMatchesIntoRounds
};
