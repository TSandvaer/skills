---
name: post-pr
description: Post a "PR ready for review" message to a Microsoft Teams channel via a Power Automate webhook. Takes a PR ID (and optional extra @mentions, resolved to full names via Microsoft Graph against the backing M365 group). Use when the user says "post-pr", "announce PR", "post to Teams", or wants to notify reviewers in Teams after creating a PR.
---

# Post PR to Teams

Fetch an Azure DevOps pull request by ID, resolve any `@partial-name` mentions against the Teams team's backing M365 group members, build a **Microsoft Graph `chatMessage`** payload (with the PR details in an Adaptive Card attachment and real mentions in the message body so named users get notified), and POST it via the user's Power Automate webhook URL. The flow is a passthrough: it forwards the payload to `POST https://graph.microsoft.com/v1.0/teams/{teamId}/channels/{channelId}/messages` via the "Send a Microsoft Graph HTTP request" Teams action, authenticated as the flow owner.

Why Graph directly instead of the Power Automate "Post card in a chat or channel" action? That action strips the `msteams.entities` extension from Adaptive Cards, so `<at>Name</at>` tags render as literal text and mentions never trigger notifications. Graph's `chatMessage` endpoint accepts a dedicated `mentions` array that makes `<at id="N">Name</at>` in `body.content` into real mentions.

The group-members endpoint is used instead of the channel-members endpoint because the Azure CLI first-party token in most tenants has `GroupMember.Read.All` / `User.Read.All` but NOT `ChannelMember.Read.All`. For a standard channel this is equivalent (channel members = team members); for a private/shared channel some matches may be team members who aren't in that specific channel — acceptable tradeoff.

## Step 0: Load configuration (or run onboarding)

The skill reads its configuration from `~/.claude/post-pr.config.json`. This file is **per-user, not committed to the skill** — each user (you and your colleagues) has their own.

Expected shape:

```json
{
  "webhookUrl": "https://...environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/.../triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=...",
  "teamId": "00000000-0000-0000-0000-000000000000",
  "channelId": "19:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx@thread.tacv2",
  "channelName": "Operational team",
  "tenantId": "00000000-0000-0000-0000-000000000000"
}
```

Fields used by the skill:

