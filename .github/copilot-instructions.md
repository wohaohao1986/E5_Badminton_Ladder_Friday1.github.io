# Badminton Ladder Project Instructions

> **For contributors:** This file is automatically read by GitHub Copilot for everyone
> who opens this project. To add your own rules, edit this file directly or ask Copilot:
> *"Update copilot-instructions.md to add rules for [your feature/area]"*

## Project Overview
- **Name:** E5 Badminton Ladder Friday
- **Type:** Node.js Express backend + Vanilla JavaScript frontend
- **Purpose:** Tournament management system for badminton ladder rankings
- **Main Language:** JavaScript (both server and client-side)

## Project Structure
```
src/
  ├── server.js              # Express server with REST API endpoints
  ├── app.js                 # Frontend logic and UI rendering
  ├── api.js                 # Shared HTTP helpers + syncDataFromServer()
  ├── opens.js               # Opens page UI logic (renderOpens and all sub-functions)
  ├── routes/
  │   ├── playerRoutes.js    # Player-related endpoints
  │   ├── matchRoutes.js     # Match-related endpoints
  │   └── opensRoutes.js     # Opens (公开赛) endpoints
  ├── utils/
  │   ├── dataUtils.js       # Core algorithms (ranking, grouping, matching)
  │   ├── fileUtils.js       # File I/O and JSON persistence
  │   └── pairingUtils.js    # Opens pairing plan generator (coverage-first, balanced)
  └── data/
      ├── badminton_ladder_friday.json  # Main ladder data storage
      ├── e5_opens.json                 # Opens tournament data
      ├── opens_pair_plan.json          # Pairing rules for match generation
      ├── admin_config.json             # Admin credentials
      └── application.log               # Logging output
```

## Key Concepts

### Categories
- **灰太狼 (huitailang):** Advanced players
- **喜羊羊 (xiyangyang):** Intermediate players

### Core Functions to Understand
1. **`calculatePlayerStats()`** - Computes rankings, win rates, and player statistics
2. **`rerankPlayer(id)`** - Updates individual player ranking after matches
3. **`rearrangeGroups(data, category, newGroupSizes, currentRound)`** - Reorganizes player groups
4. **`generateRoundRobinMatches(playerIds, round, groupId)`** - Creates match pairings
5. **`finishRound()`** - Completes current round and transitions to next

### Data Model
- **Players:** Have ID, name, ranking, category, active status, statistics
- **Groups:** Contain 4-5 players, organized by skill level
- **Matches:** Round-robin pairings within groups
- **Rounds:** Sequential tournament stages

### Opens (公开赛) Data Model
Stored in `src/data/e5_opens.json`:
```jsonc
{
  "opens": [
    {
      "id": "<name>-<date>",        // e.g. "AYJ-2026-05-11"
      "name": "AYJ",
      "date": "2026-05-11",
      "categories": [
        {
          "id": "A",                  // or "B"
          "males":   [ { "id": "player-xxx", "name": "..." } ],
          "females": [ { "id": "player-xxx", "name": "..." } ]
        }
      ],
      "groups": {                     // populated by generateMatchesAndGroups
        "males":   [ { "ht": [...], "xy": [...] } ],   // one entry per group
        "females": [ { "ht": [...], "xy": [...] } ]
      },
      "matches": [
        {
          "type": "males",            // "males" | "females" | "cross"
          "group": 1,
          "team1": ["PlayerA", "PlayerB"],
          "team2": ["PlayerC", "PlayerD"],
          "completed": false,
          "score1": null,
          "score2": null
        }
      ]
    }
  ]
}
```

**Pair plan** (`opens_pair_plan.json`) stores named plans used by `generateMatchesAndGroups`.
The file is a map of plan keys (`"6M_6F"`, `"8M_6F"`, …) to plan objects.
The dynamic generator in `pairingUtils.js` is used directly by `generateMatchesAndGroups` — the JSON file
is only for reference, inspection, and per-tournament overrides.
```jsonc
{
  "6M_6F": {
    "males_matches":   [ { "team1": ["A1","A2"], "team2": ["B1","B2"] } ],
    "females_matches": [ ... ],
    "cross_matches":   [ ... ]  // mixed-gender matches
  },
  "8M_6F": { ... }
}
```
Codes: `A` = Team A, `B` = Team B; `M`/`F` suffix = males/females; number = 1-based rank index.

