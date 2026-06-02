---
name: start-flow
description: Orchestrate the full PBI lifecycle — runs start-branch, start-pbi, start-pr, codereview, and post-pr in sequence with a confirmation gate between each step. Sets the VS Code terminal tab title to the PBI title, auto-invokes save-session after the analysis step, and gates post-pr on explicit acceptance of the code-review findings. Use when the user says "start-flow {pbi id}" or wants to take a work item from branch creation through to Teams announcement in one guided flow.
---

# Start Flow — End-to-end PBI workflow

Run the five PBI-lifecycle skills (`start-branch` → `start-pbi` → `start-pr` → `codereview` → `post-pr`) as a single guided flow with a confirmation gate between each step, so the user can continue, skip, jump to a specific step, or stop at any point.

This skill is an **orchestrator**: it does not duplicate the logic of the underlying skills. For each step, follow the corresponding `SKILL.md` in `C:\Users\538252\.claude\skills\<skill>\` exactly as written, then surface the gate prompt described below.

## Step 0: Parse input

Extract from the user's arguments:

- **Work item ID** (required) — a number (e.g. `145975`) or a full DevOps URL containing the ID.
- **Repository name** (optional) — accepts the same flexible names as `start-branch` (`website`, `core`, `business`, `rest.core`, `settings`). If omitted, infer it from the current working directory by matching the path against the `start-branch` repository table. If it can't be inferred, ask the user.

If the work item ID is missing, ask for it before doing anything else.

## Step 1: Fetch the PBI title and rename the VS Code terminal tab

Before running any sub-skills, fetch the PBI's title once so we can:

1. Use it as the terminal-tab label.
2. Reuse it across the steps below (saves a duplicate `az boards work-item show` call).

```bash
az boards work-item show --id {WORK_ITEM_ID} --output json --query "{title: fields.\"System.Title\", type: fields.\"System.WorkItemType\"}"
```

If `az boards` fails, tell the user to run `az login --allow-no-subscriptions` and retry — then stop, because the rest of the flow needs this data.

### Set the VS Code terminal tab title

Emit an OSC 0 escape sequence to the integrated terminal — VS Code's terminal honours this and updates the tab label:

```bash
printf '\033]0;%s\007' "{PBI_ID} {PBI_TITLE}"
```

This is best-effort. If the tab label doesn't visibly change, mention it once and move on — there is no public Claude Code API to rename the agent session itself, and the user can rename the tab manually if needed. Don't loop on this.

Cache `{PBI_ID}`, `{PBI_TITLE}`, and `{PBI_TYPE}` in the conversation for use in the per-step gate messages and final summary.

## Step 2: The step-gate protocol

Between every step (and before step 1), present a gate using `AskUserQuestion` so the user can choose what happens next. The gate has these options:

| Option | Behavior |
|---|---|
| **Continue** | Run the next step in sequence. |
| **Skip** | Treat the next step as done-without-running and advance past it (i.e. the *upcoming* step is skipped, not the one just finished). The flow continues from the step after the skipped one. |
| **Jump to step N** | Re-anchor the cursor to step N (1=branch, 2=pbi, 3=pr, 4=codereview, 5=post-pr) and run that step next. Jumping backward re-runs a step. |
| **Stop** | End the flow now. Report which steps ran and which didn't. |

### Gate question template

```
Step {N}/5 — {STEP_NAME} just finished.
PBI: #{PBI_ID} {PBI_TITLE}
What next?
```

For the **first** gate (before step 1) the wording is:

```
Ready to start the flow for PBI #{PBI_ID} {PBI_TITLE}.
What next?
```

Pass these as `AskUserQuestion` options (multi-select disabled — the user picks one):

- **Continue** — "Run step {next_N}: {next_step_name}"
- **Skip next** — "Skip step {next_N} and run step {next_N + 1}"
- **Jump to step…** — "Pick a specific step (1=branch, 2=pbi, 3=pr, 4=codereview, 5=post-pr)"
- **Stop** — "End the flow here"

If the user picks "Jump to step…", follow up with a second `AskUserQuestion` listing steps 1–5 by name and run from there.

If the user picks "Stop", emit a final summary (which steps ran, current branch, any PR/PBI URLs created so far) and end the skill.

### Where the gate fires

There are six gate points total — one before each step, and a final wrap-up after step 5:

1. **Before step 1** (start-branch)
2. **After step 1 / before step 2** (start-pbi)
3. **After step 2 / before step 3** (start-pr)
4. **After step 3 / before step 4** (codereview)
5. **After step 4 / before step 5** (post-pr) — see Step 7 below; this gate is a **mandatory acceptance gate** for the code-review findings.
6. **After step 5** — final summary, no gate question; just report outcome.

## Step 3: Step 1 — start-branch

Follow `C:\Users\538252\.claude\skills\start-branch\SKILL.md` end-to-end with the work item ID and repository from Step 0. Reuse the PBI title/type already fetched in Step 1 — do not re-call `az boards work-item show` for the same data.

After it completes, run the gate.

## Step 4: Step 2 — start-pbi

Follow `C:\Users\538252\.claude\skills\start-pbi\SKILL.md` with the work item ID. Reuse the cached PBI fields where possible.

When the user picks **Continue** at the gate after this step, **invoke the `save-session` skill before moving on to step 3.** This captures the analysis + alignment from start-pbi as a resumable session, so a long-running implementation phase can be split across conversations cleanly.

If the user picks **Skip**, **Jump**, or **Stop** at this gate, do NOT auto-invoke save-session — only fire it on the natural Continue path, since that's the only branch where step 2's output is the platform for follow-up work.

## Step 5: Step 3 — start-pr

Follow `C:\Users\538252\.claude\skills\start-pr\SKILL.md` to commit staged changes, push the branch, and create the PR. Capture the resulting PR ID and URL — they're needed for steps 4, 5, and the final summary.

After it completes, run the gate.

## Step 6: Step 4 — codereview

Follow `C:\Users\538252\.claude\skills\codereview\SKILL.md` against the PR ID from step 3. The skill spawns 2 parallel Opus review agents and returns confidence-scored findings.

Surface the consolidated findings to the user as the codereview skill produces them — do NOT swallow or summarize them away. Then run the gate, which in this case is the **acceptance gate** described in Step 7.

## Step 7: Acceptance gate (between codereview and post-pr)

This gate is more restrictive than the others. The flow does not proceed to post-pr (announcing the PR to the team) until the user has explicitly accepted that the code-review findings are acceptable to ship.

Use `AskUserQuestion` with these options instead of the standard continue/skip/jump/stop:

- **Accept and post** — review findings are acceptable as-is; run step 5 (post-pr).
- **Address findings** — there are findings to act on; stop the flow so the user can fix them. After fixes are committed and re-reviewed, the user can re-enter the flow via `/start-flow {pbi_id}` and Jump to step 5 (post-pr).
- **Jump to step…** — same jump semantics as the standard gate (1=branch, 2=pbi, 3=pr, 4=codereview, 5=post-pr).
- **Stop** — end the flow without posting to Teams.

**Never auto-advance from codereview to post-pr.** Even if the review found nothing, the user must pick "Accept and post" — this is the explicit acknowledgement that the findings (or their absence) are acceptable.

If the user picks **Skip** at any earlier gate to bypass codereview, this acceptance gate still fires before post-pr — but with the wording adjusted: "Code review was skipped. Post to Teams without review?" The user must still explicitly accept before post-pr runs.

## Step 8: Step 5 — post-pr

Follow `C:\Users\538252\.claude\skills\post-pr\SKILL.md` using the PR ID from step 3. Pass through any extra `@mentions` arguments the user supplied at flow start (or ask if they want to add any — keep it short, default to no mentions if the user doesn't specify).

After it completes, emit the final summary.

## Step 9: Final summary

Tell the user:

- ✓ Branch created: `{branch_name}` (or skipped/skipped because…)
- ✓ PBI moved to In Progress (or skipped)
- ✓ Save-session written: `{state_file_path}` (only if step 2 ran and the user continued)
- ✓ PR created: `{PR_URL}` (or skipped)
- ✓ Code review run: `{summary — e.g. "2 nits, 0 blockers" or "skipped"}`
- ✓ Posted to Teams (or skipped)
- PBI: `#{PBI_ID} {PBI_TITLE}` ([link]({PBI_URL}))

## Notes

- **Never auto-advance through gates** — every step boundary requires the user to pick continue/skip/jump/stop. Silence is not approval.
- **Skip semantics** — "Skip" applies to the *upcoming* step, not the one just completed. To skip the current step, the user should pick Stop and re-enter the flow at a later step via Jump.
- **Jump semantics** — Jump may go forward or backward; jumping back to step 1 with a branch already created will fail at `git checkout -b` (branch exists), so warn the user before re-running.
- **Failures inside a step** — if an underlying skill errors out (e.g. `az` auth failure, push rejected), surface the error, do NOT auto-advance. Treat it as a forced gate: ask whether to retry, jump elsewhere, or stop.
- **Argument forwarding** — the only argument the orchestrator strictly needs is the PBI ID. Repository, extra mentions, and any sub-skill flags can be asked for at the moment they're needed rather than collected up-front.
- **Session/tab title** — the OSC 0 escape only changes the *terminal* tab title in VS Code. The Claude Code chat session header is not user-renamable from inside the agent; if the user asks why the chat tab didn't change, explain this once.
