# Project Alignment Analysis

> Diff your current project's Claude setup against another project, and selectively adopt the rules, skills, hooks, and settings worth borrowing — nothing is ever copied automatically.

## What it does
Compares the **current project** (where the session runs) against a **target project** (a path you point at) across four dimensions — skills, hooks + settings, `CLAUDE.md` rules, and (for orchestrated projects only) agents/team roster. It scans the target **read-only**, ranks every borrow-worthy difference High/Medium/Low, and prints the whole landscape first. You then decide each candidate one at a time via Adopt / Adapt / Skip popups. Approved changes are assembled into a plan doc, self-verified (no internal conflicts, no clash with the current project, production-protection left intact, add/append-only), and applied to the **current project only** after one final go-ahead. If the target project could itself benefit from something the current project has, it also writes a reverse-handoff doc you can carry over by hand.

If a previous run in the *opposite* direction left a reverse-handoff in the target's tree (`handoff-to-<this-project>-*.md`), the skill reads it and folds it in as a **cross-check** — corroborating candidates it independently finds, catching ones it would have missed, and retiring stale ones — then flags any divergence in the report. The handoff is always treated as a hint to verify against the live trees, never as ground truth, and never replaces the skill's own independent analysis.

## When to use it
- "project alignment analysis" / "/project-alignment-analysis"
- "align my project with X" / "compare my setup to <other project>"
- "what can I borrow from <project>" / "see if my project can learn from <path>"
- Any time you name another project's path and ask what your project could improve.

## How to use it
1. Run the skill, optionally passing the target project's absolute path as the argument. If you don't, it asks for the path.
2. Read the ranked summary report (forward candidates, reverse candidates, auto-excluded — plus a handoff cross-check note if a prior opposite-direction run left one).
3. Answer the per-candidate Adopt / Adapt / Skip popups (grouped by dimension, High value first).
4. Review the assembled plan doc and the self-verification checklist.
5. Click through the final apply gate: **Apply all / Apply a subset / Don't apply**.

## Inputs
- **target project path** — optional argument; the absolute path of the project to compare against. If omitted, the skill prompts for it. Must be a different path than the current project, and must contain a `.claude/` folder and/or `CLAUDE.md`.

## Output
- A ranked **summary report** printed to chat.
- A **plan doc** at `.claude/alignment/alignment-plan-<target>-<runtag>.md` in the current project.
- The **applied changes** (new skill folders, hook files + settings wiring, appended `CLAUDE.md` rules, added agents) — current project only, and only what you approved.
- An optional **reverse-handoff doc** at `.claude/alignment/handoff-to-<target>-<runtag>.md` when the target could adopt something from the current project.

## Guarantees (core promises)
- **Target is strictly read-only** — every write lands in the current project.
- **Nothing is adopted automatically** — every candidate needs an explicit click.
- **Production-protection is never weakened** — candidates touching a "never touch PROD" rule are auto-excluded.
- **Add/append only** — same-name collisions become an Adapt (merge/rename) decision, never an in-place overwrite.
- **Final apply needs an explicit go-ahead** — the verified plan requires one confirm-to-apply popup before anything is written.

## Prerequisites
None beyond a Claude Code session running inside the current project. The current project must have a `.claude/` folder and/or `CLAUDE.md` to align; the target must too. The agents/team comparison only runs when **both** projects are orchestrated (have `.claude/agents/` role files or a `team/STATE.md`).

## Installation
Unzip into your `.claude/skills/` folder (user-level `~/.claude/skills/` for everywhere, or
`<project>/.claude/skills/` for one project), then restart Claude Code or start a new session so
the skill is picked up.

## Files in this package
- `SKILL.md` — the skill definition Claude loads (the full 8-step flow and core promises).
- `README.md` — this file.
- `references/templates.md` — concrete output shapes for the summary report, plan doc, and reverse-handoff doc.
