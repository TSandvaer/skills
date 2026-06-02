---
name: create-orchestration-project
description: Bootstrap a brand-new orchestrated Claude Code project — interview the sponsor for vision + V1 scope, propose a project-tailored persona roster, then generate the full `.claude/` scaffolding (CLAUDE.md, agents, docs, hooks, maintain-docs skill, settings, decisions/away logs), initialize the GitHub repo, create the tracker board (ClickUp / Azure DevOps / etc.), and create per-role git worktrees. Use when the user says "create orchestration project", "/create-orchestration-project", "bootstrap a new orchestrated project", "set up a new team project like ClaudeTeam", or wants to start a multi-agent orchestrated project from scratch. Also supports sub-modes `register <path>` (record an existing orchestrated project in the registry without scaffolding), `port-improvements <project>` (diff a registered project's `.claude/` against this skill's `template/` and propose upgrades), `retrofit <path>` (add orchestration scaffolding to an EXISTING non-orchestrated git repo without destroying sponsor's prior work — trigger phrases: "retrofit", "orchestration-ify this existing repo"), and `unretrofit <path>` (surgically remove orchestration from a registered project — trigger phrases: "unretrofit", "remove orchestration from project"). The skill is tracker-agnostic: ClickUp and Azure DevOps are fully wired; Linear / Jira / GitHub Issues are placeholder-only. Each phase is a hard gate — the sponsor approves before the skill advances. The final scaffold step ALWAYS presents a confirmation block listing every external action (repo push, tracker setup, file writes, worktree creates) and refuses to act without an explicit Y from the sponsor.
---

# Create Orchestration Project

Spin up a brand-new orchestrated Claude Code project the same way `ClaudeTeam` was bootstrapped — interview, plan, then scaffold. The output is a complete `.claude/`-equipped project with a curated persona roster, dispatch conventions, hooks, the maintain-docs skill, and per-role git worktrees, ready for the Project Lead's first dispatch.

This skill is **global** and lives at `~/.claude/skills/create-orchestration-project/`. The `template/` subdirectory contains the universal scaffolding pieces (copied verbatim from a verified pattern source). Project-specific files (CLAUDE.md, persona files, V1-PLAN.md, docs/architecture-overview) are generated from the sponsor's interview answers.

## Sub-modes

Parse the first argument:

- `(no arg)` or `new` → **bootstrap mode** (default; full interview + scaffold against a greenfield path).
- `register <path>` → record an existing orchestrated project in `KNOWN_PROJECTS.md`. Skip the interview entirely; just append to the registry and confirm. Useful for pre-existing projects that should be available to `port-improvements` or `unretrofit`.
- `port-improvements <project-name>` → diff the named project's `.claude/` against this skill's `template/` and propose template upgrades. Follow `PORTING.md`.
- `retrofit <path>` → run the full Phase 1–7 interview against an EXISTING git repo at `<path>`. Skips Phase 8 steps 1 (`git init`) and 4 (`gh repo create`). Applies merge rules (not overwrites) to existing files. Follow `RETROFIT.md`.
- `unretrofit <path>` (or `<project-slug>`) → surgically remove orchestration scaffolding from a registered project. Preserves sponsor's `CLAUDE.md` and `.claude/docs/` by default. Never touches the tracker (ClickUp list / AzDO board / etc.) — sponsor cleans up tracker manually. Supports flags `--nuclear`, `--keep-worktrees`, `--force-unretrofit`. Follow `UNRETROFIT.md`.

For `register`, `port-improvements`, `retrofit`, and `unretrofit`, follow the dedicated paths (the latter two use the Phase 1–7 interview where noted; the former two skip every phase). `unretrofit` is the only sub-mode that does not run any phase of the interview.

## Phase 1 — Parse the sponsor's intent (gate)

Ask the sponsor to describe the project in their own words (1–3 sentences). Once they answer:

- Echo back the project name (slug-form, kebab-case) and a one-sentence summary.
- Confirm: "Does that match your intent? Y / fix the summary / start over."
- Refuse to advance until the sponsor confirms Y.

## Phase 2 — Choose interview depth (gate)

Offer three depths. Present them with concrete trade-offs:

1. **Vision** (deepest) — end-product-first interview, then V1 cut from it. Best when the long-term shape of the product matters more than first-shipped functionality. Phases 3a + 3b + 3c.
2. **V1-only** (fast prototype) — skip the vision interview, jump straight to V1 cut + constraints. Best when the sponsor knows exactly what they want shipped first and doesn't need to ground out-of-scope decisions in a longer vision. Phases 3b + 3c only.
3. **Vision-then-V1** (recommended default) — vision interview first, V1 cut grounded in vision answers, constraints last. Best when the sponsor wants out-of-scope decisions in V1 to have a "why" they can defend. Phases 3a + 3b + 3c.

Sponsor picks one. Skill cites back the choice before advancing.

## Phase 3 — Run the interview (gate per phase)

Follow `INTERVIEW.md` for the question lists. Apply the **cite-back rule** at the end of each sub-phase: echo the sponsor's answers in concrete terms, ask "is that right?", and refuse to advance until they confirm. Vague answers ("a tracker", "something fast") get pushed: "tracker of what, for whom, that shows what? Be specific."

Sub-phases:

- **3a. Vision** (skip in V1-only mode) — 7 questions.
- **3b. V1 cut** — 5 questions. The skill refuses to proceed past this without concrete in-scope and out-of-scope lists.
- **3c. Constraints** — 5 questions.

At the end of Phase 3, write a **draft V1 plan** as `<project>/docs/V1-PLAN.md` content (in-memory; not committed yet). Present it to the sponsor; ask "approve this V1 plan? Y / edit (specify) / start over." Refuse to advance without Y.

## Phase 4 — Propose persona roster (gate)

Based on the project flavor uncovered in Phase 3, propose a roster from `PERSONA_LIBRARY.md`. Roster composition follows the project's needs:

- A Project Lead is mandatory (every orchestrated project has one).
- Add Senior Dev pairs where peer-review pairing is needed.
- Add a QA role if the testing bar warrants it.
- Add a UX Designer role only if the project has visible user-facing surface.
- Add a Research Consultant if the project needs deep prior-art / domain investigation.
- Add a Domain Specialist if the project touches a niche domain (game design, ML ops, finance, etc.).

Propose specific names from the palette (or invented) and roles. Sponsor approves the roster as a whole, OR redlines individual entries (rename, drop, add, change role). Refuse to advance until the sponsor confirms the final roster.

## Phase 5 — Confirm backends (gate)

The skill is tracker-agnostic: ClickUp and Azure DevOps are fully wired; Linear / Jira / GitHub Issues are placeholder-only; `none` skips tracker integration entirely.

### 5a — Source control

Ask the sponsor: **Source control:** GitHub (default) / GitLab / Bitbucket / Azure Repos / local-only.

If non-GitHub, warn and ask whether to scaffold with placeholders + manual-setup TODO or fall back to GitHub. The skill must not silently ship a broken integration.

### 5b — Issue tracking

Ask the sponsor: **Tracker:** ClickUp (default) / Azure DevOps / Linear / Jira / GitHub Issues / none.

Capture backend-specific config as follows:

#### If `clickup`

- workspace-id, list-id (created in Phase 8 step 5), space-id, space-name
- status-workflow: default `to do` → `in progress` → `in review` → `complete` (4-state, case-sensitive). Sponsor may override.

#### If `azure-devops`

Per the manual-board policy (sponsor creates the board; skill captures references):

- **org-url** — e.g. `https://dev.azure.com/MyOrg`
- **project** — Azure DevOps project name
- **process-template** — `Scrum` (default) / `Agile` / `CMMI` / `Basic`. ASK; do not assume.
- **area-path** — full area path
- **iteration-path** — full iteration path
- **board-name** — the board the sponsor created
- **work-item-types** — defaults per process template (Scrum: `Product Backlog Item`, `Task`, `Bug`). Sponsor confirms or overrides.
- **status-workflow** — the columns/states on the sponsor's board, **in order**. Sponsor types this VERBATIM; do not assume textbook defaults if the company customized them.
- **lifecycle mapping** — map sponsor's states to the three lifecycle transitions explicitly:
  - "On dispatch: developer/persona moves ticket from `<first-state>` → `<active-state>` via `az boards work-item update --id <id> --state '<active-state>'`."
  - "On PR open: developer/persona moves ticket from `<active-state>` → `<review-state>` via same."
  - "On merge: orchestrator moves ticket from `<review-state>` → `<done-state>` via same."
  - Show the mapping back to sponsor; refuse to advance until confirmed.

#### If `linear` / `jira` / `github-issues`

Warn: "This backend is not yet fully wired. Scaffolding will include a placeholder block + manual-setup TODO comments. You'll need to populate IDs and write the lifecycle block by hand." Proceed only with sponsor's explicit OK.

#### If `none`

Agents skip the tracker-status-flip block entirely. CLAUDE.md, TEAM.md, and dispatch-template.md render with a "Tracker: none — work tracked in PR descriptions and decision logs." block.

### 5c — Substitution variables produced

Phase 5's output feeds the Phase 6 substitution layer:

- `{{TRACKER_NAME}}` — `ClickUp` / `Azure DevOps` / etc.
- `{{TRACKER_BLOCK}}` — rendered backend-specific block for CLAUDE.md (ClickUp: workspace/list/space lines + 4-state workflow; AzDO: org-url/project/process-template/area-path/iteration-path/board-name + sponsor's state list).
- `{{TRACKER_OP_IDS}}` — rendered Operational-IDs lines for TEAM.md.
- `{{TRACKER_LIFECYCLE_BLOCK}}` — rendered dispatch-template lifecycle block with the sponsor's state names baked in.
- `{{TRACKER_PERMISSIONS_PLACEHOLDER}}` — the sentinel string in `template/settings.json`. The skill replaces this single string element in `permissions.allow` with N backend-specific entries when writing the file:
  - `clickup` → `["mcp__clickup__clickup_get_task", "mcp__clickup__clickup_update_task", "mcp__clickup__clickup_create_task_comment", "mcp__clickup__clickup_create_task", "mcp__clickup__clickup_filter_tasks"]`
  - `azure-devops` → `["Bash(az boards work-item create:*)", "Bash(az boards work-item show:*)", "Bash(az boards work-item update:*)", "Bash(az boards query:*)", "Bash(az repos pr:*)"]`
  - `none` / `linear` / `jira` / `github-issues` → the sentinel is replaced with NO entries (effectively removed).

## Phase 6 — Generate the scaffold (in-memory, then present for review)

Generate every file the new project will need by:

- Copying `template/*` verbatim into the in-memory plan, substituting all `{{PLACEHOLDER}}` tokens.
- Generating `CLAUDE.md`, `agents/*.md`, `docs/V1-PLAN.md`, and any project-specific docs from the interview answers + roster.
- Building the worktree map (one worktree per persona).

Present the file list to the sponsor with a one-line description per file. Sponsor may redline (drop a file, edit content). Refuse to advance until the sponsor confirms the file list.

## Phase 7 — Final confirmation block (hard gate, always)

This is the only gate that cannot be skipped or relaxed. Before any external side effect, show:

```
About to execute the following — REVIEW CAREFULLY:

External actions:
  - git init at <project-root-path>
  - gh repo create <owner>/<repo-name> (--public | --private) and push
  - mcp__clickup__create_list "<list-name>" under workspace <id>, space <id>
  - git worktree add for each of <N> personas

File writes (<N> files):
  - <path 1>
  - <path 2>
  - ...

Worktrees to create:
  - <path>-<role>-wt  (branch: <role>/idle)
  - ...

Proceed? Y / cancel / show <file> / change <thing>
```

Refuse to act on anything except `Y`. On `cancel`, stop completely — the in-memory plan is discarded. On `show <file>`, print the file's full content and re-prompt. On `change <thing>`, return to Phase 6 with the requested change.

## Phase 8 — Execute (no gate; sponsor already approved)

Once `Y` is received in Phase 7, execute in this order:

1. `mkdir -p <project-root>`, `cd <project-root>`, `git init`.
2. Write every file from the approved plan. Apply correct permissions to `*.sh` (`chmod +x`). When writing `template/settings.json`, replace the `{{TRACKER_PERMISSIONS_PLACEHOLDER}}` string element in `permissions.allow` with the backend-specific entries from Phase 5c (or remove the sentinel entirely if backend is `none` / `linear` / `jira` / `github-issues`).
3. `git add . && git commit -m "Initial commit: V1 plan, scaffolding"`.
4. `gh repo create` and push.
5. **Tracker setup — backend-conditional:**
   - `clickup` — call `mcp__clickup__create_list` to create the project's list under the sponsor's workspace + space. Capture the returned list-id for `KNOWN_PROJECTS.md` and CLAUDE.md substitution.
   - `azure-devops` — SKIP creation (sponsor created the board manually per Q6). The captured Phase 5b references are already baked into the generated `CLAUDE.md` / `agents/TEAM.md` / `agents/dispatch-template.md` via the substitution layer.
   - `linear` / `jira` / `github-issues` — SKIP creation; the generated files contain manual-setup TODO blocks. Surface the TODO list in the final summary so sponsor knows what to wire up.
   - `none` — SKIP entirely.
6. Create per-role worktrees: `git worktree add ../<project>-<role>-wt -b <role>/idle origin/main` for each persona. (In `retrofit` mode, the default branch is detected — see `RETROFIT.md`.)
7. Append the new project to `~/.claude/skills/create-orchestration-project/KNOWN_PROJECTS.md` with `bootstrap-mode: new` (or `retrofit` if invoked via `retrofit <path>`) and the tracker-config block from Phase 5b.

Surface a final summary to the sponsor:

- Repo URL, tracker reference (ClickUp list URL / AzDO board name + org-url / "manual-setup TODO" for placeholder backends).
- Worktree paths.
- Commit SHA of the initial commit.
- Recommended next step: start a fresh Claude Code session in the new project directory (this activates the SessionStart hooks) and run `/auto-status local`. Then dispatch the Project Lead with the V1-PLAN.md to begin ticketization.

## Phase 9 — Hand off to Project Lead (recommendation only; sponsor executes)

Do NOT spawn the Project Lead from this skill — the user runs the dispatch from the new project's first session (so docs preload + auto-status hooks are active). Provide a copy-pasteable dispatch brief in the summary, with the tracker-name substituted:

```
Dispatch <project-lead-name> with: "You are Project Lead on the new <project-name>
project. Read .claude/docs/*.md and docs/V1-PLAN.md, then draft the M1 backlog
as dispatch-ready <{{TRACKER_NAME}}> tickets and recommend the first
parallel-dispatch wave."
```

For Azure DevOps projects, the Project Lead creates PBIs / Tasks via `az boards work-item create --type "Product Backlog Item" --title "<title>" --description "<body>" --area "<area-path>" --iteration "<iteration-path>"` (or the work-item-type defaults captured in Phase 5b).

## Retrofit mode — workflow (sub-mode entrypoint)

For full detail see [RETROFIT.md](RETROFIT.md). Summary:

- Invoked via `create-orchestration-project retrofit <path>`.
- Hard preconditions: `<path>` exists, is a git repo, has `origin` remote, is NOT already scaffolded (heuristic: presence of `.claude/agents/TEAM.md` or `.claude/hooks/maintain-docs-stop.sh`).
- Reuses Phase 1–7 verbatim. Phase 6 adds a pre-generation collision-scan gate; Phase 7's confirmation block shows existing-file decisions (new / merge / refuse-overwrite).
- Phase 8 modifications: SKIP step 1 (`git init`) and step 4 (`gh repo create`). Step 2 applies merge rules — `.gitignore` append-with-dedupe, `settings.json` JSON deep-merge, `CLAUDE.md` refuse-overwrite (writes `.claude/CLAUDE.md.proposed` for sponsor to merge by hand). Step 6 detects default branch via `git symbolic-ref refs/remotes/origin/HEAD` with probe fallback `main` → `master` → `trunk`, and skips persona worktrees whose `<role>/idle` branch already exists.
- `KNOWN_PROJECTS.md` entry uses `bootstrap-mode: retrofit`.
- First retrofit run also kicks off a lessons-learned capture (see `RETROFIT.md`).

## Unretrofit mode — workflow (sub-mode entrypoint)

For full detail see [UNRETROFIT.md](UNRETROFIT.md). Summary:

- Invoked via `create-orchestration-project unretrofit <path>` (or `<project-slug>`).
- Skips Phase 1–7 entirely. No interview.
- Hard preconditions: project is in `KNOWN_PROJECTS.md`; `<path>` exists and is a git repo; main worktree and all persona worktrees are clean (`git status --porcelain` empty); no `<role>/idle` branch has unmerged commits (overridable with `--force-unretrofit`).
- Surgical default removes: persona worktrees, `<role>/idle` branches, `.claude/agents/`, `.claude/hooks/`, `.claude/decisions-while-away.md`, `.claude/away-queue.md`, `.claude/auto-status.state`, `.claude/skills/maintain-docs/`, skill-managed keys from `.claude/settings.json`, the auto-status line from `.gitignore`, and the entry from `KNOWN_PROJECTS.md`.
- Preserves by default: `<path>/CLAUDE.md` (sponsor cleans up by hand — manual-cleanup note in summary), `<path>/.claude/docs/` (sponsor's accumulated knowledge), all non-template files, tracker resources (ClickUp list / AzDO board — sponsor deletes manually if desired).
- Flags: `--nuclear` (wipes entire `.claude/` including docs), `--keep-worktrees`, `--force-unretrofit`.
- Phase 7-style confirmation block applies — no execution without explicit `Y`.

## Gates summary (sponsor approval required at each)

| Phase | Gate                                          | Applies to                |
|------|------------------------------------------------|---------------------------|
| pre  | Retrofit precondition check (path is git repo + has remote + not already scaffolded) | retrofit only             |
| pre  | Unretrofit precondition check (in registry + clean worktrees + no unmerged persona-branch commits) | unretrofit only           |
| 1    | Project name + summary confirmed              | new, retrofit             |
| 2    | Interview depth chosen                        | new, retrofit             |
| 3a   | Vision answers cite-back confirmed (skipped in V1-only) | new, retrofit             |
| 3b   | V1 cut cite-back + draft V1-PLAN.md approved  | new, retrofit             |
| 3c   | Constraints cite-back confirmed               | new, retrofit             |
| 4    | Persona roster confirmed                      | new, retrofit             |
| 5    | Backends + tracker config confirmed (incl. AzDO state-mapping if azure-devops) | new, retrofit             |
| 6    | Generated file list confirmed (retrofit adds collision classification) | new, retrofit             |
| **7** | **Final confirmation block — Y required (never skipped)** | new, retrofit, unretrofit |

## Hard rules

- **Never extrapolate or fabricate** values (repo names, tracker IDs, file paths, persona names). Ask, or confirm with the sponsor before using. For Azure DevOps state names specifically: NEVER assume textbook Scrum / Agile defaults — the sponsor types the actual states verbatim because company customization is common.
- **Never execute Phase 8 actions without explicit Y in Phase 7.** The `Y` must be a fresh confirmation in the current turn, not inferred from earlier approvals.
- **Refuse to scaffold on vague answers.** If V1 in-scope is "make it good" or "a tool that helps users", apply the cite-back rule and push for concrete answers. The interview is the load-bearing part of the skill; don't shortcut it.
- **Never write outside `<project-root>` or this skill's own `~/.claude/skills/create-orchestration-project/KNOWN_PROJECTS.md`, `RETROFIT.md`, `UNRETROFIT.md`.**
- **Sub-agents the new project spawns inherit nothing from THIS session.** The Project Lead's first dispatch happens in a fresh Claude Code session inside the new project — the user, not this skill, opens that session.
- **Retrofit-specific:** never overwrite `<path>/CLAUDE.md` — refuse-and-write-`.proposed` is the only mode. Never assume default branch is `main` — detect via `git symbolic-ref` with probe fallback. Never call `az boards` / `gh issue` / similar to provision the tracker — sponsor provides references; skill captures them.
- **Unretrofit-specific:** never delete `<path>/CLAUDE.md` — sponsor cleans up by hand. Never delete `<path>/.claude/docs/` in surgical mode. Never call `mcp__clickup__delete_list` / AzDO board deletion / etc. — tracker resources are sponsor-managed. Refuse on dirty worktrees without `--force-unretrofit`. Refuse on projects not in `KNOWN_PROJECTS.md`.

## Background

This skill captures the bootstrap pattern validated on the ClaudeTeam project (2026-05-23). The template files are copied verbatim from that pattern source. As future orchestrated projects iterate on conventions (e.g. new hooks, refined dispatch templates, persona-file improvements), use `port-improvements` to diff and pull the upgrades back into `template/`.

`KNOWN_PROJECTS.md` is the registry of bootstrapped orchestration projects on this machine; `PORTING.md` describes the diff-and-pull workflow; `RETROFIT.md` and `UNRETROFIT.md` describe the existing-repo workflows.

### Tracker-agnostic rework (2026-05-23)

The skill was originally ClickUp-only. The tracker abstraction (`{{TRACKER_BLOCK}}`, `{{TRACKER_OP_IDS}}`, `{{TRACKER_LIFECYCLE_BLOCK}}`, `{{TRACKER_PERMISSIONS_PLACEHOLDER}}`) and the `retrofit` / `unretrofit` sub-modes were added together to support orchestration-ifying an existing Azure-DevOps-tracked repo. Azure DevOps is treated as a first-class backend on equal footing with ClickUp. The first real retrofit run will drive lessons-learned updates to this skill (see `RETROFIT.md`'s lessons-learned section).
