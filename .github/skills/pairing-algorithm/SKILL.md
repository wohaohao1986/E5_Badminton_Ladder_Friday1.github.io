---
name: pairing-algorithm
description: 'Opens tournament pairing algorithm reference. Use when improving, debugging, or extending match generation in pairingUtils.js — including coverage-first selection, balance scoring, cross matches, reduced female appearances, randomized tie-breaks, or alternative plan generation.'
---

# Opens Pairing Algorithm — Skill Reference

**File:** `src/utils/pairingUtils.js`  
**Tested in:** `test/pairingUtils.test.js`

---

## 1. Problem Statement

An Opens tournament has two skill sides per group:

| Side | Code | Players |
|------|------|---------|
| Team A (ladder: 灰太狼 huitailang) | `A` | Best-ranked, `A1` = highest rank |
| Team B (ladder: 喜羊羊 xiyangyang) | `B` | Intermediate-ranked, `B1` = highest rank |

Each match is a doubles game: **Team 1** (two `A`-side players) vs **Team 2** (two `B`-side players).

Goals of the pairing algorithm:
1. **Balance** — both teams in a match should have equal or near-equal combined rank. `rank(A_i) + rank(A_j) ≈ rank(B_k) + rank(B_l)`
2. **Coverage** — every player partners with every other player on their side at least once (when match count allows)
3. **Even load** — each player plays approximately the same number of matches
4. **No repeated pairings** — the same partner pair should not appear twice

---

## 2. Notation

```
A1, A2, …, An   huitailang players ranked 1 (best) to n
B1, B2, …, Bn   xiyangyang players ranked 1 (best) to n

AM1, BM3        male players in cross matches
AF2, BF1        female players in cross matches
```

A **pair plan** is a JSON array of match rules:
```json
[
  { "team1": ["A1", "A2"], "team2": ["B1", "B2"] },
  { "team1": ["A1", "A3"], "team2": ["B3", "B4"] }
]
```

The route `generateMatchesAndGroups` resolves these abstract codes to real player names.

---

## 3. Mathematical Foundation

### 3.1 Perfect Balance Property

For any two players of ranks `i` and `j` on the A side, the ideal B-partner pair has ranks `k` and `l` such that:

$$i + j = k + l$$

When both sides have the same number of players `n`, the B-side pool is a mirror of the A-side pool (both have ranks 1…n), so for **every** A-pair there exists at least one B-pair with the same rank sum. This means perfect balance (`diff = 0`) is always achievable for any n.

### 3.2 Full Coverage = 1-Design

When all C(n,2) matches are generated:
- Every A-partner pair `{A_i, A_j}` appears exactly **once** → a combinatorial 1-design
- Every B-partner pair `{B_k, B_l}` is also used exactly once
- Each player appears exactly **n−1** times

For `n = 6`: 15 matches, each player appears 5 times.

### 3.3 Coverage-First Selection (Partial Plans)

When `maxMatches < C(n,2)`, we want to maximise coverage evenness. The greedy algorithm at each step picks the pair `[i, j]` from the remaining unused pairs that minimises:

$$\text{score}(i, j) = \text{aCount}[i] + \text{aCount}[j]$$

**Key property:** when `maxMatches = floor(n/2)`, the first selected matches always form a **perfect matching** — every player appears exactly once. This means the first `floor(n/2)` matches form a complete "round" playable simultaneously.

Example for `n = 6`, selecting 6 matches:
```
Step 1: (1,2), (3,4), (5,6)  → first disjoint round, all scores = 0
Step 2: (1,3), (2,4), …      → second round begins
```

---

## 4. Algorithms

### 4.1 `generateGenderPlan(n, sidePrefix, options)`

Internal function shared by males and females plans.

```
Input:  n (players per side), sidePrefix ('', 'M', or 'F')
        options.maxMatches (default C(n,2))
Output: array of match rules

1. Determine target = min(maxMatches, C(n,2))
2. SELECT A-pairs via selectAPairsForCoverage(n, target)
3. For each selected A-pair [i, j]:
     target_sum = i + j
     Find best unused B-pair [k, l] minimising:
       score = |k+l - target_sum| × 1000 + (bCount[k] + bCount[l])
     Emit match { team1: [A_i, A_j], team2: [B_k, B_l] }
     Mark [k,l] used, increment bCount[k], bCount[l]
```

