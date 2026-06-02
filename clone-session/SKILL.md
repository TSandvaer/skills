---
name: clone-session
description: Clone the current work-in-progress into a brand-new Claude Code conversation — does everything save-session does (promote durable insights to memory, write a structured state file capturing current task/files/decisions/next-steps, return a paste-ready one-liner) AND auto-opens a fresh Claude Code conversation in VS Code with the resume one-liner pre-filled, so the user only presses Enter. Use when the user says "clone session", "/clone-session", "clone this session", "fork session", or otherwise asks to seamlessly hand off in-flight work to a new conversation without manually copying and pasting.
---

# Clone Session

Capture the current work cleanly so a fresh Claude session can pick it up cold, promote any durable lessons learned to memory along the way, and seamlessly open the new conversation pre-filled with the resume one-liner.

## What this skill does

1. **Audits the conversation** to identify what's worth saving.
2. **Promotes durable insights to memory** — patterns, feedback, project context that should survive past this task.
3. **Writes a state file** — captures the ephemeral, in-flight context: current goal, files in progress, decisions made, next steps, blockers.
4. **Returns a one-liner** the user pastes into a new session to resume.
5. **Auto-opens a new Claude Code conversation in VS Code** with the resume one-liner pre-filled, so the user only presses Enter.

## Two kinds of information — keep them separate

These live in different places. Don't conflate them.

| Information | Where it goes | Example |
|---|---|---|
| Stable facts, patterns, preferences, project context | **Memory** (`<project>/memory/`) | "Mobile hover requires onPointerEnter not onMouseEnter — mouseleave doesn't fire on touch" |
| Current task state, files in progress, what's next | **State file** (`<project>/sessions/`) | "Working on PBI 149225, refactored Case2.tsx similar-listings button, need to add tests next" |

