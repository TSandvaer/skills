# post-pr setup guide

This is the manual reference for setting up the `post-pr` skill. The skill's first-run onboarding follows these same steps interactively — use this document if onboarding fails, if you want to understand what's happening, or if you need to re-configure later.

## What you'll end up with

A config file at `~/.claude/post-pr.config.json` with this shape:

```json
{
  "webhookUrl": "https://...environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/.../triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=...",
  "teamId": "00000000-0000-0000-0000-000000000000",
  "channelId": "19:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx@thread.tacv2",
  "channelName": "Operational team",
  "tenantId": "00000000-0000-0000-0000-000000000000"
}
```

| Field | What it is | How to get it |
|---|---|---|
| `webhookUrl` | HTTP trigger URL for your Power Automate flow | Created in step 3 below |
| `teamId` | Object ID of the Teams team (= backing M365 group ID) | Step 2 below |
| `channelId` | Thread ID of the channel within that team | Step 2 below |
| `channelName` | Display name of the channel (for confirmation messages) | Step 2 below |
| `tenantId` | AAD tenant ID (informational; the skill doesn't use it for calls but it helps when debugging) | `az account show --query tenantId -o tsv` |

## Prerequisites

- **Azure CLI** installed and logged in: `az login --allow-no-subscriptions`
- **Node.js** installed (any recent LTS)
- **Power Automate** access in the same tenant as the Teams team
- You are a member of the team you want to post into

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

## Step 2: Find the team ID and channel ID

### Option A: via Graph (recommended — copy-pasteable)

List the teams you're a member of:

```bash
curl -s -H "Authorization: Bearer $GRAPH_TOKEN" \
  'https://graph.microsoft.com/v1.0/me/joinedTeams?$select=id,displayName'
```

Pick the one you want and save its `id` as `TEAM_ID`.

List that team's channels:

```bash
curl -s -H "Authorization: Bearer $GRAPH_TOKEN" \
  "https://graph.microsoft.com/v1.0/teams/$TEAM_ID/channels?\$select=id,displayName"
```

Pick the channel you want and save its `id` as `CHANNEL_ID` (it will look like `19:...@thread.tacv2`) and its `displayName` as `CHANNEL_NAME`.

### Option B: via the Teams desktop app

1. Right-click the channel in the left sidebar → **Get link to channel**.
2. The URL contains `groupId=<TEAM_ID>` and `tenantId=<TENANT_ID>` as query parameters. Copy the team ID from there.
3. For the channel ID, the URL contains `/channel/<url-encoded-channel-id>/...`. URL-decode the segment between `/channel/` and the next `/`. The decoded value is your `CHANNEL_ID` (starts with `19:`, ends with `@thread.tacv2`).

Option A is less error-prone — prefer it.

## Step 3: Create your Power Automate flow

You need a flow that receives the skill's payload over HTTP and forwards it to Graph's `POST /teams/{teamId}/channels/{channelId}/messages` endpoint. The flow posts **as you** (the owner), so mentions notify correctly and you can edit/delete the resulting message.

1. Go to [make.powerautomate.com](https://make.powerautomate.com) and sign in with the same tenant.
2. Click **+ Create** → **Instant cloud flow**.
3. Name it something like `post-pr forwarder` and choose the trigger **When an HTTP request is received**. Create.
4. On the trigger step:
   - Leave **Request Body JSON Schema** empty (we pass `triggerBody()` straight through).
   - Method: POST (default).
5. Click **+ New step** and search for **Send a Microsoft Graph HTTP request** (Danish UI: **Send en Microsoft Graph HTTP-anmodning**). It's under the **Microsoft Teams** connector — **not** the generic HTTP action. Using this one means the flow uses the Teams connector's delegated auth (with scopes like `ChannelMessage.Send`), so you don't need to set up your own Entra ID app.
6. Configure the Graph action:
   - **Method:** POST
   - **URI:** `https://graph.microsoft.com/v1.0/teams/<YOUR_TEAM_ID>/channels/<YOUR_CHANNEL_ID>/messages` (hard-code your IDs from step 2 here)
   - **Body:** click the **fx** button next to the Body field and enter the expression `triggerBody()`. This passes the skill's payload straight through as the Graph request body.
7. **Save** the flow. Saving generates the webhook URL.
8. Re-open the HTTP trigger step and copy the **HTTP POST URL**. That's your `webhookUrl`.

### Why this specific action?

The Power Automate "Post card in a chat or channel" action (from the Teams connector) **strips the `msteams.entities` extension from Adaptive Cards and also can't forward Graph `mentions` arrays**, so `<at>Name</at>` tags render as literal text and mentions never trigger notifications. Using the raw Graph HTTP action preserves the full payload and real mentions work.

### Auth note

The Teams connector uses a **delegated** token (the flow owner's). You need the `ChannelMessage.Send` scope. In most tenants this is consented automatically the first time the connector is used; if an admin has locked down consent you may need to request it.

## Step 4: Write the config file

Create `~/.claude/post-pr.config.json`:

```bash
mkdir -p "$HOME/.claude"
cat > "$HOME/.claude/post-pr.config.json" <<'EOF'
{
  "webhookUrl": "<paste the HTTP POST URL from Step 3.8>",
  "teamId": "<TEAM_ID from Step 2>",
  "channelId": "<CHANNEL_ID from Step 2>",
  "channelName": "<CHANNEL_NAME from Step 2>",
  "tenantId": "<tenant id from az account show>"
}
EOF
```

Or on Windows / in any text editor — just save the file at that path with those fields.

## Step 5: Smoke test

Run the skill against any real PR ID:

```
/post-pr <some-pr-id>
```

It should post into the channel. If it doesn't:

- **HTTP 202 from the webhook but no post appears:** open Power Automate → *My flows* → your flow → *Run history* → latest run → expand the "Send a Microsoft Graph HTTP request" step to see the Graph error body.
- **Common Graph errors:**
  - `Forbidden` / insufficient scope → the Teams connector's delegated token lacks `ChannelMessage.Send`. An admin may need to consent.
  - `Invalid mention id` → a `<at id="N">` tag in the message body has no matching entry in the `mentions` array. This is a skill bug; report it.
  - `Attachment content must be a string` → the Adaptive Card wasn't JSON-stringified. Also a skill bug.
- **HTTP 4xx from the webhook:**
  - `Signature expired` / URL revoked → regenerate the HTTP POST URL in the trigger step and update the config file.
  - Payload rejected by trigger schema → you added a schema to the HTTP trigger. Leave **Request Body JSON Schema** empty.

## Troubleshooting

### Mentions don't notify

- If the mentioned user's name rendered as plain `@Name` (not a blue mention chip), the skill couldn't resolve it against the team and warned you — they won't be notified.
- If the name rendered as a chip but Teams still didn't notify, check the user's own Teams notification settings. Real mentions via Graph are equivalent to any other @mention.

### "No team member matches 'X'"

The skill matches partial display-name tokens (starts-with) against the team's backing M365 group via Graph. If you get zero matches:

- Confirm the user is actually a member of the same team (not just the channel).
- The skill reads from the **group** members endpoint, not the **channel** members endpoint (due to `ChannelMember.Read.All` not being available to the `az` first-party token). For a standard channel, group members = channel members. For a private/shared channel, a team member who isn't in that channel will still match — acceptable tradeoff.

### Re-run onboarding

Delete `~/.claude/post-pr.config.json` and run `/post-pr` again. The skill will detect the missing config and restart the onboarding flow.

### Switch team/channel

Edit `~/.claude/post-pr.config.json` directly, OR delete it and run `/post-pr` to re-onboard. If you switch channels, you likely want to update your Power Automate flow's Graph URI as well (or create a second flow and swap `webhookUrl`).
