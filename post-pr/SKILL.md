---
name: post-pr
description: Post a "PR ready for review" message to a Microsoft Teams channel via a Power Automate webhook. Takes a PR ID (and optional extra @mentions, resolved to full names via Microsoft Graph against the backing M365 group). Use when the user says "post-pr", "announce PR", "post to Teams", or wants to notify reviewers in Teams after creating a PR.
---

# Post PR to Teams

Fetch an Azure DevOps pull request by ID, resolve any `@partial-name` mentions against the Teams team's backing M365 group members, build a **Microsoft Graph `chatMessage`** payload (with the PR details in an Adaptive Card attachment and real mentions in the message body so named users get notified), and POST it via the Power Automate webhook URL. The flow is a passthrough: it forwards the payload to `POST https://graph.microsoft.com/v1.0/teams/{teamId}/channels/{channelId}/messages` via the "Send en Microsoft Graph HTTP-anmodning" Teams action, authenticated as the flow owner.

Why Graph directly instead of the Power Automate "Post card in a chat or channel" action? That action strips the `msteams.entities` extension from Adaptive Cards, so `<at>Name</at>` tags render as literal text and mentions never trigger notifications. Graph's `chatMessage` endpoint accepts a dedicated `mentions` array that makes `<at id="N">Name</at>` in `body.content` into real mentions.

The group-members endpoint is used instead of the channel-members endpoint because the Azure CLI first-party token in this tenant has `GroupMember.Read.All` / `User.Read.All` but NOT `ChannelMember.Read.All`. For a standard channel this is equivalent (channel members = team members); for a private/shared channel some matches may be team members who aren't in that specific channel — acceptable tradeoff.

## Hardcoded configuration

These IDs are baked in so the skill is shareable as-is:

| Setting | Value |
|---|---|
| **Webhook URL** | `https://default8e392e4f0a5340428d7a4d39211207.12.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/564883e0b64848af8c4d72f861fea0fa/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=XnVKFzUSeHTaYHrhfh3SP88E9nA_bQfvjrsOreNBvZM` |
| **Team ID (groupId)** | `8981d5af-a67e-448d-bbc3-7e624c43a423` |
| **Channel ID** | `19:13ec77afc46a4ca59a5e5eb7e03bae9d@thread.tacv2` |
| **Channel name** | Operational team |
| **Tenant ID** | `8e392e4f-0a53-4042-8d7a-4d3921120712` |

## Group aliases

A group alias is a single token in the mention arguments that expands to multiple pre-resolved users. AAD Object IDs are baked in so no Graph lookup is needed for alias members.

| Alias (case-insensitive) | Members |
|---|---|
| `team`, `TeamEdcDK` | Oliver Pasha Rasoli (`428585ec-366b-4b34-ab23-8178eda7625b`), Matias Gramkow (`fed0ca8c-8306-413e-9a42-16d89c324a15`), Weronika Wendowski (`799ebe7f-81d8-4bd6-adc7-b1399cf15021`) |

When matching an extra-mention token (Step 2c), check the alias table FIRST. If the token (lowercased) equals an alias name or any of its synonyms, expand it directly into mention entries for every member — skipping the Graph display-name lookup for those members. Other tokens fall through to the existing Graph resolution.

## Forking for another user

The webhook URL above belongs to a specific Power Automate flow owned by the original skill author (thjo@edc.dk). That flow is configured to **Post as: User**, so posts appear as sent by the flow owner — they, and only they, can edit/delete the resulting message.

**If you want posts to appear under your own identity** (so you can edit/delete them), you need your own copy of the flow:

