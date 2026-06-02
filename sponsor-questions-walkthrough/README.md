# sponsor-questions-walkthrough

Walks the sponsor through accumulated **open orchestrator-side decisions one at a time**, using `AskUserQuestion` popups with concrete options and per-option descriptions — so the sponsor can *click* instead of typing freeform answers. It replaces the freeform-bullet-list pattern with focused, one-question-at-a-time popups.

It surfaces only items that genuinely need sponsor input and never fabricates filler.

## When to use it

- "sponsor questions walkthrough" / "/sponsor-questions-walkthrough"
- "sponsor gate questions" / "/sponsor-gate-questions"
- "walk me through your questions" / "what do you need from me"
- "what are your open questions" / "any open questions" / "any gates you need me for"
- "what gates need my approval" / "go through your questions"

## Where the questions come from

Both live-session context and persisted sources:

- **Live session** *(the bulk)* — decisions the orchestrator deferred during the current session.
- **`team/STATE.md`** — entries marked "pending sponsor".
- **`.claude/away-queue.md`** — queued away-mode items.
- **`.claude/decisions-while-away.md`** — entries with `Status: pending review`.
- **Tracker (ClickUp)** — tickets flagged for sponsor.

## How it works

1. Gathers pending decisions from the live session + the persisted sources above.
2. Presents each as an `AskUserQuestion` popup with a recommended option first and a short description per option.
3. Records the sponsor's clicked answers and moves to the next, skipping anything that doesn't genuinely need input.
