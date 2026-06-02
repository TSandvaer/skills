# create-orchestration-project

Bootstraps a brand-new **orchestrated Claude Code project** from scratch. The skill interviews the sponsor for vision + V1 scope, proposes a project-tailored persona roster, then generates the full `.claude/` scaffolding and wires up the external surfaces:

- `.claude/` scaffolding — `CLAUDE.md`, agents, docs, hooks, the `maintain-docs` skill, settings, and decisions/away logs.
- A GitHub repo (initialized and pushed).
- A tracker board (ClickUp / Azure DevOps / etc.).
- Per-role git worktrees.

Every phase is a **hard gate** — the sponsor approves before the skill advances. The final scaffold step always presents a confirmation block listing every external action (repo push, tracker setup, file writes, worktree creates) and refuses to act without an explicit `Y`.

## When to use it

- "create orchestration project" / "/create-orchestration-project"
- "bootstrap a new orchestrated project" / "set up a new team project like ClaudeTeam"
- Any request to start a multi-agent orchestrated project from scratch.

## Sub-modes

- **`register <path>`** — record an existing orchestrated project in the registry without scaffolding.
- **`port-improvements <project>`** — diff a registered project's `.claude/` against this skill's `template/` and propose upgrades.
- **`retrofit <path>`** — add orchestration scaffolding to an *existing* non-orchestrated git repo without destroying prior work. (Triggers: "retrofit", "orchestration-ify this existing repo".)
- **`unretrofit <path>`** — surgically remove orchestration from a registered project. (Triggers: "unretrofit", "remove orchestration from project".)

## Tracker support

Tracker-agnostic by design. **ClickUp** and **Azure DevOps** are fully wired; **Linear / Jira / GitHub Issues** are placeholder-only.

## Layout

The `template/` directory holds the scaffolding that gets copied into new projects; `SKILL.md` plus the supporting docs (`DESIGN.md`, `INTERVIEW.md`, `PERSONA_LIBRARY.md`, `RETROFIT.md`, `UNRETROFIT.md`, `USAGE.md`, `KNOWN_PROJECTS.md`, `PORTING.md`) drive the skill's behavior.
