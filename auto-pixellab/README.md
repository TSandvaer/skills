# auto-pixellab

A durable toggle for a recurring **PixelLab dispatch+harvest tick**. Turn it on and the skill starts a ~5-minute loop that checks the in-flight PixelLab generation, harvests it when complete (bulk-download via `curl` + extract), advances the dispatch queue file, and dispatches the next pending row. Turn it off and the loop stops.

The on/off state is persisted to a per-project state file, so the toggle survives session restarts — a SessionStart hook reads the state file and re-arms the loop automatically on every new session.

It is deliberately kept **independent from `auto-status`** so PixelLab's short task-loop cadence doesn't pollute the orchestrator pulse, and so PixelLab dispatch lifetime isn't tied to orchestration cadence. You can turn either one on/off without affecting the other.

## When to use it

- "auto-pixellab on" / "auto-pixellab off"
- `/auto-pixellab ...`
- Any request to start/stop periodic advancement of a PixelLab animation queue.

## How it works

- **State file:** `<project>/.claude/auto-pixellab.state` (`key=value` lines: `enabled`, `interval`, `queue_file`, `last_tick`). Gitignored — per-machine state, not committed.
- **Queue file:** a markdown table of `Status | Character | Template | Animation Name` rows that the tick advances as generations complete.
- **on** → arms a ~5-min loop that harvests completed generations and dispatches the next pending row.
- **off** → stops the loop and records the disabled state.
