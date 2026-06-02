# Dispatch Template

Reusable snippets the orchestrator appends to every Agent brief. NOT a persona file — a reference document for the orchestrator.

## Mandatory blocks (every dispatch)

### 1. Step 0 — worktree state (verbatim)

The first action of every dispatched agent must be:

```bash
cd {{WORKTREE_BASE_PATH}}-<role>-wt
git fetch origin
git checkout -B <role>/<id>-<slug> origin/main
pwd   # verify you're in the worktree, not the orchestrator's cwd
```

**Why this is non-negotiable:** Sub-agents inherit the orchestrator's cwd if Step 0 is omitted. Edits then land in the survey root instead of the role worktree, branches collide, and the merge cleanup short-circuits. Make Step 0 the literal first line of the agent's task list.

### 2. Doc preload preamble

```
Before any other work: read CLAUDE.md and every .claude/docs/*.md file IN PARALLEL (multiple Read calls in one message). Sub-agents do NOT inherit the SessionStart docs-preload — you have to read them yourself, once per session.
```

### 3. Scoped contract (mandatory for non-trivial tickets — 2h+ or 3+ files)

```
**Goal:** <one sentence — what does success look like?>
**Acceptance criteria:**
- AC1: <observable, testable>
- AC2: ...
**Out of scope (OOS):**
- <thing 1>
- <thing 2>
**Done-when test:** <the exact command/check that proves done>
**Files in play:**
- Owned (you write): <paths>
- Read-only references: <paths>
**Conflict rule:** if you discover OOS scope is load-bearing, STOP and file a follow-up ticket — do not expand mid-PR.
```

### 4. Tracker lifecycle (paired flips)

{{TRACKER_LIFECYCLE_BLOCK}}

### 5. Tightened final-report contract (≤200 words)

```
**Final report — return in this shape and EXIT (do not wait for merge):**

PR: <URL>
Verdict: <"AC met, ready for review" | "blocked — see notes" | "needs decision from sponsor on X">
Blockers: <none | one-line>
Doc updates: <none | "added .claude/docs/<file>.md" | "updated <file>.md @ section X">
Decision drafts (if any): <one per line, prefixed `Decision draft:`>

Anything beyond this goes in the PR body, ticket comments, or your workspace folder — NOT in the orchestrator-bound report. Cite verifiable evidence for every state claim (run-id URL, SHA, file:line, screenshot URL).
```

### 6. Non-obvious findings postamble

```
At the end of your work, list any non-obvious findings (gotchas, surprising constraints, validated patterns, "I almost did X but here's why Y is right") in your PR body. These are the input to maintain-docs — the more concretely you surface them, the more useful future Claude sessions become.
```

## Optional blocks (context-dependent)

### Self-Test Report (for UX-visible PRs)

```
**Self-Test Report — required before requesting QA:**

1. AC walkthrough on a real reload — for each AC, the observed behavior + screenshot.
2. Side-effect inventory — every surface this change touches.
3. {{PROJECT_SPECIFIC_PROBE_1}}.
4. State-coverage — screenshots of each state your change affects.
```

### Background-agent tripwire (for `run_in_background: true` spawns)

```
This agent is being dispatched in the background. The orchestrator MUST pair this dispatch with a ScheduleWakeup at ~2× the agent's expected duration so a silent agent-death is caught. Background agents must `git commit && git push` after each milestone — agents die silently and uncommitted work is lost.
```

### Peer-review routing

{{PEER_REVIEW_ROUTING_BULLETS}}

## Worktree map (reference)

| Role | Worktree path | Default branch |
|---|---|---|
{{WORKTREE_TABLE_ROWS}}

## Pre-dispatch checklist (orchestrator-side)

Before sending a brief:

- [ ] Ticket ID + body included verbatim in the brief.
- [ ] Worktree path matches the assigned role.
- [ ] Branch name follows `<role>/<id>-<slug>` format.
- [ ] Scoped contract block present (for non-trivial tickets).
- [ ] Tracker lifecycle block present.
- [ ] Final-report contract block present.
- [ ] Doc-preload preamble present.
- [ ] Non-obvious findings postamble present.
- [ ] If background dispatch: ScheduleWakeup tripwire scheduled.
- [ ] If UX-visible: Self-Test Report block present.
