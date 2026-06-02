# keep-screens-alive

Toggles a background PowerShell process that holds Windows'
`SetThreadExecutionState(ES_CONTINUOUS | ES_DISPLAY_REQUIRED)` flag, keeping displays awake **even when admin policy locks the GUI screen-sleep settings**.

It works because the execution-state API is callable by any process without elevation — so it bypasses the admin lockout that greys out the screen-timeout controls. The on/off state persists to a per-user state file.

## When to use it

- "keep screens alive" / "/keep-screens-alive ..."
- Any request to prevent display sleep during long-running work (Playwright soaks, presentations, long builds).

## How it works

- **on** → launches a background PowerShell process ([`screen-alive.ps1`](screen-alive.ps1)) that continuously asserts the display-required execution state.
- **off** → stops the process and clears the persisted state.
- State persists per-user, so the toggle's intent is remembered between invocations.

## Notes

- Bypasses admin-locked screen-sleep settings without requiring elevation.
- Holds the *display* awake (not just the system), so monitors stay on.