The `× 1000` weight on the rank difference means balance is strictly preferred over B-player load balancing.

### 4.2 `selectAPairsForCoverage(n, maxMatches)`

```
Input:  n, maxMatches
Output: ordered list of A-pairs to use

remaining = allPairs(n)  // lexicographic order [[1,2],[1,3],…,[n-1,n]]
aCount = [0, 0, …, 0]    // n+1 zeros

while |selected| < maxMatches and remaining non-empty:
    best = remaining[k] with minimum (aCount[i] + aCount[j])
    // ties broken by lexicographic order (natural sort of remaining)
    push best to selected
    increment aCount[best[0]], aCount[best[1]]
    remove best from remaining

return selected
```

**Complexity:** O(maxMatches × C(n,2)). For typical tournament sizes (n ≤ 8) this is negligible.

### 4.3 `generateFemalesPlanReduced(n, maxAppearances = 3)`

A physically-motivated reduction for female players (fewer total matches, each player plays ≤ 3 games).

```
Input:  n, maxAppearances
Output: match rules

A-pairs sorted ascending by rank sum (prefers balanced pairs first)
For each A-pair [i, j]:
    skip if aCount[i] >= maxAppearances OR aCount[j] >= maxAppearances
    Find best unused B-pair [k, l] where:
        bCount[k] < maxAppearances AND bCount[l] < maxAppearances
        score = |k+l-(i+j)| × 1000 + (bCount[k] + bCount[l])
    emit match, update counts
```

This enforces the appearance cap symmetrically on both A and B sides, preventing unfair B-side overload.

**Trade-off:** strict enforcement on both sides means some A-pairs at the extremes (e.g., `A5+A6` for n=6) may not get a valid B-pair and are skipped. The output count will be ≤ `floor(n × maxAppearances / 2)`.

### 4.4 `generateCrossPlan(nM, nF, options)`

Cross matches pair one male + one female from the **same side (team)**.

Each team in an Opens tournament is already a cross-tier mix by construction:
- Males come from the `huitailang` (advanced) ladder category
- Females come from the `xiyangyang` (intermediate) ladder category
- Import logic distributes both evenly across Team A and Team B (round-robin)

So `[AM_i, AF_j]` is already "advanced male + intermediate female from Team A" — no additional tier-crossing is needed.

```
Input:  nM, nF, options.maxMatches (default max(nM,nF), max nM×nF)
        options.femaleOffset  (default 0)     — shift AF/BF code indices by this amount
        options.femaleGroupId (default null)  — append Gn suffix to AF/BF codes when set
Output: match rules with AM/AF/BM/BF codes

Build aTeamPool = all nM×nF combos [(mi, fi)]

Coverage-first A-team selection:
  aMCount[1..nM] = 0,  aFCount[1..nF] = 0
  while |aTeams| < maxMatches:
      pick (mi,fi) from pool with min (aMCount[mi] + aFCount[fi])
      // ties: lexicographic (row-major order)

For each (ami, afi):
    target_sum = ami + afi
    Find best unused B-team (bm, bf) minimising:
        score = |bm+bf - target_sum| × 100 + (bMCount[bm] + bFCount[bf])
    emit match with globally-indexed codes:
        team1: [AM{ami}, AF{afi+femaleOffset}{Gsuffix}]
        team2: [BM{bm},  BF{bf+femaleOffset}{Gsuffix}]
```

`femaleOffset` and `femaleGroupId` are used together when one female group is split across multiple cross groups. For example, splitting 6 females (from group G1) into two cross groups of 3:
- Cross group 1: `generateCrossPlan(6, 3, { femaleOffset: 0, femaleGroupId: 1 })` → `AF1G1..AF3G1`
- Cross group 2: `generateCrossPlan(6, 3, { femaleOffset: 3, femaleGroupId: 1 })` → `AF4G1..AF6G1`

The `route applyCrossAllocation` computes the cumulative offset (`fOffset += fCount`) and passes `femaleGroupId: 1` when `safeCrossAllocation.length > 1`.

**Match count range:**
- Minimum meaningful: `max(nM, nF)` — all players appear at least once
- Default: `max(nM, nF)` 
- Maximum: `nM × nF` — all possible A/B team combinations

### 4.5 Randomized tie-breaks (balance-preserving)

