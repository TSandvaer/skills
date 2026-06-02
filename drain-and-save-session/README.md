# drain-and-save-session

A combined wind-down workflow that chains two skills in one step:

1. **`/drain-session`** — kills the recurring dispatch cron, refrains from new dispatches, and continues closure activities (merging in-flight PRs, QA sign-offs, status flips) until the team reaches **0 agents + 0 open PRs**.
2. **`/save-session`** — invoked *immediately* afterward, without waiting for separate user confirmation, to produce the resume one-liner and persist state.

Use it when you want closure **and** handoff in one move, rather than manually invoking `save-session` after watching for "Drain complete".

## When to use it

- "drain and save" / "/drain-and-save-session"
- "drain then save" / "wind down and save" / "save session after drain"
- Any signal you want both winding down *and* the resume one-liner produced in one chained step.

## How it works

Runs [`drain-session`](../drain-session) to quiescence, then chains straight into [`save-session`](../save-session) — no intermediate prompt.
