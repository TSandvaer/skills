# Start PBI

> Read an Azure DevOps work item, analyze it against the codebase, and present a clear understanding plus a proposed solution — without writing any code yet.

## What it does
Given an Azure DevOps PBI/Bug ID (or link), this skill fetches the work item, moves it to "In Progress" (unless it's already In Progress/Done), checks for any linked branches, and presents a clean, structured summary (title, type, state, sprint, description, acceptance criteria, child tasks) with the HTML stripped for readability. It then explores the relevant parts of the codebase, lays out the affected files, proposes a step-by-step implementation plan, flags risks and ambiguities, and asks clarifying questions. It deliberately stops before implementing anything — the goal is shared understanding and an agreed approach.

## When to use it
Reach for this when you've been handed a work item and want to understand it properly before touching code. Trigger phrases: "start-pbi", "analyze pbi", or any time you want to read and plan a PBI/Bug before implementing it.

## How to use it
1. Invoke the skill with the work item ID or URL, e.g. `start-pbi 146146` or paste the full DevOps URL.
2. Review the summary it presents (description, acceptance criteria, child tasks, any linked branches).
3. Read its analysis: understanding, affected areas, proposed approach, and open questions.
4. Answer its questions and confirm/adjust the plan. Implementation is a separate step (e.g. the `pbi` skill or manual work).

## Inputs
- **work item ID** — required. Accepts a raw ID (`146146`), a full DevOps URL, or any string containing the ID. If omitted, the skill asks for it.

## Output
- A structured PBI summary rendered in chat (no files written).
- A codebase analysis: affected files grouped by area, a proposed implementation plan, risks/edge cases, and clarifying questions.
- Side effect: the work item is moved to "In Progress" in Azure DevOps (skipped if already In Progress/Done, or if the state transition is invalid).

## Prerequisites
- **Azure CLI** with the `azure-devops` extension (`az boards ...`), authenticated against the EDC organization. If `az boards` fails, run `az login --allow-no-subscriptions` and retry.
- Run from within the target repo so the skill can explore the relevant codebase and read `CLAUDE.md` / `.claude/docs/`.

## Installation
Unzip into your `.claude/skills/` folder (user-level `~/.claude/skills/` to have it everywhere,
or `<project>/.claude/skills/` for one project), then restart Claude Code or start a new
session so the skill is picked up.

## Files in this package
- `SKILL.md` — the skill definition Claude loads.
- `README.md` — this file.