**Cross split notation (single female group split across two cross groups):**
- If there is only one original female group (G1), keep `G1` in both cross sets
- Cross group 1 uses first-half female indices, e.g. `AF1G1`, `AF2G1`, `AF3G1`
- Cross group 2 uses second-half female indices from the same original group, e.g. `AF4G1`, `AF5G1`, `AF6G1`
- Do not label the second cross set as `G2` when there is no second original female group
- Parser should accept both forms: with suffix (`AF1G1`) and without suffix (`AF1`)

**Route defaults for Opens generation:**
- `PUT /api/opens/generateMatchesAndGroups` defaults to max 16 male matches per male group (override with `maxMalesMatches`)
- `PUT /api/opens/generatePairPlan` also defaults to max 16 male matches when `maxMalesMatches` is omitted
- `PUT /api/opens/generatePairPlan` accepts optional `crossFemaleAllocation` (array of female counts per cross group) and returns grouped cross sections (`cross_matches_group1`, `cross_matches_group2`, ...). When grouped fields are present, each group uses only the allocated female index range.

**Pair plan JSON formatting convention (middle-ground):**
- Use 2-space indentation
- Keep each match object on a single line, e.g. `{ "team1": ["A1", "A2"], "team2": ["B1", "B2"] }`
- Keep arrays multi-line (one match object per line)
- Do not minify the full file unless explicitly requested

### Opens Workflow
1. **Create opens** — `POST /api/opens` with `{ name, date }`
2. **Import players from ladder** — `PUT /api/opens/importPlayers` with `{ opensId }`
   - Ladder `huitailang` players sorted by `avgRankInCat`: even indices → Team A males, odd → Team B males
   - Ladder `xiyangyang` players sorted by `avgRankInCat`: odd indices → Team A females, even → Team B females
3. **Manually adjust players** (optional):
   - Add: `PUT /api/opens/player/add`
   - Reorder: `PUT /api/opens/player/rank`
   - Remove: `PUT /api/opens/player/delete`
4. **Generate groups & matches** — `PUT /api/opens/generateMatchesAndGroups` with `{ opensId }`
   - Splits each gender list into groups of 6
   - Applies pair-plan rules to create match pairings, resolving player codes to names
5. **Record scores** — `PUT /api/opens/:id` with the full updated opens object (client-side mutation, then save)
6. **Delete opens** — `DELETE /api/opens/:id`

### Opens Frontend Structure
- `src/api.js` — shared HTTP helpers (`addDataToServer`, `updateDataToServer`, `getFromServer`, `deleteFromServer`, `sendAuthenticatedRequest`, `syncDataFromServer`). `syncDataFromServer()` fetches both `data` (ladder) and `dataOpens` (opens).
- `src/opens.js` — all opens UI: `renderOpens()`, `renderOpensDetail()`, tabs, player management, match display, score submission
- `src/app.js` — calls `renderOpens()` in `showPage('opens')`, declares `let dataOpens`

## Code Standards

Full coding standards are in `.github/skills/coding-standards/SKILL.md` — read that file for the authoritative rules.

**Quick reference:**
- `async/await` always (no raw Promise chains)
- `camelCase` for variables/functions; `SCREAMING_SNAKE_CASE` for constants
- Validate all inputs at route boundaries; return `400`/`404`/`500` with `{ error: string }`
- Use `logToFile()` on every significant server-side action
- `escapeHtml()` on all user-supplied strings inserted into `innerHTML`
- Run `npm test` after every code change

## When Adding Features

### Backend (API Endpoints)
1. Add route handler in `src/server.js`
2. Import required utilities
3. Validate request parameters
4. Call appropriate function from `dataUtils.js`
5. Return JSON response with `{ success, message, data }` structure

### Frontend (UI)
1. Create function in `src/app.js`
2. Use `updateDataToServer()` for API calls
3. Update relevant render functions after changes
4. Add appropriate event listeners to DOM elements

### Data Processing
1. Write algorithm in `src/utils/dataUtils.js`
2. Add unit tests for new functions
3. Test with sample data in quick tests
4. Log key operations

### Testing
- Use Jest framework (when configured)
- Test edge cases and error conditions
- Verify data integrity after operations
- Test with various player counts (4, 8, 12, 16+ players)
- **When a new feature is added, write corresponding tests for it and run all tests (`npm test`) to verify the functionality of the entire system**

## Algorithm Notes

