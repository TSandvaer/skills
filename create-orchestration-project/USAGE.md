# How to Use & Test `create-orchestration-project`

Practical guide for picking up the skill later. Read this first; then read [DESIGN.md](DESIGN.md) when you need to understand *why* something is the way it is.

## TL;DR

```
# Bootstrap a new orchestrated project (full flow):
/create-orchestration-project

# Or natural-language equivalents:
"create orchestration project"
"bootstrap a new orchestrated project"
"set up a new team project like ClaudeTeam"

# Register an existing project in the skill's registry (no scaffold):
/create-orchestration-project register <absolute-path-to-project>

# Port template improvements from a registered project:
/create-orchestration-project port-improvements <project-name>
```

The skill runs 8 gates. Sponsor answers Y / no / edit at each. The final gate (Phase 7) is non-skippable and lists every external action before any happens.

## Before you invoke

Pre-requisites the skill assumes are in place:

- [ ] `gh` CLI installed and authenticated (`gh auth status` returns 0).
- [ ] Git installed and configured.
- [ ] Node available (used by the hook scripts).
- [ ] You have permission to create repos under the target GitHub owner.
- [ ] ClickUp MCP server is running and connected (check the system reminder at session start for `mcp__clickup__*` tools — if they're listed, you're good).
- [ ] You have a target directory in mind for the new project's root (e.g. `c:\Trunk\PRIVATE\NewProject`). The directory should NOT exist yet — the skill creates it.
- [ ] You know the GitHub repo name you want (will become `<owner>/<repo-name>`).

