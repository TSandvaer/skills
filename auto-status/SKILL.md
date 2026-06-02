---
name: auto-status
description: Toggle a recurring orchestrator check on or off, durably. Use when the user says "auto-status on", "auto-status off", "auto-status away", "/auto-status ...", or asks to start/stop periodic status updates or away-mode orchestration. "on" starts a 5-min read-only status pulse; "away" starts a ~15-min active orchestration tick that keeps the team moving while the user is gone; "off" stops it. The on/off/away state is persisted to a project state file and auto-re-armed on session restart by a SessionStart hook.
---

# Auto-Status

A durable wrapper around the `loop` skill that toggles a recurring orchestrator
check. The mode (`on` / `away`) and enabled-state are persisted to a per-project
**state file**, so the toggle survives session restarts: a SessionStart hook reads
the state file and re-arms the loop automatically on every new session.

Two modes:

- **`on`** (a.k.a. `local`) — a 5-minute **read-only status pulse**. Reports; never
  changes state. Use while the user is at the machine.
- **`away`** — a ~15-minute **active orchestration tick**. Keeps the agent team
  moving while the user is gone: revives stale agents, merges gate-cleared PRs,
  keeps waves in flight, queues sign-off items. Use while the user is away (machine
  stays on and awake — this is a local loop, it does not run through sleep).

## The state file

Path: `<project>/.claude/auto-status.state` (i.e. `$CLAUDE_PROJECT_DIR/.claude/auto-status.state`).
It is gitignored — per-machine state, not committed. Format (`key=value`, one per line):

```
# auto-status state — managed by the auto-status skill. Do not edit by hand.
enabled=true
mode=local
interval=5m
last_tick=2026-05-14T12:00:00Z
```

`mode` is `local` (for `on`) or `away`. If the file is missing, auto-status is off.

## Step 0: Parse the argument

Invoked with a single argument: `on` / `off` / `away` (case-insensitive).
Synonyms: `start` → `on`, `stop` → `off`, `local` → `on`.

- **No argument** → this is a **status query**. Read the state file and report in
  one or two lines: enabled? which mode? interval? how long since `last_tick`
  (warn if older than 2× interval — the loop may have died mid-session). Then stop.
- Unrecognised argument → ask whether they mean `on`, `off`, or `away`, and stop.
  Do not guess.

## Step 1: `auto-status on` (read-only status pulse)

1. Write the state file with `enabled=true`, `mode=local`, `interval=5m`,
   `last_tick=` (current UTC timestamp).
2. If an auto-status loop is already running in this session, say so in one line
   and stop — do **not** stack a second loop.
3. Otherwise start the recurring check by invoking the `loop` skill with:
   - interval: `5m`
   - prompt: the **status-pulse prompt** below (verbatim)
4. Confirm in one line:
   `Auto-status ON (local) — read-only status pulse every 5 min. Say "auto-status away" for away-mode, "auto-status off" to stop.`

### Status-pulse prompt handed to the loop

```
Give a concise orchestrator status update: agents currently in flight (name +
ticket + what they're doing), PRs open / awaiting review / merged since the last
check, tickets that changed state, anything blocked or waiting on the user, and
the single most useful next action. If nothing has changed since the last check,
say so in one line. Keep it scannable — bullets, no preamble. This is a read-only
summary: do NOT spawn agents, merge PRs, or change any state. Then update
last_tick in <project>/.claude/auto-status.state to the current UTC timestamp.
```

## Step 2: `auto-status away` (active orchestration tick)

1. Write the state file with `enabled=true`, `mode=away`, `interval=15m`,
   `last_tick=` (current UTC timestamp).
2. If an auto-status loop is already running in this session, stop it first, then
   start the away-mode loop — do not stack.
3. Start the recurring tick by invoking the `loop` skill with:
   - interval: `15m`
   - prompt: the **away-mode prompt** below (verbatim)
4. Confirm in one line:
   `Auto-status AWAY — active orchestration tick every 15 min. The team keeps moving while you're gone. Say "auto-status on" for read-only mode, "auto-status off" to stop.`

### Away-mode prompt handed to the loop

```
Active orchestration tick — the user is away; keep the team moving. Do one full
orchestration pass, respecting every hard rule in this project's CLAUDE.md
(protected branches, testing bar, never self-approve the user's sign-off calls):

1. Audit in-flight agents against the ticket board and open PRs. For any agent
   dispatched but with no PR and no completion for more than ~2 ticks, treat it
   as stale: check its worktree for progress, SendMessage to nudge if it may
   still be alive, otherwise re-dispatch fresh with a WIP-recovery brief.
2. Merge any PR that has cleared ALL required gates (green CI + review sign-off +
   any project-specific visual/self-test gates). Never merge past an unmet gate.
3. Keep the target number of agents in flight: if the board has ready tickets and
   there is capacity, dispatch. Pair every dispatch / PR-open / merge with the
   matching ticket-status move in the same round.
4. QUEUE — do not decide — anything that needs the user's own sign-off. Write
   these into the project's coordination/state doc so the user sees them on return.
5. Update last_tick in <project>/.claude/auto-status.state to the current UTC
   timestamp.

Emit a concise summary of what changed this tick (revived / dispatched / merged /
queued). If nothing needed doing, say so in one line.
```

## Step 3: `auto-status off`

1. Write the state file with `enabled=false` (leave `mode` as-is for reference).
2. Stop the running auto-status loop — cancel the underlying `/loop` (invoke the
   `loop` skill's stop/cancel path, or cancel the scheduled wakeup / cron it
   created).
3. If no auto-status loop was running, say so in one line.
4. Confirm in one line: `Auto-status OFF — recurring orchestrator check stopped.`

## Re-arm on session start (how durability works)

A SessionStart hook (`<project>/.claude/hooks/session-start-auto-status.sh`,
registered in `<project>/.claude/settings.json`) reads the state file on every
`startup` / `resume` / `clear`. If `enabled=true`, it injects context telling the
orchestrator to re-arm the loop in the recorded mode — so you should invoke this
skill with the recorded `mode` as your first action that session. This is what
makes the toggle survive session restarts; you do not rely on the user remembering.

The hook deliberately does **not** fire on `compact` (same session continues; the
loop may still be alive — re-arming would stack a duplicate). A loop that dies
mid-session is the one residual gap: it shows up as a stale `last_tick`, which the
no-arg `auto-status` query surfaces.

## Notes / limitations

- The loop runs in **this session's** context — it ticks only while the machine is
  on and awake and the session process is alive. It does **not** run through
  laptop sleep or with the session closed. The state file + SessionStart hook
  cover *restart*, not *machine-off*.
- The status-pulse mode is a **report only** — it must never spawn agents, merge
  PRs, move tickets, or change state. The away mode is the opposite: it actively
  orchestrates, but still never makes calls reserved for the user's own sign-off.
- This skill is global (`~/.claude/skills/auto-status/`). The per-project pieces
  (state file, SessionStart hook, settings registration, gitignore line) are set
  up per project — see `PORTING.md` in this skill's directory.