The auto-memory rules in the user's harness already define what's memory-worthy. Don't duplicate ephemeral state into memory — and don't put durable patterns into the state file (they'd disappear when the task closes).

## Step 1 — Promote durable insights to memory

Re-read the conversation looking for things worth remembering across future sessions:

- **User memory** — new info about the user's role, expertise, or preferences
- **Feedback memory** — corrections ("stop doing X") *and* validations ("yes, that approach was right"). Both matter.
- **Project memory** — organizational context, deadlines, motivations behind decisions
- **Reference memory** — external systems mentioned (Linear projects, dashboards, channels, IT tickets)

Save each as its own file in the memory directory and add a one-line pointer in `MEMORY.md`. Follow the format from the auto-memory section already in the system prompt: frontmatter with `name`/`description`/`type`, then the body. For feedback/project memories, include the **Why:** and **How to apply:** lines so future-you can judge edge cases.

If nothing in the conversation rises to the level of memory, skip this step. Don't manufacture memories — fabricated rules are worse than no rules.

If a memory already covers what you'd write, **update it in place** rather than duplicating.

## Step 2 — Write the state file

### Locate the sessions directory

The auto-memory directory path is given in the system prompt under the "auto memory" section (e.g. `C:\Users\538252\.claude\projects\c--Trunk-EDC-EDCDK-Website\memory\`). Sessions live in a **sibling directory** called `sessions/` at the same level as `memory/`. Create it if it doesn't exist.

If for some reason the auto-memory section is not present, fall back to creating `<repo-root>/.claude/sessions/` and tell the user where you put it.

### Filename

`session-YYYY-MM-DD-HHMM-<short-slug>.md`

The slug is 2-4 hyphenated words summarizing the task — e.g., `case2-similar-listings-bug`, `bbr-seo-refactor`, `umbraco-cache-investigation`. Infer it from the conversation; don't ask the user.

### Enrich with git state

Before writing the file, gather concrete repo state so the resumer doesn't have to:

```bash
git rev-parse --abbrev-ref HEAD       # branch
git status --short                     # dirty files
git log -5 --oneline                   # recent commits for context
git diff --stat                        # scope of unstaged changes
git diff --stat --cached               # scope of staged changes
```

Don't run anything destructive. Read-only inspection only.

### Template

```markdown
---
saved: <ISO timestamp>
branch: <git branch>
repo: <repo path or name>
---

# Session: <one-line title>

## Goal
<1-3 sentences: what the user is trying to accomplish. Include PBI/issue ID and link if known. State the *why*, not just the *what* — the resumer needs motivation to make judgment calls.>

## Status
<Where we are right now. What's done vs in progress. Be specific — "wrote the hook, hook works in isolation, integration with X still failing with error Y" beats "made progress on the hook".>

## Files changed
<List of files modified or being worked on, each with a one-line description of the change. Pull from `git status` plus anything not yet on disk that's been planned. Use clickable markdown links: [path/to/file.tsx](path/to/file.tsx).>

## Key decisions
<Choices made during this session and the reasoning behind them. Include rejected alternatives if the resumer might be tempted to revisit them. Decisions without reasons rot fast — always include the why.>

## Next steps
<Concrete actions to take when resuming, in order. Be specific — name files and what to change. "Add a useEffect to Case2.tsx that resets the search-on-edit flag when the case changes" beats "finish the hook".>

## Open questions / blockers
<Anything unresolved: questions for the user, things waiting on someone else, debugging dead-ends. Mark each with the kind of resolution needed.>

## Useful context
<Commands, file paths, env details, test invocations the resumer will need. Include URLs to PBIs, PRs, dashboards. Skip the section if there's nothing.>
```

### Self-contained rule

**The resumer agent gets nothing but this file.** No conversation history, no recall of decisions. If a fact isn't in the state file, it's lost. Err on the side of writing more context, not less — file-system bytes are cheap, the user's time re-explaining is not.

Concretely: include enough that someone reading cold could pick up the work without asking the user clarifying questions about basics like "what PBI is this", "what branch are you on", "what have you already tried".

## Step 3 — Return the one-liner

After the file is written, output **exactly** this line as your final message — no narration around it, no extra commentary, just the line itself in a code block so it's easy to copy:

```
Resume from <absolute-path-to-state-file>
```

A fresh Claude session will recognize this as an instruction to read the state file and continue the work described.

## Step 3a — Auto-open the resume conversation in VS Code

After (or alongside) printing the one-liner, dispatch it to a brand-new Claude Code conversation via the extension's URI handler so the user can resume with a single Enter press. This is the headline behaviour that distinguishes `clone-session` from `save-session`.

Run this as a PowerShell tool call, substituting the real absolute path:

```powershell
$oneLiner = "Resume from <absolute-path-to-state-file>"
$encoded  = [Uri]::EscapeDataString($oneLiner)
$uri      = "vscode://Anthropic.claude-code/open?session=$([guid]::NewGuid())&prompt=$encoded"

# Clipboard as a graceful fallback
$clip = $false
try {
    if     ($IsWindows) { $oneLiner | Set-Clipboard; $clip = $true }
    elseif ($IsMacOS)   { $oneLiner | & pbcopy;       $clip = $true }
    else                { $oneLiner | & xclip -selection clipboard; $clip = $true }
} catch {}

$opened = $false
try {
    if ($IsWindows) {
        # WMI Win32_Process.Create spawns under WmiPrvSE.exe — a process tree
        # completely outside Code.exe's lineage. Required because Start-Process
        # from inside Claude Code's PowerShell tool (a descendant of Code.exe)
        # hits a URI-routing filter that silently drops the dispatch. cmd /c start
        # then performs the ShellExecute from that clean parent, and the URI
        # reaches the running VS Code window normally.
        $cmd = "cmd.exe /c start `"`" `"$uri`""
        $r = ([wmiclass]"Win32_Process").Create($cmd)
        if ($r.ReturnValue -ne 0) { throw "WMI dispatch failed (return $($r.ReturnValue))" }
    }
    elseif ($IsMacOS) { & open $uri }
    else              { & xdg-open $uri }
    $opened = $true
} catch {}

if     ($opened) { Write-Host "Opened a new Claude Code conversation with the resume prompt pre-filled. Press Enter to continue." }
elseif ($clip)   { Write-Host "Couldn't reach VS Code. One-liner is on your clipboard - open a new conversation and press Ctrl+V then Enter." }
else             { Write-Host "Could not open VS Code or access clipboard. Copy the line below manually:"; Write-Host $oneLiner }
```

**Mechanism:** the Claude Code extension registers a URI handler for `vscode://Anthropic.claude-code/open?prompt=...`. The prompt is embedded as `data-initial-prompt` on the webview root and applied via `setInputText` on mount.

**Guardrails:**
- Publisher segment is capital-A `Anthropic` — do not lowercase.
- Use `[Uri]::EscapeDataString` for encoding — not `HttpUtility.UrlEncode` (it turns spaces into `+` which the webview won't decode).
- Never attempt SendKeys / keystroke injection; the URI handler focuses the input itself.
- If the targeted Claude session is already open, the extension shows "Session is already open. Your prompt was not applied — enter it manually." The clipboard fallback covers that — the user can Ctrl+V into the existing window.
- Skip this step if `$env:CLAUDE_SAVE_SESSION_NO_AUTO_OPEN` is set (user opt-out).

If you also wrote new memories in step 1, briefly mention what was promoted *before* the one-liner — one short sentence per memory, so the user knows what stuck. Then the one-liner on its own, then the auto-open step.

## Notes

- **Don't ask the user to fill anything in.** Infer the slug, the title, the goal, the next steps from the conversation. If you genuinely can't determine something, say so in the relevant section of the state file ("unclear whether X or Y; resumer should ask user") rather than blocking on the user.
- **Be honest about uncertainty.** If a decision was tentative or a fix was a guess, say so. The resumer shouldn't treat speculation as fact.
- **Don't commit, push, or modify git state.** Saving a session is a read-only operation against the repo. The state file lives outside the repo entirely.
- **Don't create a state file for trivial conversations.** If the user has only asked a single question with no work in progress, there's nothing to save — tell them so and skip the file. The skill's value is preserving in-flight work, not paperwork for its own sake.
- **Multiple clones in one session are fine.** Each gets its own timestamped file. The most recent one is what the user will resume from.
