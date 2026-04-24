---
name: coding-standards
description: >
  Project-wide coding standards for E5 Badminton Ladder Friday.
  Load this skill whenever writing, reviewing, or refactoring any code in this project.
  Covers JavaScript style, naming, logging, error handling, API patterns, UI patterns, and testing.
---

# E5 Badminton Ladder — Coding Standards

> **Shared across all agents.** These rules are the single source of truth.
> Both the Badminton Ladder agent and the Badminton Opens agent follow every rule here.

---

## 1. JavaScript Style

| Rule | Detail |
|------|--------|
| Async | Always use `async/await`; never use raw `.then()` / `.catch()` chains |
| Variables | `const` by default; `let` only when re-assignment is needed; never `var` |
| Naming | `camelCase` for variables and functions; `SCREAMING_SNAKE_CASE` for module-level constants |
| Descriptive names | `playerIds` not `pids`; `categoryId` not `cat`; `opensId` not `oid` |
| Function size | Keep functions under 50 lines; split into helpers when logic grows |
| Comments | Add inline comments only for non-obvious logic; do **not** add JSDoc for every function |
| Immutability | Prefer non-mutating array methods (`map`, `filter`, `slice`) over in-place mutation unless performance demands otherwise |
| Template literals | Use template literals for string interpolation; never `+` concatenation for multi-part strings |

---

## 2. Naming Conventions

```
Variables / functions:   camelCase         e.g. playerStats, rerankPlayer
Constants (module-top):  SCREAMING_SNAKE   e.g. DEFAULT_MAX_MALES_MATCHES
Files:                   camelCase         e.g. pairingUtils.js, opensRoutes.js
Test files:              <subject>.test.js e.g. pairingUtils.test.js
```

---

## 3. Logging

Use `logToFile()` (from `src/utils/fileUtils.js`) for every meaningful server-side operation.

```javascript
// ✅ Log before and after significant actions
logToFile(`Request to import players for opens: ${opensId}`);
// ... do work ...
logToFile(`Imported ${count} players into ${opensId}`);

// ✅ Log errors
logToFile(`Error in generateGroups: ${error.message}`);

// ❌ Do not log inside tight loops or purely read-only utility functions
```

**Frontend (`opens.js`, `app.js`):** use `console.error` for caught exceptions only; do not call `logToFile` from the browser.

---

## 4. Error Handling

### Backend (Express route handlers)

```javascript
router.put('/someRoute', (req, res) => {
  const { requiredParam } = req.body;
  if (!requiredParam)
    return res.status(400).json({ error: 'requiredParam is required' });

  try {
    const result = doWork(requiredParam);
    logToFile(`someRoute succeeded: ${requiredParam}`);
    res.json({ success: true, message: 'Done', ...result });
  } catch (error) {
    logToFile(`Error in someRoute: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});