1. Go to [make.powerautomate.com](https://make.powerautomate.com) and sign in with the same tenant (`edc.dk`).
2. **Save As / clone** the existing flow (ask the current owner to share it with you if you don't see it under *My flows*), OR recreate it:
   - Trigger: **When an HTTP request is received** (Teams webhook trigger is fine too)
   - Action: **Send en Microsoft Graph HTTP-anmodning** / **"Send a Microsoft Graph HTTP request"** (from the Microsoft Teams connector — NOT the generic HTTP action)
     - Method: **POST**
     - URI: `https://graph.microsoft.com/v1.0/teams/{TEAM_ID}/channels/{CHANNEL_ID}/messages`
     - Body: `triggerBody()` (as an Expression — passes the skill's payload straight through to Graph)
3. Save the flow — this generates a new HTTP POST URL with a fresh signature.
4. Paste that new URL into this skill's `Webhook URL` row above (overwriting the existing one). Everything else in the skill stays the same.

Keep the team/channel/tenant IDs the same — only the `Webhook URL` changes per fork.

**Why the "Send en Microsoft Graph HTTP-anmodning" action specifically:** it uses the Teams connector's existing auth (the flow owner's delegated token with appropriate Graph scopes like `ChannelMessage.Send`) so you don't need to set up a separate Entra ID app or connection. The post is made as the flow owner.

## Step 1: Parse input

Extract from the user's arguments:

- **PR ID** (required) — a number, e.g. `19647`
- **Extra mentions** (optional) — names the user wants tagged. They may be passed as `@name` or just `name`, space- or comma-separated. Treat each token as a **partial display-name query**.

If the PR ID is missing, ask the user for it.

**No channel mention:** This skill does NOT mention the channel. Channel mentions via Power Automate / incoming webhook Adaptive Cards aren't supported — Teams only accepts AAD Object IDs or Teams tag GUIDs as `mentioned.id`, not channel thread IDs (thread IDs render as "Unknown User"). The team has no Teams tags configured either, so there is no real-notification target for the channel as a whole. If a broader ping is needed, name specific people as extra mentions.

Example invocations:

- `/post-pr 19647` → no mentions (post still lands in the channel, just with nobody specifically pinged)
- `/post-pr 19647 Oliver` → one resolved mention for Oliver Pasha Rasoli
- `/post-pr 19647 Oliver thomas` → two resolved mentions for Oliver Pasha Rasoli + Thomas Sandvær Jørgensen
- `/post-pr 19647 team` → expands the `team` alias into mentions for every member of the `TeamEdcDK` group (see "Group aliases" above). Aliases can be combined with individual names: `/post-pr 19647 team thomas` adds Thomas alongside the alias members.

## Step 2: Resolve extra mentions against team members

**Skip this step if there are no extra mentions.**

### 2.0. Expand group aliases first

Before any Graph call, scan the extra-mention tokens for entries that match an alias in the **Group aliases** table at the top of this skill (case-insensitive equality). For each alias hit:

- Replace the token with one resolved-user entry per alias member (display name + AAD Object ID are baked into the table — no Graph lookup needed).
- Record each member exactly once across the whole post even if multiple aliases or individual tokens would resolve to the same person — deduplicate by AAD Object ID before assigning mention ids in Step 2e.

If, after expansion, there are no remaining non-alias tokens, you can skip 2a–2c entirely (no Graph call needed). Otherwise, continue with 2a–2c on whatever tokens are left.

### 2a. Get a Microsoft Graph token

```bash
az account get-access-token --resource https://graph.microsoft.com --query accessToken -o tsv
```

Save it as `GRAPH_TOKEN`. If this fails, tell the user to run `az login --allow-no-subscriptions` and retry.

### 2b. Fetch the team's members (via the backing M365 group)

```bash
curl -s -H "Authorization: Bearer $GRAPH_TOKEN" \
  'https://graph.microsoft.com/v1.0/groups/8981d5af-a67e-448d-bbc3-7e624c43a423/members?$select=id,displayName,mail,userPrincipalName'
```

Single-quote the URL so `$select` isn't expanded by the shell.

From the JSON response, extract `value[*]` — each member is a user resource with `id` (AAD Object ID), `displayName`, `mail`, and `userPrincipalName`. **Keep `id` for every matched user** — it is required for the real-mention entity in Step 5.

If the response status is 4xx/5xx, fall through to Step 2d (plain-text fallback). Do NOT try the `/teams/{id}/channels/{id}/members` endpoint — it requires `ChannelMember.Read.All` which isn't granted to the Azure CLI token in this tenant.

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
az repos pr show --id {PR_ID} --org https://dev.azure.com/edc-group --output json
```

Extract:

- **Title:** `title`
- **Description:** `description` (may be empty or contain Markdown/HTML — truncate to ~300 chars for the card, strip raw HTML tags if present)
- **Source branch:** `sourceRefName` (strip the `refs/heads/` prefix)
- **Target branch:** `targetRefName` (strip the `refs/heads/` prefix)
- **Repository name:** `repository.name` (e.g. `EDC.EDCDK.Website`)
- **Author:** `createdBy.displayName`
- **Work items:** `workItemRefs` — array of `{id, url}`. Each `id` is the work item ID.
- **PR web URL:** construct as
  `https://dev.azure.com/edc-group/Relaunch%20-%20Charlie%20Tango/_git/{repository.name}/pullrequest/{PR_ID}`

If `az repos pr show` fails with an auth error, tell the user to run `az login --allow-no-subscriptions` and retry.

If there are no linked work items, tell the user — the post uses the PBI title as the core context, so posting without one makes less sense. Ask whether to post anyway (with PR title as a fallback) or abort.

## Step 4: Fetch the PBI title

For the first linked work item (the primary PBI):

```bash
az boards work-item show --id {WORK_ITEM_ID} --output json --query "{title: fields.\"System.Title\", type: fields.\"System.WorkItemType\"}"
```

Extract:

- **PBI title:** `title`
- **PBI URL:** `https://dev.azure.com/edc-group/Relaunch%20-%20Charlie%20Tango/_workitems/edit/{WORK_ITEM_ID}`

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
- **Mentions live in `body.content`, not in the card.** The HTML message body renders above the card in Teams. Inside `body.content`, the `<at id="N">Name</at>` tags reference entries in the top-level `mentions` array by matching `id`. This is the Graph-native way and replaces the old `msteams.entities` approach from the Power Automate era.
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

Write a Node.js script `post-pr-post.js` **in the skill's base directory** (the path shown at the top of this file as "Base directory for this skill: …"). Keeping it in the skill folder avoids polluting the user's project and eliminates the risk of accidentally committing it. Do NOT write it to the current working directory or `/tmp/` — Git Bash on Windows handles `/tmp` inconsistently. The script:

1. Builds the Adaptive Card as a JS object, then `JSON.stringify()`s it for the attachment content.
2. Builds the full `chatMessage` payload.
3. POSTs it to the webhook URL using the built-in `https` module (no external dependencies).

**IMPORTANT:** Use the `Webhook URL` value from the `## Hardcoded configuration` table at the top of this file for the `WEBHOOK` constant below — do not use the URL literal shown in this template. If the config table's URL differs from what appears here, the config table wins. (Forks of this skill will have different webhook URLs in the table.)

```js
const https = require('https');

// Paste the Webhook URL from the config table above verbatim:
const WEBHOOK = "<<<PASTE WEBHOOK URL FROM CONFIG TABLE HERE>>>";

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

Substitute all `{PLACEHOLDERS}` before writing the file. Then run (using the skill base directory from the top of this file):

```bash
node "{SKILL_BASE_DIR}/post-pr-post.js"
```

### Handle the response

- **HTTP 200/202** → success. The flow accepted the payload. Tell the user the post went through to the "Operational team" channel and show the PR URL again for quick reference. **Verify in Teams before declaring success** — a 202 only means Power Automate accepted the trigger; if the downstream Graph call failed, nothing shows up in the channel.
- **HTTP 4xx/5xx** → show the response body. Common causes:
  - Signature expired / URL revoked → regenerate the workflow URL in Power Automate
  - Payload schema rejected by Power Automate trigger → the trigger's request schema doesn't allow one of the top-level fields; check the trigger schema
- **Graph-level failures** (flow returned 202 but post didn't appear): open Power Automate → flow → Run history → latest run → "Send en Microsoft Graph HTTP-anmodning" step to see the Graph error body. Common causes:
  - `Forbidden` / insufficient scope → the flow owner's Teams connection lacks `ChannelMessage.Send` delegated scope (admin may need to consent)
  - `Invalid mention id` → a `<at id="N">` in `body.content` has no matching entry in `mentions[]`
  - `Attachment content must be a string` → forgot to `JSON.stringify()` the card

Delete the script at the end of Step 7: `rm -f "{SKILL_BASE_DIR}/post-pr-post.js"`.

## Step 7: Confirm and clean up

Delete the temp script: `rm -f "{SKILL_BASE_DIR}/post-pr-post.js"`.

Then report back to the user:

- ✓ Post sent to Teams channel "Operational team"
- Subject (Teams notification / channel listing): `{REPO_NAME} PR ready for review`
- Mentions: each resolved user (real mention via Graph, will notify) and any raw tokens (plain text, will NOT notify). If no mentions, say so.
- PR: `{PR_URL}`
- Linked PBI: `#{PBI_ID} {PBI_TITLE}`

## Notes on @mentions

Mentions in this skill use Graph's `chatMessage.mentions` array: each `<at id="N">Name</at>` in `body.content` must map to an entry with the same `id` in the top-level `mentions` array, whose `mentioned.user.id` is an AAD Object ID. User mentions built this way trigger real Teams notifications.

**Not supported by this skill:**

- **Channel mentions** — Graph's chatMessage does support channel mentions (`mentioned.conversation` with `conversationIdentityType: "channel"`), but the team's "Operational team" channel uses a thread ID that Teams doesn't expose as a mention target through this flow. Never add a channel mention entry unless you've tested it separately — it often renders as "Unknown User".
- **Teams tag mentions** — would require `TeamworkTag.Read` scope, which the Teams connector in the flow doesn't hold by default. The `Operational team` team has no tags configured either (as of 2026-04-17). If tags are created later, this section can be revisited.

**Rendering caveats:**

- Plain-text tokens (`@Oliver` for unresolved users) render literally and do NOT trigger notifications. Always flag these in the confirmation summary so the user knows who did and did not get pinged.
- The mentions render in `body.content` **above** the Adaptive Card, not inside it. That's intentional — it keeps the card clean and makes the Teams notification preview useful.