- `webhookUrl` — used in Step 6
- `teamId` — used in Step 2b (the backing M365 group ID = Teams team ID)
- `channelId` — informational (the flow's Graph URI already encodes it); shown in the confirmation summary
- `channelName` — used in confirmation messages in Step 7
- `tenantId` — informational, for debugging

Load it with:

```bash
CONFIG_PATH="$HOME/.claude/post-pr.config.json"
if [ -f "$CONFIG_PATH" ]; then
  cat "$CONFIG_PATH"
fi
```

### If the config file is missing → run interactive onboarding

Tell the user: *"Looks like this is your first time using post-pr. Let me walk you through a quick setup."* Then follow this order (also documented in [SETUP.md](SETUP.md) — read that file now for the full reference):

1. **Check prerequisites.**
   - `az --version` — Azure CLI must be installed. If missing, point the user at https://learn.microsoft.com/cli/azure/install-azure-cli and stop.
   - `node --version` — Node.js must be installed. If missing, point at https://nodejs.org and stop.

2. **Ensure Azure login.**
   ```bash
   az account show --query tenantId -o tsv
   ```
   If this fails, tell the user to run `az login --allow-no-subscriptions` and come back. When it succeeds, save the tenant ID as `TENANT_ID`.

3. **Get a Graph token:**
   ```bash
   GRAPH_TOKEN=$(az account get-access-token --resource https://graph.microsoft.com --query accessToken -o tsv)
   ```

4. **Pick a team.** List the user's teams:
   ```bash
   curl -s -H "Authorization: Bearer $GRAPH_TOKEN" \
     'https://graph.microsoft.com/v1.0/me/joinedTeams?$select=id,displayName' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);j.value.forEach((t,i)=>console.log((i+1)+'.',t.displayName,'('+t.id+')'))})"
   ```
   Show the list and use `AskUserQuestion` to let the user pick. Save the chosen `id` as `TEAM_ID` and `displayName` as the team name.

5. **Pick a channel.** List that team's channels:
   ```bash
   curl -s -H "Authorization: Bearer $GRAPH_TOKEN" \
     "https://graph.microsoft.com/v1.0/teams/$TEAM_ID/channels?\$select=id,displayName" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);j.value.forEach((c,i)=>console.log((i+1)+'.',c.displayName,'('+c.id+')'))})"
   ```
   Use `AskUserQuestion` to let the user pick. Save `id` as `CHANNEL_ID` and `displayName` as `CHANNEL_NAME`.

6. **Guide the user through creating their Power Automate flow.** Tell them verbatim:

   > *Open [make.powerautomate.com](https://make.powerautomate.com) in your browser, sign in with the same tenant, and create a new **Instant cloud flow** with these steps:*
   >
   > *1. Trigger: **When an HTTP request is received** — leave the request body schema empty.*
   > *2. Action: **Send a Microsoft Graph HTTP request** (Danish: "Send en Microsoft Graph HTTP-anmodning") — this is under the **Microsoft Teams** connector, not the generic HTTP action.*
   > *   - Method: POST*
   > *   - URI: `https://graph.microsoft.com/v1.0/teams/{TEAM_ID}/channels/{CHANNEL_ID}/messages`* ← substitute the IDs you just chose
   > *   - Body: click the **fx** button on the Body field and enter the expression `triggerBody()`*
   > *3. Save the flow. Re-open the HTTP trigger step and copy the **HTTP POST URL**. Paste it back here when done.*

   Show the filled-in URI with the actual `TEAM_ID` and `CHANNEL_ID` substituted so the user can copy it directly. See [SETUP.md](SETUP.md) for the long-form explanation of why this specific action.

   Use `AskUserQuestion` (or wait for the user to paste it) to collect the webhook URL. Save as `WEBHOOK_URL`. Validate it starts with `https://` and contains `triggers/manual/paths/invoke`.

7. **Write the config file:**
   ```bash
   mkdir -p "$HOME/.claude"
   ```
   Then use the Write tool to create `$HOME/.claude/post-pr.config.json` with JSON containing `webhookUrl`, `teamId`, `channelId`, `channelName`, `tenantId`.

8. **Confirm and continue.** Tell the user setup is done and the config is saved at `~/.claude/post-pr.config.json`. Then proceed to Step 1 of the normal flow using the values you just collected.

Once the config file exists, the skill never re-enters onboarding. To re-onboard, delete the file.

## Step 1: Parse input

Extract from the user's arguments:

- **PR ID** (required) — a number, e.g. `19647`
- **Extra mentions** (optional) — names the user wants tagged. They may be passed as `@name` or just `name`, space- or comma-separated. Treat each token as a **partial display-name query**.

If the PR ID is missing, ask the user for it.

**No channel mention:** This skill does NOT mention the channel. Channel mentions via Power Automate / incoming webhook Adaptive Cards aren't supported — Teams only accepts AAD Object IDs or Teams tag GUIDs as `mentioned.id`, not channel thread IDs (thread IDs render as "Unknown User"). If a broader ping is needed, name specific people as extra mentions.

Example invocations:

- `/post-pr 19647` → no mentions (post still lands in the channel, just with nobody specifically pinged)
- `/post-pr 19647 Oliver` → one resolved mention for Oliver Pasha Rasoli
- `/post-pr 19647 Oliver thomas` → two resolved mentions for Oliver Pasha Rasoli + Thomas Sandvær Jørgensen

## Step 2: Resolve extra mentions against team members

**Skip this step if there are no extra mentions.**

### 2a. Get a Microsoft Graph token

```bash
az account get-access-token --resource https://graph.microsoft.com --query accessToken -o tsv
```

Save it as `GRAPH_TOKEN`. If this fails, tell the user to run `az login --allow-no-subscriptions` and retry.

### 2b. Fetch the team's members (via the backing M365 group)

Use the `teamId` from the loaded config:

```bash
curl -s -H "Authorization: Bearer $GRAPH_TOKEN" \
  "https://graph.microsoft.com/v1.0/groups/$TEAM_ID/members?\$select=id,displayName,mail,userPrincipalName"
```

Quote `$select` so the shell doesn't expand it.

From the JSON response, extract `value[*]` — each member is a user resource with `id` (AAD Object ID), `displayName`, `mail`, and `userPrincipalName`. **Keep `id` for every matched user** — it is required for the real-mention entity in Step 5.

If the response status is 4xx/5xx, fall through to Step 2d (plain-text fallback). Do NOT try the `/teams/{id}/channels/{id}/members` endpoint — it requires `ChannelMember.Read.All` which isn't granted to the Azure CLI token.

### 2c. Match each extra mention

For each extra mention token (stripped of leading `@`):

1. Normalise to lowercase for comparison.
2. Match against team members where `displayName.toLowerCase()` **starts with** the token. (Also check the local-part of `mail` / `userPrincipalName` — e.g. `oliver.pasha@edc.dk` matches "oliver" — as a secondary filter.)
3. Outcomes:
   - **Exactly 1 match** → use the member's full `displayName`. Store `id` (AAD Object ID) — required for the real-mention entity.
   - **Multiple matches** → use `AskUserQuestion` to let the user pick one. List up to 4 candidates; show their `displayName` and `mail` as the description.
   - **Zero matches** → warn the user ("No team member matches 'Oliver'. Including it as plain text anyway.") and keep the raw `@Oliver` token. Plain-text mentions do NOT trigger notifications — make this explicit in the summary.

### 2d. Fallback: no resolution

If Graph is unreachable, the token fails, or the group-members call returns 4xx/5xx:

- Keep extra mentions as raw text (`@Oliver`)
- Tell the user once: "Couldn't verify names against team members — posting with raw text. These will not notify anyone. Check before it lands."
- Continue to Step 3.

### 2e. Build the mentions structures

You'll need two things in Step 5 — both derived from the resolved-user list. Assign each resolved user a sequential `mentionId` starting at `0` and reuse that id in both places:

1. **Top-level `mentions` array** for the Graph `chatMessage` payload — one entry per resolved user:

   ```json
   {
     "id": 0,
     "mentionText": "{displayName}",
     "mentioned": {
       "user": {
         "id": "{aadObjectId}",
         "displayName": "{displayName}",
         "userIdentityType": "aadUser"
       }
     }
   }
   ```

2. **Mention-line HTML string** for `body.content` in the chatMessage — uses `<at id="N">...</at>` tags matching the mention ids above:

   ```
   <at id="0">Oliver Pasha Rasoli</at> <at id="1">Thomas Sandvær Jørgensen</at> @Unresolved
   ```

   Resolved users use `<at id="N">DisplayName</at>`. Unresolved raw tokens stay as plain `@token` (rendered literally, no notification).

If there are no resolved users AND no raw tokens, `mentions` is omitted from the payload and the mention-line string is empty (just the attachment reference renders in `body.content`).

## Step 3: Fetch PR details

```bash
az repos pr show --id {PR_ID} --output json
```

If your org isn't set as the default for `az repos`, add `--org https://dev.azure.com/{your-org}`. The skill should try without `--org` first; if it fails, ask the user for their org URL and retry. (Optionally, this can be captured during onboarding and stored in the config file as `azureDevOpsOrg` — not required.)

Extract:

- **Title:** `title`
- **Description:** `description` (may be empty or contain Markdown/HTML — truncate to ~300 chars for the card, strip raw HTML tags if present)
- **Source branch:** `sourceRefName` (strip the `refs/heads/` prefix)
- **Target branch:** `targetRefName` (strip the `refs/heads/` prefix)
- **Repository name:** `repository.name`
- **Project name:** `repository.project.name` — used to construct the PR web URL
- **Author:** `createdBy.displayName`
- **Work items:** `workItemRefs` — array of `{id, url}`. Each `id` is the work item ID.
- **Organization:** derive from `repository.webUrl` (first path segment after `dev.azure.com/`) or use whatever `--org` value you ended up calling with
- **PR web URL:** construct as
  `https://dev.azure.com/{ORG}/{PROJECT_NAME_URL_ENCODED}/_git/{REPO_NAME}/pullrequest/{PR_ID}`

If `az repos pr show` fails with an auth error, tell the user to run `az login --allow-no-subscriptions` and retry.

If there are no linked work items, tell the user — the post uses the PBI title as the core context, so posting without one makes less sense. Ask whether to post anyway (with PR title as a fallback) or abort.

## Step 4: Fetch the PBI title

For the first linked work item (the primary PBI):

```bash
az boards work-item show --id {WORK_ITEM_ID} --output json --query "{title: fields.\"System.Title\", type: fields.\"System.WorkItemType\"}"
```

Extract:

- **PBI title:** `title`
- **PBI URL:** `https://dev.azure.com/{ORG}/{PROJECT_NAME_URL_ENCODED}/_workitems/edit/{WORK_ITEM_ID}`

## Step 5: Build the Graph `chatMessage` payload

The flow passes the payload straight through to Graph's `POST /teams/{teamId}/channels/{channelId}/messages` endpoint. The full payload is a Graph `chatMessage` resource:

```json
{
  "subject": "{REPO_NAME} PR ready for review",
  "body": {
    "contentType": "html",
    "content": "{MENTION_LINE_HTML}<br><attachment id=\"card1\"></attachment>"
  },
  "attachments": [
    {
      "id": "card1",
      "contentType": "application/vnd.microsoft.card.adaptive",
      "content": "{CARD_JSON_STRINGIFIED}",
      "name": null,
      "thumbnailUrl": null
    }
  ],
  "mentions": [
    // one entry per resolved user from Step 2e — omit this array entirely if none
  ]
}
```

The Adaptive Card JSON that gets stringified into `attachments[0].content`:

```json
{
  "type": "AdaptiveCard",
  "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
  "version": "1.4",
  "body": [
    {
      "type": "TextBlock",
      "text": "Please review PR related to [{PBI_TITLE}]({PBI_URL})",
      "wrap": true
    },
    {
      "type": "FactSet",
      "facts": [
        { "title": "Author:",  "value": "{AUTHOR}" },
        { "title": "Branch:",  "value": "{SOURCE_BRANCH} → {TARGET_BRANCH}" },
        { "title": "Work item:", "value": "[#{PBI_ID} {PBI_TITLE}]({PBI_URL})" }
      ]
    },
    {
      "type": "TextBlock",
      "text": "{PR_DESCRIPTION_EXCERPT}",
      "wrap": true,
      "isSubtle": true,
      "spacing": "Medium"
    }
  ],
  "actions": [
    { "type": "Action.OpenUrl", "title": "Open PR", "url": "{PR_URL}" }
  ]
}
```

Key structural notes:

- **`attachments[0].content` MUST be a string** (stringified JSON), not a nested object. Use `JSON.stringify(card)` or Python's `json.dumps(card)` — do not inline the card as an object.
- **Mentions live in `body.content`, not in the card.** The HTML message body renders above the card in Teams. Inside `body.content`, the `<at id="N">Name</at>` tags reference entries in the top-level `mentions` array by matching `id`.
- **The card has no mention TextBlock** — mentions already appear above the card as the message body, so duplicating them inside the card would be noisy.

Rules for placeholder substitution:

- **`{REPO_NAME}`** → `repository.name` from Step 3. `subject` is always `{REPO_NAME} PR ready for review`.
- **`{MENTION_LINE_HTML}`** → the HTML mention-line string from Step 2e (e.g. `<at id="0">Oliver Pasha Rasoli</at>`). If there are no mentions at all, omit the leading `<br>` too so `body.content` becomes just `<attachment id="card1"></attachment>`.
- **`mentions` array** → the list built in Step 2e. Omit the entire `"mentions"` key if no resolved users (raw `@token`s do NOT go in this array — they're plain text only).
- **`{PBI_TITLE}`** / **`{PBI_URL}`** / **`{PBI_ID}`** → from Step 4
- **`{AUTHOR}`** → `createdBy.displayName`
- **`{SOURCE_BRANCH}`** / **`{TARGET_BRANCH}`** → from Step 3, with `refs/heads/` stripped
- **`{PR_URL}`** → constructed in Step 3
- **`{PR_DESCRIPTION_EXCERPT}`** → first ~300 chars of the PR description with:
  - HTML tags stripped
  - Markdown kept (links like `[text](url)` render)
  - Newlines preserved (Adaptive Card TextBlock supports `\n` as line breaks)
  - Truncate at a word boundary and append `…` if longer than 300 chars
  - If the description is empty, omit this TextBlock entirely from the card's body array
- If there is **no linked work item** (and the user opted to post anyway):
  - Drop the "Work item" fact row
  - Change the first card TextBlock to: `"Please review PR: [{PR_TITLE}]({PR_URL})"`

Invariant: **every `<at id="N">Name</at>` in `body.content` MUST have a matching entry in `mentions[]` with the same `id`**, otherwise Graph rejects the request or renders the tag literally.

## Step 6: Post to the Teams webhook

Because `attachments[0].content` must be a stringified JSON, the cleanest way to build the payload is via a small Node.js script — the `Write` tool + `curl` approach doesn't work well because you can't easily produce a stringified JSON inside another JSON file with the right escaping.

Write a Node.js script `post-pr-post.js` **in the current working directory** (do NOT use `/tmp/` — on Windows Git Bash, the Write tool and curl disagree on what `/tmp` maps to). The script:

1. Loads the webhook URL from `~/.claude/post-pr.config.json`.
2. Builds the Adaptive Card as a JS object, then `JSON.stringify()`s it for the attachment content.
3. Builds the full `chatMessage` payload.
4. POSTs it to the webhook URL using the built-in `https` module (no external dependencies).

```js
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_PATH = path.join(os.homedir(), '.claude', 'post-pr.config.json');
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const WEBHOOK = config.webhookUrl;

const card = {
  type: "AdaptiveCard",
  $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
  version: "1.4",
  body: [
    { type: "TextBlock", text: "Please review PR related to [{PBI_TITLE}]({PBI_URL})", wrap: true },
    { type: "FactSet", facts: [
      { title: "Author:", value: "{AUTHOR}" },
      { title: "Branch:", value: "{SOURCE_BRANCH} → {TARGET_BRANCH}" },
      { title: "Work item:", value: "[#{PBI_ID} {PBI_TITLE}]({PBI_URL})" },
    ] },
    { type: "TextBlock", text: "{PR_DESCRIPTION_EXCERPT}", wrap: true, isSubtle: true, spacing: "Medium" },
  ],
  actions: [
    { type: "Action.OpenUrl", title: "Open PR", url: "{PR_URL}" },
  ],
};

const payload = {
  subject: "{REPO_NAME} PR ready for review",
  body: {
    contentType: "html",
    content: '{MENTION_LINE_HTML}<br><attachment id="card1"></attachment>',
  },
  attachments: [
    { id: "card1", contentType: "application/vnd.microsoft.card.adaptive", content: JSON.stringify(card), name: null, thumbnailUrl: null },
  ],
  mentions: [
    // one entry per resolved user from Step 2e — OMIT this key entirely if empty
  ],
};

const data = JSON.stringify(payload);
const url = new URL(WEBHOOK);
const opts = {
  hostname: url.hostname, port: url.port || 443,
  path: url.pathname + url.search, method: "POST",
  headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
};
const req = https.request(opts, (res) => {
  let body = "";
  res.on("data", (c) => (body += c));
  res.on("end", () => { console.log("HTTP", res.statusCode); console.log(body); });
});
req.on("error", (e) => console.error("ERR", e));
req.write(data);
req.end();
```

Substitute all `{PLACEHOLDERS}` before writing the file. Then run:

```bash
node post-pr-post.js
```

### Handle the response

- **HTTP 200/202** → success. The flow accepted the payload. Tell the user the post went through to the configured channel (use `channelName` from config) and show the PR URL again for quick reference. **Verify in Teams before declaring success** — a 202 only means Power Automate accepted the trigger; if the downstream Graph call failed, nothing shows up in the channel.
- **HTTP 4xx/5xx** → show the response body. Common causes:
  - Signature expired / URL revoked → tell the user to regenerate the workflow URL in Power Automate (re-open the HTTP trigger step, copy the new URL) and update `~/.claude/post-pr.config.json`
  - Payload schema rejected by Power Automate trigger → the trigger's request schema is locking things down; tell the user to clear the Request Body JSON Schema on the trigger
- **Graph-level failures** (flow returned 202 but post didn't appear): tell the user to open Power Automate → flow → Run history → latest run → "Send a Microsoft Graph HTTP request" step to see the Graph error body. Common causes:
  - `Forbidden` / insufficient scope → the flow owner's Teams connection lacks `ChannelMessage.Send` delegated scope (admin may need to consent)
  - `Invalid mention id` → a `<at id="N">` in `body.content` has no matching entry in `mentions[]`
  - `Attachment content must be a string` → forgot to `JSON.stringify()` the card

Delete the script at the end of Step 7: `rm -f post-pr-post.js`.

## Step 7: Confirm and clean up

Delete the temp script: `rm -f post-pr-post.js`.

Then report back to the user:

- ✓ Post sent to Teams channel "{channelName from config}"
- Subject (Teams notification / channel listing): `{REPO_NAME} PR ready for review`
- Mentions: each resolved user (real mention via Graph, will notify) and any raw tokens (plain text, will NOT notify). If no mentions, say so.
- PR: `{PR_URL}`
- Linked PBI: `#{PBI_ID} {PBI_TITLE}`

## Notes on @mentions

Mentions in this skill use Graph's `chatMessage.mentions` array: each `<at id="N">Name</at>` in `body.content` must map to an entry with the same `id` in the top-level `mentions` array, whose `mentioned.user.id` is an AAD Object ID. User mentions built this way trigger real Teams notifications.

**Not supported by this skill:**

- **Channel mentions** — Graph's chatMessage does support channel mentions (`mentioned.conversation` with `conversationIdentityType: "channel"`), but most Teams channels use a thread ID that isn't a valid mention target through this flow. Never add a channel mention entry unless you've tested it separately — it often renders as "Unknown User".
- **Teams tag mentions** — would require `TeamworkTag.Read` scope, which the Teams connector in the flow doesn't hold by default. If tags are created in your team, this section can be revisited.

**Rendering caveats:**

- Plain-text tokens (`@Oliver` for unresolved users) render literally and do NOT trigger notifications. Always flag these in the confirmation summary so the user knows who did and did not get pinged.
- The mentions render in `body.content` **above** the Adaptive Card, not inside it. That's intentional — it keeps the card clean and makes the Teams notification preview useful.
