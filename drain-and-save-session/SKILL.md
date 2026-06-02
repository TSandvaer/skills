---
name: drain-and-save-session
description: Combined wind-down workflow — invokes /drain-session first (kill recurring dispatch cron, refrain from new dispatches, continue closure activities until 0 agents + 0 open PRs), then IMMEDIATELY invokes /save-session without waiting for separate user confirmation. Trigger phrases include "drain and save", "/drain-and-save-session", "drain then save", "wind down and save", "save session after drain", or any signal the user wants both winding down AND the resume one-liner produced in one chained step. Use when the user wants closure + handoff without manually invoking save-session after watching for "Drain complete".
---

# Drain and Save Session

Composed wrapper around `/drain-session` + `/save-session`. The user signals end-of-session intent AND wants the resume one-liner produced automatically once the team has reached idle, without having to manually invoke save-session after watching for "Drain complete".

## When to invoke

- User types `/drain-and-save-session`
- User says any of: "drain and save", "drain then save", "wind down and save", "save session after drain", "let's wind down and pick it up tomorrow"
- User signals end-of-session intent AND explicitly wants both phases chained in one step

Do NOT invoke for:
- Conversations with NO agents in flight + NO open PRs — just call `/save-session` directly; drain is unnecessary overhead.
- Quick checkpoint saves mid-flow where the user wants to continue working — `/save-session` direct.

## Step 1 — Invoke /drain-session

Invoke the drain-session skill via the Skill tool (`Skill(skill="drain-session")`). Let its full logic execute:

1. `CronList` + `CronDelete` to kill heartbeat / recurring dispatch crons.
2. Refrain from new dispatches.
3. CONTINUE closure activities — merge in-flight PRs that have cleared gates, dispatch sign-offs on existing open PRs, flip ClickUp ticket statuses on merged work, resolve coordination-doc conflicts.
4. Track in-flight count down to 0.

The drain-session skill normally STOPS at "Drain complete. Ready for save-session." and waits for the user to invoke save-session. THIS skill chains past that stop point.

## Step 2 — Determine when drain is complete

Drain conditions hold when ALL five are true:

1. Zero background agents in flight.
2. Zero open PRs awaiting review or merge.
3. ClickUp tickets reconciled — anything that merged has been flipped to `complete`; nothing stuck in `in progress` / `in review` against a closed PR.
4. No conflict-resolution backlog.
5. Recurring dispatch cron remains killed (no re-arm).

The drain phase may be **synchronous** (all closure work completes in the current turn — small or zero in-flight queue) or **asynchronous** (a PR is awaiting CI; drain arms a one-shot ScheduleWakeup to merge later).

## Step 3 — Chain into /save-session

**Synchronous path** — if drain conditions are reached in the current turn (no ScheduleWakeup needed):

1. Confirm drain complete inline (one short line — do NOT emit the standalone "Drain complete. Ready for save-session." line because we're chaining, not handing off).
2. Immediately invoke save-session via the Skill tool (`Skill(skill="save-session")`).
3. Let save-session execute its full logic — promote durable insights to memory, write the state file with goal/status/files/decisions/next-steps, return the paste-ready one-liner.
4. End with save-session's standard output (`Resume from <absolute-path>`).

**Asynchronous path** — if drain has work that can't complete synchronously (e.g. PR awaiting CI for 20+ minutes), the drain-session skill arms a one-shot ScheduleWakeup tripwire. THIS skill modifies the tripwire wake-up prompt:

- When arming any ScheduleWakeup for drain-completion checks, **append to the prompt** instructions to chain into save-session automatically once drain conditions hold. Wake-up handler does drain-finalization + save-handoff in the SAME response — does NOT surface "Drain complete" and stop.

Suggested tripwire-prompt appendix when chaining (paste verbatim near the end of the drain-session tripwire prompt you would otherwise arm):

```
**DRAIN-AND-SAVE chain (this is part of /drain-and-save-session, not standalone /drain-session):**
Once drain conditions hold (PR merged + ticket flipped + 0 agents in flight + cron remains killed), IMMEDIATELY invoke the save-session skill via Skill(skill="save-session"). Do NOT stop at "Drain complete" — chain straight into save-session and emit the resume one-liner as the final user-facing message. The user invoked the combined skill expecting both phases without manual intervention.
```

## Step 4 — Output

The final user-facing message after this skill completes (whether synchronous or via tripwire chain) is **save-session's standard one-liner**:

```
Resume from <absolute-path-to-state-file>
```

Plus optional brief mention of memories promoted during save (per save-session's own contract — "one short sentence per memory before the one-liner").

No separate "Drain complete" line. Drain completion is implicit in the fact that save ran. The user invoked the combined skill; they get the combined output: a clean state file + one-liner, after the team reached idle.

## What this skill explicitly does NOT do

- Skip drain steps to save faster. Drain logic must complete before save — saving mid-flight loses agent-state coherence (an agent in flight could land a PR seconds after save, making the state file immediately stale).
- Force-save with open PRs that haven't merged. If a PR cannot merge cleanly (failing CI, genuine review concerns, missing Self-Test Report), surface the blocker exactly like /drain-session does and STOP — do not proceed to save. The user must decide: force-merge, dismiss the PR, or address the blocker.
- Restart the recurring dispatch cron. Drain killed it; save-session doesn't re-arm it; this skill doesn't either. The next session resumes via the Resume-from-state-file path on first user prompt.
- Run multiple in-parallel drain/save invocations. If the user types `/drain-and-save-session` again while one is already in flight (e.g. tripwire armed), acknowledge "already in progress" and don't double-arm.

## Resume path (next session)

Identical to /save-session output. The user pastes the one-liner into a fresh conversation; the next session reads the state file and resumes work. The recurring dispatch cron is NOT re-armed by the resume path — that re-arms on the first "get to work" / "continue" cron-tick equivalent in the new session (per the always-parallel-dispatch / auto-status rearm pattern).

## Composition with other skills referenced

- [`drain-session`](../drain-session/SKILL.md) — the wind-down logic; invoked verbatim in Step 1.
- [`save-session`](../save-session/SKILL.md) — the save logic; invoked in Step 3 once drain completes.
- [`auto-status`](../auto-status/SKILL.md) — if a recurring AWAY-mode tick was running, drain killed it. The auto-status state file remains as-is; the next session's SessionStart hook may re-arm based on the file's `enabled=` flag.

## One-line summary

`/drain-session` then `/save-session`, chained — produce the resume artifact automatically once the team reaches idle. Synchronous if drain finishes in-turn; via tripwire chain if drain needs to wait on CI / async work.
