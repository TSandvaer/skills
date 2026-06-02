---
name: drain-session
description: Wind down a multi-agent orchestration session toward quiescence so a clean state-save can follow. Stops heartbeat/dispatch crons, refrains from starting new tickets, but CONTINUES closure activities — merging in-flight PRs, dispatching QA for pending sign-offs, flipping ClickUp statuses, resolving coordination-doc conflicts. Surfaces "drain complete" when all agents are idle. **Invoke BEFORE /save-session whenever multiple agents are in flight and the user signals end-of-session intent.** Trigger phrases include "save session" (when work is in flight), "drain", "wind down", "let's enter a new session", "wait for everyone to finish", "stop dispatching", or explicit /drain-session. The skill does NOT itself save the session — it reaches the idle state that lets /save-session capture cleanly.
---

# drain-session

You are the orchestrator of a multi-agent team (Priya, Uma, Devon, Drew, Tess on Embergrave; the same pattern generalizes). Several agents are in flight, several PRs may be open, and the user just signalled they want to wind down for a session boundary. Your standing rules say "always 3-5 agents in flight" and "every tick mandates dispatch" — those rules **actively work against winding down**. This skill turns them off temporarily and runs the closure loop instead.

## When to invoke

Invoke when the user signals session-end intent AND there's in-flight multi-agent work. Don't invoke for:
- Single-task conversations with no agents running (just call `/save-session` directly)
- Mid-flow saves where the user wants to checkpoint but keep running (also `/save-session` direct)
- Quick hand-offs in <2 turns

Invoke when:
- The user says "save session" with multiple agents in flight or PRs open
- The user explicitly says "drain", "wind down", "let's enter a new session", or "/drain-session"
- The user says "wait for everyone to finish" or "stop dispatching"

## Step 1 — Stop the dispatch engine

The first action breaks the always-parallel-dispatch feedback loop:

1. `CronList` → identify any heartbeat / dispatch crons running
2. `CronDelete` each one → these would otherwise keep firing prompts that re-trigger parallel dispatch
3. Acknowledge to the user: "Drain mode active. Cron killed. Standing down on new dispatches."

The cron is the most common foot-gun. Kill it first; everything else can be done at human pace.

## Step 2 — DON'T dispatch new tickets

Even safe-to-dispatch work waits for the next session. This includes:
- New `feat(*)` / `fix(*)` tickets
- Anticipatory M2/M3 design or planning work
- Queued P0/P1 fixes the team hasn't started
- "While we wait" make-work — there is no "while we wait" in drain mode

The default behavior outside drain mode is to keep agents at 3-5 in flight (see `always-parallel-dispatch.md`). In drain, the target is **0 in flight**.

## Step 3 — DO continue closure activities

These are not new dispatches — they're necessary to reach idle:

| Activity | Notes |
|---|---|
| Merging in-flight PRs | `gh pr merge --squash --admin --delete-branch`. Orchestrator authority for `chore(state)`, `chore(planning)`, `chore(orchestrator)`, `docs(team)`, `design(*)`. |
| Dispatching Tess for sign-offs on `feat(*)` / `fix(*)` PRs already open | Sign-off is closure of an existing PR, not new feature work. Batch multiple sign-offs into one Tess run if she has several queued. |
| Flipping ClickUp ticket statuses to `complete` on merged tickets | Per `clickup-status-as-hard-gate.md` — paired status flip in same tool round as `gh pr merge`. |
| Resolving DECISIONS.md / STATE.md merge conflicts on coordination docs | Orchestrator-in-lane per `orchestrator-never-codes.md` carve-out for "STATE.md, DECISIONS.md cross-role calls". Pattern: fetch branch into orch-wt, merge origin/main, resolve trivial append-only conflict, push back, merge PR. |
| Verifying Self-Test Reports on UX-visible PRs | Per `self-test-report-gate.md`. If absent, note in sign-off but don't bounce — drain mode prefers closure over re-work. |
| Triggering a final release-build if it closes the current arc | E.g., `gh workflow run release-github.yml --ref main` after the last UX-affecting PR lands. Capture run ID for Sponsor's resume. |

## Step 4 — Track the agent count down to 0

Maintain explicit visibility of in-flight agents. As each completes:
- Acknowledge briefly: "Devon idle (PR #X merged). Remaining: Drew, Uma, Priya."
- Update the count in your todo list or response so the user sees progress
- Don't go silent for long stretches — drain feels stuck if the user can't see the trickle

## Step 5 — Surface "drain complete"

When all five conditions hold:
1. Zero agents in flight (no background tasks running)
2. Zero open PRs awaiting review or merge
3. ClickUp tickets in `in progress` or `ready for qa test` reconciled to reality (either flipped to `complete` or appropriately re-categorized)
4. No conflict-resolution backlog
5. Cron remains killed

…surface to the user, exactly:

> **Drain complete. Ready for save-session.**

Then stop. Don't invoke `/save-session` yourself — the user owns that gate. They may want to inspect state first, ask follow-up questions, or just type `/save-session`.

## What this skill explicitly does NOT do

- **Save the session.** That's `/save-session`. This skill *prepares the team* for save-session.
- **Re-arm the cron.** Drain mode is session-durable until the user explicitly resumes work in a new session.
- **Force-close PRs that aren't ready.** If a PR has unresolved CI failures or genuine review concerns, flag them to the user — drain doesn't mean ignore quality.
- **Auto-merge PRs that need Self-Test Reports they're missing.** Note the gap; let user decide.

## Resume path (next session)

The user starts fresh, often with `Resume from <state-file>` from a `/save-session` output. The next session restores `always-parallel-dispatch.md` behavior on the first "get to work" / "continue" / cron tick. Drain mode does NOT survive across sessions — it's a wind-down posture, not a permanent setting.

## Memory rules referenced

This skill operates against these existing rules — read them via `MEMORY.md` if context is fresh:

- [`drain-mode-on-session-end.md`](../../projects/<project-id>/memory/drain-mode-on-session-end.md) — the durable rule this skill operationalizes
- [`always-parallel-dispatch.md`](../../projects/<project-id>/memory/always-parallel-dispatch.md) — the rule drain mode overrides
- [`orchestrator-never-codes.md`](../../projects/<project-id>/memory/orchestrator-never-codes.md) — coord-doc conflict resolution is in-lane
- [`clickup-status-as-hard-gate.md`](../../projects/<project-id>/memory/clickup-status-as-hard-gate.md) — paired status flips on every merge
- [`self-test-report-gate.md`](../../projects/<project-id>/memory/self-test-report-gate.md) — UX-visible PR review check

## Project-specific reference (Embergrave)

For the Embergrave game-dev orchestration this skill was built around:
- Team roster: Priya (PL), Uma (UX), Devon (game-dev #1), Drew (game-dev #2), Tess (QA)
- Per-role worktrees: `C:/Trunk/PRIVATE/RandomGame-{role}-wt`
- Orchestrator worktree: `C:/Trunk/PRIVATE/RandomGame-orch-wt`
- Main repo: `c:\Trunk\PRIVATE\RandomGame`
- ClickUp list ID: `901523123922`
- Recognized space tags: `bug`, `chore`, `week-3`, `feat`, `qa`, `design`, `docs`

For other projects with similar shapes (orchestrator + multi-agent team + ClickUp + GitHub PR workflow), the same drain logic applies — substitute role names + paths + list ID.

## One-line summary

Stop dispatching, merge what's open, mark tickets complete, surface "drain complete", let the user invoke `/save-session` themselves.
