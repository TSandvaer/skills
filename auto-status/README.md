# auto-status

A durable toggle for a recurring **orchestrator check**. It has three states:

- **on** — a 5-minute *read-only status pulse* that reports where the orchestration stands without taking action.
- **away** — a ~15-minute *active orchestration tick* that keeps the team moving (dispatching, merging, advancing work) while you're gone.
- **off** — stops the recurring check entirely.

The on/off/away state is persisted to a per-project state file, so the toggle survives session restarts — a SessionStart hook reads the state file and re-arms the loop automatically on every new session.

## When to use it

- "auto-status on" / "auto-status off" / "auto-status away"
- `/auto-status ...`
- Any request to start/stop periodic status updates or away-mode orchestration.

## How it works

- **State file:** `<project>/.claude/auto-status.state`, holding the enabled mode (`on` / `away` / `off`), interval, and last-tick timestamp. Gitignored — per-machine state, not committed.
- **on** arms a short read-only pulse; **away** arms a longer active-orchestration tick; **off** clears the loop.
- Independent from `auto-pixellab`, which runs its own dedicated cadence so the two don't interfere.
