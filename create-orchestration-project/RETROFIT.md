# Retrofit Mode — Orchestration-ify an Existing Repo

Invoked via `create-orchestration-project retrofit <path>`. Adds the full `.claude/` orchestration scaffold to an EXISTING git repo without destroying the sponsor's prior work.

The retrofit reuses the same Phase 1–7 interview as `new` mode. The differences are in pre-flight checks, the merge rules in Phase 8 step 2, the skipping of `git init` and `gh repo create` (steps 1 and 4), and a default-branch detection in step 6.

## Preconditions (hard gates, checked before Phase 1)

The skill aborts with a clear message if any of the following fail:

1. **`<path>` exists.** Otherwise: "Path not found. Did you mean `new` mode to create the project?"
2. **`<path>` is a git repo.** Verify with `git -C <path> rev-parse --git-dir`. If not: "Not a git repo. Run `git init` at `<path>` first, then retry — or use `new` mode."
3. **`<path>` has remote `origin`.** Verify with `git -C <path> remote get-url origin`. If missing: "Repo has no `origin` remote. Add it manually and retry."
4. **`<path>` is NOT already scaffolded.** Detected by the presence of `<path>/.claude/agents/TEAM.md` OR `<path>/.claude/hooks/maintain-docs-stop.sh`. If either exists:
   - Also in `KNOWN_PROJECTS.md` → suggest `port-improvements <project>` instead.
   - Not in `KNOWN_PROJECTS.md` → suggest `register <path>` (with `--force` retrofit available if sponsor explicitly wants to overwrite).
5. **No persona branch collisions.** For each proposed `<role>/idle`, check `git -C <path> show-ref --verify refs/heads/<role>/idle`. Collect collisions; do NOT abort yet — surface them in the Phase 7 confirmation block as "branches that will be skipped."

## Phase 1–4 — Same as `new` mode

The interview is identical. Project name, vision, V1 cut, constraints, persona roster — all reused unchanged.

## Phase 5 — Backends (tracker capture)

Same question set as `new` mode. The skill captures the sponsor's backend choice and the tracker config.

### When sponsor picks `azure-devops`

Per the Q6 decision (manual-board): the skill does NOT call `az boards` to inspect or modify anything. It only captures references the sponsor provides:

- **org-url** — e.g. `https://dev.azure.com/MyOrg`
- **project** — Azure DevOps project name
- **process-template** — `Scrum` (default) / `Agile` / `CMMI` / `Basic`. Confirm with sponsor; do not assume.
- **area-path** — full area path (e.g. `MyProject\Orchestration`)
- **iteration-path** — full iteration path (e.g. `MyProject\Sprint 1`)
- **board-name** — the board the sponsor created
- **work-item-types** — defaults per process template (Scrum: `Product Backlog Item`, `Task`, `Bug`). Sponsor confirms or overrides.
- **status-workflow** — the columns/states on the sponsor's board, in order. **Sponsor types this verbatim**; do not assume Scrum defaults if the company customized them. Examples:
  - Default Scrum: `New` → `Approved` → `Committed` → `Done`
  - Customized example: `New` → `Refined` → `In Progress` → `Code Review` → `Done`
  - The skill uses what the sponsor types — even if it diverges from textbook Scrum.

The captured `status-workflow` drives the persona ownership rules in CLAUDE.md and the dispatch-template lifecycle block (e.g. "developer/persona owns `New → In Progress` on dispatch, `In Progress → Code Review` on PR open, orchestrator handles `Code Review → Done` on merge"). Map sponsor states to the three lifecycle transitions explicitly during Phase 5 — show the mapping back to the sponsor and confirm before advancing.

### When sponsor picks `clickup`, `linear`, `jira`, `github-issues`, `none`

- `clickup` — full template wired (this is the original path).
- `linear` / `jira` / `github-issues` — warn that these are not yet fully wired; scaffold with placeholders + manual-setup TODO blocks in CLAUDE.md.
- `none` — agents skip tracker-status-flip blocks entirely.

## Phase 6 — Generate scaffold (NEW pre-Phase-6 collision gate added)

Before generating the in-memory file list, the skill scans `<path>` for every file it would write and classifies each:

| Status | Meaning | Default action |
|---|---|---|
| `new` | Path doesn't exist in `<path>` | Write |
| `would-overwrite` | Path exists and is one of: `CLAUDE.md` | Refuse — sponsor manually merges (see below) |
| `merge-needed` | Path exists and the skill knows how to merge | `.gitignore` append-with-dedupe; `settings.json` JSON deep-merge |
| `would-overwrite-template-managed` | Path exists under `.claude/agents/`, `.claude/hooks/`, `.claude/skills/maintain-docs/`, `.claude/decisions-while-away.md`, `.claude/away-queue.md` | Refuse and abort unless `--force` — these should have been caught by the precondition #4 check; reaching here means partial prior scaffold |

Present the classification to the sponsor as a table. Sponsor confirms per category before Phase 7.

### Merge rules

#### `.gitignore`

For each line in `template/.gitignore` not already present in `<path>/.gitignore`, append. Skip lines already present. Preserve all sponsor entries and ordering.

#### `settings.json`

Read `<path>/.claude/settings.json` if it exists. Deep-merge with `template/settings.json` substituted output:

- `env` — union keys; sponsor's existing values win on collision (do NOT overwrite sponsor's env).
- `permissions.allow` — union arrays, dedupe; preserve sponsor entries.
- `hooks` — union by hook event (`SessionStart`, `Stop`, etc.); for each event, append the skill's hook commands AFTER any sponsor commands; do NOT remove sponsor hooks.