Randomness is applied only when multiple candidates have the exact same score.
This keeps the core balance objective unchanged while allowing alternative plans.

- `randomize: true` enables randomized tie-break choice
- `seed` makes randomization deterministic and reproducible
- Same seed => same plan; different seed => potentially different plan

Because score priority is unchanged, team-balance quality is preserved.

### 4.6 `generateAlternativePlans(nM, nF, options)`

Generates multiple unique balanced plans by varying seed-derived tie-break outcomes.

```js
generateAlternativePlans(8, 6, {
  count: 3,
  maxMalesMatches: 16,
  reducedFemales: true,
  randomize: true,
  seed: 'session-1'
})
```

Returns an array of unique full plans (`males_matches`, `females_matches`, `cross_matches`).

UI wording note: `reducedFemales` is shown in the frontend as “限制女子出场次数”, and `femalesMaxAppearances` is shown as “女子最多出场次数”.### 4.7 `generateNTeamPlan(teams, options)` — N-team round-robin

Generates a round-robin schedule for **N ≥ 2 teams**. Produces C(N,2) sub-plans — one per unique team pair.

```js
generateNTeamPlan([
  { id: 'A', nM: 6, nF: 6 },
  { id: 'B', nM: 6, nF: 6 },
  { id: 'C', nM: 6, nF: 6 }
], { maxMalesMatches: 10, reducedFemales: true })
```

**Returns:**
```json
{
  "pairings": [
    { "team1Id": "A", "team2Id": "B", "males_matches": [...], "females_matches": [...], "cross_matches": [...] },
    { "team1Id": "A", "team2Id": "C", "males_matches": [...], "females_matches": [...], "cross_matches": [...] },
    { "team1Id": "B", "team2Id": "C", "males_matches": [...], "females_matches": [...], "cross_matches": [...] }
  ]
}
```

**How codes work:** each sub-plan substitutes the pair's team IDs for the generic `A`/`B` prefixes. For the B-vs-C sub-plan, codes are `B1`, `BM2`, `CF3`, etc. — never `A1` or `B1` in the A/B sense.

**Implementation:** calls `generateFullPlan(nM, nF, { sideA: t1.id, sideB: t2.id, … })` for each pair. All `generateFullPlan` / `generateGenderPlan` / `generateCrossPlan` / `generateFemalesPlanReduced` functions now accept `options.sideA` / `options.sideB` (default `'A'`/`'B'`) — fully backward-compatible.

**Unequal team sizes:** when two paired teams have different `nM` or `nF`, `Math.min` is used for each dimension. The sub-plan covers the top-ranked players of the larger team.

**Seeding:** if `options.seed` is set, each pair gets a derived seed `<seed>:<team1Id>v<team2Id>` for reproducible, independent randomisation.

### 4.8 `groupMatchesIntoRounds(matches)` — Court scheduling

Groups a flat list of tagged matches into rounds so that **no player appears more than once per round**. Matches within a round can be played simultaneously on separate courts.

```
Input:  matches — array of match objects, each with a `matchType` field ('males'|'females'|'cross')
Output: [{ round: 1, matches: [...] }, { round: 2, matches: [...] }, ...]

Algorithm: greedy first-fit
  For each match:
    normalise each player code to a type-aware key (see below)
    find the earliest round with no player key conflict
    place the match there (or open a new round)
```

**Type-aware code normalization** avoids false conflicts between the male and female player pools (which reuse the same `A1`/`B1` namespace):

| Input code | Match type | Normalized key |
|---|---|---|
| `A1` | males | `M:A1` |
| `A1` | females | `F:A1` |
| `AM1` | cross | `M:A1` |
| `AF1G1` | cross | `F:A1G1` |
| `BM2` | cross | `M:B2` |
| `BF3` | cross | `F:B3` |

This means:
- `AM1` (cross) correctly conflicts with `A1` (males) — same physical person
- `AF1` (cross) correctly conflicts with `A1` (females) — same physical person  
- `A1` (males) does **not** conflict with `A1` (females) — different people

`generateFullPlan` always calls this internally and includes `rounds` in its output.

