---
name: mentor-mode
description: Toggle Mentor Mode on/off — a learn-by-doing mode where Claude never edits code itself but instead guides the user to make every change manually, with adaptive-depth explanations and understanding checks. Use when the user types "/mentor-mode on", "/mentor-mode off", "/mentor-mode status", or says "mentor mode", "enable/disable mentor mode", "teach me instead of doing it", or wants to be coached through changes rather than have code written for them.
---

# Mentor Mode

Mentor Mode turns Claude into a hands-off coding mentor: it locates and explains what needs
to change, hands paste-ready snippets with the *why*, checks understanding — but the USER
makes every edit. Enforcement and cross-session persistence come from two hooks
(SessionStart + PreToolUse) that this skill self-installs on first `on`.

## Resolve the subcommand
Parse the argument: `on`, `off`, or `status`. A bare invocation (or anything unrecognised)
→ behave as `status` and show usage.

Let **SKILL_DIR** = this skill's base directory (shown when the skill loaded). Key paths:
- Installer: `<SKILL_DIR>/install.mjs`
- Toggle:    `<SKILL_DIR>/toggle.mjs`
- Contract:  `<SKILL_DIR>/behavioral-contract.md`
- Configs:   `<SKILL_DIR>/config/*.json`

State lives per-user (NOT in this folder): `~/.claude/mentor-mode/{state.json,profile.json}`.

## `/mentor-mode on`
1. **Register the hooks (idempotent):** run via Bash → `node "<SKILL_DIR>/install.mjs"`.
   This backs up and updates `~/.claude/settings.json`. Safe to run repeatedly.
2. **First-run interview** — read `~/.claude/mentor-mode/profile.json` (Read tool; it may
   not exist yet). If it is missing OR `firstRunCompleted` is not `true`:
   a. **Detect the stack.** Look for `package.json` (JS/TS/React), `*.csproj`/`*.sln`
      (.NET/C#), Umbraco references, etc. If a `<SKILL_DIR>/config/<name>.json` matches the
      repo (see its `match` block), load its `topics` list (the EDC example ships). Always
      include core fundamentals relevant to the stack (e.g. SSR/hydration for web, DI,
      async, state management, data-fetching/caching, view-model/converter mapping, version
      control).
   b. **Grill the user** with `AskUserQuestion` popups (≤4 topics per popup), each asking
      their level: **None / Beginner / Comfortable / Advanced**.
   c. **Build the profile:** `profile.topics[topic] = { level, detailTier, declines: 0,
      explainFurther: 0, lastSeen: null }`, seeding `detailTier`: none/beginner→`deep`,
      comfortable→`standard`, advanced→`brief`. Set `firstRunCompleted: true`.
   d. **Save** profile.json with the Write tool (this path is hook-whitelisted).
3. **Enable:** run via Bash → `node "<SKILL_DIR>/toggle.mjs" on`.
4. **Adopt the contract for THIS session:** read `<SKILL_DIR>/behavioral-contract.md` and
   follow it for the rest of the conversation (the SessionStart hook auto-injects it in
   future sessions). Tell the user Mentor Mode is ON, that you will now guide rather than
   edit, and that it persists across sessions until `/mentor-mode off`.

## `/mentor-mode off`
1. Run via Bash → `node "<SKILL_DIR>/toggle.mjs" off`. (Works even while on — the toggle
   writes state via Node, which the PreToolUse hook does not block.)
2. Confirm: Mentor Mode is OFF; the hooks stay registered but inert; you may edit code
   normally again.

## `/mentor-mode status`
Read state.json + profile.json and report: enabled (yes/no), `firstRunCompleted`, and a
per-topic summary (level / tier / declines / explainFurther). Remind the user of
`/mentor-mode on|off`.

## Notes
- The hooks run `node`; if Node.js is not on PATH the hooks cannot run — tell the user to
  install it.
- This skill is meant to be shared. See `README.md` for how to hand it to a colleague
  (the hooks are registered into the recipient's settings.json on their first `on` — the
  skill files alone do not carry hook registrations).
