# Porting `auto-pixellab` to another project

The `auto-pixellab` skill itself is **global** (`~/.claude/skills/auto-pixellab/`),
so it is already available in every project on this machine. What is *per-project*
is the **durability wiring**: a state file, a SessionStart hook that re-arms the
loop, the settings registration, a gitignore line, and (the one new bit vs
auto-status) a **dispatch queue file** the tick can read.

To set up auto-pixellab in a new project, paste this whole file into a Claude
Code session opened in that project and say: **"set up auto-pixellab durability
wiring per this guide."** The steps below are written for that session.

---

## What you're installing

Five per-project artifacts. The skill logic lives in the global skill; these
just make the on/off toggle survive session restarts and give the tick a queue
to operate on.

1. `.claude/hooks/session-start-auto-pixellab.sh` — the re-arm hook (new file).
2. `.claude/settings.json` — register the hook under `SessionStart` (merge).
3. `.gitignore` — ignore the state file (one line).
4. `.claude/anim-dispatch-queue.md` — the queue file the tick reads (project
   authors initial rows; the tick edits status fields).
5. `.claude/auto-pixellab.state` — created automatically by the skill on first
   `auto-pixellab on`; you do **not** create it by hand.

---

## Step 1 — Create the hook

Write this file verbatim to `.claude/hooks/session-start-auto-pixellab.sh`:

```bash
#!/usr/bin/env bash
# SessionStart hook — re-arms the auto-pixellab loop if it was left enabled
# before this session started.
#
# Mirrors session-start-auto-status.sh. The auto-pixellab loop is session-
# scoped: it dies on session restart / resume / clear. This hook reads the
# durable intent from .claude/auto-pixellab.state and, if auto-pixellab was
# left enabled, injects context telling the orchestrator to re-arm the loop.
#
# Deliberately NOT matched on `compact`: compaction keeps the same session,
# so the loop may still be alive — re-arming there risks stacking a second
# loop. A loop that dies mid-session is surfaced via a stale `last_tick`,
# which the no-arg `auto-pixellab` command reports.
#
# Always exits 0; never blocks.

set -eu

STATE_FILE="$CLAUDE_PROJECT_DIR/.claude/auto-pixellab.state"
[ -f "$STATE_FILE" ] || exit 0

getval() { grep -E "^$1=" "$STATE_FILE" 2>/dev/null | head -1 | cut -d= -f2- || true; }

ENABLED="$(getval enabled)"
INTERVAL="$(getval interval)"
QUEUE_FILE="$(getval queue_file)"
LAST_TICK="$(getval last_tick)"

[ "$ENABLED" = "true" ] || exit 0
INTERVAL="${INTERVAL:-5m}"
QUEUE_FILE="${QUEUE_FILE:-.claude/anim-dispatch-queue.md}"

CONTEXT="# Auto-pixellab re-arm (SessionStart)

auto-pixellab was left **enabled** before this session (interval=\`$INTERVAL\`, queue_file=\`$QUEUE_FILE\`, last_tick=\`${LAST_TICK:-never}\`).

The auto-pixellab loop is session-scoped and does NOT survive a session restart — so it is **not running right now**. Re-arm it as your first action this session: invoke the \`auto-pixellab\` skill with argument \`on\`. Do this before handling the user's request, unless the user's first message explicitly turns auto-pixellab off."

node -e '
const ctx = process.argv[1];
process.stdout.write(JSON.stringify({
  systemMessage: `Auto-pixellab was enabled — re-arm pending.`,
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: ctx,
  },
}));
' "$CONTEXT"
```

## Step 2 — Register the hook in `.claude/settings.json`

Add a new entry to the `SessionStart` array (matcher `startup|resume|clear` —
**not** `compact`). If the array already exists (e.g. for auto-status), append
this object:

```json
{
  "matcher": "startup|resume|clear",
  "hooks": [
    {
      "type": "command",
      "command": "bash \"$CLAUDE_PROJECT_DIR/.claude/hooks/session-start-auto-pixellab.sh\""
    }
  ]
}
```

## Step 3 — Gitignore the state file

Add this line to the project's `.gitignore`:

```
.claude/auto-pixellab.state
```

## Step 4 — Create / verify the dispatch queue file

The skill's default path is `.claude/anim-dispatch-queue.md`. The file is a
markdown table with this shape (the auto-pixellab tick reads + edits the
Status column only):

```markdown
# PixelLab Animation Dispatch Queue

## Character IDs

- Player: `a6eddc72-3256-44c8-81e9-51065cd0e5ac`
- Grunt:  `e92d6924-44b3-4968-a3fd-ee5aecfe5ea5`
- ...

## Queue

| Status | Character | Template | Animation Name |
|---|---|---|---|
| pending | Player | walking-4-frames | player-walk |
| pending | Player | lead-jab | player-attack-light |
| ...
```

Status values:
- `pending` — not yet dispatched
- `in flight` — `mcp__pixellab__animate_character` call submitted, generation
  in progress
- `done` — generation complete + harvested to disk

Only ONE row at a time should be `in flight` on Tier 1 (8-slot ceiling).

The tick does not author the queue — the user / orchestrator writes pending
rows ahead of time and turns auto-pixellab on. The tick handles
advancement + harvest.

## Step 5 — (optional) Project-specific harvest path

The skill's tick prompt expects the harvest pattern documented in the
project's PixelLab pipeline doc (typically `.claude/docs/pixellab-pipeline.md`).
Default pattern:

```bash
curl -fsSL -o /tmp/<char>.zip \
  "https://api.pixellab.ai/mcp/characters/<char_uuid>/download"
unzip -q -o /tmp/<char>.zip -d assets/sprites/<char>/_pixellab_anims/
```

If the project stores assets in a non-default path, document the actual path
in `pixellab-pipeline.md` and the tick will follow.

---

## Verify

1. Author the queue file with a few `pending` rows.
2. Run `auto-pixellab on` in the project — confirm
   `.claude/auto-pixellab.state` is created with `enabled=true`,
   `queue_file=<path>`.
3. Wait ~5 min — the first tick should dispatch the first pending row and
   mark it `in flight`.
4. Wait another ~5 min — the next tick should see the generation complete,
   harvest the ZIP, mark the row `done`, dispatch the next pending row.
5. Restart the session — on startup you should see the hook's banner
   `Auto-pixellab was enabled — re-arm pending.` and the orchestrator should
   re-arm the loop as its first action.
6. Run `auto-pixellab off` — confirm the state file flips to `enabled=false`
   and the loop stops.
7. Run `auto-pixellab` with no argument — confirm it reports current state
   and `last_tick` age.

## How it behaves (recap)

- **on** — ~5-min dispatch+harvest tick. Reads the queue file, advances rows
  on completion, dispatches new generations, harvests completed ZIPs.
  Changes state on every tick (file edits + API calls + asset downloads).
- **off** — stops the loop; state file remembers it's off.
- Survives **session restart** (hook re-arms). Does **not** run through
  machine sleep / closed session — the loop is local and session-scoped by
  design.
- Independent from `auto-status`: turn on/off without affecting the other.
