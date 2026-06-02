---
name: start-pr
description: Commit staged changes, push, and create an Azure DevOps pull request linked to the PBI from the branch name. Use when user says "start-pr", "create pr", "make a pr", "open pull request", or wants to commit and create a PR for their current branch. Also use when the user is done with implementation and wants to submit their work for review.
---

# Start PR

Commit staged git changes, push the branch, and create an Azure DevOps pull request linked to the work item embedded in the branch name.

## Step 1: Gather context

Run these commands in parallel to understand the current state:

```bash
# Current branch name
git branch --show-current

# Staged changes (for commit message generation)
git diff --cached --stat

# Staged diff content (for understanding what changed)
git diff --cached

# Check for unstaged changes too
git status

# Get the remote URL to determine the repository
git remote get-url origin
```

### Validate before proceeding

- There **must** be staged changes (`git diff --cached` is non-empty). If there are no staged changes but there are unstaged changes, ask the user if they want to stage everything first.
- The branch **must not** be `master` or `main`. If it is, stop and tell the user.

## Step 2: Determine the repository

Map the git remote URL or current working directory to the repository label used in PR titles and the Azure DevOps repository name:

| Directory contains | PR title label | DevOps repo name |
|---|---|---|
| `EDC.EDCDK.Website` | `WEBSITE` | `EDC.EDCDK.Website` |
| `EDC.Core` | `EDC.CORE` | `EDC.Core` |
| `EDC.REST.Business` | `REST.BUSINESS` | `EDC.REST.Business` |
| `EDC.REST.Core` | `REST.CORE` | `EDC.REST.Core` |
| `EDC.Settings` | `SETTINGS` | `EDC.Settings` |

If the repository can't be determined, ask the user.

## Step 3: Extract the PBI ID from the branch name

Branch names follow the pattern:
```
{prefix}/{pbi_id}_{description}{suffix}
```

Examples:
- `feature/146146_updated_articles_rss_feed_and_options_in_umbraco.Website`
- `bug/149011_missing_cases_on_mitedc.REST.Business`

Extract the **numeric ID** that appears right after the first `/`. This is the work item ID.

If no numeric ID can be extracted, ask the user for the PBI ID.

## Step 4: Fetch PBI details from Azure DevOps

```bash
az boards work-item show --id {PBI_ID} --output json
```

Extract:
- **Title:** `fields.System.Title` — used in the PR name
- **Description:** `fields.System.Description` — HTML content describing what needs to be done
- **Acceptance Criteria:** `fields.Microsoft.VSTS.Common.AcceptanceCriteria` — HTML content (may be empty)

If `az boards` fails with an auth error, tell the user to run `az login --allow-no-subscriptions` and retry.

## Step 5: Commit staged changes

Generate a short, descriptive commit message based on the `git diff --cached` output. The message should:
- Be one line, under 72 characters
- Describe **what** changed concisely (not why — the PR covers that)
- Use lowercase, imperative mood (e.g., "add rss feed options to article page")

Then commit:

```bash
git commit -m "{generated_commit_message}"
```

## Step 6: Push the branch

```bash
git push -u origin {branch_name}
```

If the push fails because the remote is ahead, tell the user and suggest pulling first. Do not force-push.

## Step 7: Create the pull request

### Build the PR title

Format: `[{REPO_LABEL}] {PBI_ID} {PBI_TITLE}`

Examples:
- `[WEBSITE] 146146 Updated articles RSS feed and options in Umbraco`
- `[REST.BUSINESS] 149011 Missing cases on MitEDC duplicate logic`

### Write the PR description

Write a clear, helpful PR description by combining the PBI context (from Step 4) with the actual code changes (from Step 1). The description should tell a reviewer what was solved and how, so they can review efficiently.

Structure the description as follows:

```
## What
One or two sentences explaining what problem or requirement this PR addresses.
Derive this from the PBI title and description — rephrase in your own words, don't just paste the raw HTML.

## How
A concise summary of the technical approach — what files/areas were changed and why.
Base this on the actual git diff, not speculation. Use bullet points for multiple changes.
Keep it short but specific enough that a reviewer knows where to look.

## PBI
https://dev.azure.com/edc-group/Relaunch%20-%20Charlie%20Tango/_workitems/edit/{PBI_ID}
```

Guidelines for writing the description:
- Keep it concise — a few sentences per section, not paragraphs
- Be specific about what changed technically (e.g., "added `PublishDate` property to `ArticlePage` model" rather than "updated model")
- If the PBI description or acceptance criteria are empty, just describe the changes based on the diff
- Don't list every single line changed — focus on the meaningful changes a reviewer should understand

### Create the PR via Azure CLI

```bash
az repos pr create \
  --repository "{devops_repo_name}" \
  --source-branch "{branch_name}" \
  --target-branch master \
  --title "{pr_title}" \
  --description "{pr_description}" \
  --work-items {PBI_ID} \
  --org https://dev.azure.com/edc-group \
  --project "Relaunch - Charlie Tango" \
  --output json
```

The `--work-items` flag automatically links the PR to the Azure DevOps work item. Pass the description via a HEREDOC or properly escaped string to handle newlines and special characters.

### Handle errors

- If the PR already exists for this branch, tell the user and show the existing PR URL.
- If auth fails, suggest `az login --allow-no-subscriptions`.

## Step 8: Confirm

Report back to the user:
- The commit message used
- The PR title
- The PR URL (extract from the `az repos pr create` JSON response — the `url` field contains the API URL; construct the web URL as `https://dev.azure.com/edc-group/Relaunch%20-%20Charlie%20Tango/_git/{devops_repo_name}/pullrequest/{pr_id}`)
- That the PR is linked to the work item
