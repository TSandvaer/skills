---
name: post-release
description: Post a "Releasing {repo} to PROD" message to a Microsoft Teams release channel via a Power Automate webhook. The target channel is always @mentioned so every subscriber gets notified. Lists every commit pushed to master since the last successful production deployment (sourced from Azure DevOps release pipeline, rollback-aware). Takes optional repository name, optional minutes-until-release, and optional extra @mentions (resolved to full names via Microsoft Graph). Use when the user says "post-release", "announce release", "post release to Teams", or wants to notify the team before a production deploy.
---

# Post Release to Teams

Announce an imminent production deployment in a Teams release channel. The post lists the commits pushed to `master` since the previous successful PROD deployment (so reviewers can see what's going out), mentions the target channel (so everyone subscribed gets notified), and optionally mentions individuals + shows a countdown ("in X minutes").

The message goes out via a Power Automate flow the user owns. The flow forwards the payload to `POST https://graph.microsoft.com/v1.0/teams/{teamId}/channels/{channelId}/messages` through the Teams connector's "Send a Microsoft Graph HTTP request" action.

**Why Graph directly, not the Power Automate "Post card" action?** That action strips the `msteams.entities` extension from Adaptive Cards and can't forward Graph `mentions` arrays, so mentions never trigger notifications. Graph's `chatMessage` endpoint accepts a dedicated `mentions` array that makes `<at id="N">Name</at>` tags into real mentions — including channel mentions.

## Step 0: Load configuration (or run onboarding)

The skill reads `~/.claude/post-release.config.json`. This file is **per-user** — not committed with the skill. Expected shape:

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

| Field | Used where |
|---|---|
| `webhookUrl` | Step 7 (post) |
| `teamId` | Step 3 (member lookup for user mentions) |
| `channelId` | Step 3a (channel mention entry) |
| `channelName` | Step 3a (channel mention `mentionText` + confirmation) |
| `tenantId` | informational |
| `azureDevOpsOrg` | Steps 4, 5 |
| `azureDevOpsProject` | Steps 4, 5 |
| `releaseDefinitionId` *(optional)* | Step 4 — if set, skip auto-discovery |
| `autoMentionChannel` *(optional, default `true`)* | Step 3a — set `false` if channel mentions render as "Unknown User" on your channel |
| `channelMentionAliases` *(optional)* | Step 3b — tokens that are deduplicated against the automatic channel mention |

Load it:

```bash
CONFIG_PATH="$HOME/.claude/post-release.config.json"
if [ -f "$CONFIG_PATH" ]; then
  cat "$CONFIG_PATH"
fi
```

### If the config file is missing → run interactive onboarding

Tell the user: *"Looks like this is your first time using post-release. Let me walk you through a quick setup."* Then follow this order (also documented in [SETUP.md](SETUP.md) — read that file now for the full reference):

1. **Check prerequisites.**
   - `az --version` — Azure CLI installed. If missing, point at https://learn.microsoft.com/cli/azure/install-azure-cli and stop.
   - `az extension list --query "[?name=='azure-devops'].name" -o tsv` — `azure-devops` extension present. If missing, run `az extension add --name azure-devops`.
   - `node --version` — Node.js installed. If missing, point at https://nodejs.org and stop.

2. **Ensure Azure login.**
   ```bash
   az account show --query tenantId -o tsv
   ```
   If this fails, tell the user to run `az login --allow-no-subscriptions` and come back. Save the output as `TENANT_ID`.

3. **Get a Graph token:**
   ```bash
   GRAPH_TOKEN=$(az account get-access-token --resource https://graph.microsoft.com --query accessToken -o tsv)
   ```

4. **Ask for the Azure DevOps org URL.** Use `AskUserQuestion`. Expected format: `https://dev.azure.com/{org-slug}`. Save as `AZURE_DEVOPS_ORG`.

5. **Ask for the Azure DevOps project name.** Use `AskUserQuestion`. Save as `AZURE_DEVOPS_PROJECT` (spaces OK, don't URL-encode).

6. **Optionally pin a release definition.** List definitions:
   ```bash
   az pipelines release definition list --org "$AZURE_DEVOPS_ORG" --project "$AZURE_DEVOPS_PROJECT" --query "[].{id:id, name:name}" --output json
   ```
   Show the list and use `AskUserQuestion` with an extra "Auto-discover per repo (skip pinning)" option. If the user picks a definition, save its `id` as `RELEASE_DEFINITION_ID`. If they pick auto-discover, leave it unset.

7. **Pick a team.**
   ```bash
   curl -s -H "Authorization: Bearer $GRAPH_TOKEN" \
     'https://graph.microsoft.com/v1.0/me/joinedTeams?$select=id,displayName' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);j.value.forEach((t,i)=>console.log((i+1)+'.',t.displayName,'('+t.id+')'))})"
   ```
   Use `AskUserQuestion`. Save `id` as `TEAM_ID`.

8. **Pick the release channel.**
   ```bash
   curl -s -H "Authorization: Bearer $GRAPH_TOKEN" \
     "https://graph.microsoft.com/v1.0/teams/$TEAM_ID/channels?\$select=id,displayName" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);j.value.forEach((c,i)=>console.log((i+1)+'.',c.displayName,'('+c.id+')'))})"
   ```
   Use `AskUserQuestion`. Save `id` as `CHANNEL_ID` and `displayName` as `CHANNEL_NAME`.

9. **Guide the user through creating their Power Automate flow.** Tell them verbatim:

   > *Open [make.powerautomate.com](https://make.powerautomate.com) in your browser, sign in with the same tenant, and create a new **Instant cloud flow**:*
   >
   > *1. Trigger: **When an HTTP request is received** — leave the request body schema empty.*
   > *2. Action: **Send a Microsoft Graph HTTP request** (Danish UI: "Send en Microsoft Graph HTTP-anmodning") — this is under the **Microsoft Teams** connector, NOT the generic HTTP action.*
   > *   - Method: POST*
   > *   - URI: `https://graph.microsoft.com/v1.0/teams/{TEAM_ID}/channels/{CHANNEL_ID}/messages`* ← substitute your IDs
   > *   - Body: click the **fx** button on the Body field and enter the expression `triggerBody()`*
   > *3. Save the flow. Re-open the HTTP trigger step and copy the **HTTP POST URL**. Paste it back here.*

   Show the filled-in URI with actual `TEAM_ID`/`CHANNEL_ID` substituted so the user can copy it directly. See [SETUP.md](SETUP.md) for background on why this specific action.

   Use `AskUserQuestion` (or wait for the paste) to collect the webhook URL. Save as `WEBHOOK_URL`. Validate it starts with `https://` and contains `triggers/manual/paths/invoke`.

10. **Write the config file.** Use the Write tool to create `$HOME/.claude/post-release.config.json` with `webhookUrl`, `teamId`, `channelId`, `channelName`, `tenantId`, `azureDevOpsOrg`, `azureDevOpsProject`, optional `releaseDefinitionId`, `autoMentionChannel: true`.

11. **Confirm and continue.** Tell the user setup is done, config is saved at `~/.claude/post-release.config.json`. Proceed to Step 1 of the normal flow using the values just collected.

Once the config file exists, the skill never re-enters onboarding. To re-onboard, delete the file.

## Step 1: Parse input

Arguments are all optional, order-independent:

- **Repository name** — a token matching a repo in the Azure DevOps org. Distinguishes the three field types:
  - Repository: non-numeric token that equals (case-insensitive) a repo name from `az repos list`.
  - Minutes: a purely numeric token, optionally suffixed with `m`/`min`/`minutes`. Examples: `15`, `15m`, `15 min`, `15 minutes`.
  - Mention: anything else (optionally `@`-prefixed), space- or comma-separated.

**Invocation examples** (the target channel is always mentioned automatically — extra arguments only add mentions on top):

- `/post-release` → current repo (from cwd), no countdown, just the channel mention
- `/post-release 15` → "...in 15 minutes", channel mention only
- `/post-release MyRepo` → specific repo, no countdown, channel mention only
- `/post-release MyRepo 15` → specific repo + countdown
- `/post-release 15 Oliver thomas` → current repo, countdown, two user mentions
- `/post-release MyRepo 10 {channelName}` → identical to `/post-release MyRepo 10` — the channel-name token is deduplicated so the channel isn't mentioned twice.

## Step 2: Determine the repository

### If a repository token was given in Step 1

Verify it against the Azure DevOps org:

```bash
az repos list --org "$AZURE_DEVOPS_ORG" --project "$AZURE_DEVOPS_PROJECT" --query "[].{name:name}" --output json
```

Match case-insensitively. Set:

- `{REPO_NAME}` = the exact DevOps repo name (with original casing)
- `{REPO_PATH}` = the local clone path. Ask the user for this if not obvious — defaults are:
  - If cwd's `git remote get-url origin` ends with `{REPO_NAME}.git`, use `pwd`
  - Otherwise prompt the user for the local path

If the token doesn't match any repo in the org, list the available repos and ask the user which one they meant.

### If no repository token was given

Fall back to the current working directory:

```bash
basename "$(git -C . remote get-url origin)" .git
```

Use that as `{REPO_NAME}` and the cwd as `{REPO_PATH}`. If not in a git repo, ask the user to supply a repo name.

## Step 3: Resolve mentions

Mentions come from two places:

1. **Automatic channel mention** — always `mentions[0]` (unless `autoMentionChannel: false` in config).
2. **Extra user mentions** — from Step 1's mention tokens.

### 3a. Always add the channel mention

Skip this substep if `autoMentionChannel === false` in the config.

`mentions[0]`:

```json
{
  "id": 0,
  "mentionText": "{CHANNEL_NAME}",
  "mentioned": {
    "conversation": {
      "id": "{CHANNEL_ID}",
      "displayName": "{CHANNEL_NAME}",
      "conversationIdentityType": "channel"
    }
  }
}
```

And `<at id="0">{CHANNEL_NAME}</at>` in `body.content`. Graph's server-side resolver renders it as a channel tag based on the `mentioned` object type.

**Channel-specific behaviour:** channel mentions render correctly on most channels but occasionally come back as "Unknown User" — it depends on tenant/channel config. Verify on the first real post. If it fails, set `autoMentionChannel: false` in the config and rely on user mentions instead.

### 3b. Deduplicate the channel name from extra mentions

Before resolving user mentions, drop any token that matches (case-insensitive, `@` stripped) either:

- the channel name from config (`channelName`)
- any entry in `channelMentionAliases` (default: `["release", "channel"]`)

This way `/post-release 10 release` doesn't mention the channel twice — the automatic entry from 3a already covers it.

### 3c. User mention (team-member lookup)

**Skip this substep if no extra tokens remain after 3b.**

Get a Graph token (if not already in scope):

```bash
GRAPH_TOKEN=$(az account get-access-token --resource https://graph.microsoft.com --query accessToken -o tsv)
```

Fetch the team's members (the backing M365 group — same `teamId` as `groupId`):

```bash
curl -s -H "Authorization: Bearer $GRAPH_TOKEN" \
  "https://graph.microsoft.com/v1.0/groups/$TEAM_ID/members?\$select=id,displayName,mail,userPrincipalName&\$top=100"
```

Quote `$select`/`$top` so the shell doesn't expand them. If the response has `@odata.nextLink`, follow it and merge results (teams with 100+ members).

For each remaining token (lowercased, leading `@` stripped):

- **Exactly 1 match** (displayName starts-with token, OR local-part of mail/UPN starts-with token) → use the member's full `displayName` and `id` (AAD Object ID). Entry shape:
  ```json
  { "id": N, "mentionText": "Full Name", "mentioned": { "user": { "id": "{aadId}", "displayName": "Full Name", "userIdentityType": "aadUser" } } }
  ```
- **Multiple matches** → use `AskUserQuestion` with up to 4 candidates (show displayName + mail).
- **Zero matches** → warn the user, keep the raw `@token` as plain text (no notification).

### 3d. Build the outputs

Combine the channel mention (3a) and resolved users (3c):

1. Top-level `mentions[]` array — `mentions[0]` is the channel mention (if enabled). Subsequent entries are resolved users. Assign sequential `id`s starting at `0`.
2. Mention-line HTML string — `<at id="0">{CHANNEL_NAME}</at> <at id="1">Full Name</at> @unknown`. Resolved users use `<at id="N">DisplayName</at>`. Unresolved raw tokens stay as plain `@token` (rendered literally, no notification).

If `autoMentionChannel` is `false` and there are no extra mentions, `mentions[]` is omitted entirely and the mention-line is empty (just the attachment reference).

If the Graph call for user-mention resolution fails, fall back to raw `@token` text for the extra mentions only. The channel mention still goes through regardless. Tell the user once.

## Step 4: Find the last successful PROD release

**Key insight:** "most recently deployed to PROD" is NOT the same as "release with the newest `createdOn`". Azure DevOps classic Release pipelines redeploy existing releases on rollback, so an older Release can be what's live right now. Always sort by **PROD deployment timestamp** (`modifiedOn` on a `PROD*` environment), never by `release.createdOn`.

### 4a. Pick the release definition

If `releaseDefinitionId` is set in config, use it directly.

Otherwise, auto-discover: list definitions, then peek at each one's latest release to find one whose primary artifact's `repository.name` matches `{REPO_NAME}`:

```bash
az pipelines release definition list --org "$AZURE_DEVOPS_ORG" --project "$AZURE_DEVOPS_PROJECT" --query "[].{id:id, name:name}" --output json
```

For each definition, fetch its top release and check `artifacts[?isPrimary].definitionReference.repository.name.id`. The first matching definition is the one. If none match, tell the user and stop.

### 4b. List recent releases for the definition

```bash
az pipelines release list \
  --org "$AZURE_DEVOPS_ORG" \
  --project "$AZURE_DEVOPS_PROJECT" \
  --definition-id "$RELEASE_DEFINITION_ID" \
  --top 20 \
  --query "[].{id:id, name:name}" --output json
```

Collect the `id`s (order doesn't matter here — Step 4c determines actual deployment order).

### 4c. For each release, fetch PROD status + deployment timestamp

```bash
az pipelines release show \
  --id "$RELEASE_ID" \
  --org "$AZURE_DEVOPS_ORG" \
  --project "$AZURE_DEVOPS_PROJECT" \
  --query "{release:name, sourceVersion: artifacts[?isPrimary] | [0].definitionReference.sourceVersion.id, prodEnvs: environments[?starts_with(name, 'PROD')].{name:name, status:status, modifiedOn:modifiedOn}}" \
  --output json
```

A release counts as "successfully deployed to PROD" when **every** environment whose name starts with `PROD` has `status == "succeeded"`. Ignore `TEST*`, `DEV*`, `UAT*` etc.

(If your project uses a different naming convention — e.g. `Production` instead of `PROD` — change the JMESPath filter to match.)

For each qualifying release, compute its **PROD deployment time** = `max(modifiedOn)` across its `PROD*` environments.

### 4d. Pick the release with the latest PROD deployment time

Sort qualifying releases by computed PROD deployment time **descending** and take the first one. That's what's currently live — including after rollbacks, where a lower-numbered release can be newer by deployment time than a higher-numbered one.

Save as:
- `{LAST_PROD_SHA}` — 40-char commit SHA from `sourceVersion`
- `{LAST_PROD_NAME}` — release name (e.g. `Release-1303`)
- `{LAST_PROD_ID}` — release ID (used for the "Previous release" link)
- `{LAST_PROD_DATE}` — ISO timestamp (the computed PROD deployment time, not `release.createdOn`)

If none of the last 20 releases qualifies, widen `--top` to 50 and retry. If still none, tell the user and stop.

**Worked example (rollback scenario):**

| Release | sourceVersion | PROD CD modifiedOn | Status |
|---|---|---|---|
| Release-1310 | 861e3c24 | 2026-04-20T11:35:49 | succeeded |
| Release-1309 | 76c97d8b | 2026-04-20T12:10:33 | succeeded |
| Release-1303 | f6dd0bbb | 2026-04-20T12:36:34 | succeeded |

Naïve `createdOn`-sort would pick Release-1310. Correct answer is **Release-1303** — redeployed most recently, so commit `f6dd0bbb…` is what's live. Everything between `f6dd0bbb…` and `origin/master` is the diff the post should list.

## Step 5: List commits since last PROD

Run git against `{REPO_PATH}` (from Step 2) so the skill works regardless of cwd.

```bash
git -C "{REPO_PATH}" fetch origin master --quiet
```

List commits reachable from `origin/master` but not from the last-PROD SHA:

```bash
git -C "{REPO_PATH}" log {LAST_PROD_SHA}..origin/master --pretty=format:'%h|%s|%an' --no-merges
git -C "{REPO_PATH}" log {LAST_PROD_SHA}..origin/master --pretty=format:'%h|%s|%an' --merges
```

- If the repo uses merge-commit PR completion (verify by peeking at `git -C "{REPO_PATH}" log origin/master --merges -n 5` — Azure DevOps merge commits are named `Merged PR NNNN: ...`), list **merge commits only** so each PR appears once.
- Otherwise (squash-merge repo — no merge commits, direct commits to master), list **all non-merge commits**.

If `{LAST_PROD_SHA}` isn't in the local clone (stale fetch), run `git -C "{REPO_PATH}" fetch origin --quiet` (all refs) and retry.

For each commit parse `{shortSha}|{subject}|{author}`. Strip any trailing email/noise from author. Keep the full subject.

Format as a card-friendly bullet list (one per line):

```
- [{shortSha}] {subject} — {author}
```

If zero commits, still post the message but replace the list body with a single italic line: `No new commits since last release`.

Cap the list at **20 entries**. If more, truncate and append a final line: `… and N more commits`.

## Step 6: Build the Graph `chatMessage` payload

```json
{
  "subject": "Releasing {REPO_NAME} to PROD",
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
  "mentions": [ /* from Step 3d — OMIT entire key if none */ ]
}
```

Adaptive Card body (stringified into `attachments[0].content`):

```json
{
  "type": "AdaptiveCard",
  "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
  "version": "1.4",
  "body": [
    { "type": "TextBlock", "text": "Releasing {REPO_NAME} to PROD{COUNTDOWN_SUFFIX}", "size": "Medium", "weight": "Bolder", "wrap": true },
    { "type": "TextBlock", "text": "Previous release: [{LAST_PROD_NAME}]({LAST_PROD_URL}) ({LAST_PROD_DATE_SHORT})", "isSubtle": true, "spacing": "Small", "wrap": true },
    { "type": "TextBlock", "text": "Changes since last release", "weight": "Bolder", "spacing": "Medium", "wrap": true },
    { "type": "TextBlock", "text": "{COMMIT_LIST_MARKDOWN}", "wrap": true }
  ]
}
```

Placeholders:

- `{REPO_NAME}` — from Step 2
- `{COUNTDOWN_SUFFIX}` — ` in {X} minutes` (leading space) if minutes given, else empty
- `{LAST_PROD_NAME}` — from Step 4d
- `{LAST_PROD_URL}` — `{AZURE_DEVOPS_ORG}/{PROJECT_URL_ENCODED}/_releaseProgress?releaseId={LAST_PROD_ID}` (URL-encode spaces in project name)
- `{LAST_PROD_DATE_SHORT}` — `{LAST_PROD_DATE}` truncated to `YYYY-MM-DD`
- `{COMMIT_LIST_MARKDOWN}` — newline-joined list from Step 5. TextBlock renders `\n` as line breaks and supports inline Markdown
- `{MENTION_LINE_HTML}` — from Step 3d. If empty (no channel mention, no user mentions), `body.content` becomes just `<attachment id="card1"></attachment>` (no leading `<br>`)
- `mentions` — from Step 3d. Omit the entire key if empty

**Invariant:** every `<at id="N">` in `body.content` must have a matching entry in `mentions[]` with the same `id`, or Graph rejects the request.

## Step 7: Post to the webhook

Write a Node.js script `post-release-post.js` **in the current working directory** (not `/tmp/` — Git Bash on Windows handles it inconsistently). The script:

1. Builds the Adaptive Card as a JS object, then `JSON.stringify()`s it for the attachment content
2. Builds the full `chatMessage` payload
3. POSTs it to the webhook URL via the built-in `https` module (no external deps)

**IMPORTANT:** Use the `webhookUrl` value from `~/.claude/post-release.config.json`.

```js
const https = require('https');

const WEBHOOK = "<<<PASTE webhookUrl FROM CONFIG>>>";

const card = {
  type: "AdaptiveCard",
  $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
  version: "1.4",
  body: [
    { type: "TextBlock", text: "Releasing {REPO_NAME} to PROD{COUNTDOWN_SUFFIX}", size: "Medium", weight: "Bolder", wrap: true },
    { type: "TextBlock", text: "Previous release: [{LAST_PROD_NAME}]({LAST_PROD_URL}) ({LAST_PROD_DATE_SHORT})", isSubtle: true, spacing: "Small", wrap: true },
    { type: "TextBlock", text: "Changes since last release", weight: "Bolder", spacing: "Medium", wrap: true },
    { type: "TextBlock", text: "{COMMIT_LIST_MARKDOWN}", wrap: true },
  ],
};

const payload = {
  subject: "Releasing {REPO_NAME} to PROD",
  body: {
    contentType: "html",
    content: '{MENTION_LINE_HTML}<br><attachment id="card1"></attachment>',
  },
  attachments: [
    { id: "card1", contentType: "application/vnd.microsoft.card.adaptive", content: JSON.stringify(card), name: null, thumbnailUrl: null },
  ],
  mentions: [ /* from Step 3d — OMIT entire key if empty */ ],
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

Substitute all `{PLACEHOLDERS}` before writing. Then run:

```bash
node post-release-post.js
```

### Handle the response

- **HTTP 200/202** → success. Power Automate accepted the payload. **Verify in Teams before declaring success** — 202 only means the trigger ran; the Graph call downstream may still fail.
- **HTTP 4xx/5xx** → show the response body. Likely causes:
  - `WorkflowTriggerIsNotEnabled` → flow is saved but off. User needs to turn it on in Power Automate.
  - Signature expired / URL revoked → regenerate the trigger's HTTP POST URL and update the config file.
  - Payload schema rejected → user added a schema to the HTTP trigger. Leave **Request Body JSON Schema** empty.
- **Flow returned 202 but nothing in Teams** → Power Automate → flow → Run history → latest run → Graph step. Common causes:
  - `Forbidden` / insufficient scope → connection lacks `ChannelMessage.Send`; admin may need to consent
  - `Invalid mention id` → a `<at id="N">` has no matching `mentions[]` entry (skill bug, report)
  - `Attachment content must be a string` → card wasn't `JSON.stringify()`d (skill bug, report)

## Step 8: Confirm and clean up

```bash
rm -f post-release-post.js
```

Report back:

- ✓ Post sent to Teams channel `{CHANNEL_NAME}` (team `{teamId}`)
- Subject: `Releasing {REPO_NAME} to PROD`
- Countdown: `in X minutes` (or `none`)
- Channel mention: yes / no (based on `autoMentionChannel`)
- User mentions: resolved users (real notification) + any raw `@tokens` (plain text, no notification). Say "none" if empty.
- Previous PROD release: `{LAST_PROD_NAME}` on `{LAST_PROD_DATE_SHORT}` (commit `{shortSha}`)
- Commits included: `{count}` (or `none — no changes since last release`)

## Notes

- **Release vs. build:** this skill keys off **release pipeline completions**, not build pipeline completions. A PR merged to master produces a build artifact, but until the release pipeline's `PROD*` environments all succeed, it hasn't shipped. The commit diff reflects "merged to master but not yet in prod".
- **Multi-environment PROD:** if your pipeline has `PROD CM` and `PROD CD` (or similar), both must succeed for the release to count. If one succeeded and the other is still running or failed, skip it and try the previous release.
- **Channel mention reliability:** Graph's channel mention (`mentioned.conversation`) works on many channels but fails on others, rendering as "Unknown User". If your first real post shows that, set `autoMentionChannel: false` in `~/.claude/post-release.config.json` and the skill will stop adding it. Use user mentions instead.
- **Rollbacks:** the rollback-aware release detection (`modifiedOn`-sort in Step 4d) is essential. Azure DevOps classic Release pipelines redeploy existing releases rather than creating new ones, so `createdOn`-sort gives the wrong answer in rollback scenarios. Don't "simplify" back to `createdOn`.
