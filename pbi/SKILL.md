---
name: pbi
description: Fetch an Azure DevOps PBI by link or ID, create an Obsidian task note, then spawn a subagent team (knowledge gatherer, developer, note taker) to research and implement the task. Use when user says "pbi", provides a DevOps work item link, or wants to start working on a PBI.
---

# PBI Workflow

End-to-end workflow: fetch PBI from Azure DevOps, create Obsidian note, research the codebase, implement the solution, and document everything.

## Step 1: Parse input

Extract the PBI ID from the user's input. Accepted formats:
- Raw ID: `145975`
- Full URL: `https://dev.azure.com/edc-group/Relaunch%20-%20Charlie%20Tango/_workitems/edit/145975`
- Any string containing the ID

## Step 2: Fetch PBI details

```bash
az boards work-item show --id {PBI_ID} --output json
```

Extract these fields:
- **ID:** `System.Id`
- **Title:** `System.Title`
- **Sprint:** `System.IterationLevel2` (this is the sprint name, e.g., "Sprint 4 (W13-15) 2026")
- **Description:** `System.Description` (HTML — strip tags for the note)
- **Acceptance Criteria:** `Microsoft.VSTS.Common.AcceptanceCriteria` (HTML — strip tags)
- **PBI Link:** `https://dev.azure.com/edc-group/Relaunch%20-%20Charlie%20Tango/_workitems/edit/{PBI_ID}`

If `System.IterationLevel2` is missing, ask the user which sprint/project to link to.

## Step 3: Planning & Alignment

Before creating notes or spawning agents, enter planning mode and grill the user (use the grill-me skill approach):

1. **Present the PBI** — show the user the extracted title, description, acceptance criteria, and sprint
2. **Ask clarifying questions** — challenge assumptions and dig into:
   - Is the description clear enough to implement? What's ambiguous?
   - Are there edge cases the acceptance criteria doesn't cover?
   - Are there related components or areas that might be affected?
   - Does the user have additional context not in the PBI? (e.g., screenshots, conversations, design specs)
3. **Propose an approach** — based on the PBI details and your understanding, suggest:
   - Which files likely need changes
   - A high-level implementation approach
   - Potential risks or things to watch out for
4. **Reach alignment** — keep asking until both you and the user are confident in the plan. Don't proceed until the user confirms.

Only move to the next step once there is shared understanding of what needs to be done.

## Step 4: Create Obsidian note

Use the obsidian-tasks skill conventions. Write to `In Progress/` folder.

**Vault path:** `C:\Users\538252\OneDrive - EDC-Gruppen A S\Documents\EDC Obsidian vault\EDC_Notes`

**File:** `In Progress/{ID} {Title}.md`

```markdown
[[{Sprint name}]]
[PBI Task](https://dev.azure.com/edc-group/Relaunch%20-%20Charlie%20Tango/_workitems/edit/{ID})

## Summary

{Description stripped of HTML, condensed to 2-3 sentences}

## Acceptance Criteria

{Acceptance criteria stripped of HTML, as bullet points}

## Git

- **Branch:** `{current branch from git}`

## Notes
```

Also add a `[[wikilink]]` to the task in the sprint hub note at `Sprints/{Sprint name}.md` under `## Tasks`. If the sprint file doesn't exist, create it.

## Step 5: Spawn subagent team

Launch **two agents in parallel**, then a third after they complete:

### Agent 1: Knowledge Gatherer (Explore agent)

Prompt the agent with the PBI title, description, and acceptance criteria. Ask it to:

**First, read project documentation:**
- Read the root `CLAUDE.md` for conventions, key file paths, and architecture overview
- Based on the task area, read the relevant `.claude/docs/*.md` files:
  - React/module work → `frontend-architecture.md`
  - Styling/CSS → `styling-guide.md`
  - API/data fetching → `api-data-fetching.md`
  - .NET/Umbraco/backend → `backend-architecture.md`
  - SEO/translations/tracking → `seo-and-i18n.md`
  - Tests/CI → `testing-and-cicd.md`
  - ViewModels/forms → `viewmodel-bridge-and-forms.md`
- If unclear which docs apply, read all of them — better to over-read than miss context

**Then, explore the codebase:**
- Search for all files relevant to the task
- Identify the specific components, hooks, styles, and translations that need changes
- Check for existing patterns in the codebase that should be followed
- Return a structured report: files to modify, what to change in each, patterns to follow, and any relevant guidance from the docs

### Agent 2: Developer (general-purpose agent, on the current branch)

**Wait for the Knowledge Gatherer to finish first.** Then prompt the developer with:
- The PBI description and acceptance criteria
- The knowledge gatherer's full report (files, patterns, what to change)
- Instruction: implement the solution directly on the current branch, do NOT commit. The user will review the changes in their IDE.

### Agent 3: Code Reviewer (runs after Developer)

After the developer finishes, launch **5 parallel Sonnet agents** to review the changes (same approach as the code-review skill):

1. **CLAUDE.md compliance** — audit changes against root `CLAUDE.md` and any relevant `.claude/CLAUDE.md` files
2. **Bug scan** — shallow scan for obvious bugs in the diff, ignore nitpicks and linter-catchable issues
3. **Git history context** — check git blame/log for historical context that reveals bugs in the new changes
4. **Code comments compliance** — check if changes conflict with any TODO/NOTE/FIXME comments in modified files
5. **Pattern consistency** — verify the changes follow existing patterns in the codebase (e.g., how similar ARIA attributes, hooks, or components are used elsewhere)

Then for each issue found, launch a **parallel Haiku agent** to score confidence (0-100):
- 0: False positive / pre-existing issue
- 25: Might be real, couldn't verify
- 50: Real but a nitpick
- 75: Verified real, impacts functionality
- 100: Definitely real, will happen frequently

**Filter out issues scoring below 75.** Present remaining issues to the user with explanations before proceeding.

### Agent 4: Note Taker (Haiku agent, runs last)

After code review completes, launch a Haiku agent to update the Obsidian note. It should:
- Add the changed files list under `## Git`
- Add a dated `## Notes` entry summarizing: what was researched, what was changed, and key decisions
- If the code review found issues (score >= 75), add them under a `## Code Review` section in the note
- Keep it concise — bullet points, not paragraphs

## Step 6: Present results

After all agents complete, present the user with:
1. A summary of what was found and implemented
2. The list of changed files
3. Any code review issues found (score >= 75)
4. Ask the user to review the changes in their IDE

## Error handling

- If `az boards` fails: ask user to run `! az login --allow-no-subscriptions`
- If no matching sprint file exists in `Sprints/`: create one with a `## Tasks` section
- If the PBI has no description: use the title as the summary and ask the user for context