**Minimum rounds:** For `n` players per side, `n−1` rounds are a theoretical lower bound (Vizing's theorem for the K_n complete graph). The greedy first-fit algorithm does not guarantee this optimum — it uses a simple round-assignment heuristic that is correct (no conflicts) but not globally optimal. For typical tournament sizes (n ≤ 8), the resulting schedule is practically useful regardless.

---

## 5. API Endpoint: `PUT /api/opens/generatePairPlan`

Generates and persists a plan to `src/data/opens_pair_plan.json`.

```json
// Request body
{
  "nM": 6,
  "nF": 3,
  "maxMalesMatches": 16,
  "maxFemalesMatches": 6,
  "maxCrossMatches": 6,
  "crossFemaleAllocation": [3, 3],
  "reducedFemales": false,
  "femalesMaxAppearances": 3,
  "randomize": true,
  "seed": "opens-2026-03-16",
  "alternativeCount": 3
}

// Response: the generated plan object
{
  "males_matches":   [...],
  "females_matches": [...],
  "cross_matches":   [...],
  "cross_matches_group1": [...],
  "cross_matches_group2": [...]
}

// When alternativeCount > 1
{
  "plans": [
    { "males_matches": [...], "females_matches": [...], "cross_matches": [...], "cross_matches_group1": [...], "cross_matches_group2": [...] },
    { "males_matches": [...], "females_matches": [...], "cross_matches": [...], "cross_matches_group1": [...], "cross_matches_group2": [...] }
  ]
}
```

**Note:** `generateMatchesAndGroups` no longer reads this file — it generates the plan dynamically. This endpoint exists for inspection, export, or tooling purposes.

`crossFemaleAllocation` is optional. When provided, `generatePairPlan` emits `cross_matches_group#` arrays where each cross group uses only the allocated local female range (for example, allocation `[3,3]` means each group's plan uses `AF1..AF3` / `BF1..BF3` in that group section).

`PUT /api/opens/generatePairPlan` applies a route-level default male cap of `16` when `maxMalesMatches` is omitted.

### Route-level cross grouping behavior

In `PUT /api/opens/generateMatchesAndGroups`, cross matches are generated per male group and mapped to slices of the first female group on each side.

- Let `G = min(number of ht male groups, number of xy male groups)`
- Let `F = min(ht first-female-group size, xy first-female-group size)`
- The female cross pool (`F`) is split as evenly as possible into `G` contiguous slices
- Slice 1 is paired with male group 1, slice 2 with male group 2, etc.
- Route-level default male cap is `16` matches per male group (override via request `maxMalesMatches`)

For the common `2 male groups + 1 female group (6 players)` case, this yields:
- Cross group 1: male group 1 + female players 1-3
- Cross group 2: male group 2 + female players 4-6

### Cross notation for split from one female group

When two cross groups are derived from a single original female group, notation should keep original female indices and original group id:

- Group 1 uses first-half females: `AF1G1`, `AF2G1`, `AF3G1` (and `BF1G1` ... `BF3G1`)
- Group 2 uses second-half females: `AF4G1`, `AF5G1`, `AF6G1` (and `BF4G1` ... `BF6G1`)

This avoids incorrectly implying a second female group (`G2`) when only one female group exists.

Parser support in routes accepts optional group suffix codes such as `AF1G1` and `BF5G1`.

---

## 6. `generateFullPlan(nM, nF, options)` — Full Option Reference

```js
generateFullPlan(nM, nF, {
  // Match-count caps (independent per type):
  maxMalesMatches:        number,   // default: C(nM,2)
  maxFemalesMatches:      number,   // default: C(nF,2)
  maxCrossMatches:        number,   // default: max(nM,nF), hard cap: nM×nF

  // Females appearance-cap mode (alternative to maxFemalesMatches):
  reducedFemales:         boolean,  // default: false; UI label: “限制女子出场次数”
  femalesMaxAppearances:  number,   // default: 3 (only used when reducedFemales=true)

})

// Return value always includes `rounds`:
// {
//   males_matches:   [...],
//   females_matches: [...],
//   cross_matches:   [...],
//   rounds: [{ round: 1, matches: [{ ...match, matchType: 'males'|'females'|'cross' }] }, ...]
// }
```

`reducedFemales` and `maxFemalesMatches` serve different purposes:
- `maxFemalesMatches: K` → exactly K matches, coverage-first selection
- `reducedFemales: true, femalesMaxAppearances: M` → as many matches as possible while limiting each女子选手的出场次数 to `M`; the exact count is determined by the constraint, not by you

---

## 7. Design Decisions and Trade-offs

### Why greedy (not exhaustive)?

The exact optimum — minimising total rank imbalance over all C(n,2) matches — is an assignment problem solvable optimally in O(n³) via the Hungarian algorithm. However:
1. The greedy achieves **perfect balance (`diff = 0`) for all n** because the B pool mirrors the A pool
2. The greedy is O(n⁴) but n ≤ 8 in practice; it's instantaneous
3. The output is deterministic and easy to reason about

### Why appearance-first selection for partial plans?

Alternative: use the rank-sum-sorted order (which `generateFemalesPlanReduced` does).
- Rank-sum order prefers middle-ranked pairs, leaving extremes under-used
- Appearance-first is mathematically fairer: it produces near-regular tournaments where every player's advantage/disadvantage is equalised

### Why `max(nM, nF)` as default for cross?

This is the minimum needed to guarantee every player appears at least once. Fewer would leave some players idle; more is optional depending on how long you want the tournament to run.

### The × 1000 balance weight vs penalty

In `pickBPair`:
- `diff * 1000`: a rank imbalance of just 1 is heavily penalised
- `+ balancePenalty`: only matters when multiple B-pairs have equal rank sum

This ensures the rank balance goal is never sacrificed for B-player load balancing.

---

## 8. Common Usage Patterns

### Standard 6-player group (current default)
```js
generateFullPlan(6, 3)
// males: 15 matches, perfect balance, each player 5 games
// females: 9 matches, each player <= 3 games (wait: actually use reducedFemales for 3x cap)
// cross: 6 matches, zero imbalance

generateFullPlan(6, 3, { reducedFemales: true })
// same but females uses appearance-cap algorithm
```

### Shorter tournament (e.g. half-day)
```js
generateFullPlan(6, 3, {
  maxMalesMatches:   6,  // each player ~2 games instead of 5
  maxFemalesMatches: 3,
  maxCrossMatches:   3
})
```

### Extended cross section
```js
generateCrossPlan(6, 3, { maxMatches: 12 })
// 12 of 18 possible combinations; each male appears 2x, each female 4x
```

### Checking the first "round" is disjoint
```js
const matches = generateMalesPlan(6, { maxMatches: 3 });
// matches[0..2] cover all 6 players exactly once — schedulable simultaneously
```

### Non-standard group sizes
```js
generateFullPlan(4, 4)   // 4-player groups: 6 males, 6 females, 4 cross
generateFullPlan(8, 6)   // 8-player groups: 28 males, 15 females, 8 cross
```

---

## 9. Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| `n < 2` | Returns `[]` |
| `nM < 1 \|\| nF < 1` | Returns `[]` |
| `maxMatches = 0` | Returns `[]` |
| `maxMatches > C(n,2)` | Clamped to `C(n,2)`; full plan returned |
| `maxCrossMatches > nM×nF` | Clamped to `nM×nF` |
| `generateFemalesPlanReduced` with very large `n` | Some low-ranked players may not appear if no valid B-pair is available within the cap |
| B-pool exhausted in `pickBPair` | Returns `null`; that A-pair is silently skipped (safe, only possible if B pool was independently reduced) |

---

## 10. Extending the Algorithm

### Adding a "round" constraint (each round = disjoint matches)

The coverage-first selection already guarantees the first `floor(n/2)` A-pairs form a perfect matching. To exploit this for scheduling:

```js
const round1 = generateMalesPlan(n, { maxMatches: Math.floor(n / 2) });
const round2 = generateMalesPlan(n, { maxMatches: n - 1 }).slice(Math.floor(n / 2));
// NOTE: re-running generates the same order deterministically
```

### Support for unequal side sizes (|A| ≠ |B|)

Currently the algorithm assumes both sides have exactly `n` players. If sides differ:
- A-pairs are still all C(nA, 2)
- B-pool would have C(nB, 2) pairs — some A-pairs may not get a perfectly balanced B-pair
- The balance penalty cost still minimises imbalance greedily
- Not currently implemented; would require changing `pickBPair` to accept separate `nA` and `nB`

### Simulated annealing for near-optimal plans

For very large groups (n > 12), the greedy may accumulate moderate imbalances. A post-processing step could improve balance:
1. Build the greedy plan
2. Try swapping B-pair assignments between two matches if the total imbalance decreases
3. Repeat until no improvement (local optimum)
