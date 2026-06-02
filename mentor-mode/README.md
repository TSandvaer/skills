# Mentor Mode (Claude Code skill)

A learn-by-doing mode for Claude Code. When ON, Claude becomes a hands-off mentor: it finds
the file/lines that need changing, explains *what* and *why* with paste-ready snippets,
checks your understanding — and **lets you make every edit yourself**. It adapts explanation
depth to your skill level and to how you respond over time.

## How it works

- **Skill** (`SKILL.md`) — toggles the mode and runs the first-run knowledge interview.
- **SessionStart hook** (`hooks/session-start.mjs`) — re-injects the mentor rules every
  session so the behavior persists, and announces the mode is on.
- **PreToolUse hook** (`hooks/pre-tool-use.mjs`) — the hard backstop: while ON it blocks
  `Edit`/`Write`/`MultiEdit`/`NotebookEdit` and mutating shell commands (git writes,
  `rm`/`mv`, file redirects, dependency installs, …). Read-only inspection, builds, tests,
  and running the app stay allowed so you can verify your own edits.

Your on/off flag and learner profile live in `~/.claude/mentor-mode/` — **not** in this
folder — so they are per-person and are never shipped inside a zip of the skill.

## Requirements

- **Node.js on your PATH** (the hooks run `node`).

## Install (recipient)

1. Extract this folder to `~/.claude/skills/mentor-mode/`
   (Windows: `C:\Users\<you>\.claude\skills\mentor-mode\`).
2. In Claude Code, run **`/mentor-mode on`**. The first run auto-registers the two hooks
   into your `~/.claude/settings.json` (it backs the file up first) and interviews you
   about your skill level.
3. Use **`/mentor-mode off`** anytime to hand control back to Claude.
   **`/mentor-mode status`** shows the current state and your learner profile.

> ⚠️ The hooks are NOT carried by the skill files alone — they are registered into your
> `settings.json` on the first `on`. Copying the folder is not enough; you must run
> `/mentor-mode on` once.

## Per-project tuning (optional)

`config/edc.example.json` shows the optional per-project config: a `match` block (so the
skill recognises the repo), a `topics` list (what to grill on), and `importantAreas` (paths
always treated as high-importance). Drop a sibling `config/<name>.json` for another project
to tailor the interview and importance scoring; without one, the skill falls back to
stack-detection + git-churn + docs-coverage.

## Share it

From the author's machine, run **`/skill-zip-share mentor-mode`** (or just zip the
`mentor-mode/` folder) and send it. The recipient follows the Install steps above.

## Uninstall

Remove the two `mentor-mode` entries from `~/.claude/settings.json` (look for commands
containing `mentor-mode`), delete `~/.claude/skills/mentor-mode/`, and optionally
`~/.claude/mentor-mode/`.
