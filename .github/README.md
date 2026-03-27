# Agents Guide

This folder contains custom AI agents for the E5 Badminton Ladder Friday project. Each agent is a focused persona with its own tools, context, and responsibilities.

## Available Agents

### 🏸 Badminton Ladder
**File:** `badminton-ladder.agent.md`

The general-purpose agent for this project. Use it for ladder features, player/match/ranking management, and anything that spans across the whole codebase.

**Best for:**
- Ladder feature changes (player ranking, grouping, rounds)
- Bug fixes in `playerRoutes.js`, `matchRoutes.js`, `dataUtils.js`
- General project questions
- Cross-cutting concerns (server setup, file I/O, shared utilities)
- Anything outside the Opens feature

**How to invoke:**
- Type `@Badminton Ladder` in GitHub Copilot Chat
- Or select it from the agent picker (`@` menu)

---

### 📋 Badminton Opens
**File:** `badminton-opens.agent.md`

The specialist agent for all Opens (公开赛) work. Handles both the frontend UI (`opens.js`), backend API (`opensRoutes.js`), and the match pairing algorithm (`pairingUtils.js`). It always loads the full algorithm reference from `SKILL.md` before acting on pairing-related tasks.

**Best for:**
- Any Opens feature: player import, group generation, match scoring, UI
- Pairing algorithm changes (`pairingUtils.js`)
- Opens API endpoints (`opensRoutes.js`)
- Opens frontend (`opens.js`)
- Opens tests (`pairingUtils.test.js`, `opensRoutes.test.js`)
- Explaining why a specific match pairing was chosen
- Generating or regenerating `opens_pair_plan.json` entries

**How to invoke:**
- Type `@Badminton Opens` in GitHub Copilot Chat
- Or select it from the agent picker (`@` menu)
- The Badminton Ladder agent will also delegate to it for Opens tasks

**Restricted to:** Opens files only — does not touch ladder data, `app.js`, `dataUtils.js`, or ladder routes.

---

## How Agents Work Together

```
User
 │
 ├─ Ladder task ───────────► @Badminton Ladder agent
 │
 ├─ Opens task ────────────► @Badminton Opens agent
 │                               │
 │                               └─ Includes pairing algorithm, UI, and API
 │
 └─ General/unclear task ──► @Badminton Ladder agent
                                 │
                                 └─ Opens sub-task ──► @Badminton Opens agent
```

The **Badminton Ladder** agent can delegate to **Badminton Opens** as a subagent when it detects the task is bout the Opens feature. You can also invoke **Badminton Opens** directly to keep ladder context out of the conversation.

---

## Per-Call Trust Prompting (Hook)

A `PreToolUse` hook is active in this workspace that **asks for your approval before any terminal command runs or any file is written**. Read-only operations (file reads, searches) are allowed automatically.

| Tool category | Decision |
|---|---|
| Terminal execution (`run_in_terminal`) | **Ask** — you approve/deny each command |
| File writes (`replace_string_in_file`, `create_file`, …) | **Ask** — you approve/deny each edit |
| File reads, searches, directory listings | **Allow** — no prompt |

Hook files:
- `.github/hooks/trust-prompt.json` — registers the hook event
- `.github/hooks/scripts/trust-prompt.ps1` — logic that decides allow/ask per tool

To **disable** the hook temporarily, rename or delete `trust-prompt.json`. To make it permanent for your user profile only (not committed), copy the hook config to `%USERPROFILE%\.claude\settings.local.json`.

---

## Related Files

| File | Purpose |
|------|---------|
| `.github/copilot-instructions.md` | Workspace-wide rules applied to all agents |
| `.github/skills/pairing-algorithm/SKILL.md` | Algorithm reference loaded by the Badminton Opens agent |
| `.github/hooks/trust-prompt.json` | PreToolUse hook configuration |
| `.github/hooks/scripts/trust-prompt.ps1` | Hook script (Windows) |
| `src/utils/pairingUtils.js` | Pairing algorithm (owned by Badminton Opens agent) |
| `test/pairingUtils.test.js` | Pairing tests (owned by Badminton Opens agent) |
