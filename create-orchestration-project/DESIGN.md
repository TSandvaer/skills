# `create-orchestration-project` — Design, Rationale, and Maintenance Notes

This document captures the **why** behind the skill, the **how** it was assembled, the design decisions that were made and what alternatives were considered, the **risks and gaps** in the current shape, and the **roadmap** for future evolution. Read this before making non-trivial changes to the skill so the change preserves the design intent rather than working against it.

## Table of contents

1. [Purpose](#purpose)
2. [Provenance — how the skill was made](#provenance--how-the-skill-was-made)
3. [Architecture and file layout](#architecture-and-file-layout)
4. [Key design decisions](#key-design-decisions)
5. [The gates — why so many](#the-gates--why-so-many)
6. [What's NOT in the skill (out-of-scope)](#whats-not-in-the-skill-out-of-scope)
7. [Potential problems and risks](#potential-problems-and-risks)
8. [Untested paths and validation gaps](#untested-paths-and-validation-gaps)
9. [Future adaptations and changes](#future-adaptations-and-changes)
10. [Maintenance workflow](#maintenance-workflow)
11. [Glossary of placeholders](#glossary-of-placeholders)

## Purpose

Bootstrapping a new orchestrated Claude Code project from scratch — repository init, ClickUp board setup, `.claude/` scaffolding with personas, dispatch templates, hooks, the maintain-docs skill, autonomy log, away queue, per-role git worktrees — takes several hours of careful, error-prone work. Most of those hours are spent re-typing or re-deriving content that's already converged across orchestrated projects on the same machine.

`create-orchestration-project` automates the structural bootstrap (the parts that are universal across orchestrated projects) while preserving the parts that genuinely need to be re-thought per project (the V1 scope, the persona roster, the architecture). The skill is **not a yes-machine**: it interviews the sponsor, applies a cite-back rule to push back on vague answers, and refuses to scaffold until the V1 plan is concrete enough to ship from.

In other words: the skill takes the **mechanical** work off the sponsor's plate (file creation, directory structure, hook wiring, ClickUp list creation) so the sponsor's attention is reserved for the **judgment** work (vision, scope, roster shape, backend choices).

### What "orchestrated project" means here

A Claude Code project where:

- The main session is the **orchestrator** (briefs, gates, merges — never codes).
- A small named-role team (Project Lead, dev pairs, QA, designer, etc.) does the work, each in their own git worktree.
- Coordination flows through standard artifacts: a CLAUDE.md, a `.claude/agents/` directory with persona files + dispatch template, `.claude/docs/` for trusted context, a ClickUp board (or equivalent) with a 4-state workflow, and hooks for SessionStart docs-preload + auto-status re-arm + Stop maintain-docs trigger.

The skill captures that shape and lets the sponsor instantiate it for a brand-new project in one guided pass.

## Provenance — how the skill was made

The skill was created on **2026-05-23**, immediately after the **ClaudeTeam** project itself was bootstrapped manually. ClaudeTeam was the first project to follow this orchestration shape; its `.claude/` directory and supporting documents were the verified pattern source.

### Build process (chronological)

1. **The sponsor (Thomas / `TSandvaer`) requested the skill** after observing that the manual ClaudeTeam bootstrap had produced a clean, reusable pattern. The request was specifically: extract the good practices, generalize them, and make a sponsor-grilling skill that turns any new project intent into a bootstrapped orchestration project.
2. **Four scoping questions** were asked of the sponsor before any drafting began:
   - Scope of the skill (does it own everything end-to-end, or just produce the V1 plan?). Decision: end-to-end, with hard gates per phase.
   - Persona generation (fixed six or project-tailored?). Decision: project-tailored from a role palette.
   - Interview depth (deep vision or fast V1?). Decision: sponsor picks Vision / V1-only / Vision-then-V1 (default).
   - Reusable parts (what's copied vs generated?). Decision: `template/` directory for universal copies, generation for project-specific files.
3. **Three meta questions** clarified backends, scope, and location:
   - Backends: skill asks sponsor at interview time (ClickUp+GitHub default; alternates negotiable).
   - Recursive bootstrap: skill is global at `~/.claude/skills/`, not project-local, with a `KNOWN_PROJECTS.md` registry pointing at existing orchestration projects so future template upgrades can pull improvements back.
   - Where it lives: global (same answer as above).
4. **Sponsor approved a layout** of ~18 files (which expanded to 20 actual files when fully enumerated).
5. **One final design call**: should the skill always present a final confirmation block before performing external actions? Sponsor: yes, hardcode that always.
6. **Files were drafted in this order** (chosen because the "brain" files inform the templates, not the other way around):
   - `SKILL.md` (entry point)
   - `INTERVIEW.md` (interview script)
   - `PERSONA_LIBRARY.md` (role palette)
   - `KNOWN_PROJECTS.md` (registry; ClaudeTeam pre-registered)
   - `PORTING.md` (improvement-pulling workflow)
   - Then all template files under `template/`.

### Pattern source

Every template file under `template/` originates as a copy from `c:\Trunk\PRIVATE\ClaudeTeam`'s `.claude/` (or `CLAUDE.md` for the project root file). The verbatim sources at copy time were:

| Template file | Source file in ClaudeTeam |
|---|---|
| `template/CLAUDE.md` | `c:\Trunk\PRIVATE\ClaudeTeam\CLAUDE.md` (placeholderized) |
| `template/agents/TEAM.md` | `c:\Trunk\PRIVATE\ClaudeTeam\.claude\agents\TEAM.md` (placeholderized) |
| `template/agents/dispatch-template.md` | `c:\Trunk\PRIVATE\ClaudeTeam\.claude\agents\dispatch-template.md` (placeholderized) |
| `template/agents/persona-template.md` | Distilled from `c:\Trunk\PRIVATE\ClaudeTeam\.claude\agents\nora.md` |
| `template/docs/orchestration-overview.md` | `c:\Trunk\PRIVATE\ClaudeTeam\.claude\docs\orchestration-overview.md` (placeholderized) |
| `template/docs/testing-strategy.md` | `c:\Trunk\PRIVATE\ClaudeTeam\.claude\docs\testing-strategy.md` (placeholderized) |
| `template/docs/architecture-overview-STUB.md` | Synthesized (no direct source — see [Key design decisions](#key-design-decisions)) |
| `template/hooks/session-start-read-docs.sh` | `c:\Trunk\PRIVATE\ClaudeTeam\.claude\hooks\session-start-read-docs.sh` (verbatim) |
| `template/hooks/session-start-auto-status.sh` | `c:\Trunk\PRIVATE\ClaudeTeam\.claude\hooks\session-start-auto-status.sh` (verbatim) |
| `template/hooks/maintain-docs-stop.sh` | `c:\Trunk\PRIVATE\ClaudeTeam\.claude\hooks\maintain-docs-stop.sh` (verbatim) |
| `template/skills/maintain-docs/SKILL.md` | The maintain-docs SKILL.md as loaded into context (verbatim) |
| `template/settings.json` | `c:\Trunk\PRIVATE\ClaudeTeam\.claude\settings.json` (small adjustments — vsce permission dropped since not universal) |
| `template/decisions-while-away.md` | `c:\Trunk\PRIVATE\ClaudeTeam\.claude\decisions-while-away.md` (verbatim) |
| `template/away-queue.md` | `c:\Trunk\PRIVATE\ClaudeTeam\.claude\away-queue.md` (verbatim) |
| `template/.gitignore` | `c:\Trunk\PRIVATE\ClaudeTeam\.gitignore` (verbatim — includes VS Code extension ignores that some projects won't need; see [Future adaptations](#future-adaptations-and-changes)) |

### Author attribution

The orchestrator (Claude Code session at commit `f9ff9f8` of ClaudeTeam) authored the skill in collaboration with the sponsor across approximately one hour of design + implementation conversation. No sub-agent dispatch was used — the skill is small enough (~3000 LOC across 20 files) that the orchestrator wrote it directly. This is captured here for honesty: the orchestrator-never-codes rule applies to **project code**, not to **meta-tooling like skills**.

## Architecture and file layout

```
~/.claude/skills/create-orchestration-project/
├── SKILL.md                    Entry point: trigger phrases, sub-modes, phases, gates
├── INTERVIEW.md                Interview script — Vision / V1-only / Vision-then-V1
├── PERSONA_LIBRARY.md          Role palette + project-flavor → roster mapping
├── KNOWN_PROJECTS.md           Registry of bootstrapped orchestration projects on this machine
├── PORTING.md                  Workflow for pulling improvements from registered projects back into template/
├── DESIGN.md                   THIS DOC — design, rationale, risks, maintenance
└── template/
    ├── CLAUDE.md               Universal CLAUDE.md with {{PLACEHOLDER}} tokens
    ├── settings.json           Hooks, env, permission allowlist (project-agnostic subset)
    ├── .gitignore              Standard ignores
    ├── decisions-while-away.md Empty autonomy log header
    ├── away-queue.md           Empty sponsor-sign-off queue header
    ├── agents/
    │   ├── TEAM.md             Roster topology + cross-review pairing (placeholders)
    │   ├── dispatch-template.md   Universal dispatch blocks
    │   └── persona-template.md Fillable per-persona schema
    ├── docs/
    │   ├── orchestration-overview.md   Dispatch + PR/merge + worktree protocol
    │   ├── testing-strategy.md         Three-layer testing model
    │   └── architecture-overview-STUB.md   Outline only (filled at M1 by Project Lead)
    ├── hooks/
    │   ├── session-start-read-docs.sh     Preload .claude/docs/*.md into context
    │   ├── session-start-auto-status.sh   Re-arm auto-status loop on session restart
    │   └── maintain-docs-stop.sh          Stop hook → invoke maintain-docs
    └── skills/maintain-docs/SKILL.md      The maintain-docs skill (project-local copy)
```

### Two-tier file separation

The skill distinguishes between:

1. **Brain files** (top-level): describe what the skill *does*. SKILL.md is the entry; INTERVIEW, PERSONA_LIBRARY, KNOWN_PROJECTS, PORTING are reference docs the SKILL.md cites by section. These files are read by the orchestrator when executing the skill — they're the load-bearing logic.
2. **Template files** (`template/`): what gets copied into the new project. These files are **never executed** by this skill — they're treated as data that gets placeholder-substituted and written into the new project's filesystem.

This separation is deliberate. A future improvement to the dispatch template (say, a new mandatory block) only requires editing `template/agents/dispatch-template.md`; no other skill files need to change. Conversely, a change to the interview script doesn't touch any template file.

### Why a `template/` subdirectory instead of inline content in SKILL.md

Alternative considered: bake the template content directly into SKILL.md as heredocs. Rejected because:

1. SKILL.md would balloon to ~2500 lines and become unreadable.
2. Updating a template file would require editing SKILL.md, increasing the risk of breaking the skill's brain logic when only updating a template.
3. The `port-improvements` sub-mode needs to diff against the template files individually — that's much easier when they're separate files on disk.

## Key design decisions

These are the load-bearing decisions. Changing them invalidates assumptions the rest of the skill makes.

### Decision 1 — Single skill, owns the full bootstrap, gated per phase

**Decision:** One skill that owns the entire bootstrap (interview → V1 plan → file generation → repo init → ClickUp setup → worktree creation → handoff to Project Lead). Each phase is a hard gate the sponsor must approve before the skill advances.

**Alternatives considered:**

- **Multi-skill pipeline** (e.g. `interview-sponsor` → `draft-v1-plan` → `scaffold-project` → `init-repo`). Rejected because the phases are tightly coupled — Phase 4 (persona roster) depends on Phase 3 (interview answers); Phase 6 (file generation) depends on all of Phases 3-5. Splitting into separate skills would require passing state between them (file-on-disk, conversation context, etc.) which adds complexity without value.
- **Stop after V1-PLAN.md** (the sponsor delegates scaffold execution to a separate command). Rejected because the highest leverage of the skill is the scaffold execution; the sponsor explicitly asked for end-to-end.

**Why gates per phase matter:** The skill is making decisions that will live for the project's lifetime (persona names, repo URL, ClickUp list ID). A bad call in Phase 4 (wrong roster shape) is much cheaper to fix while still in the interview than after the scaffold lands on disk. Gates are the release valve.

### Decision 2 — Sponsor picks interview depth

**Decision:** Phase 2 asks the sponsor to choose Vision / V1-only / Vision-then-V1 (recommended default).

**Why:** Different projects need different depth. A research spike that might be thrown away in a week doesn't benefit from a 7-question vision interview. A flagship product that will exist for years deserves it. Defaulting to Vision-then-V1 captures the case where the sponsor isn't sure — the V1 cut benefits from being grounded in a longer vision.

**Risk:** Sponsors will pick V1-only by default to "save time," producing scaffolds where the out-of-scope decisions don't have a defensible "why." Mitigation: the recommended-default label nudges toward Vision-then-V1, and INTERVIEW.md warns explicitly that V1-only mode skips the vision phase.

### Decision 3 — Project-tailored persona roster, not fixed six

**Decision:** Phase 4 proposes a roster derived from project flavor + the role palette in PERSONA_LIBRARY.md. The sponsor approves/renames/edits.

**Alternatives considered:**

- **Fixed six personas (Nora/Iris/Felix/Maya/Sage/Bram)** every time. Rejected because a CLI tool doesn't need a UX Designer, a research spike doesn't need a QA, etc. Forcing the full six produces persona files for roles that never get dispatched.
- **Sponsor names all personas from scratch**, with the skill not suggesting any. Rejected because most sponsors don't have a name pool in mind and would either reuse ClaudeTeam's names accidentally or get stuck choosing.

**Trade-off:** The role palette in PERSONA_LIBRARY.md is opinionated. If a sponsor wants a role the palette doesn't cover (say, "DevOps Engineer"), they need to extend the palette or invent the role themselves during Phase 4. That friction is acceptable because it surfaces gaps in the palette that can be ported into a future PERSONA_LIBRARY update.

### Decision 4 — Always-present final confirmation block (Phase 7)

**Decision:** Phase 7 is non-skippable. Before any external side effect (repo push, ClickUp list create, file writes, worktree creates), the skill presents a confirmation block listing every action and refuses to act without an explicit `Y`.

**Why:** Phase 8 is the only phase where the skill makes externally-visible changes — it creates a GitHub repo (visible to the world, may not be revertible cleanly), it creates a ClickUp list (visible to teammates, takes manual cleanup to delete), it writes files (recoverable but annoying), it creates worktrees (recoverable but annoying). Bundling all those actions behind a single confirmation gate gives the sponsor one clear point to abort if any phase produced something unexpected.

**Alternative considered:** Per-action confirmation in Phase 8 ("create repo? Y/N", "create ClickUp list? Y/N", "write CLAUDE.md? Y/N"). Rejected because it would balloon the interaction count and the sponsor would start hitting Y reflexively after the third or fourth prompt — defeating the gate. One careful confirmation beats six routine ones.

### Decision 5 — Cite-back rule in the interview

**Decision:** Each interview sub-phase ends with the skill echoing the sponsor's answers back in concrete terms and requiring confirmation before advancing.

**Why:** Sponsors answer at the level of abstraction the question implies. "What does success look like?" gets "users using it." The cite-back forces the answer to land in concrete, observable terms before it gets written into V1-PLAN.md. Without the cite-back, the skill silently produces a V1 plan that doesn't match what the sponsor meant.

**Risk:** Aggressive cite-back may feel adversarial. INTERVIEW.md includes a "when the sponsor pushes back" section explaining the interview's value plainly rather than bullying.

### Decision 6 — Architecture doc is a STUB, not generated

**Decision:** `template/docs/architecture-overview-STUB.md` is an OUTLINE the Project Lead fills during M1, not content the skill generates from the interview.

**Why:** The interview captures vision + V1 scope + constraints, but it does not capture concrete tech-stack decisions (which framework, which database, which message protocol). Those decisions happen during M1 when the Project Lead and devs sit down with the V1 plan. Pretending to generate an architecture from the interview would produce something that has to be rewritten anyway. Honest stub is better than misleading content.

**Risk:** Project Leads who don't replace the stub leave a placeholder file in their `.claude/docs/`. Mitigation: the stub explicitly says "STUB" at the top in bold, and the existing CLAUDE.md "Detailed Documentation" entry says "V1 architecture and core data flow" — a Project Lead reading their own CLAUDE.md will notice the mismatch.

### Decision 7 — Skill is global, with a `KNOWN_PROJECTS.md` registry

**Decision:** The skill lives at `~/.claude/skills/create-orchestration-project/`, not per-project. A `KNOWN_PROJECTS.md` file inside the skill folder lists every bootstrapped (or registered) orchestration project on the machine.

**Why:** The skill is meta-tooling. Putting it in a single project would mean every other project has to either re-implement it or re-derive the patterns. Global location + registry lets the user invoke `/create-orchestration-project` from anywhere and lets `port-improvements` find the registered projects.

**Risk:** Multiple users on the same machine (rare for this user but possible in shared dev environments) would share the skill. Each user has their own `~/.claude/`, so this isn't actually a risk — but it would be if a future Claude Code change introduced shared skill scopes.

### Decision 8 — Pre-register ClaudeTeam in KNOWN_PROJECTS.md

**Decision:** `KNOWN_PROJECTS.md` ships with one entry pointing at `c:\Trunk\PRIVATE\ClaudeTeam`.

**Why:** It's the pattern source; future `port-improvements` runs will preferentially merge from ClaudeTeam's evolution. The user explicitly asked for this in the design conversation.

**Risk:** If ClaudeTeam moves or gets deleted, the path becomes stale. Low-impact (the registry is informational; the skill doesn't depend on ClaudeTeam being present). Future improvement: a `register --refresh` sub-command that re-validates paths.

## The gates — why so many

The skill has 8 gates (one per phase). This may seem like a lot of friction; here's the rationale per gate:

| Gate | What it catches |
|------|-----------------|
| **Phase 1** (project name) | Sponsor and skill disagree on what the project even is. Catching this in 30 seconds saves wasted Phase 3 work. |
| **Phase 2** (interview depth) | Sponsor accidentally picks Vision when they wanted V1-only (or vice versa). Cheap to re-pick before the interview runs. |
| **Phase 3a** (vision cite-back) | The skill's interpretation of vision answers drifts from the sponsor's intent. |
| **Phase 3b** (V1 cut + draft V1-PLAN.md) | **The most important gate.** Catches scope-creep and vague out-of-scope. The sponsor reviewing the draft V1-PLAN.md before the scaffold is generated. |
| **Phase 3c** (constraints) | Constraints get echoed back; sponsor catches anything misinterpreted. |
| **Phase 4** (persona roster) | Sponsor sees the proposed roster, has the chance to drop personas the project doesn't need or add ones the skill didn't propose. |
| **Phase 5** (backends) | Sponsor confirms ClickUp+GitHub (or names alternates), with explicit warning if the skill doesn't have a template for the chosen backend. |
| **Phase 6** (file list) | Sponsor sees every file that will be written, with a one-line description per file. Last chance to drop a file or edit content. |
| **Phase 7** (final confirmation) | **Hard gate, never skipped.** All external actions listed before any is executed. |

Gates 2-6 can be answered quickly if the sponsor has already done the thinking. Gate 7 is the only one that should always feel substantial.

## What's NOT in the skill (out-of-scope)

The skill deliberately does not:

- **Spawn the Project Lead.** Phase 9 provides a copy-pasteable dispatch brief; the user runs the dispatch from a fresh session in the new project. This is because the new project's SessionStart hooks (docs preload + auto-status re-arm) need to be active for the Project Lead, and they're only active in a session started inside the new project's working directory.
- **Generate the architecture doc** from the interview. See [Decision 6](#decision-6--architecture-doc-is-a-stub-not-generated).
- **Create the first ClickUp tickets.** That's the Project Lead's job in their first dispatch. The skill creates the ClickUp list (the empty board) but no tickets.
- **Configure CI/CD.** No `.github/workflows/`, no Azure pipelines. The Project Lead and Senior Dev decide the CI shape during M1.
- **Install dependencies / scaffold code.** The skill creates `.claude/` and project-level config files (CLAUDE.md, V1-PLAN.md, .gitignore) but not source code. The first source-code commit is the Project Lead's M1 dispatch.
- **Configure VS Code workspace settings.** No `.vscode/settings.json` is generated. Some projects want one, some don't; pushing this decision into the skill would force opinions on every project.

## Potential problems and risks

These are the known weak points. Surface any new risks as they appear.

### Risk 1 — Sponsor fatigue at the gates

**Concern:** 8 gates is a lot. Sponsors may start rubber-stamping by Gate 4-5, defeating the design intent.

**Mitigation in current shape:** Most gates are quick (Phase 1 cite-back is one sentence; Phase 5 is a 2-question form). Only Phase 3 (the interview) and Phase 7 (final confirmation) are substantial.

**Open question:** Should the skill detect rubber-stamping (e.g. sponsor answers Y in <2 seconds for 3 consecutive gates) and slow down with explicit "I want to double-check this — please confirm again with context"? Current answer: no, that's paternalistic. But worth revisiting if user reports rubber-stamping leading to bad scaffolds.

### Risk 2 — Vague answers slipping past the cite-back

**Concern:** The cite-back rule depends on the orchestrator's judgment about what counts as "concrete enough." A sponsor saying "an AI tool that helps developers" might pass cite-back if the orchestrator is having a generous moment.

**Mitigation in current shape:** INTERVIEW.md lists explicit examples of answers to push back on ("a tracker" → "tracker of what, for whom, that shows what?").

**Open question:** Should the cite-back have stricter machine-readable criteria (e.g. "in-scope must have ≥4 bulleted items"; "out-of-scope must have ≥3 items including 1-2 the sponsor would be sad to lose")? Worth considering for a future revision.

### Risk 3 — Template drift from pattern source

**Concern:** ClaudeTeam evolves. Its `.claude/` directory will get new hooks, refined dispatch templates, new docs. The skill's `template/` will silently fall behind unless someone runs `port-improvements`.

**Mitigation in current shape:** PORTING.md documents the workflow. KNOWN_PROJECTS.md tracks which projects are registered.

**Open question:** Should the skill auto-suggest a port-improvements pass when invoked in `new` mode and the registry's projects are older than the template's last update? Could be a Phase 0 ("by the way, ClaudeTeam has had 14 commits to `.claude/` since last template port — port now? Y/N"). Not implemented yet.

### Risk 4 — Placeholders not all caught by Phase 6 substitution

**Concern:** The template files have ~20 `{{PLACEHOLDER}}` tokens. If any aren't substituted before Phase 8 writes the files, the new project gets `{{PROJECT_NAME}}` in their CLAUDE.md. Bad first impression.

**Mitigation in current shape:** Phase 6 explicitly does the substitution. The skill should run a "grep for `{{` in all generated files" check before Phase 7 confirmation.

**Action item:** Add explicit "verify no leftover placeholders" step to Phase 6 in SKILL.md before re-running this skill on a real project.

### Risk 5 — Backend abstraction is thin

**Concern:** The current `template/CLAUDE.md` and `agents/TEAM.md` hardcode ClickUp 4-state workflow language. If a sponsor picks Linear or Azure DevOps, the placeholders substitute the IDs but the workflow language ("`to do` → `in progress` → `in review` → `complete`") is still ClickUp-flavored.

**Mitigation in current shape:** SKILL.md Phase 5 warns when a non-default backend is chosen. The warning currently says "scaffold with placeholders + a manual-setup TODO" — that means the sponsor has to manually fix the workflow vocabulary post-bootstrap.

**Action item:** Future improvement — backend-specific template variants (`template-clickup/`, `template-linear/`, `template-azure/`) that swap in the right vocabulary. For now, ClickUp is the only fully-supported backend.

### Risk 6 — Hook scripts assume Git Bash on Windows

**Concern:** The hook scripts at `template/hooks/*.sh` use bash + Node + grep + sed. They run on Windows via Git Bash (which is what the user has installed). A sponsor on a pure Linux or macOS environment will be fine. A sponsor on Windows without Git Bash will fail silently when the hooks try to fire.

**Mitigation in current shape:** None. The hook scripts assume bash is available.

**Action item:** Future improvement — detect platform during Phase 6, and if Windows-without-Git-Bash is the target, rewrite hooks as PowerShell scripts. For now, the skill assumes Git Bash. Document this in SKILL.md.

### Risk 7 — `gh repo create` may fail silently

**Concern:** If the sponsor isn't authenticated to GitHub (`gh auth status` fails), the Phase 8 repo creation step will error. The skill needs to either pre-check authentication or handle the error gracefully and roll back the file writes.

**Mitigation in current shape:** Not implemented. Phase 8 currently assumes `gh` works.

**Action item:** Add a Phase 5.5 or Phase 7-prerequisite check: `gh auth status` must return 0 before Phase 7 confirmation is offered. If not authenticated, prompt the sponsor to authenticate first.

### Risk 8 — Worktree creation may collide with existing directories

**Concern:** Phase 8 creates worktrees at `<project-base>-<role>-wt`. If a directory with that name already exists (from a prior attempt that crashed mid-Phase-8), `git worktree add` will fail.

**Mitigation in current shape:** Not implemented. Phase 8 currently assumes a clean target.

**Action item:** Add a Phase 7-prerequisite check: for each worktree path the skill is about to create, verify no directory exists yet. If one does, surface to sponsor and ask whether to abort or remove the existing directory.

### Risk 9 — ClickUp MCP availability

**Concern:** Nora's report from the M1 planning kickoff dispatch noted that `mcp__clickup__clickup_create_task` is declared in her persona file but **not surfaced to her runtime in the current harness**. If that gap also applies to this skill's invocation of `mcp__clickup__create_list`, Phase 8 ClickUp list creation will fail.

**Mitigation in current shape:** Not validated. The skill assumes the ClickUp MCP tools are available when it runs.

**Action item:** Before considering this skill ready for production use, verify `mcp__clickup__create_list` (and any other ClickUp MCP tools the skill calls) are surfaced to skill execution. If they're not, the fallback is to have the skill emit instructions for the sponsor to create the list manually and paste the ID back.

### Risk 10 — Name collisions across registered projects

**Concern:** PERSONA_LIBRARY.md's sample-name pools include names already used by ClaudeTeam (Nora, Iris, Felix, Maya, Sage, Bram). If a new project reuses one of those names, the orchestrator on the user's machine might confuse personas across projects in conversation.

**Mitigation in current shape:** None. Persona names aren't required to be globally unique — they're project-scoped.

**Open question:** Should Phase 4 cross-check proposed persona names against KNOWN_PROJECTS.md and warn on collision? Probably yes, but low-priority. The sponsor will likely notice "wait, that's a ClaudeTeam name" during Phase 4 review.

## Untested paths and validation gaps

The skill has been authored but NOT executed end-to-end. The following are unverified:

- **No bootstrap has been run.** No project has been created using this skill. Every assumption about Phase 8's execution order, error handling, and side-effect choreography is on paper only.
- **Placeholder substitution mechanics are not implemented.** The skill describes the substitution in prose but doesn't have a concrete implementation. The orchestrator running the skill will need to perform the substitution itself when generating the file plan. This works for now (the orchestrator has full editing power) but is a fragile design — future improvements should consider whether to make substitution explicit (e.g. a `substitute.py` helper, or a documented list of tokens with regex patterns).
- **`register <path>` and `port-improvements <project>` sub-modes are described but not exercised.** They're documented in SKILL.md and PORTING.md but no execution path has been tested.
- **No eval scaffolding.** The `skill-creator` skill (Anthropic's tool for building skills) supports eval-driven development; this skill was authored without that framework. Future improvement: add eval cases for "sponsor says X → skill should produce Y" pairs.

## Future adaptations and changes

### Near-term (next few weeks)

1. **Run a real bootstrap** — pick a small project, execute the skill end-to-end, fix any gaps surfaced. The first end-to-end run will reveal more issues than this doc anticipates.
2. **Add Phase 5.5 prerequisite checks** — `gh auth status`, `mcp__clickup__*` availability, worktree directory cleanliness. See risks 7, 8, 9.
3. **Substitution check** — explicit "no leftover `{{` placeholders" verification in Phase 6. See risk 4.
4. **Name-collision check** — Phase 4 cross-checks proposed names against KNOWN_PROJECTS.md. See risk 10.

### Medium-term

5. **Backend-specific template variants** — separate `template-clickup/`, `template-linear/`, `template-azure-devops/` directories with the appropriate workflow vocabulary. See risk 5.
6. **`port-improvements` automation** — make the diff-and-port workflow actually work, with a side-by-side review UI. See PORTING.md.
7. **Auto-suggest porting** — Phase 0 warning if registered projects have evolved past the template's last port. See risk 3.
8. **PowerShell hook variants** — for Windows users without Git Bash. See risk 6.
9. **Eval scaffolding** — replay test cases for the interview phase and the file generation phase. Catches regressions in the skill's behavior.

### Long-term

10. **Cross-project pattern detection** — if 3+ registered projects all have the same custom hook (not in template), prompt the user "this looks universal — port to template?" Lightweight ML or just a frequency count over `KNOWN_PROJECTS.md` would do.
11. **Multi-machine sync** — if the user has multiple machines with the same `~/.claude/skills/create-orchestration-project/`, sync `KNOWN_PROJECTS.md` and template changes via a git repo. Out of scope for now.
12. **Web UI for sponsor interview** — if the conversational interview proves inefficient for some sponsors, a forms-style UI might fit better. Speculation; depends on real usage feedback.
13. **Project archival flow** — `archive <project-name>` sub-command that records when a registered project has been abandoned / shipped / merged into another project. Currently no lifecycle states in the registry.

## Maintenance workflow

### To change the skill's behavior (entry, gates, phases)

Edit `SKILL.md`. The frontmatter `description` field is what Claude Code uses to decide whether to surface the skill — be careful editing it. After saving, the skill is re-loaded on next Claude Code session restart (or earlier if the session re-reads skill lists).

### To change the interview script

Edit `INTERVIEW.md`. SKILL.md references it by section name (`## Phase 3a — Vision`). Keep section names stable so SKILL.md doesn't break.

### To add or modify a role

Edit `PERSONA_LIBRARY.md`. Add the role under "Common roles" or "Specialty roles" with the standard schema. If the role implies new project flavors, add an entry under "Project-flavor → roster mapping (examples)."

### To improve a template file

Edit the file under `template/`. If the change is universal (improving guidance for all future projects), no further work needed. If the change is project-specific (e.g. you're using template/ as a scratchpad for a specific project), STOP — the change doesn't belong in template/. Put it in the project itself.

### To port improvements back from a registered project

Follow PORTING.md. Either invoke `create-orchestration-project port-improvements <project-name>` (when that sub-mode is implemented) or do the diff manually and update template/ files + the port-pass log in PORTING.md.

### To register an existing orchestration project (without bootstrapping)

Invoke `create-orchestration-project register <path>`. (When that sub-mode is implemented — currently described in SKILL.md but not exercised.)

### To delete the skill

`rm -rf ~/.claude/skills/create-orchestration-project/`. No external state — the skill is self-contained on disk. Existing bootstrapped projects continue to work without the skill present (they have their own `.claude/` copies).

### To run from scratch on this machine

If the skill ever needs to be re-bootstrapped (e.g. user's home directory is wiped), this DESIGN.md and the existing ClaudeTeam project together contain enough information to recreate the skill manually in ~1 hour.

## Glossary of placeholders

These are the `{{PLACEHOLDER}}` tokens used in `template/` files. When generating a new project's files in Phase 6, the skill must substitute every one. Missing a substitution leaves the new project with literal `{{TOKEN}}` in its files.

| Placeholder | Meaning | Source |
|---|---|---|
| `{{PROJECT_NAME}}` | Display name of the project (e.g. "ClaudeTeam") | Phase 1 |
| `{{PROJECT_ONE_LINER}}` | One-sentence description of the project | Phase 3 (vision or V1 answer) |
| `{{PROJECT_ONE_LINER_INLINE}}` | Same as above but as an inline phrase | derived |
| `{{ROSTER_COUNT}}` | Number of personas in the roster (e.g. "6") | Phase 4 |
| `{{PERSONA_LIST}}` | Comma-separated list of persona names (e.g. "Nora, Iris, Felix, Maya, Sage, Bram") | Phase 4 |
| `{{SPONSOR_NAME}}` | Sponsor's name (e.g. "Thomas") | derived (from Claude Code user, or asked in Phase 1) |
| `{{SCAFFOLD_GATE_THING}}` | Project-specific thing the gate guards (e.g. "the extension scaffold" for ClaudeTeam, "the API gateway" for a backend project) | Phase 3b |
| `{{PROJECT_SPECIFIC_GATE_1}}`, `{{..._2}}` | Up to 2 project-specific hard rules | Phase 3 |
| `{{PROJECT_SPECIFIC_GATE_1_DESCRIPTION}}`, `{{..._2_..}}` | Their descriptions | Phase 3 |
| `{{PROJECT_SMOKE_NAME}}` | Name of the project's smoke test (e.g. "webview smoke" for ClaudeTeam, "API smoke" for a service) | Phase 3 |
| `{{CROSS_REVIEW_RULE}}` | One-sentence description of the cross-review pairing | derived from Phase 4 roster |
| `{{CLICKUP_WORKSPACE_ID}}` | ClickUp workspace ID | Phase 5 |
| `{{CLICKUP_LIST_ID}}` | ClickUp list ID for the project's board | Phase 8 (created during exec) |
| `{{CLICKUP_SPACE_NAME}}` | Human-readable space name | Phase 5 |
| `{{CLICKUP_SPACE_ID}}` | ClickUp space ID | Phase 5 |
| `{{REPO_OWNER}}` | GitHub owner (e.g. "TSandvaer") | Phase 5 |
| `{{REPO_NAME}}` | GitHub repo name | derived from Phase 1 project name |
| `{{PROJECT_ROOT_PATH}}` | Absolute path to project root (e.g. `c:\Trunk\PRIVATE\ClaudeTeam`) | Phase 5 |
| `{{WORKTREE_BASE_PATH}}` | Base path prefix for worktrees (e.g. `c:\Trunk\PRIVATE\ClaudeTeam`; suffix `-<role>-wt` appended per persona) | derived |
| `{{ROSTER_TABLE_ROWS}}` | Markdown table rows for the persona roster | generated from Phase 4 |
| `{{TOPOLOGY_DIAGRAM}}` | ASCII diagram of the communication topology | generated from Phase 4 |
| `{{PEER_REVIEW_BULLETS}}`, `{{PEER_REVIEW_ROUTING_BULLETS}}`, `{{PEER_REVIEW_PROTOCOL}}` | Persona-pair-specific bullets/rows | generated from Phase 4 |
| `{{PROJECT_SPECIFIC_OP_IDS}}` | Any extra operational IDs (e.g. Azure DevOps org, Linear team key) | Phase 5 |
| `{{MODEL_TABLE}}` | Per-persona model assignment (opus/sonnet) with rationale | generated from Phase 4 |
| `{{PROJECT_SPECIFIC_PROBE_1}}` | Project-specific Self-Test probe (e.g. "Theme-switch probe" for VS Code projects) | Phase 3 |
| `{{WORKTREE_TABLE_ROWS}}`, `{{WORKTREE_DIAGRAM}}` | Worktree map rows / diagram | generated |
| `{{TRACK_ROUTING_BULLETS}}` | Track-based dispatch routing rules | generated from Phase 4 |
| Persona-template tokens | `{{PERSONA_SLUG}}`, `{{ROLE_DESCRIPTION_ONE_LINER}}`, `{{TYPICAL_TASKS}}`, `{{STRENGTH_PHRASE}}`, `{{NOT_FOR}}`, `{{OTHER_PERSONAS}}`, `{{TOOL_LIST}}`, `{{MODEL}}`, `{{PERSONA_NAME}}`, `{{ROLE_TITLE}}`, `{{ROLE_BLURB}}`, `{{ROLE_SUFFIX}}`, `{{ARTIFACT_LIST}}`, `{{WORKTREE_PATH}}`, `{{COLLABORATOR_BULLETS}}`, `{{ROLE_SPECIFIC_WORKFLOW_STEPS}}`, `{{HARD_RULES_BULLETS}}`, `{{TONE_DESCRIPTION}}` | Phase 4 + PERSONA_LIBRARY lookup |
| Testing-strategy tokens | `{{UNIT_TEST_FRAMEWORK}}`, `{{LAYER_1_COVERAGE_TARGETS}}`, `{{LAYER_2_COVERAGE_TARGETS}}`, `{{LAYER_3_NAME}}`, `{{LAYER_3_DESCRIPTION}}`, `{{LAYER_3_COVERAGE_TARGETS}}`, `{{LAYER_3_DIR}}`, `{{MANUAL_TEST_KIND}}`, `{{MANUAL_CHECKLIST_STEPS}}`, `{{UX_SURFACE_NAME}}`, `{{SELF_TEST_PROBE_1}}`, `{{FAILURE_MODE_PROBE_LIST}}`, `{{PROJECT_SPECIFIC_REQUEST_CHANGES_TRIGGER}}`, `{{CI_PROVIDER}}`, `{{FIXTURE_LIST}}`, `{{NOT_TESTED_LIST}}` | Phase 3 + Phase 5 |

When adding new placeholders, update this glossary. When removing them, update the template files and this glossary together.

---

## Document maintenance

Update this DESIGN.md when:

- A new design decision is made (add to [Key design decisions](#key-design-decisions)).
- A risk surfaces (add to [Potential problems and risks](#potential-problems-and-risks)).
- A planned improvement lands (move from [Future adaptations](#future-adaptations-and-changes) to the appropriate sections).
- A placeholder is added or removed from templates (update [Glossary](#glossary-of-placeholders)).

This doc is the institutional memory for the skill. If it falls out of date, future maintenance becomes archaeology.
