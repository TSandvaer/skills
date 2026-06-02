# save-session

A Claude Code skill that captures your current work-in-progress as a resumable session, so a fresh conversation can pick it up cold — without you re-explaining anything.

It does two distinct jobs at once: it **promotes durable lessons to memory** (patterns, preferences, project context that should outlive this task), and it **writes a state file** capturing the ephemeral here-and-now (current goal, files in progress, decisions, next steps, blockers). When it's done it hands you a one-line paste-able resume command.

## When to use it

Reach for this whenever you're about to pause and resume later in a new conversation. The skill triggers on phrases like:

- "save session" / `/save-session` / "save state"
- "let's pick this up later" / "continue this tomorrow"
- "I need to stop here for now"
- any signal that a context-switch is coming and there's in-flight work worth preserving

It's most valuable when reconstructing the current state from scratch would be expensive. For a trivial conversation with no work in progress, it will tell you there's nothing to save rather than create paperwork.

## How to use it

1. **Invoke it** — type `/save-session`, or just say "save session" / "let's pick this up tomorrow". You don't fill anything in; the skill infers the task, title, slug, and next steps from the conversation.
2. **It runs four steps:**
   - **Audits the conversation** for what's worth saving.
   - **Promotes durable insights to memory** — user/feedback/project/reference memories, each as its own file with a pointer in `MEMORY.md`. Skipped if nothing rises to that bar.
   - **Writes a state file** enriched with read-only git state (branch, dirty files, recent commits, diff scope).
   - **Silences the auto-status heartbeat** — sets `enabled=false` so an away-mode cron doesn't keep firing during the pause.
3. **It returns a resume one-liner** as its final message:

   ```
   Resume from <absolute-path-to-state-file>
   ```

4. **To resume** — copy that line, open a fresh Claude Code conversation, and paste it. The new session reads the state file and continues the work described.

## What it produces

- **State file** at `<project>/sessions/session-YYYY-MM-DD-HHMM-<short-slug>.md` (a sibling of the auto-memory `memory/` directory). It's self-contained: goal, status, files changed, key decisions, next steps, open questions/blockers, and useful context. The resumer gets *nothing but this file*, so it errs on the side of more context.
- **Memory entries** (when warranted) under the project's `memory/` directory, with a one-line index entry in `MEMORY.md`.

Multiple saves in one session are fine — each gets its own timestamped file, and you resume from the most recent.

## What it won't do

- **No git mutations.** Saving is read-only against the repo — no commits, pushes, staging, or branch changes. The state file lives outside the repo entirely.
- **No fabricated memories.** If nothing is memory-worthy, it skips the memory step rather than manufacturing rules.
- **No nagging.** It won't ask you to fill in fields; if it genuinely can't determine something, it notes the uncertainty in the state file instead of blocking on you.

## Relationship to SKILL.md

[SKILL.md](SKILL.md) is the authoritative, agent-facing specification — the exact step-by-step instructions Claude follows when the skill runs, including file paths, the state-file template, and the auto-status shutdown procedure. This README is the human-facing orientation. If the two ever drift, SKILL.md is the source of truth.

## Related skills

- **drain-session** — winds a multi-agent orchestration down to quiescence first; invoke before save-session when several agents are in flight.
- **drain-and-save-session** — chains drain then save in one step.
- **clone-session** — does everything save-session does, then auto-opens a fresh Claude Code conversation with the resume line pre-filled.
