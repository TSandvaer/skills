---
name: keep-screens-alive
description: Toggle a background PowerShell process that holds Windows' SetThreadExecutionState(ES_CONTINUOUS | ES_DISPLAY_REQUIRED) flag, keeping displays awake even when admin policy locks the GUI screen-sleep settings. Use when the user says "keep screens alive", "/keep-screens-alive ...", or wants to prevent display sleep during long-running work (Playwright soaks, presentations). The on/off state persists to a per-user state file. Bypasses admin lockout because the API is callable by any process without elevation.
---

# Keep Screens Alive

A durable wrapper around a background PowerShell process that holds Windows'
`SetThreadExecutionState(ES_CONTINUOUS | ES_DISPLAY_REQUIRED)` flag — the same
mechanism VLC / video players / installers use to prevent display sleep. The
flag is held continuously while the process lives, no periodic ticking needed.
Bypasses admin-locked GUI screen-sleep settings because the underlying Windows
API is callable by any process without elevation.

Two states:

- **`on`** — spawns a detached background PowerShell process holding the flag.
  Displays stay awake until `off` is run or the PID dies.
- **`off`** — kills the background process by PID. Display sleep settings return
  to normal Windows behaviour.

## The state file

Path: `$env:USERPROFILE\.claude\keep-screens-alive.state` (i.e.
`C:\Users\<user>\.claude\keep-screens-alive.state`). Per-user, NOT per-project —
the display is the same regardless of which project you're in. Format
(`key=value`, one per line):

```
# keep-screens-alive state — managed by the skill. Do not edit by hand.
enabled=true
pid=12345
started_at=2026-05-16T13:00:00Z
```

If the file is missing or `enabled=false`, keep-screens-alive is off.

## Step 0: Parse the argument

Invoked with a single argument: `on` / `off` (case-insensitive).
Synonyms: `start` → `on`, `stop` → `off`.

- **No argument** → this is a **status query**. Read the state file, verify the
  PID is still alive, and report in one or two lines. Then stop.
- Unrecognised argument → ask whether they mean `on` or `off`, and stop. Do
  not guess.

## Step 1: `keep-screens-alive on`

1. Read the state file. If `enabled=true` AND the PID is still alive
   (`Get-Process -Id <pid> -ErrorAction SilentlyContinue`), say so in one line
   and stop — do NOT double-spawn.
2. Otherwise spawn a detached background PowerShell process running
   `screen-alive.ps1`:
   ```powershell
   $script = "$env:USERPROFILE\.claude\skills\keep-screens-alive\screen-alive.ps1"
   $proc = Start-Process pwsh -ArgumentList "-NoProfile","-WindowStyle","Hidden","-File",$script -WindowStyle Hidden -PassThru
   ```
3. Write the state file with `enabled=true`, `pid=<proc.Id>`,
   `started_at=<current UTC ISO-8601>`.
4. Confirm in one line:
   `Keep-screens-alive ON (pid <id>). Displays stay awake until "keep-screens-alive off" or this PID dies.`

## Step 2: `keep-screens-alive off`

1. Read the state file. If `enabled=false` OR the recorded PID is not alive,
   say "already off" in one line and ensure state shows `enabled=false`.
2. Otherwise kill the PID:
   ```powershell
   Stop-Process -Id <pid> -Force -ErrorAction SilentlyContinue
   ```
3. Update state to `enabled=false`, clear `pid=` and `started_at=`.
4. Confirm in one line:
   `Keep-screens-alive OFF — display sleep settings restored.`

## Step 3: Status query (no argument)

1. Read the state file. If missing or empty, say `Keep-screens-alive OFF (no state file).` and stop.
2. Check if PID is alive (`Get-Process -Id <pid> -ErrorAction SilentlyContinue`).
3. Report in one or two lines:
   - **Enabled + alive:** `Keep-screens-alive ON (pid <id>, uptime <minutes>).`
   - **Enabled + not alive:** `Keep-screens-alive state says ON but pid <id> is gone — flag is cleared. Resetting state to off.` Then write `enabled=false`.
   - **Disabled:** `Keep-screens-alive OFF.`

## Notes / limitations

- The Windows API `SetThreadExecutionState(ES_CONTINUOUS | ES_DISPLAY_REQUIRED)`
  keeps the **display** awake, not the system. To also prevent system sleep,
  add `ES_SYSTEM_REQUIRED` to the flag in `screen-alive.ps1`.
- The detached process survives Claude session exit. The user must run
  `keep-screens-alive off` to release the flag. Restarting Windows also clears it.
- Lid-close is a separate Windows handler; this skill does not override it.
- No SessionStart auto-rearm in v1 — screens-alive is transient by nature.
  The state file persists so the user can query whether a stale process is
  still running, but a new Claude session does NOT auto-spawn the keeper.
- No periodic input simulation, no fake key presses, no mouse jiggling — zero
  interference with whatever the user is actively doing.
