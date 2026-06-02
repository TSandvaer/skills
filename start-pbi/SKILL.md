---
name: start-pbi
description: Read and analyze an Azure DevOps PBI or Bug by ID, summarize it, ask clarifying questions, and propose a solution approach. Use when user says "start-pbi", "analyze pbi", or wants to understand a work item before implementing it.
---

# Start PBI — Read, Understand, and Plan

Fetch a work item from Azure DevOps, analyze it thoroughly, explore the relevant codebase, and present the user with a clear understanding and proposed solution.

## Step 1: Parse input

Extract the work item ID from the user's arguments. Accepted formats:
- Raw ID: `146146`
- Full URL: `https://dev.azure.com/edc-group/Relaunch%20-%20Charlie%20Tango/_workitems/edit/146146`
- Any string containing the ID number

If no ID is provided, ask the user for it.

## Step 2: Fetch work item details

```bash
az boards work-item show --id {WORK_ITEM_ID} --output json
```

Extract these fields:
- **ID:** `fields.System.Id`
- **Title:** `fields.System.Title`
- **Type:** `fields.System.WorkItemType` (PBI, Bug, Task, etc.)
- **State:** `fields.System.State`
- **Sprint:** `fields.System.IterationLevel2`
- **Assigned To:** `fields.System.AssignedTo.displayName`
- **Description:** `fields.System.Description` (HTML)
- **Acceptance Criteria:** `fields.Microsoft.VSTS.Common.AcceptanceCriteria` (HTML)
- **Child work items:** from `relations` where `rel` is `System.LinkTypes.Hierarchy-Forward`
- **PBI Link:** `https://dev.azure.com/edc-group/Relaunch%20-%20Charlie%20Tango/_workitems/edit/{ID}`

If there are child work items, fetch their titles too:

```bash
az boards work-item show --id {CHILD_ID} --output json --query "fields.System.Title"
```

If `az boards` fails, tell the user to run `az login --allow-no-subscriptions` and retry.

## Step 3: Move work item to "In Progress"

Check the current state of the work item. If it is NOT already "In Progress" or "Done", move it to "In Progress":

```bash
az boards work-item update --id {WORK_ITEM_ID} --state "In Progress" --output json
```

If the state is already "In Progress" or "Done", skip this step and note that it's already in progress / completed.

If the update fails due to an invalid state transition, report the error and move on — don't block the rest of the workflow.

## Step 4: Fetch linked branch info

Check if there are already branches linked to this work item (from the `relations` array where `rel` is `ArtifactLink` and `attributes.name` is `"Branch"`). If branches exist, mention them — the user may already have work in progress.

## Step 5: Present the PBI summary

Present a clear, structured summary to the user:

### Format

```
## PBI #{ID}: {Title}

**Type:** {Type} | **State:** {State} | **Sprint:** {Sprint}
**Assigned to:** {Name}
**Link:** {DevOps URL}

### Description
{Description stripped of HTML tags, cleaned up for readability}

### Acceptance Criteria
{Acceptance criteria stripped of HTML, presented as bullet points}

### Child Tasks
- #{child_id}: {child_title}
```

## Step 6: Explore the codebase

Based on the PBI description, launch an **Explore agent** to investigate the codebase. The agent should:

1. **Read project documentation first:**
   - Read the root `CLAUDE.md` for conventions, key file paths, and architecture overview
   - Based on the task area, read the relevant `.claude/docs/*.md` files (frontend-architecture, backend-architecture, styling-guide, api-data-fetching, seo-and-i18n, viewmodel-bridge-and-forms, testing-and-cicd)

2. **Search for relevant code:**
   - Identify files, components, controllers, models, and services related to the PBI
   - Look for existing patterns that the implementation should follow
   - Check for related tests, translations, and configuration

3. **Return a structured report** of:
   - Which files are relevant and why
   - Existing patterns to follow
   - Dependencies and related systems

## Step 7: Provide analysis and proposed solution

After the codebase exploration, present your analysis:

### Understanding
- Restate the problem in your own words — what exactly needs to change and why
- Call out anything ambiguous or underspecified in the PBI
- Note any assumptions you're making

### Affected areas
- List the specific files that will likely need changes
- Group by area (frontend components, backend controllers, models, translations, tests, etc.)
- For each file, briefly note what kind of change is expected

### Proposed approach
- Step-by-step implementation plan
- Note which parts are straightforward vs. which need more investigation
- Flag any risks, edge cases, or decisions the user needs to make
- Estimate relative complexity (small/medium/large change)

### Questions
- Ask specific clarifying questions about anything unclear in the PBI
- Challenge assumptions where the description is vague
- Ask about edge cases the acceptance criteria doesn't cover
- Ask if there are design specs, screenshots, or conversations with additional context

## Step 8: Wait for alignment

Do NOT proceed to implementation. Wait for the user to:
- Answer your questions
- Confirm the approach
- Add any missing context
- Adjust the plan if needed

This skill is purely for understanding and planning. Implementation happens separately (e.g., via the `pbi` skill or manual work).
