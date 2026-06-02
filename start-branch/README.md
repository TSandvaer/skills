# Start Branch

> Create and check out a git branch from `master` for an Azure DevOps work item, push it, and link the branch back to the work item.

## What it does
Given an Azure DevOps PBI/Bug ID and a target repository, this skill builds a
well-formed git branch name from the work item's title and type, creates the
branch from the latest `origin/master`, pushes it, and links the branch to the
work item in Azure DevOps so the association shows up on the board. It finishes
by telling you the branch name, the repo, and the work item title/type.

## When to use it
Reach for this at the very start of a new piece of work — when you say
"start-branch", "new branch for PBI", or otherwise want to begin work on a
DevOps work item in a specific repo without hand-crafting the branch name or
the artifact link yourself.

## How to use it
1. Trigger the skill with the work item ID and the repository name, e.g.
   `start-branch 145975 website`.
2. The skill fetches the work item details, builds the branch name, creates +
   pushes the branch, and links it to the work item.
3. You end up checked out on the new branch, ready to implement.

## Inputs
- **Work item ID** — required. A number (e.g. `145975`) or a full DevOps URL containing the ID.
- **Repository name** — required. Flexible aliases are accepted and mapped to the right repo:
  - `website` / `edcdk` / `edc.edcdk.website` → `EDC.EDCDK.Website`
  - `core` / `edc.core` → `EDC.Core`
  - `business` / `rest.business` / `edc.rest.business` → `EDC.REST.Business`
  - `rest.core` / `edc.rest.core` → `EDC.REST.Core`
  - `settings` / `edc.settings` → `EDC.Settings`

If either input is missing, or the repo name doesn't match a known mapping, the
skill asks before proceeding.

## Output
- A new git branch named `{feature|bug}/{id}_{sanitized_title}{repo_suffix}`
  (e.g. `feature/145975_add_aria_labels_to_search_field.Website`).
- The branch is created from `origin/master`, checked out, and pushed to remote.
- The branch is linked to the work item in Azure DevOps as a Branch artifact link.

## Prerequisites
- Azure CLI (`az`) installed and authenticated. If `az boards` fails, run
  `az login --allow-no-subscriptions` and retry.
- Access to the `edc-group` Azure DevOps organization and the
  "Relaunch - Charlie Tango" project.
- The target repositories cloned locally under `C:\Trunk\`.
- `git` and `curl` available on PATH.

## Installation
Unzip into your `.claude/skills/` folder (user-level `~/.claude/skills/` for
everywhere, or `<project>/.claude/skills/` for one project), then restart Claude
Code or start a new session so the skill is picked up.

## Files in this package
- `SKILL.md` — the skill definition Claude loads.
- `README.md` — this file.
