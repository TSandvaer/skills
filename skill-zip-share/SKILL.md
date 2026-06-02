---
name: skill-zip-share
description: Package an existing Claude Code skill for sharing with colleagues. Given a skill name plus its location (global or a named project), this generates a fresh English README.md next to the skill's SKILL.md, zips the whole skill folder, and returns a short Danish blurb ready to paste into a Teams/Slack channel. Use whenever the user wants to share, hand off, export, package, or zip up a skill for someone else - phrases like "share my skill X", "zip up the skill X", "package skill X to send to a colleague", "skill-zip-share X", "make a shareable zip of skill X", or "export skill X with a readme". Reach for this even if the user only says "send my skill to the team" without naming the zip step explicitly.
---

# skill-zip-share

Turn an installed skill into a single shareable `.zip` that a colleague can drop into their own `.claude/skills/` folder, complete with a human-readable `README.md` that explains what the skill is and how to use it.

The README is written in **English** (so it travels well across teams). The blurb you hand back to the user for posting in a channel is written in **Danish**.

## Inputs

The user supplies two things (ask only for whatever is missing):

1. **Skill name** - the folder/`name:` of the skill to share (e.g. `post-pr`, `run-frontend`).
2. **Location** - one of:
   - `global` -> the user-level skills directory: `%USERPROFILE%\.claude\skills\<skill-name>` (on this machine `C:\Users\538252\.claude\skills\<skill-name>`).
   - `project` (a *named* project) -> that project's `.claude\skills\<skill-name>`. If the user names a project, resolve its repo root; if they don't, default to the current working directory's repo root (`git rev-parse --show-toplevel`).

If you cannot tell which location is meant, ask once rather than guessing - global and project skills can share the same name.

## Workflow

### 1. Resolve and verify the skill directory

Build the path from the location:

- global -> `Join-Path $env:USERPROFILE ".claude\skills\<name>"`
- project -> `Join-Path <repo-root> ".claude\skills\<name>"`

Confirm `SKILL.md` exists inside it. If the folder or `SKILL.md` is missing, stop and tell the user the path you looked at - do not fabricate a path or proceed with a guess.

### 2. Understand the skill

Read the skill's `SKILL.md` (and skim any `scripts/`, `references/`, `assets/` so the README is accurate). You are writing the README from the *actual* contents, not from the skill's name. Capture:

- What it does (the value it delivers).
- When it triggers / when a user would reach for it.
- The inputs or arguments it expects.
- What it produces (output format, side effects).
- Any prerequisites (tools, MCP servers, credentials, environment).

### 3. Write `README.md` (English) next to `SKILL.md`

Overwrite any existing `README.md` (regenerating keeps it in sync with the current `SKILL.md`). Use this structure - adapt headings to the skill, omit a section if it genuinely doesn't apply:

```markdown
# <Skill Name>

> One-sentence summary of what this skill does.

## What it does
A short paragraph explaining the value and behaviour.

## When to use it
The situations / phrases that should make you reach for this skill.

## How to use it
Step-by-step from the user's point of view. Include the trigger phrase and any arguments.

## Inputs
- **<arg>** - what it is, required/optional, example value.

## Output
What you get back (files, messages, side effects).

## Prerequisites
Tools, MCP servers, credentials, or environment the skill depends on. Omit if none.

## Installation
Unzip into your `.claude/skills/` folder (user-level `~/.claude/skills/` for everywhere,
or `<project>/.claude/skills/` for one project), then restart Claude Code or start a new
session so the skill is picked up.

## Files in this package
- `SKILL.md` - the skill definition Claude loads.
- `README.md` - this file.
- <list any scripts/references/assets folders>
```

Keep it concise and genuinely useful - a colleague should understand the skill in under a minute.

### 4. Create the zip

Run the bundled packaging script, which stages the folder, drops eval/workspace artifacts, and writes `<skill-name>.zip` into the skill's parent folder. The zip filename is **exactly the skill's folder name plus `.zip`** - nothing is appended or altered (folder `grill-me` -> `grill-me.zip`, folder `post-pr` -> `post-pr.zip`):

```powershell
& "<this-skill-dir>\scripts\zip-skill.ps1" -SkillDir "<resolved-skill-dir>"
```

The script prints the absolute path of the zip it created. It excludes `evals/`, `*-workspace`, `skill-snapshot`, `.git`, `node_modules`, `__pycache__`, and stray `*.zip` / `feedback.json` / `benchmark.*` files so the shared package stays clean. The new `README.md` is always included.

If PowerShell is unavailable, fall back to a manual `Compress-Archive -Path "<resolved-skill-dir>" -DestinationPath "<parent>\<name>.zip" -Force` (this won't apply the exclusions).

### 5. Return the Danish sharing blurb

End your response with a short Danish description the user can paste into a channel. It must:

- **Lead with the skill name as a bold title** - do NOT prefix it with "Deler en skill:" or any other label. Wrap the name in backticks with a leading slash, then wrap that in `**...**` for bold (`` **`/<skill-name>`** ``) so it renders as a bold, highlighted inline-code "square" when pasted into Teams/Slack, just like a slash command.
- Follow the title (on the same line, after an em dash) with one or two sentences on what it does and when to use it.
- State that a `readme.md` with an explanation is **included in the zip**.
- Be short and channel-friendly (a couple of lines, not a wall of text).

Use this shape (fill in the specifics for the actual skill):

```
**`/<skill-name>`** - <en til to saetninger om hvad den goer og hvornaar man bruger den>

Zip indeholder readme.md der beskriver hvad den goer og hvordan den bruges
```

Then tell the user (in your normal reply language) where the zip was written so they can attach it.

## Notes

- Danish text in the blurb may use proper Danish characters in your chat reply; just keep any files you *write to disk* ASCII-safe per the project's Windows tooling rules.
- This skill only reads the target skill and writes a `README.md` + a `.zip`; it never modifies `SKILL.md` or touches production.