```

### Frontend (async UI functions)

```javascript
async function myAction(param) {
  const result = await sendAuthenticatedRequest('/api/endpoint', { param });
  if (result) {
    alert('操作成功！');
    // refresh state / re-render
  } else {
    alert('操作失败，请重试');
  }
}
```

### Rules
- Validate **all** required inputs at the route boundary before calling any utility function
- Return HTTP 400 for bad input, 404 for missing records, 500 for unexpected errors
- Response body: always `{ error: string }` on failure; `{ success: true, message: string, ...data }` on success
- Never swallow errors silently; always log before returning 500

---

## 5. API Design

### Route structure (`src/routes/*.js`)

- Group related routes in their own router file and mount under a prefix in `server.js`
- Specific `PUT /resource/action` paths **must** be declared before wildcard `PUT /resource/:id` in Express
- Always validate the request body at the top of the handler before any file I/O

### Response shapes

```javascript
// Success
res.json({ success: true, message: 'Human-readable description', ...optionalData });

// Client error
res.status(400).json({ error: 'Reason' });
res.status(404).json({ error: 'Resource not found' });

// Server error
res.status(500).json({ error: error.message });
```

### Data persistence

- Use `safeReadJson(FILE, default)` to load; use `saveStore(store)` / `safeWriteJson(FILE, data)` to persist
- Always persist **before** sending the response
- Do not write to `badminton_ladder_friday.json` from Opens routes, and vice-versa

---

## 6. Frontend Patterns

### Rendering

- All rendering is done by named functions (`renderOpens`, `renderOpensDetail`, `loadOpenMatchesData`, …)
- After any data mutation, re-fetch from the server and re-invoke the relevant render function:

```javascript
const refreshed = await getFromServer(`/api/opens/${opensId}`);
if (refreshed) {
  window.currentOpens = refreshed;
  loadOpenPlayersData(refreshed);
}
```

- Use `escapeHtml()` on **all** user-supplied strings that go into `innerHTML`

### Colour scheme

| Usage | Value |
|-------|-------|
| Primary action (buttons) | `#4CAF50` green |
| Danger / delete | `#f44336` red |
| Info / neutral | `#2196F3` blue |
| Background (cards) | `#f9f9f9` |
| Border | `#e0e0e0` |

### Responsive layout

- Wrap any table in `<div style="overflow-x:auto;">` so it scrolls on mobile
- Use `flex-wrap:wrap` on flex rows that contain fixed-width items
- Avoid hard-coded `px` widths on containers; prefer `%`, `flex:1`, or `min-width`
- Modals: use `.modal-overlay` + `.modal-content` class pattern

### Accessibility

- Every interactive element must be reachable by keyboard (use `<button>`, not `<div onclick>`)
- Labels must be associated with their inputs (`<label>` with matching `for`/`id`, or wrapping the input)

---

## 7. Testing

- Framework: **Jest** (`npm test`)
- File naming: `test/<subject>.test.js`
- Run `npm test` after **every** code change before considering the task done

### Test structure

```javascript
describe('PUT /importPlayers — import players from ladder', () => {
  beforeEach(() => { /* reset mock stores */ });

  test('returns 400 when opensId is missing', async () => { ... });
  test('distributes players correctly', async () => { ... });
  test('excludes inactive players', async () => { ... });
});
```

### Coverage rules

| Change type | Required tests |
|-------------|----------------|
| New API endpoint | Happy path + missing required fields + 404 |
| New algorithm function | Full coverage: exact output, edge cases (n<2, empty arrays, caps) |
| Bug fix | Regression test that would have caught the bug |
| Refactor | Existing tests must still pass; add tests if coverage gaps found |

### Mocking

- Mock `safeReadJson` / `safeWriteJson` by replacing the module in each test file
- Do **not** touch real data files (`e5_opens.json`, `badminton_ladder_friday.json`) during tests
- Mock both the ladder file and the opens file by switching on the file path string

---

## 8. File Ownership & Boundaries

| File / folder | Owner agent |
|---------------|-------------|
| `src/opens.js` | Badminton Opens |
| `src/routes/opensRoutes.js` | Badminton Opens |
| `src/utils/pairingUtils.js` | Badminton Opens |
| `test/pairingUtils.test.js` | Badminton Opens |
| `test/opensRoutes.test.js` | Badminton Opens |
| `src/data/opens_pair_plan.json` | Badminton Opens |
| `src/data/e5_opens.json` | Badminton Opens |
| `src/app.js` | Badminton Ladder |
| `src/server.js` | Badminton Ladder |
| `src/utils/dataUtils.js` | Badminton Ladder |
| `src/utils/fileUtils.js` | Badminton Ladder |
| `src/routes/playerRoutes.js` | Badminton Ladder |
| `src/routes/matchRoutes.js` | Badminton Ladder |
| `src/data/badminton_ladder_friday.json` | Badminton Ladder |
| `test/dataUtils.test.js` | Badminton Ladder |
| `test/matchRoutes.test.js` | Badminton Ladder |
| `test/playerRoutes.test.js` | Badminton Ladder |
| `.github/` (all docs) | Either agent |

**Cross-boundary rule:** An agent must not edit a file owned by the other agent unless the change is a direct dependency of a task explicitly assigned to it. When in doubt, ask.

---

## 9. Git / Change Discipline

- Make the **minimal** change that satisfies the requirement — no opportunistic refactors
- Do not add docstrings, comments, or type annotations to code you didn't change
- Do not add error handling for scenarios that cannot occur in the current design
- Do not create new abstraction helpers unless the same logic appears 3+ times
- After editing, always run `npm test` to confirm nothing regressed
