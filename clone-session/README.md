# clone-session

Clones the current work-in-progress into a **brand-new Claude Code conversation**. It does everything `save-session` does — promotes durable insights to memory, writes a structured state file capturing the current task / files / decisions / next-steps, and returns a paste-ready resume one-liner — and then goes one step further: it **auto-opens a fresh Claude Code conversation in VS Code with the resume one-liner pre-filled**, so all you have to do is press Enter.

The difference from `save-session` is the handoff: `save-session` hands you the one-liner to paste yourself; `clone-session` opens the new conversation for you.

## When to use it

- "clone session" / "/clone-session"
- "clone this session" / "fork session"
- Any request to seamlessly hand off in-flight work to a new conversation without manually copying and pasting.

## How it works

1. Runs the full `save-session` capture — memory promotion + structured state file + resume one-liner.
2. Opens a new Claude Code conversation in VS Code.
3. Pre-fills the resume one-liner so the next conversation resumes cleanly on a single keypress.

See also: [`save-session`](../save-session) (capture without auto-opening a new conversation).