### Current Ranking System
- Based on match results (wins/losses)
- Players ranked within their category
- Can be modified with weighted scoring

### Group Distribution
- 4-5 players per group
- Calculated based on total active players
- Can be manually rearranged with `rearrangeGroups()`

### Match Generation
- Round-robin format within each group
- 3 matches for 4-player groups
- 5 matches for 5-player groups

## UI/Styling Guidelines
- **Color Scheme:** 
  - Primary action: Green (#4CAF50)
  - Secondary: Light gray backgrounds
  - Text: Dark gray/black on light backgrounds
- **Layouts:** Use Flexbox for responsive design
- **Modals:** Use overlay pattern with `.modal-overlay` and `.modal-content` classes
- **Accessibility:** Ensure buttons are clickable with good contrast
- **Responsive Design:** When working on UI changes, make sure phone users and computer users have similar views — wrap wide tables in `overflow-x:auto` scroll containers, use compact padding on mobile, and avoid fixed widths that break small screens

## Common Tasks

### Task: Add New Algorithm
1. Write function in `dataUtils.js`
2. Export it at the bottom of file
3. Import in `server.js`
4. Create API endpoint
5. Call from `app.js`

### Task: Modify Ranking Calculation
1. Find `calculatePlayerStats()` in `dataUtils.js`
2. Update calculation logic
3. Test with sample player data
4. Verify with multiple rounds

### Task: Change UI Style
1. Modify styles in `<style>` section of `app.js` or separate CSS file
2. Test on different screen sizes
3. Update responsive breakpoints if needed

### Task: Add Unit Tests
1. Create file in `test/` directory
2. Use Jest syntax
3. Test success cases and error conditions
4. Run with `npm test`

### Task: Improve Pairing Algorithm
When a user suggests changes to how Opens matches are generated (e.g. "give each player more games", "balance better", "reduce female match count", "support N players per group", etc.):

1. **Update the algorithm** in `src/utils/pairingUtils.js`
   - `generateMalesPlan(n, options)` — full C(n,2) plan or capped via `options.maxMatches`
   - `generateFemalesPlan(n, options)` — same structure as males
   - `generateFemalesPlanReduced(n, maxAppearances)` — appearance-capped plan for reduced female load
   - `generateCrossPlan(nM, nF, options)` — coverage-first, `options.maxMatches` default `max(nM,nF)`
  - `generateFullPlan(nM, nF, options)` — calls all three; accepts `maxMalesMatches`, `maxFemalesMatches`, `maxCrossMatches`, `reducedFemales` (UI label: “限制女子出场次数”), `femalesMaxAppearances`
2. **Regenerate saved plans** if the suggestion affects a preset group size — run the algorithm and save results as a new named entry in `src/data/opens_pair_plan.json` (key format: `"<nM>M_<nF>F"`, e.g. `"8M_6F"`)
3. **Update the skill doc** `.github/skills/pairing-algorithm/SKILL.md` — record the suggestion, what was changed, and why; update the relevant algorithm section, option reference, or usage examples
4. **Update tests** in `test/pairingUtils.test.js` to cover the new behaviour
5. Run `npm test` to verify nothing broke

## Important Files NOT to Break
- `src/server.js` - Critical for API functionality
- `src/utils/dataUtils.js` - All core algorithms here
- `src/utils/pairingUtils.js` - Opens pairing plan generator; changes here affect all Open match generation
- `src/data/badminton_ladder_friday.json` - Main data storage
- `src/routes/opensRoutes.js` - All opens API endpoints
- `src/opens.js` - All opens UI logic
- `src/api.js` - Shared HTTP helpers used by both app.js and opens.js

## Before Deploying Changes
- [ ] Test with current data
- [ ] Check logs for errors
- [ ] Verify UI renders correctly
- [ ] Test all related endpoints
- [ ] Update documentation if needed

## Useful Commands
```bash
npm start              # Start server
npm test              # Run unit tests (when configured)
node src/server.js   # Direct server start
```

## Chinese Terms (for UI)
- 分组 = Group/Grouping
- 比赛 = Match/Game
- 排名 = Ranking
- 灰太狼 = Advanced category
- 喜羊羊 = Intermediate category
- 确认 = Confirm
- 取消 = Cancel
- 成功 = Success
- 失败 = Failed
- 公开赛 = Opens tournament
- 男子 = Males
- 女子 = Females
- 混合 = Mixed/Cross
