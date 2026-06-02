# drain-session

Winds down a multi-agent orchestration session toward **quiescence** so a clean state-save can follow. It stops heartbeat/dispatch crons and refrains from starting new tickets, but it **continues closure activities**:

- merging in-flight PRs,
- dispatching QA for pending sign-offs,
- flipping tracker (ClickUp) statuses,
- resolving coordination-doc conflicts.

When all agents are idle, it surfaces **"drain complete"**. The skill does **not** itself save the session — it reaches the idle state that lets `/save-session` capture cleanly.

> **Invoke this BEFORE `/save-session` whenever multiple agents are in flight and you signal end-of-session intent.** For the combined one-step version, use [`drain-and-save-session`](../drain-and-save-session).

## When to use it

- "drain" / "wind down" / "/drain-session"
- "save session" *(when work is in flight)*
- "let's enter a new session" / "wait for everyone to finish" / "stop dispatching"

## How it works

1. Stops recurring dispatch/heartbeat crons; no new tickets are started.
2. Drives existing work to completion (merges, QA, status flips, conflict resolution).
3. Announces "drain complete" once 0 agents are active and 0 PRs are open — the clean point for [`save-session`](../save-session).
