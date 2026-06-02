# screen-alive.ps1
#
# Holds Windows' SetThreadExecutionState(ES_CONTINUOUS | ES_DISPLAY_REQUIRED)
# flag until this process is killed. The flag prevents the display from sleeping
# regardless of the GUI Power Plan setting (which may be admin-locked).
#
# Same mechanism used by VLC, video players, installers, etc. The flag is per-
# thread; when this process exits, Windows automatically clears the flag and
# normal display-sleep behaviour resumes.
#
# Invoked by the keep-screens-alive skill via Start-Process with -WindowStyle
# Hidden. Sleeps forever in 1-hour chunks (the chunks are arbitrary — Start-Sleep
# could be -Seconds [int]::MaxValue, but 3600s chunks make the process easier to
# inspect and kill cleanly).

$ErrorActionPreference = 'Stop'

Add-Type @'
using System;
using System.Runtime.InteropServices;
public class Power {
    [DllImport("kernel32.dll")]
    public static extern uint SetThreadExecutionState(uint esFlags);
    public const uint ES_CONTINUOUS       = 0x80000000;
    public const uint ES_SYSTEM_REQUIRED  = 0x00000001;
    public const uint ES_DISPLAY_REQUIRED = 0x00000002;
}
'@

# Set the flag: continuous + display-required. Returns the PREVIOUS state on
# success or 0 on failure. We do not care about the prior state for our purposes.
$null = [Power]::SetThreadExecutionState([Power]::ES_CONTINUOUS -bor [Power]::ES_DISPLAY_REQUIRED)

# Sleep until killed. The flag remains in force until this thread exits.
while ($true) { Start-Sleep -Seconds 3600 }