If any of the above is missing, the skill may fail partway through Phase 8 and leave you with a half-bootstrapped project. See [Recovery](#recovery-if-something-goes-wrong).

## Walk-through of a real invocation

Here's what the conversation will look like, gate by gate. Use this to know what to expect.

### Phase 1 — Project intent

Skill: *"Describe the project in 1–3 sentences."*

You: *"A VS Code extension that lets developers visualize their git commit graph as a 3D city, where each commit is a building and each branch is a street."*

Skill: *"Got it — project name slug: `git-city-3d`. One-sentence summary: 'VS Code extension that visualizes commit history as a navigable 3D city.' Match? Y / fix the summary / start over."*

You: *"Y"*

### Phase 2 — Interview depth

Skill presents three options:

1. **Vision** (deepest)
2. **V1-only** (fast prototype)
3. **Vision-then-V1** (recommended default)

Pick one. Don't pick V1-only just to save time unless you've genuinely thought through the long-term shape.

### Phase 3 — Interview

The skill asks 5–17 questions depending on depth, one at a time. Don't try to skim and answer in a block. Each question is calibrated to surface something the V1 plan needs.

After each sub-phase the skill cites your answers back. **If the cite-back captures something wrong, fix it now** — don't say Y and figure you'll edit V1-PLAN.md later. The skill writes V1-PLAN.md from the cite-back, not from your original answers.

At the end of Phase 3, the skill presents a draft `docs/V1-PLAN.md`. Read it carefully. This is the most important review. Once you say Y, this becomes the project's V1 plan and the team starts dispatching from it.

### Phase 4 — Persona roster

Skill: *"Based on the project flavor, I propose this roster:*
- *Nora — Project Lead (opus)*
- *Felix — Senior Dev: extension host (opus)*
- *Maya — Senior Dev: 3D rendering (opus)*
- *Sage — QA (opus)*
- *Bram — Research Consultant on git internals (sonnet)*

*5 personas. Approve as-is, or redline."*

You can: approve, rename a persona ("call Maya 'Riley' instead"), drop a persona ("we don't need a Research Consultant"), add one ("add a UX Designer named Iris"), or swap models ("make Maya sonnet").

### Phase 5 — Backends

Skill: *"Issue tracking: ClickUp (default — workspace 90151646138, space 90156932495) / Linear / Jira / Azure DevOps / GitHub Issues / none?"*

You: *"ClickUp"* (or name an alternate)

Skill: *"Source control: GitHub (default — owner `TSandvaer`) / GitLab / Bitbucket / Azure Repos / local-only?"*

You: *"GitHub, public repo"*

If you pick a non-default backend, the skill will warn that it doesn't have a fully-templatized variant for that backend and ask whether to scaffold with placeholders + a manual-setup TODO.

### Phase 6 — File list confirmation

Skill presents the list of files it's about to generate (around 20 files) with a one-line description per file. This is your last chance to drop a file ("we don't need testing-strategy.md, it's a research spike") or edit content before the final confirmation.

### Phase 7 — Final confirmation (HARD GATE)

Skill presents the full action plan:

```
About to execute the following — REVIEW CAREFULLY:

External actions:
  - git init at c:\Trunk\PRIVATE\git-city-3d
  - gh repo create TSandvaer/git-city-3d --public and push
  - mcp__clickup__create_list "git-city-3d" under workspace 90151646138, space 90156932495
  - git worktree add for each of 5 personas

File writes (20 files):
  - c:\Trunk\PRIVATE\git-city-3d\CLAUDE.md
  - c:\Trunk\PRIVATE\git-city-3d\.gitignore
  ...

Worktrees to create:
  - c:\Trunk\PRIVATE\git-city-3d-nora-wt   (branch: nora/idle)
  - c:\Trunk\PRIVATE\git-city-3d-felix-wt  (branch: felix/idle)
  ...

Proceed? Y / cancel / show <file> / change <thing>
```

**Read this block.** Do not Y-by-reflex. If something looks off — wrong path, wrong repo name, wrong worktree count — say `cancel` or `change <thing>`.

### Phase 8 — Execute

Once you say Y, the skill executes in order: git init → file writes → first commit → gh repo create + push → ClickUp list create → worktree creates → KNOWN_PROJECTS.md update.

The skill emits progress as it goes. Anything that fails should surface a clear error — but see [Recovery](#recovery-if-something-goes-wrong) for what to do if it doesn't.

### Phase 9 — Handoff

Skill ends with a copy-pasteable dispatch brief for the new project's Project Lead. **Do not run that dispatch from this session.** Start a fresh Claude Code session in the new project directory (so the SessionStart hooks activate), then dispatch the Project Lead.

## How to test the skill safely

Before running on a real project, do at least one of these:

### Option A — Dry-run conversational test (no side effects)

1. Invoke the skill in a fresh Claude Code session.
2. Pick a throwaway project description ("a CLI tool that converts CSV to YAML").
3. Walk through Phases 1–6 normally.
4. At Phase 7, **say `cancel`** instead of Y.
5. Note any issues you saw (vague cite-backs, persona proposals that didn't fit, missing template placeholders, confusing prompts).
6. Report back so the skill can be tightened.

This costs nothing — no files written, no repo created, no ClickUp list created.

### Option B — Bootstrap a throwaway project end-to-end

1. Invoke the skill, give it a throwaway project name like `claudeteam-test-bootstrap-2026-05-23`.
2. Walk through to Phase 7.
3. Say Y. The skill creates everything.
4. Verify the result:
   - Files written: `cd c:\Trunk\PRIVATE\claudeteam-test-bootstrap-2026-05-23 && ls`
   - Repo created: `gh repo view TSandvaer/claudeteam-test-bootstrap-2026-05-23`
   - ClickUp list created: visit the ClickUp board, look for the new list
   - Worktrees: `git worktree list` in the new project
5. **Throw it away** when done: delete the repo (`gh repo delete TSandvaer/claudeteam-test-bootstrap-2026-05-23 --yes`), the ClickUp list (manually), the worktrees (`git worktree remove`), the project directory (`rm -rf c:\Trunk\PRIVATE\claudeteam-test-bootstrap-2026-05-23 c:\Trunk\PRIVATE\claudeteam-test-bootstrap-2026-05-23-*-wt`), and the registry entry (edit `KNOWN_PROJECTS.md`).

### Option C — Run on a real project you actually want

Skip the test. If the skill fails partway, see [Recovery](#recovery-if-something-goes-wrong).

Honestly: the first real run will surface more issues than a dry-run because real sponsor intent is messier than test inputs. If you have a small real project you want to bootstrap, that's a fine first test.

## What to watch for during a real bootstrap

Things that should make you pause:

| Signal | What it means | What to do |
|---|---|---|
| Skill cites back something different from what you said | Either you were vague or the skill misunderstood | Fix the cite-back at the gate; don't say Y |
| Skill proposes a persona role that doesn't seem to fit the project | Project flavor wasn't well-captured in Phase 3 | Drop or replace the persona in Phase 4 |
| File list in Phase 6 includes something irrelevant (e.g. `testing-strategy.md` for a research spike) | Template is opinionated; project doesn't need it | Drop the file in Phase 6 |
| Phase 7 action block has wrong paths, wrong repo name, wrong worktree count | Earlier phase produced the wrong value | Say `cancel` and start over (or `change <thing>` to re-input) |
| `gh repo create` fails with auth error | `gh` not authenticated to the right account | Cancel, run `gh auth login`, re-invoke |
| `mcp__clickup__create_list` fails | ClickUp MCP not available, or workspace ID wrong | See risk 9 in DESIGN.md; may need to create list manually and paste ID |
| Worktree creation fails because directory exists | Prior bootstrap attempt left state | See [Recovery](#recovery-if-something-goes-wrong) below |
| Files have leftover `{{PLACEHOLDER}}` after Phase 8 | Substitution missed a token | Edit the files manually post-bootstrap; note the gap so the skill can be fixed |

## Recovery if something goes wrong

The skill is not transactional. If Phase 8 fails midway, you may have a partial state.

### Common partial states

**File writes succeeded but `gh repo create` failed:**
- You have a local project directory + first commit, no remote.
- Recovery: either fix the auth issue and run `gh repo create` manually + `git push -u origin main`, OR delete the project directory and re-invoke the skill.

**`gh repo create` succeeded but ClickUp list creation failed:**
- You have a GitHub repo + local files, no ClickUp board.
- Recovery: manually create the ClickUp list in the workspace, then edit `CLAUDE.md` and `agents/TEAM.md` to substitute the new list ID for the placeholder.

**Everything succeeded except worktree creation:**
- You have the repo + ClickUp list + files, no worktrees.
- Recovery: run `git worktree add ../<project>-<role>-wt -b <role>/idle origin/main` for each persona manually.

**Skill produces leftover `{{TOKEN}}` in committed files:**
- You have a project that looks half-finished.
- Recovery: grep the project for `{{` (`rg '\{\{' --type md`), substitute manually, commit a "fix scaffolding placeholders" patch. Note the bug so the skill can be fixed.

### Hard reset

If recovery feels too messy:

1. `gh repo delete <owner>/<repo-name> --yes` (irreversible — be sure)
2. Manually delete the ClickUp list via the ClickUp UI
3. `git worktree remove <each worktree>` for any that were created
4. `rm -rf c:\Trunk\PRIVATE\<project-name>` and `rm -rf c:\Trunk\PRIVATE\<project-name>-*-wt`
5. Edit `~/.claude/skills/create-orchestration-project/KNOWN_PROJECTS.md` to remove the partial registry entry
6. Re-invoke the skill from scratch

## Sub-modes

### `register <path>` — record an existing project

When to use: you have an orchestration project (created manually before this skill existed, or imported from another machine) and want `port-improvements` to be able to find it.

What it does:
- Reads the project's CLAUDE.md, `.claude/agents/TEAM.md`, and `.claude/settings.json` to gather metadata.
- Asks the sponsor to confirm: project name, repo URL, ClickUp list ID, persona list.
- Appends an entry to `KNOWN_PROJECTS.md`.
- **No files are written outside the skill's own registry.**

This is a safe, reversible operation.

### `port-improvements <project-name>` — pull template upgrades

When to use: a registered project's `.claude/` has improved since the skill's `template/` was last updated, and you want to pull those improvements back into the template for future bootstraps.

What it does:
- Looks up the project in `KNOWN_PROJECTS.md`.
- Diffs each `template/` file against its counterpart in the registered project (with placeholder normalization).
- Presents each non-trivial diff for sponsor decision: port to template / skip / needs-judgment.
- Applies approved ports to `template/` files.
- Logs the port pass in `PORTING.md`.

This sub-mode is described but **not yet fully exercised**. Expect rough edges; see DESIGN.md risk 6.

## Files in the skill — what to read when

When you come back to the skill later and need to remember something:

- **What does the skill do, and what are the trigger phrases?** → `SKILL.md` (entry point)
- **How do I use it / test it?** → this file (`USAGE.md`)
- **Why was it designed this way, what are the risks, what's the roadmap?** → `DESIGN.md`
- **What's the interview script?** → `INTERVIEW.md`
- **What persona roles exist?** → `PERSONA_LIBRARY.md`
- **Which projects on this machine are registered?** → `KNOWN_PROJECTS.md`
- **How do I port improvements from a registered project back?** → `PORTING.md`
- **What does the new project actually receive?** → walk `template/`

## What's expected of you, the sponsor

The skill does the mechanical bootstrap. It does NOT:

- Decide your project's vision for you.
- Decide the right out-of-scope cuts.
- Pick the right roster for the project (it proposes; you confirm).
- Write your architecture (that's M1 work for the Project Lead).
- Make trade-off calls between budget and scope.

You bring the judgment. The skill brings the typing.

## Open items for picking up later

These are the things the orchestrator and sponsor agreed were worth doing but haven't been done yet (mirroring the "Future adaptations" section of DESIGN.md):

- [ ] Run a real or throwaway end-to-end bootstrap to validate Phase 8 execution choreography.
- [ ] Add Phase 5.5 prerequisite checks (`gh auth status`, ClickUp MCP availability, worktree directory cleanliness).
- [ ] Add explicit "verify no leftover `{{` placeholders" step in Phase 6.
- [ ] Add name-collision check in Phase 4 against `KNOWN_PROJECTS.md` (warn if a proposed persona name is already in use elsewhere).
- [ ] Implement and test the `register` sub-mode (currently described but not exercised).
- [ ] Implement and test the `port-improvements` sub-mode.
- [ ] Decide whether to add backend-specific template variants (`template-clickup/`, `template-linear/`, etc.) or stay with ClickUp-flavored + manual-fix-for-alternates.
- [ ] Decide whether the hook scripts need a PowerShell variant for Windows-without-Git-Bash users.

When you next pick up the skill, work through this list in priority order: the end-to-end test is the highest-leverage item because it surfaces gaps the design conversation didn't anticipate.
