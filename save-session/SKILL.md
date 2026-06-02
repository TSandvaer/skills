---
name: save-session
description: Save the current work-in-progress as a resumable session — promote durable insights to memory, write a structured state file capturing current task/files/decisions/next-steps, and return a paste-ready one-liner the user can drop into a fresh conversation to resume cleanly. Use whenever the user says "save session", "/save-session", "save state", "let's pick this up later", "I need to stop here for now", "continue this tomorrow", or otherwise signals they want to pause and resume in a new conversation. This skill is the right tool any time context-switching is about to happen and the conversation contains in-flight work that would be expensive to reconstruct.
---

# Save Session

Capture the current work cleanly so a fresh Claude session can pick it up cold, and promote any durable lessons learned to memory along the way.

## What this skill does

1. **Audits the conversation** to identify what's worth saving.
2. **Promotes durable insights to memory** — patterns, feedback, project context that should survive past this task.
3. **Writes a state file** — captures the ephemeral, in-flight context: current goal, files in progress, decisions made, next steps, blockers.
4. **Returns a one-liner** the user pastes into a new session to resume.

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

## Step 3 — Silence the auto-status heartbeat

After the state file is written and BEFORE returning the resume one-liner, turn off auto-status. Save-session implies "pause" — an away-mode cron continuing to fire after a save means wasted dispatch cycles on an idle board, and risks the cron making mid-pause state changes the resumer doesn't expect.

Concretely:

1. Read `<project>/.claude/auto-status.state`. If the file doesn't exist or already has `enabled=false`, skip this step.
2. If a cron was created in this session via `CronCreate` for auto-status (typical job IDs are returned by `/auto-status on` or `/auto-status away` when they invoke `/loop`), cancel it via `CronDelete`. If you don't have the job ID in immediate context, query `CronList` to find any matching cron whose prompt body contains "Active orchestration tick" / "read-only status pulse" / similar auto-status signatures.
3. Write `<project>/.claude/auto-status.state` with `enabled=false` — preserve `mode`, `interval`, and `last_tick` for reference. Format:
   ```
   # auto-status state — managed by the auto-status skill. Do not edit by hand.
   enabled=false
   mode=<last-mode>
   interval=<last-interval>
   last_tick=<last-tick-timestamp>
   ```
4. Mention "Auto-status OFF — recurring check stopped (auto-disabled by save-session)" in your output above the resume one-liner so the user sees it.

The SessionStart hook in the next session will see `enabled=false` and NOT auto-re-arm — the user can type `/auto-status away` (or `on`) explicitly when they resume if they want the cron back. This honors the save-session-implies-pause intent.

This step applies to every project regardless of whether auto-status was on at save time — checking + skipping is cheaper than wondering whether you forgot.

## Step 4 — Return the one-liner

After the file is written, output **exactly** this line as your final message — no narration around it, no extra commentary, just the line itself in a code block so it's easy to copy:

```
Resume from <absolute-path-to-state-file>
```

A fresh Claude session will recognize this as an instruction to read the state file and continue the work described. The user copies that line, opens a new conversation, pastes, and they're back to work.

If you also wrote new memories in step 1, briefly mention what was promoted *before* the one-liner — one short sentence per memory, so the user knows what stuck. Then the one-liner on its own.

## Notes

- **Don't ask the user to fill anything in.** Infer the slug, the title, the goal, the next steps from the conversation. If you genuinely can't determine something, say so in the relevant section of the state file ("unclear whether X or Y; resumer should ask user") rather than blocking on the user.
- **Be honest about uncertainty.** If a decision was tentative or a fix was a guess, say so. The resumer shouldn't treat speculation as fact.
- **Don't commit, push, or modify git state.** Saving a session is a read-only operation against the repo. The state file lives outside the repo entirely.
- **Don't create a state file for trivial conversations.** If the user has only asked a single question with no work in progress, there's nothing to save — tell them so and skip the file. The skill's value is preserving in-flight work, not paperwork for its own sake.
- **Multiple saves in one session are fine.** Each gets its own timestamped file. The most recent one is what the user will resume from.
