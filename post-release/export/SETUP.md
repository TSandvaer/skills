# post-release setup guide

This is the manual reference for setting up the `post-release` skill. The skill's first-run onboarding follows these same steps interactively — use this document if onboarding fails, if you want to understand what's happening, or if you need to re-configure later.

## What you'll end up with

A config file at `~/.claude/post-release.config.json` with this shape:

```json
{
  "webhookUrl": "https://...environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/.../triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=...",
  "teamId": "00000000-0000-0000-0000-000000000000",
  "channelId": "19:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx@thread.tacv2",
  "channelName": "Release",
  "tenantId": "00000000-0000-0000-0000-000000000000",
  "azureDevOpsOrg": "https://dev.azure.com/your-org",
  "azureDevOpsProject": "Your Project Name",
  "releaseDefinitionId": 6,
  "autoMentionChannel": true,
  "channelMentionAliases": ["release", "channel", "kanal"]
}
```

| Field | What it is | How to get it |
|---|---|---|
| `webhookUrl` | HTTP trigger URL for your Power Automate flow | Created in Step 4 below |
| `teamId` | Object ID of the Teams team (= backing M365 group ID) | Step 3 below |
| `channelId` | Thread ID of the channel within that team | Step 3 below |
| `channelName` | Display name of the channel — used as the `mentionText` in the channel mention, so it must match exactly what shows in Teams | Step 3 below |
| `tenantId` | AAD tenant ID (informational) | `az account show --query tenantId -o tsv` |
| `azureDevOpsOrg` | Azure DevOps organisation URL | From your DevOps URL, e.g. `https://dev.azure.com/my-org` |
| `azureDevOpsProject` | Project name (spaces allowed; don't URL-encode in the config) | From DevOps — the project containing the release pipeline |
| `releaseDefinitionId` | *(Optional)* Release pipeline definition ID. If omitted, the skill auto-discovers per repo at runtime. Set it to speed up invocations if you only have one release definition. | Step 2 below |
| `autoMentionChannel` | *(Optional, default `true`)* Whether to auto-mention the target channel on every post. Set to `false` if channel mentions render as "Unknown User" on your channel. | Decide after first real post |
| `channelMentionAliases` | *(Optional, default `["release", "channel"]`)* Case-insensitive tokens that get deduplicated against the automatic channel mention so the channel isn't mentioned twice. Add your channel's localised name if different. | Your choice |

## Prerequisites

- **Azure CLI** installed and logged in: `az login --allow-no-subscriptions`
- **`azure-devops` extension** for `az`: `az extension add --name azure-devops`
- **Node.js** installed (any recent LTS)
- **Power Automate** access in the same tenant as the Teams team
- You are a member of the team you want to post into
- You have `Build Read` + `Release Read` permissions on the Azure DevOps project containing the release pipeline

## Step 1: Sign in to Azure

```bash
az login --allow-no-subscriptions
```

Confirm you're in the right tenant:

```bash
az account show --query tenantId -o tsv
```

Get a Microsoft Graph token for the subsequent Graph calls:

```bash
GRAPH_TOKEN=$(az account get-access-token --resource https://graph.microsoft.com --query accessToken -o tsv)
```

## Step 2: Find the Azure DevOps release definition (optional)

If your project has **one** release pipeline that deploys everything, pin its ID into the config so the skill doesn't have to discover it per run:

```bash
az pipelines release definition list \
  --org https://dev.azure.com/your-org \
  --project "Your Project Name" \
  --query "[].{id:id, name:name}" --output json
```

Copy the `id` of the definition that deploys your production environments.

If your project has multiple release pipelines (one per repo, for instance), leave `releaseDefinitionId` unset — the skill will scan each definition's latest release for a matching artifact repository name at runtime.

## Step 3: Find the team ID and channel ID

### Option A: via Graph (recommended — copy-pasteable)

List the teams you're a member of:

```bash
curl -s -H "Authorization: Bearer $GRAPH_TOKEN" \
  'https://graph.microsoft.com/v1.0/me/joinedTeams?$select=id,displayName'
```

Pick the one that hosts your release channel and save its `id` as `TEAM_ID`.

List that team's channels:

```bash
curl -s -H "Authorization: Bearer $GRAPH_TOKEN" \
  "https://graph.microsoft.com/v1.0/teams/$TEAM_ID/channels?\$select=id,displayName"
```

Pick the release channel and save its `id` as `CHANNEL_ID` (it looks like `19:...@thread.tacv2`) and its `displayName` as `CHANNEL_NAME`.

### Option B: via the Teams desktop app

1. Right-click the channel in the left sidebar → **Get link to channel**.
2. The URL contains `groupId=<TEAM_ID>` and `tenantId=<TENANT_ID>` as query parameters. Copy `groupId` as your `TEAM_ID`.
3. For the channel ID, the URL contains `/channel/<url-encoded-channel-id>/...`. URL-decode the segment between `/channel/` and the next `/`. The decoded value is your `CHANNEL_ID` (starts with `19:`, ends with `@thread.tacv2`).

Option A is less error-prone — prefer it.

## Step 4: Create your Power Automate flow

You need a flow that receives the skill's payload over HTTP and forwards it to Graph's `POST /teams/{teamId}/channels/{channelId}/messages` endpoint. The flow posts **as you** (the owner), so mentions notify correctly and you can edit/delete the resulting message.

1. Go to [make.powerautomate.com](https://make.powerautomate.com) and sign in with the same tenant.
2. Click **+ Create** → **Instant cloud flow**.
3. Name it something like `post-release forwarder` and choose the trigger **When an HTTP request is received**. Create.
4. On the trigger step:
   - Leave **Request Body JSON Schema** empty (we pass `triggerBody()` straight through).
   - Method: POST (default).
5. Click **+ New step** and search for **Send a Microsoft Graph HTTP request** (Danish UI: **Send en Microsoft Graph HTTP-anmodning**). It's under the **Microsoft Teams** connector — **not** the generic HTTP action. Using this one means the flow uses the Teams connector's delegated auth (with scopes like `ChannelMessage.Send`), so you don't need to set up your own Entra ID app.
6. Configure the Graph action:
   - **Method:** POST
   - **URI:** `https://graph.microsoft.com/v1.0/teams/<YOUR_TEAM_ID>/channels/<YOUR_CHANNEL_ID>/messages` (hard-code the IDs from Step 3 here)
   - **Body:** click the **fx** button next to the Body field and enter the expression `triggerBody()`. This passes the skill's payload straight through as the Graph request body.
7. **Save** the flow. Saving generates the webhook URL.
8. Re-open the HTTP trigger step and copy the **HTTP POST URL**. That's your `webhookUrl`.

### Why this specific action?

The Power Automate "Post card in a chat or channel" action (from the Teams connector) **strips the `msteams.entities` extension from Adaptive Cards and can't forward Graph `mentions` arrays**, so `<at>Name</at>` tags render as literal text and mentions never trigger notifications. Using the raw Graph HTTP action preserves the full payload and real mentions work.

### Auth note

The Teams connector uses a **delegated** token (the flow owner's). You need the `ChannelMessage.Send` scope. In most tenants this is consented automatically the first time the connector is used; if an admin has locked down consent you may need to request it.

## Step 5: Write the config file

Create `~/.claude/post-release.config.json`:

```bash
mkdir -p "$HOME/.claude"
cat > "$HOME/.claude/post-release.config.json" <<'EOF'
{
  "webhookUrl": "<paste the HTTP POST URL from Step 4.8>",
  "teamId": "<TEAM_ID from Step 3>",
  "channelId": "<CHANNEL_ID from Step 3>",
  "channelName": "<CHANNEL_NAME from Step 3>",
  "tenantId": "<tenant id from az account show>",
  "azureDevOpsOrg": "https://dev.azure.com/your-org",
  "azureDevOpsProject": "Your Project Name",
  "releaseDefinitionId": 6,
  "autoMentionChannel": true
}
EOF
```

Or on Windows / in any text editor — just save the file at that path with those fields.

## Step 6: Smoke test

Run the skill from any repo that has a matching release pipeline:

```
/post-release
```

It should post into the channel. Verify:

1. The post appears in the right Teams channel with the expected subject (`Releasing {repo} to PROD`).
2. The `@{channel}` mention renders as a real blue channel tag (not "Unknown User"). If it shows "Unknown User", set `autoMentionChannel: false` in the config.
3. The "Changes since last release" list matches the commits you expect between the last PROD release and `origin/master`.

If it doesn't work:

- **HTTP 202 from the webhook but no post appears:** open Power Automate → *My flows* → your flow → *Run history* → latest run → expand the "Send a Microsoft Graph HTTP request" step to see the Graph error body.
- **Common Graph errors:**
  - `Forbidden` / insufficient scope → the Teams connector's delegated token lacks `ChannelMessage.Send`. An admin may need to consent.
  - `Invalid mention id` → a `<at id="N">` tag in the message body has no matching entry in the `mentions` array. Skill bug; report it.
  - `Attachment content must be a string` → the Adaptive Card wasn't JSON-stringified. Also a skill bug.
- **HTTP 4xx from the webhook:**
  - `WorkflowTriggerIsNotEnabled` → the flow is saved but disabled. Turn it on in Power Automate.
  - `Signature expired` / URL revoked → regenerate the HTTP POST URL in the trigger step and update the config file.
  - Payload rejected by trigger schema → you added a schema to the HTTP trigger. Leave **Request Body JSON Schema** empty.

## Troubleshooting

### The "last PROD release" the skill picks is wrong

The skill finds the release whose PROD environment (name starting with `PROD`) has the latest `modifiedOn` timestamp among all succeeded releases. Rollbacks redeploy an older release, so the latest Release by `createdOn` isn't necessarily what's live. If the skill still picks the wrong release:

- Verify your PROD environment names actually start with `PROD` (case-sensitive). If they're named `Production`, edit `SKILL.md` Step 4d's JMESPath filter from `starts_with(name, 'PROD')` to whatever matches your naming.
- If your project has multiple release pipelines and `releaseDefinitionId` isn't pinned in the config, the skill tries the first definition that matches the current repo's name. Pin `releaseDefinitionId` to disambiguate.

### Channel mention renders as "Unknown User"

Channel mentions via `mentioned.conversation` work on some channels but not others (tenant/channel config dependent). If yours fails:

1. Set `"autoMentionChannel": false` in the config. The skill will stop adding the channel mention.
2. Name specific people as extra mentions instead (they'll get real user-mention notifications).

### Mentions don't notify

- If the mentioned user's name rendered as plain `@Name` (not a blue mention chip), the skill couldn't resolve it against the team and warned you — they won't be notified.
- If the name rendered as a chip but Teams still didn't notify, check the user's own Teams notification settings.

### "No team member matches 'X'"

The skill matches partial display-name tokens (starts-with) against the team's backing M365 group via Graph. If you get zero matches:

- Confirm the user is actually a member of the same team (not just the channel).
- The skill reads from the **group** members endpoint, not the **channel** members endpoint. For a standard channel, group members = channel members. For a private/shared channel, a team member who isn't in that specific channel will still match — acceptable tradeoff.
- The group-members endpoint defaults to `$top=100`. If your team has more members, the skill pages via `@odata.nextLink` automatically.

### Re-run onboarding

Delete `~/.claude/post-release.config.json` and run `/post-release` again. The skill will detect the missing config and restart onboarding.

### Switch team/channel/project

Edit `~/.claude/post-release.config.json` directly, OR delete it and run `/post-release` to re-onboard. If you switch channels, you likely want to update your Power Automate flow's Graph URI as well (or create a second flow and swap `webhookUrl`).
