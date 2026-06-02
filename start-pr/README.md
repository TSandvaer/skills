# Start PR

> Commits your staged changes, pushes the branch, and opens an Azure DevOps pull request that is automatically linked to the PBI/Bug referenced in the branch name.

## What it does
`start-pr` takes you from "implementation done, changes staged" to "PR open and linked" in one guided step. It inspects your staged git changes, generates a concise commit message, commits and pushes the branch, derives the work-item ID from the branch name, fetches the work item from Azure DevOps, builds a properly-formatted PR title and a structured **What / How / PBI** description, and creates the pull request via the Azure CLI with the work item linked. It finishes by reporting the commit message, PR title, and the web URL of the new PR.

## When to use it
Reach for this when you are done implementing and want to submit your work for review. Trigger phrases include "start-pr", "create pr", "make a pr", "open pull request", or simply asking to commit and create a PR for the current branch.

## How to use it
1. Stage the changes you want to include (`git add ...`).
2. Make sure you are on a feature/bug branch (not `master`/`main`) whose name encodes the work item ID, e.g. `feature/146146_updated_articles_rss_feed.Website`.
3. Say "start-pr" (or one of the trigger phrases).

Claude will then:
- Gather context from your staged diff and branch.
- Determine the repository (WEBSITE, EDC.CORE, REST.BUSINESS, REST.CORE, SETTINGS).
- Extract the numeric PBI ID from the branch name.
- Fetch the work item title/description from Azure DevOps.
- Commit, push, and create the linked PR.

If anything is ambiguous (no staged changes, unknown repo, no PBI ID in the branch name), Claude asks before proceeding.

## Inputs
- **Staged changes** — required. There must be a non-empty `git diff --cached`.
- **Branch name** — required. Must not be `master`/`main` and should follow `{prefix}/{pbi_id}_{description}{suffix}` so the PBI ID can be extracted. If no ID is found, Claude asks for it.
- No arguments are passed to the command itself; everything is derived from the working tree and branch.

## Output
- A commit on your current branch with an auto-generated, one-line message.
- The branch pushed to `origin`.
- A new Azure DevOps pull request targeting `master`, titled `[{REPO_LABEL}] {PBI_ID} {Title}`, with a What/How/PBI description and the work item linked.
- A summary message containing the commit message, PR title, and PR web URL.

## Prerequisites
- **Azure CLI** (`az`) with the Azure DevOps extension, authenticated against `https://dev.azure.com/edc-group`. If auth fails, run `az login --allow-no-subscriptions` and retry.
- **git** configured with push access to the `origin` remote.
- The repository must be one of the known EDC repositories (mapping table is in `SKILL.md`).

## Installation
Unzip into your `.claude/skills/` folder (user-level `~/.claude/skills/` for everywhere,
or `<project>/.claude/skills/` for one project), then restart Claude Code or start a new
session so the skill is picked up.

## Files in this package
- `SKILL.md` — the skill definition Claude loads.
- `README.md` — this file.
