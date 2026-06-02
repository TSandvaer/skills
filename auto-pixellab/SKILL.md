---
name: auto-pixellab
description: Toggle a recurring PixelLab dispatch+harvest tick on or off, durably. Use when the user says "auto-pixellab on", "auto-pixellab off", "/auto-pixellab ...", or asks to start/stop periodic advancement of a PixelLab animation queue. "on" starts a ~5-min tick that checks the in-flight PixelLab generation, harvests it if complete (bulk-download via curl + extract), advances the queue file, and dispatches the next pending row. "off" stops it. The on/off state is persisted to a project state file and auto-re-armed on session restart by a SessionStart hook. Independent from `auto-status` so PixelLab task-loop cadence does not pollute the orchestrator pulse.
---

# Auto-PixelLab

A durable wrapper around the `loop` skill that toggles a recurring **PixelLab
dispatch+harvest tick**. The on/off state is persisted to a per-project **state
file**, so the toggle survives session restarts: a SessionStart hook reads the
state file and re-arms the loop automatically on every new session.

This skill exists to keep PixelLab task-loops out of `auto-status`. PixelLab
generations take ~3 min per direction-batch and benefit from a dedicated short
cadence; mixing them into the orchestrator pulse pollutes the pulse and ties
PixelLab dispatch lifetime to orchestration cadence. The two skills are
independent — turn either one on/off without affecting the other.

## The state file

Path: `<project>/.claude/auto-pixellab.state` (i.e. `$CLAUDE_PROJECT_DIR/.claude/auto-pixellab.state`).
It is gitignored — per-machine state, not committed. Format (`key=value`, one per line):

```
# auto-pixellab state — managed by the auto-pixellab skill. Do not edit by hand.
enabled=true
interval=5m
queue_file=.claude/anim-dispatch-queue.md
last_tick=2026-05-18T04:00:00Z
```

`queue_file` is the project-relative path to the dispatch queue (a markdown
table with `Status | Character | Template | Animation Name` rows; status values
`pending` / `in flight` / `done`). If the file is missing, auto-pixellab is off.

## Step 0: Parse the argument

Invoked with a single argument: `on` / `off` (case-insensitive).
Synonyms: `start` → `on`, `stop` → `off`.

- **No argument** → this is a **status query**. Read the state file and report
  in one or two lines: enabled? interval? queue_file? how long since
  `last_tick` (warn if older than 2× interval — the loop may have died
  mid-session). Then stop.
- Unrecognised argument → ask whether they mean `on` or `off`, and stop.
  Do not guess.

## Step 1: `auto-pixellab on` (active dispatch+harvest tick)

1. Detect the queue file. Default: `.claude/anim-dispatch-queue.md`. If a state
   file already exists with a `queue_file=` line, preserve it. If neither
   default nor stored path exists, ask the user to create the queue file or
   pass the path explicitly, then stop.
2. Write the state file with `enabled=true`, `interval=5m`,
   `queue_file=<resolved>`, `last_tick=` (current UTC timestamp).
3. If an auto-pixellab loop is already running in this session, say so in one
   line and stop — do **not** stack a second loop.
4. Otherwise start the recurring tick by invoking the `loop` skill with:
   - interval: `5m`
   - prompt: the **dispatch-tick prompt** below (verbatim)
5. Confirm in one line:
   `Auto-pixellab ON — dispatch+harvest tick every 5 min on <queue_file>. Say "auto-pixellab off" to stop.`

### Dispatch-tick prompt handed to the loop

