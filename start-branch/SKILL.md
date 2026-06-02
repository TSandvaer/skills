---
name: start-branch
description: Create and check out a new git branch from master for an Azure DevOps PBI or Bug. Takes a work item ID and repository name. Use when user says "start-branch", "new branch for PBI", or wants to begin work on a DevOps work item in a specific repo.
---

# Start Branch

Create a git branch from master for an Azure DevOps work item and check it out.

## Step 1: Parse input

Extract from the user's arguments:
- **Work item ID** — a number (e.g., `145975`) or a full DevOps URL containing the ID
- **Repository name** — the target repo. Accept flexible names and map to the correct directory under `C:\Trunk\`:

| Input (case-insensitive) | Directory | Branch suffix | DevOps repo name |
|---|---|---|---|
| `website`, `edcdk`, `edc.edcdk.website` | `C:\Trunk\EDC.EDCDK.Website` | `.Website` | `EDC.EDCDK.Website` |
| `core`, `edc.core` | `C:\Trunk\EDC.Core` | `.Core` | `EDC.Core` |
| `business`, `rest.business`, `edc.rest.business` | `C:\Trunk\EDC.REST.Business` | `.REST.Business` | `EDC.REST.Business` |
| `rest.core`, `edc.rest.core` | `C:\Trunk\EDC.REST.Core` | `.REST.Core` | `EDC.REST.Core` |
| `settings`, `edc.settings` | `C:\Trunk\EDC.Settings` | `.Settings` | `EDC.Settings` |

If the repository name doesn't match any known mapping, list the contents of `C:\Trunk\` and ask the user which one they meant.

If either argument is missing, ask the user to provide it.

## Step 2: Fetch work item details

```bash
az boards work-item show --id {WORK_ITEM_ID} --output json
```

Extract:
- **Title:** `fields.System.Title`
- **Work Item Type:** `fields.System.WorkItemType` (e.g., "Product Backlog Item", "Bug")

If `az boards` fails, tell the user to run `az login --allow-no-subscriptions` and retry.

## Step 3: Build branch name

### Sanitize the title
1. Convert to lowercase
2. Replace spaces with underscores (`_`)
3. Replace or remove characters not allowed in git branch names:
   - Remove: `~`, `^`, `:`, `?`, `*`, `[`, `]`, `\`, `{`, `}`
   - Replace with underscore: `|`, `<`, `>`, `"`, `'`, `/`, `#`, `@`, `!`, `(`, `)`, `,`, `;`, `&`, `+`, `=`
   - Replace `..` with `_`
4. Collapse multiple consecutive underscores into one
5. Trim leading/trailing underscores
6. Remove any trailing `.lock`

### Determine prefix
- If work item type is **"Bug"** → prefix is `bug/`
- Otherwise (PBI, Task, etc.) → prefix is `feature/`

### Append repository suffix
Append the **branch suffix** from the repository mapping table (e.g., `.Website`, `.REST.Business`).

### Final format
```
{prefix}{work_item_id}_{sanitized_title}{branch_suffix}
```

Example: `feature/145975_add_aria_labels_to_search_field.Website` or `bug/149011_missing_case_on_mit.edc.dk.REST.Business`

## Step 4: Create, push, and check out the branch

Run these commands in the target repository directory:

```bash
# Fetch latest master
git -C "{repo_path}" fetch origin master

# Create branch from origin/master and check it out
git -C "{repo_path}" checkout -b "{branch_name}" origin/master

# Push the branch to remote (required for the DevOps branch link to resolve)
git -C "{repo_path}" push -u origin "{branch_name}"
```

## Step 5: Link branch to work item in Azure DevOps

After creating the branch, link it to the work item using the Azure DevOps REST API.

### Get repository and project IDs

```bash
az repos show --repository {devops_repo_name} --org https://dev.azure.com/edc-group --project "Relaunch - Charlie Tango" --query "{repoId: id, projectId: project.id}" --output json
```

### Build the artifact URL

The branch artifact URL format is:
```
vstfs:///Git/Ref/{projectId}%2F{repoId}%2FGB{url_encoded_branch_name}
```

Where the branch name has `/` encoded as `%2F`. For example, `feature/145842_foo.Website` becomes `GBfeature%2F145842_foo.Website`.

### Link via REST API

Get an access token and PATCH the work item:

```bash
AZURE_TOKEN=$(az account get-access-token --resource 499b84ac-1321-427f-aa17-267ca6975798 --query accessToken -o tsv) && \
curl -s -X PATCH \
  "https://dev.azure.com/edc-group/{projectId}/_apis/wit/workitems/{work_item_id}?api-version=7.1" \
  -H "Authorization: Bearer $AZURE_TOKEN" \
  -H "Content-Type: application/json-patch+json" \
  -d '[{"op":"add","path":"/relations/-","value":{"rel":"ArtifactLink","url":"{artifact_url}","attributes":{"name":"Branch"}}}]'
```

Verify the response contains the work item ID (success) or report the error.

## Step 6: Confirm

Tell the user:
- The branch name that was created
- Which repository it was created in
- That the branch is linked to the work item in Azure DevOps
- That they are now on the new branch
- The work item title and type for reference