If no existing `settings.json`, write the substituted template directly.

#### `CLAUDE.md`

**Refuse to overwrite** when the file exists. Per the Q2 decision, the skill instead:

1. Generates the full intended CLAUDE.md content in memory (with all placeholders substituted).
2. Writes it to `<path>/.claude/CLAUDE.md.proposed` (a temp file inside `.claude/` — not the project root).
3. Surfaces a message: "Your existing `CLAUDE.md` was preserved. The orchestration brief I would have written is at `<path>/.claude/CLAUDE.md.proposed`. Review and merge into your `CLAUDE.md` manually, then delete the `.proposed` file."
4. Phase 7's confirmation block lists this as `MANUAL MERGE REQUIRED: CLAUDE.md`.

Sponsor must complete this merge before the first orchestrator session — otherwise `session-start-read-docs.sh` will load a CLAUDE.md without orchestration rules.

## Phase 7 — Confirmation block (retrofit-flavored)

The block is the same shape as `new` mode but with retrofit-specific lines:

```
About to execute the following retrofit at <path> — REVIEW CAREFULLY:

Existing repo detected: <path>
Existing remote: <repo-url>
Default branch detected: <branch>  (via git symbolic-ref refs/remotes/origin/HEAD, fallback probed main → master → trunk)

External actions:
  - git init: SKIPPED (repo already exists)
  - gh repo create: SKIPPED (using existing remote)
  - <tracker-create-call if backend supports auto-create, else SKIPPED>
  - git worktree add for <N - K> personas (K skipped due to branch collision)

File writes (<M> files):
  - <path 1> (new)
  - <path 2> (merge: append-dedupe)
  - <path 3> (merge: JSON deep-merge)
  - ...

Manual merge required:
  - CLAUDE.md — proposed orchestration brief written to .claude/CLAUDE.md.proposed; merge by hand before first session.

Branch collisions (worktree create will be SKIPPED for these):
  - <role>/idle — already exists

Worktrees to create:
  - <path>-<role>-wt  (branch: <role>/idle, base: <detected-default-branch>)
  - ...

Proceed? Y / cancel / show <file> / change <thing>
```

Refuse to act on anything except `Y`.

## Phase 8 — Execute (retrofit-modified)

1. **SKIP** `mkdir -p`, `git init` — repo already exists.
2. Write every file from the approved plan per the merge rules above. `CLAUDE.md` writes to `.proposed`, NOT the live file.
3. `git -C <path> add .claude/ .gitignore && git -C <path> commit -m "Retrofit: add orchestration scaffold"`. (Sponsor can `git revert HEAD` if anything's off — that's the safety net.)
4. **SKIP** `gh repo create` and push — using existing remote.
5. **Tracker setup** — backend-conditional:
   - `clickup` — call `mcp__clickup__create_list` to create the project's list under the sponsor's workspace.
   - `azure-devops` — SKIP creation (sponsor created the board manually); record references in `.claude/CLAUDE.md.proposed` and `agents/TEAM.md` and `agents/dispatch-template.md` from the captured Phase 5 config.
   - `linear` / `jira` / `github-issues` — SKIP creation; insert manual-setup TODO comment in the generated docs.
   - `none` — SKIP entirely.
6. Create per-role worktrees:
   - Detect default branch: `git -C <path> symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@'`. Fallback probe order if that fails: `main` → `master` → `trunk`. Abort with a clear message if none resolve.
   - For each persona NOT in the collision list: `git -C <path> worktree add <worktree-base>-<role>-wt -b <role>/idle <detected-default-branch>`.
   - For each persona IN the collision list: skip with note. Surface in the post-execution summary.
7. Append the project to `KNOWN_PROJECTS.md` with `bootstrap-mode: retrofit`.

## Phase 9 — Hand off (same as `new`, plus retrofit-specific notes)

The standard Project-Lead-dispatch brief, plus these retrofit-only notes in the summary:

- **CLAUDE.md merge reminder** — if `.proposed` exists, sponsor must merge before first orchestrator session.
- **Branch-collision summary** — list any `<role>/idle` worktrees that were skipped; sponsor decides whether to manually rename the existing branch and re-run the worktree create.
- **Tracker setup reminder** — if AzDO, remind sponsor that PBI/Task creation lives on the manually-created board; the Project Lead's first dispatch should be to create the first M1 PBIs.

## Lessons-learned capture (first retrofit only)

The first real retrofit will surface details the skill doesn't yet handle well (especially around AzDO process-template variants, company-customized state names, area/iteration-path conventions, `az boards` permission scopes). After the first retrofit completes:

1. Sponsor and skill maintainer review what was rigid, surprising, or missing.
2. Update `RETROFIT.md` (this file), `SKILL.md` Phase 5, and `template/` as needed.
3. Append a `## Lessons learned — <date> — <project>` section at the bottom of this file with bullets for: (a) what the skill got wrong, (b) what the sponsor had to do manually, (c) what the skill should auto-handle next pass.

This is a process note, not code. The first retrofit is treated as the calibration run for the AzDO path.

---

## Hard rules (retrofit-specific)

- **Never overwrite `<path>/CLAUDE.md`.** Refuse-and-proposed is the only mode.
- **Never delete sponsor files.** Retrofit is additive only; deletion is `unretrofit`'s job.
- **Never assume default-branch == `main`.** Detect via `git symbolic-ref` with probe fallback.
- **Never call `az boards` / `gh issue` / similar to provision the tracker board.** Sponsor creates it; skill captures references.
- **Refuse to retrofit a partially-scaffolded `.claude/`** without explicit `--force`. The precondition gate is the safety net.
