# Porting `auto-status` to another project

The `auto-status` skill itself is **global** (`~/.claude/skills/auto-status/`), so it
is already available in every project on this machine. What is *per-project* is the
**durability wiring**: a state file, a SessionStart hook that re-arms the loop, the
settings registration, and a gitignore line.

To set up auto-status in a new project (e.g. Marian-tutor), paste this whole file
into a Claude Code session opened in that project and say: **"set up auto-status
durability wiring per this guide."** The steps below are written for that session.

---

## What you're installing

Four per-project artifacts. The skill logic lives in the global skill; these just
make the on/off/away toggle survive session restarts in *this* project.

1. `.claude/hooks/session-start-auto-status.sh` — the re-arm hook (new file).
2. `.claude/settings.json` — register the hook under `SessionStart` (merge).
3. `.gitignore` — ignore the state file (one line).
4. `.claude/auto-status.state` — created automatically by the skill on first
   `auto-status on/away`; you do **not** create it by hand.

---

## Step 1 — Create the hook

Write this file verbatim to `.claude/hooks/session-start-auto-status.sh`:

```bash
#!/usr/bin/env bash
# SessionStart hook — re-arms the auto-status loop if it was left enabled
# before this session started.
#
# The auto-status loop is session-scoped: it dies on session restart / resume /
# clear. This hook reads the durable intent from .claude/auto-status.state and,
# if auto-status was left enabled, injects context telling the orchestrator to
# re-arm the loop in the recorded mode. This is the restart-survival mechanism —
# without it, re-arming depends on the user remembering.
#
# Deliberately NOT matched on `compact`: compaction keeps the same session, so
# the loop may still be alive — re-arming there risks stacking a second loop.
# A loop that dies mid-session (rare) is surfaced via a stale `last_tick`, which
# the no-arg `auto-status` command reports.
#
# Always exits 0; never blocks.

set -eu

STATE_FILE="$CLAUDE_PROJECT_DIR/.claude/auto-status.state"
if [ ! -f "$STATE_FILE" ]; then
  STATE_FILE="$CLAUDE_PROJECT_DIR/../.claude/auto-status.state"
fi
[ -f "$STATE_FILE" ] || exit 0

getval() { grep -E "^$1=" "$STATE_FILE" 2>/dev/null | head -1 | cut -d= -f2- || true; }

ENABLED="$(getval enabled)"
MODE="$(getval mode)"
INTERVAL="$(getval interval)"
LAST_TICK="$(getval last_tick)"

[ "$ENABLED" = "true" ] || exit 0
MODE="${MODE:-local}"
INTERVAL="${INTERVAL:-5m}"

CONTEXT="# Auto-status re-arm (SessionStart)

auto-status was left **enabled** before this session (mode=\`$MODE\`, interval=\`$INTERVAL\`, last_tick=\`${LAST_TICK:-never}\`).

The auto-status loop is session-scoped and does NOT survive a session restart — so it is **not running right now**. Re-arm it as your first action this session: invoke the \`auto-status\` skill with argument \`$MODE\` (use \`on\` if mode is \`local\`). Do this before handling the user's request, unless the user's first message explicitly turns auto-status off."

node -e '
const ctx = process.argv[1];
const mode = process.argv[2];
process.stdout.write(JSON.stringify({
  systemMessage: `Auto-status was enabled (mode=${mode}) — re-arm pending.`,
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: ctx,
  },
}));
' "$CONTEXT" "$MODE"
```

Notes:
- Requires `bash` and `node` on PATH (Claude Code ships both contexts; the existing
  read-docs hook in most projects already relies on `node`).
- If the project keeps hooks elsewhere, adjust the path — but `.claude/hooks/` is
  the convention.

## Step 2 — Register the hook in `.claude/settings.json`

Add a second entry to the `SessionStart` array (matcher `startup|resume|clear` —
**not** `compact`). If `.claude/settings.json` doesn't exist, create it with just
the `hooks` block. If it already has a `SessionStart` array, append this object to
it:

```json
{
  "matcher": "startup|resume|clear",
  "hooks": [
    {
      "type": "command",
      "command": "bash \"$CLAUDE_PROJECT_DIR/.claude/hooks/session-start-auto-status.sh\""
    }
  ]
}
```

A complete minimal `settings.json` if the project has no hooks yet:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume|clear",
        "hooks": [
          {
            "type": "command",
            "command": "bash \"$CLAUDE_PROJECT_DIR/.claude/hooks/session-start-auto-status.sh\""
          }
        ]
      }
    ]
  }
}
```

## Step 3 — Gitignore the state file

Add this line to the project's `.gitignore` (the state file is per-machine state,
not committed):

```
.claude/auto-status.state
```

## Step 4 — (optional) Adapt the away-mode prompt

The global skill's **away-mode prompt** is written project-agnostically: it tells
the loop to "respect every hard rule in this project's CLAUDE.md" and to queue
anything needing the user's sign-off into "the project's coordination/state doc."

That works as-is for any project that has a CLAUDE.md describing its orchestration
conventions. If the new project needs **project-specific orchestration steps** in
the away tick (specific gates, a specific board, named agents, a specific state
file path), don't edit the global skill — instead, either:
- ensure the project's CLAUDE.md spells those conventions out (preferred — the
  away prompt already defers to it), or
- create a project-local override of the away prompt if your setup supports it.

The read-only `on`/`local` prompt is fully generic and needs no adaptation.

---

## Verify

1. Run `auto-status on` in the project — confirm `.claude/auto-status.state` is
   created with `enabled=true`, `mode=local`.
2. Restart the session (or `/clear`) — on startup you should see the hook's
   banner `Auto-status was enabled (mode=local) — re-arm pending.` and the
   orchestrator should re-arm the loop as its first action.
3. Run `auto-status off` — confirm the state file flips to `enabled=false` and the
   loop stops.
4. Run `auto-status` with no argument — confirm it reports current state and
   `last_tick` age.

## How it behaves (recap)

- **on / local** — 5-min read-only status pulse. Reports; never changes state.
- **away** — ~15-min active orchestration tick. Revives stale agents, merges
  gate-cleared PRs, keeps waves in flight, queues sign-off items. Never makes
  calls reserved for the user.
- **off** — stops the loop; state file remembers it's off.
- Survives **session restart** (hook re-arms). Does **not** run through machine
  sleep / closed session — the loop is local and session-scoped by design.
