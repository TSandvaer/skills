# skill-zip-share

> Package an existing Claude Code skill into a single shareable `.zip` with an auto-generated English README, plus a ready-to-paste Danish sharing blurb.

## What it does
Given the name of an installed skill and where it lives (your global user skills folder, or a specific project), this skill:

1. Reads the target skill's `SKILL.md` to understand what it does.
2. Writes a fresh, human-readable `README.md` (in English) next to that `SKILL.md`, explaining the skill and how to use it.
3. Zips the whole skill folder into `<skill-name>.zip` (placed next to the skill folder), excluding eval/build artifacts.
4. Hands you back a short Danish description you can paste straight into a Teams/Slack channel to share the skill — including a note that the README is inside the zip.

## When to use it
Reach for this whenever you want to share, hand off, export, or package a skill for a colleague — e.g. "share my skill `post-pr`", "zip up the `run-frontend` skill", "package this skill to send to the team", or simply "skill-zip-share post-pr".

## How to use it
Tell Claude the skill name and its location, for example:

- "skill-zip-share `post-pr` (global)"
- "package my project skill `run-frontend` for sharing"

Claude resolves the folder, generates the README, builds the zip, and replies with the Danish blurb and the path to the zip.

## Inputs
- **Skill name** (required) — the folder / `name:` of the skill to share, e.g. `post-pr`.
- **Location** (required) — `global` (your user-level `~/.claude/skills/`) or a **named project** (that project's `.claude/skills/`). If you don't say, Claude asks rather than guessing, since the same name can exist in both.

## Output
- A regenerated `README.md` next to the skill's `SKILL.md` (English).
- A `<skill-name>.zip` written to the skill's parent folder.
- A short **Danish** blurb in the chat reply, ready to post in a channel, mentioning the included README.

## Prerequisites
- Windows PowerShell (uses `robocopy` + `Compress-Archive` via the bundled script). A manual `Compress-Archive` fallback is documented in `SKILL.md` if PowerShell is unavailable.

## Installation
Unzip into your `.claude/skills/` folder — user-level `~/.claude/skills/` to have it everywhere, or `<project>/.claude/skills/` for a single project — then restart Claude Code (or start a new session) so the skill is picked up.

## Files in this package
- `SKILL.md` — the skill definition Claude loads.
- `README.md` — this file.
- `scripts/zip-skill.ps1` — PowerShell packaging script (stages, excludes artifacts, zips).
