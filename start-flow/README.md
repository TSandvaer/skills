# start-flow

Orchestrates the **full PBI lifecycle** end-to-end by running the individual EDC workflow skills in sequence, with a confirmation gate between each step:

1. [`start-branch`](../start-branch) — create the branch from master for the work item.
2. [`start-pbi`](../start-pbi) — read, analyze, and propose an approach.
3. [`start-pr`](../start-pr) — commit, push, and open the PR.
4. [`codereview`](../codereview) — automated PR review.
5. [`post-pr`](../post-pr) — announce the PR in Teams.

Along the way it sets the VS Code terminal tab title to the PBI title, auto-invokes [`save-session`](../save-session) after the analysis step, and gates `post-pr` on explicit acceptance of the code-review findings.

## When to use it

- "start-flow {pbi id}"
- Any request to take a work item from branch creation through to Teams announcement in one guided flow.

## How it works

- Each step is **gated** — the flow pauses for confirmation before advancing, so you stay in control at every stage.
- The `post-pr` step won't fire until you've explicitly accepted the code-review findings.
- Designed as the single entry point that ties the individual `start-*`, `codereview`, and `post-pr` skills together.