```
PixelLab dispatch+harvest tick — advance the queue without user input.

1. Read the queue file path from <project>/.claude/auto-pixellab.state
   (key `queue_file`, default `.claude/anim-dispatch-queue.md`). The queue is a
   markdown table with rows: `Status | Character | Template | Animation Name`.
   Status values: `pending`, `in flight`, `done`.

2. Find the row marked `in flight`. If none:
   - If there's a `pending` row, dispatch it (see step 4) and mark it
     `in flight`. Update last_tick. Done.
   - If no `in flight` AND no `pending`, the queue is exhausted. Emit a
     one-line summary ("queue exhausted — N done, 0 pending") and update
     last_tick. Do NOT stop the loop here — the user controls that.

3. For the `in flight` row, call `mcp__pixellab__get_character` with the row's
   character UUID. Look for the animation in the returned `animations` list.
   - If present (the template+direction count matches): the generation is
     complete. Proceed to harvest (step 4a).
   - If absent: still generating. Update last_tick and emit one line
     ("still in flight: <character> / <template>"). Done.

4. **Harvest the completed generation.** Per the project's PixelLab pipeline
   doc (typically `.claude/docs/pixellab-pipeline.md`), bulk-download the
   character ZIP via curl:

       curl -fsSL -o /tmp/<char>.zip \
         "https://api.pixellab.ai/mcp/characters/<char_uuid>/download"
       unzip -q -o /tmp/<char>.zip -d assets/sprites/<char>/_pixellab_anims/

   The ZIP is cumulative — every generation for that character is bundled.
   `-o` overwrites silently; safe to re-run.

5. **Edit the queue file**: mark the just-harvested row `done`. If there is a
   next `pending` row, dispatch it now via `mcp__pixellab__animate_character`
   (re-using the template name + character UUID from the row), and mark it
   `in flight`. Only ONE row can be `in flight` at a time — Tier 1 has 8
   concurrent slots and an 8-direction animate call needs all 8.

6. Update last_tick in <project>/.claude/auto-pixellab.state to the current
   UTC timestamp.

7. Emit a concise one-line summary of what changed this tick (harvested /
   dispatched / still-flight / queue-exhausted).

Hard rules:
- Respect the project's CLAUDE.md (protected branches, testing bar, etc.) —
  but this skill only modifies asset files + the queue file, never code.
- Never commit or open PRs from this skill — the user does that manually
  once a queue batch is fully harvested.
- Never delete the queue file or rewrite its structure — only flip status
  values.
- If `mcp__pixellab__get_character` returns an error or partial data, do
  NOT mark the row done. Update last_tick + emit one-line warning. The next
  tick retries.
- If `mcp__pixellab__animate_character` fails to dispatch (e.g. all slots
  full, character not found), do NOT mark a row `in flight` that didn't
  actually start. Emit one-line warning + update last_tick. The next tick
  retries the dispatch.
```

## Step 2: `auto-pixellab off`

1. Write the state file with `enabled=false` (leave other fields as-is for
   reference).
2. Stop the running auto-pixellab loop — cancel the underlying `/loop` (invoke
   the `loop` skill's stop/cancel path, or cancel the scheduled wakeup / cron
   it created).
3. If no auto-pixellab loop was running, say so in one line.
4. Confirm in one line: `Auto-pixellab OFF — dispatch+harvest tick stopped.`

## Re-arm on session start (how durability works)

A SessionStart hook (`<project>/.claude/hooks/session-start-auto-pixellab.sh`,
registered in `<project>/.claude/settings.json`) reads the state file on every
`startup` / `resume` / `clear`. If `enabled=true`, it injects context telling
the orchestrator to re-arm the loop — so you should invoke this skill with
argument `on` as your first action that session. This is what makes the toggle
survive session restarts; you do not rely on the user remembering.

The hook deliberately does **not** fire on `compact` (same session continues;
the loop may still be alive — re-arming would stack a duplicate). A loop that
dies mid-session is the one residual gap: it shows up as a stale `last_tick`,
which the no-arg `auto-pixellab` query surfaces.

## Notes / limitations

- The loop runs in **this session's** context — it ticks only while the machine
  is on and awake and the session process is alive. It does **not** run
  through laptop sleep or with the session closed. The state file +
  SessionStart hook cover *restart*, not *machine-off*.
- The tick **does change state**: it edits the queue file, downloads ZIPs to
  `assets/sprites/<char>/_pixellab_anims/`, and dispatches new PixelLab
  generations (which burn API credits). It is NOT a read-only pulse like
  `auto-status on`. Turn it off if you don't want it advancing the queue
  unattended.
- The tick is **serial-by-row** by design. Tier 1's 8-slot ceiling means an
  8-direction animate call atomically rejects if any slot is short. Parallel
  multi-character dispatch is only safe on Tier 2 (10 slots) or higher with
  careful spacing. The skill keeps it simple: one row in flight, advance on
  completion.
- Compose with `auto-status`: both can be on at once. They use independent
  cron jobs, independent state files, and independent SessionStart hooks.
  The cadences (auto-pixellab 5m / auto-status local 5m / auto-status away
  15m) do not interfere because they emit independent summaries.
- This skill is global (`~/.claude/skills/auto-pixellab/`). The per-project
  pieces (state file, SessionStart hook, settings registration, gitignore
  line) are set up per project — see `PORTING.md` in this skill's directory.
