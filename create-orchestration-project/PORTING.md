# Porting Improvements Back into the Template

After this skill bootstraps a new project, that project's `.claude/` evolves — new hooks land, dispatch conventions tighten, the maintain-docs skill picks up new heuristics. This document describes how to pull those improvements back into `~/.claude/skills/create-orchestration-project/template/` so the next project bootstrapped inherits them.

## When to port

Trigger a porting pass when one or more is true:

- A known project's hook script gained new behavior other projects would benefit from (e.g. dual auto-status modes, smarter Stop hook filtering).
- The maintain-docs skill's heuristics or visibility rules changed.
- The dispatch template grew a new mandatory block.
- A new doc landed in `.claude/docs/` that's universally useful (not project-specific).
- A persona file pattern improved (e.g. a clearer "what NOT to do" section).
- `settings.json` permission allowlist or env vars changed in a way that's universally useful.

DON'T port:

- Project-specific content (architecture-overview.md, V1-PLAN.md, anything with project-name in it).
- Persona files tied to a specific persona name (the template uses `persona-template.md`, not specific names).
- Auto-status state files or other per-machine artifacts.

## The diff-and-port workflow

Invoked via `create-orchestration-project port-improvements <project-name>`. The skill:

1. **Looks up the project** in `KNOWN_PROJECTS.md`. If not found, asks the user to register it first via `register <path>`.
2. **Identifies the file set** to diff:
   - `template/CLAUDE.md` vs `<project>/CLAUDE.md`
   - `template/agents/TEAM.md` vs `<project>/.claude/agents/TEAM.md`
   - `template/agents/dispatch-template.md` vs `<project>/.claude/agents/dispatch-template.md`
   - `template/docs/orchestration-overview.md` vs `<project>/.claude/docs/orchestration-overview.md`
   - `template/docs/testing-strategy.md` vs `<project>/.claude/docs/testing-strategy.md`
   - `template/hooks/*.sh` vs `<project>/.claude/hooks/*.sh`
   - `template/skills/maintain-docs/SKILL.md` vs `<project>/.claude/skills/maintain-docs/SKILL.md`
   - `template/settings.json` vs `<project>/.claude/settings.json` (env + hooks + universal permissions only — project-specific allowlist entries excluded)
3. **Produces a diff report** — for each file with a non-trivial difference, show:
   - Path
   - Diff (unified, with placeholder normalization — `{{PROJECT_NAME}}` etc. ignored)
   - Classification: **likely-universal-improvement** / **project-specific** / **needs-judgment**
4. **Per-file decision** — user reviews each candidate and decides: port to template / skip / ask for more context.
5. **Applies approved ports** to `template/` files.
6. **Logs the port pass** by appending a `## YYYY-MM-DD port from <project>` section to this file (below) with the list of files updated and a one-line rationale per file.

## Placeholder normalization

When diffing template vs project, normalize:

- `{{PROJECT_NAME}}` ↔ the actual project name (e.g. `ClaudeTeam`).
- `{{REPO_OWNER}}` ↔ actual repo owner.
- `{{REPO_NAME}}` ↔ actual repo name.
- `{{CLICKUP_LIST_ID}}` ↔ actual list ID.
- `{{CLICKUP_WORKSPACE_ID}}` ↔ actual workspace ID.
- `{{CLICKUP_SPACE_ID}}` ↔ actual space ID.
- `{{WORKTREE_BASE_PATH}}` ↔ actual base path (e.g. `c:\Trunk\PRIVATE\ClaudeTeam`).
- Persona names: the template uses generic `<role>` references; project uses actual names. Normalize `<role>` ↔ the project's persona name for that lane (mapping from `KNOWN_PROJECTS.md`'s personas list).

The diff should only flag content differences, not placeholder differences.

## What "likely-universal-improvement" means

Heuristics the skill should apply:

- A new clarifying paragraph that improves orchestration discipline → universal.
- A new failure mode added to a `## Common failure modes` section → usually universal.
- A new persona-naming rule added to PERSONA_LIBRARY → universal.
- A bugfix in a hook script → almost always universal.
- A new section that references project-specific files / personas / architecture → project-specific.
- A new section that references an external system the project uses but other projects might not (Azure DevOps, Linear, etc.) → needs-judgment.

## Manual port (no skill)

If invoking the skill is overkill (one file, one change), the manual workflow:

1. Open both files side-by-side.
2. Identify the diff that's universal.
3. Edit the `template/` file directly.
4. Append a port-pass entry to this file with date + project source + file + one-line rationale.

---

## Port-pass log

<!-- Each entry below documents a port pass. Append new entries at the bottom. -->

### YYYY-MM-DD — initial template extraction from claudeteam

- Template was bootstrapped from `c:\Trunk\PRIVATE\ClaudeTeam`'s `.claude/` on 2026-05-23.
- All files in `template/` originate here.
