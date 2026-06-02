---
name: post-release
description: Post a "Releasing {repo} to PROD" message to a Microsoft Teams release channel via a Power Automate webhook. The target channel is always @mentioned so every subscriber gets notified. Lists every commit pushed to master since the last successful production deployment (sourced from Azure DevOps release pipeline). Takes optional repository name, optional minutes-until-release, and optional extra @mentions (resolved to full names via Microsoft Graph). Use when the user says "post-release", "announce release", "post release to Teams", or wants to notify the team before a production deploy.
---

# Post Release to Teams

Announce an imminent production deployment in a Teams release channel. The post lists the commits pushed to `master` since the previous successful PROD deployment (so reviewers can see at a glance what's going out), mentions any named individuals, and optionally shows a countdown ("in X minutes").

The message is posted through a Power Automate flow that forwards a **Microsoft Graph `chatMessage`** payload to `POST https://graph.microsoft.com/v1.0/teams/{teamId}/channels/{channelId}/messages`. Same pattern as the `post-pr` skill — see that skill for background on why Graph directly (instead of the Power Automate "Post card" action) and why real mentions require `msteams` entities + `<at>` tags.

## Hardcoded configuration

These IDs are baked in so the skill is shareable as-is:

| Setting | Value |
|---|---|
| **Webhook URL** | `https://default8e392e4f0a5340428d7a4d39211207.12.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/62fef4b186dd4294b0b04a2f5b417063/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=qhxG-YT0ROpoRuZ-P6HIvzkdblG1CBkntbLWthoCxVI` |
| **Team ID (groupId)** | `f4f5dc0b-9f6e-4f2e-91f3-dee000a32ff7` |
| **Team name** | 110 - EDC Kædekontor |
| **Channel ID** | `19:a1aadc2df7f54da8af64ec96ee6207ee@thread.tacv2` |
| **Channel name** | Release |
| **Tenant ID** | `8e392e4f-0a53-4042-8d7a-4d3921120712` |
| **Azure DevOps org** | `https://dev.azure.com/edc-group` |
| **Azure DevOps project** | `Relaunch - Charlie Tango` |

### Setting up the Power Automate flow

This skill needs its own flow — the `post-pr` flow is hardcoded to the `Operational team` channel and cannot be reused. Follow the same pattern described in `post-pr/SKILL.md` under "Forking for another user", with these differences:

- URI in the **Send en Microsoft Graph HTTP-anmodning** step:
  `https://graph.microsoft.com/v1.0/teams/f4f5dc0b-9f6e-4f2e-91f3-dee000a32ff7/channels/19:a1aadc2df7f54da8af64ec96ee6207ee@thread.tacv2/messages`
- Body: `triggerBody()` (Expression — passes the payload straight through)
- Save the flow, copy the generated **HTTP POST URL** into the `Webhook URL` row above.

## Step 1: Parse input

Extract from the user's arguments (all optional, order-independent):

- **Repository** — an alias from the mapping table below. Distinguishes the three field types:
  - Repository alias: non-numeric token that matches a row (case-insensitive) in the table. Examples: `website`, `core`, `rest.business`.
  - Minutes: a purely numeric token, optionally with an `m`/`min`/`minutes` suffix. Examples: `15`, `15m`, `15 min`, `15 minutes`.
  - Mention: anything else (optionally `@`-prefixed). Space- or comma-separated.
- **Minutes until release** — integer. If present, include " in X minutes" in the card header.
- **Extra mentions** — names to tag. Each is a partial display-name query.

Invocation examples (the target channel is always @mentioned — user-supplied arguments only add *extra* mentions on top):

- `/post-release` → current repo (from cwd), no countdown, just the channel mention
- `/post-release website` → EDC.EDCDK.Website repo, no countdown, channel mention
- `/post-release website 15` → "Releasing EDC.EDCDK.Website to PROD in 15 minutes" + channel mention
- `/post-release core 10 Oliver thomas` → EDC.Core repo, "in 10 minutes", channel mention + two user mentions
- `/post-release 15 Oliver` → current repo, "in 15 minutes", channel mention + one user mention
- `/post-release website 10 release` → identical to `/post-release website 10` — the `release` token is deduplicated against the automatic channel mention, not added twice.

## Step 2: Determine the repository

### If a repository alias was given in Step 1

Map it to the directory and DevOps repo name using this table (same mapping as `start-branch`):

| Input (case-insensitive) | Directory | DevOps repo name |
|---|---|---|
| `website`, `edcdk`, `edc.edcdk.website` | `C:\Trunk\EDC.EDCDK.Website` | `EDC.EDCDK.Website` |
| `core`, `edc.core` | `C:\Trunk\EDC.Core` | `EDC.Core` |
| `business`, `rest.business`, `edc.rest.business` | `C:\Trunk\EDC.REST.Business` | `EDC.REST.Business` |
| `rest.core`, `edc.rest.core` | `C:\Trunk\EDC.REST.Core` | `EDC.REST.Core` |
| `settings`, `edc.settings` | `C:\Trunk\EDC.Settings` | `EDC.Settings` |

If the alias doesn't match any row, list `C:\Trunk\` contents and ask the user which one they meant.

Set `{REPO_NAME}` = DevOps repo name. Set `{REPO_PATH}` = directory.

### If no repository alias was given

Fall back to the current working directory:

```bash
basename "$(git -C . remote get-url origin)" .git
```

Use that as `{REPO_NAME}` and the current directory as `{REPO_PATH}`. If not in a git repo, ask the user to supply a repository alias from the table above.

## Step 3: Resolve mentions

Mentions come from two places:

1. **Automatic channel mention** — always included. Every post mentions the target channel so everyone subscribed to it gets notified, including people who haven't opted in to normal channel notifications.
2. **Extra user mentions** — whatever the user passed on the command line.

### 3a. Always add the channel mention

The channel mention entry is always `mentions[0]`:

```json
{
  "id": 0,
  "mentionText": "Release",
  "mentioned": {
    "conversation": {
      "id": "19:a1aadc2df7f54da8af64ec96ee6207ee@thread.tacv2",
      "displayName": "Release",
      "conversationIdentityType": "channel"
    }
  }
}
```

The HTML tag in `body.content` is `<at id="0">Release</at>`. Graph's server-side resolver picks whether to render it as a user or channel tag based on the `mentioned` object type.

**Confirmed working** on the `Release` channel in `110 - EDC Kædekontor` (verified 2026-04-21): renders as a real channel tag and notifies all 127 team members. The `post-pr` skill's "Unknown User" warning applies to `Operational team` specifically — don't assume it generalises to every channel.

### 3b. Deduplicate the channel name from extra mentions

Before resolving user mentions, drop any token that matches the channel name (case-insensitive, `@` stripped). If the user wrote `/post-release website 10 release`, the `release` token is already covered by the automatic channel mention — skip it so the channel isn't mentioned twice.

Also deduplicate known aliases for the channel — e.g. `channel`, `kanal`, `release` — they all mean "mention the release channel" and should be collapsed into the single entry from 3a.

### 3c. User mention (team-member lookup)

If the token isn't a channel name, query the **release channel's backing team group** (team ID from the config table):

```bash
az account get-access-token --resource https://graph.microsoft.com --query accessToken -o tsv
# save as GRAPH_TOKEN

curl -s -H "Authorization: Bearer $GRAPH_TOKEN" \
  'https://graph.microsoft.com/v1.0/groups/f4f5dc0b-9f6e-4f2e-91f3-dee000a32ff7/members?$select=id,displayName,mail,userPrincipalName&$top=100'
```

Single-quote the URL so `$select` / `$top` aren't expanded by the shell. Team has ~100+ members — raise `$top` or page via `@odata.nextLink` if needed.

For each token (lowercased, leading `@` stripped):
- **Exactly 1 match** (displayName starts-with token, OR local-part of mail/UPN starts-with token) → use the member's full `displayName` and `id` (AAD Object ID). Entry shape:
  ```json
  { "id": N, "mentionText": "Full Name", "mentioned": { "user": { "id": "{aadId}", "displayName": "Full Name", "userIdentityType": "aadUser" } } }
  ```
- **Multiple matches** → use `AskUserQuestion` with up to 4 candidates (show displayName + mail).
- **Zero matches** → warn the user, keep the raw `@token` as plain text (no notification).

### 3d. Build the outputs

Combine the results:

1. Top-level `mentions[]` array — `mentions[0]` is always the channel mention from 3a. Subsequent entries (`id: 1, 2, …`) are resolved users from 3c.
2. Mention-line HTML string — `<at id="0">Release</at> <at id="1">Thomas Sandvær Jørgensen</at> @unknown`. Resolved mentions use `<at id="N">DisplayName</at>`. Unresolved raw tokens stay as plain `@token`.

The channel mention is always present — `body.content` therefore always starts with `<at id="0">Release</at><br>` followed by the attachment reference.

If the Graph call for user-mention resolution fails, fall back to raw `@token` text for the extra mentions only and tell the user once that names weren't verified. The channel mention still goes through regardless.

## Step 4: Find the last successful PROD release

**Key insight:** "most recently deployed to PROD" is NOT the same as "release with the newest `createdOn`". Azure DevOps classic Release pipelines redeploy existing releases on rollback, so an older Release can be what's live right now. Always sort by **PROD deployment timestamp** (`modifiedOn` on a `PROD*` environment), never by `release.createdOn`.

The skill assumes one release definition per repo. Find it by matching the current repo name against each release definition's artifacts.

### 4a. List release definitions in the project

```bash
az pipelines release definition list \
  --org https://dev.azure.com/edc-group \
  --project "Relaunch - Charlie Tango" \
  --query "[].{id:id, name:name}" --output json
```

### 4b. Pick the matching definition

For each definition, inspect recent releases and find one whose primary artifact's `repository.name` equals `{REPO_NAME}`. Simplest path: take the first definition and peek at its latest release (Step 4c); if `artifacts[?isPrimary].definitionReference.repository.name.id` matches `{REPO_NAME}`, use it. Otherwise try the next definition.

If no definition matches, tell the user — they may need to supply the definition ID manually.

### 4c. List recent releases for the definition

```bash
az pipelines release list \
  --org https://dev.azure.com/edc-group \
  --project "Relaunch - Charlie Tango" \
  --definition-id {DEFINITION_ID} \
  --top 20 \
  --query "[].{id:id, name:name}" --output json
```

Collect the `id`s into a working set (order here doesn't matter — Step 4d determines actual deployment order).

### 4d. For each release, fetch PROD status + deployment timestamp

```bash
az pipelines release show \
  --id {RELEASE_ID} \
  --org https://dev.azure.com/edc-group \
  --project "Relaunch - Charlie Tango" \
  --query "{release:name, sourceVersion: artifacts[?isPrimary] | [0].definitionReference.sourceVersion.id, prodEnvs: environments[?starts_with(name, 'PROD')].{name:name, status:status, modifiedOn:modifiedOn}}" \
  --output json
```

A release counts as "successfully deployed to PROD" when **every** environment whose name starts with `PROD` has `status == "succeeded"`. Environments named `PROD`, `PROD CM`, `PROD CD` all qualify; `TEST01`, `DEV`, `UAT CM`, `UAT CD` are ignored.

For each qualifying release, compute its **PROD deployment time** = `max(modifiedOn)` across its `PROD*` environments (use the latest one, since CD typically finishes after CM).

### 4e. Pick the release with the latest PROD deployment time

Sort qualifying releases by their computed PROD deployment time **descending** and take the first one. That is the release currently live in PROD — including after rollbacks, where a lower-numbered release can be newer by deployment time than a higher-numbered one.

Save as `{LAST_PROD_SHA}` (40-char commit), `{LAST_PROD_NAME}` (e.g. `Release-1303`), `{LAST_PROD_ID}` (release ID), `{LAST_PROD_DATE}` (ISO — use the computed PROD deployment time, not `release.createdOn`).

If none of the last 20 releases qualifies, widen `--top` to 50 and retry. If still none, tell the user and stop.

**Worked example (rollback scenario):**

| Release | sourceVersion | PROD CD modifiedOn | Status |
|---|---|---|---|
| Release-1310 | 861e3c24 | 2026-04-20T11:35:49 | succeeded |
| Release-1309 | 76c97d8b | 2026-04-20T12:10:33 | succeeded |
| Release-1303 | f6dd0bbb | 2026-04-20T12:36:34 | succeeded |

Naïve `createdOn`-sort would pick Release-1310. Correct answer is **Release-1303** — it was redeployed (rolled back to) most recently, so commit `f6dd0bbb…` is what's actually live. Everything between `f6dd0bbb…` and `origin/master` is the diff the post should list.

## Step 5: List commits since last PROD

Run all git commands against `{REPO_PATH}` (from Step 2) so the skill works even when invoked from outside that repo's directory.

Make sure the local refs are up to date:

```bash
git -C "{REPO_PATH}" fetch origin master --quiet
```

Detect the merge style used in the **range since last PROD**, not by peeking at arbitrary recent history. A repo can have ancient true-merge commits (e.g. from years ago) alongside modern squash-merges — a blind `git log --merges -n 5` can return old merges and wrongly classify the repo as merge-commit style, causing the range to appear empty.

First, check whether the range contains any merge commits:

```bash
git -C "{REPO_PATH}" log {LAST_PROD_SHA}..origin/master --merges --pretty=format:'%h'
```

- **Any output** → the range uses merge-commit PR completion. List **merge commits only** (so each PR appears once):

  ```bash
  git -C "{REPO_PATH}" log {LAST_PROD_SHA}..origin/master --pretty=format:'%h|%s|%an' --merges
  ```

- **No output** → the range uses squash-merge (or direct pushes). List **all non-merge commits**:

  ```bash
  git -C "{REPO_PATH}" log {LAST_PROD_SHA}..origin/master --pretty=format:'%h|%s|%an' --no-merges
  ```

Either way, commit subjects are typically `Merged PR NNNNN: ...` — Azure DevOps uses that subject line for both merge styles, so the user-visible output looks the same.

If `{LAST_PROD_SHA}` isn't in the local clone (the user hasn't fetched lately), the `git log` range will fail. If so, run `git -C "{REPO_PATH}" fetch origin --quiet` (all refs) and retry.

For each commit parse `{shortSha}|{subject}|{author}`. Strip any trailing `(thjo)` / email noise from author. Keep the full subject.

Format result as a card-friendly bullet list (one per line):

```
- [{shortSha}] {subject} — {author}
```

If there are zero commits, still post the message but replace the list body with a single italic line: "No new commits since last release".

Cap the list at **20 entries** to keep the card readable. If more, truncate and append a final line: `… and N more commits`.

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
  "mentions": [
    // one entry per resolved user from Step 3 — OMIT entire key if none
  ]
}
```

Adaptive Card body (stringified into `attachments[0].content`):

```json
{
  "type": "AdaptiveCard",
  "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
  "version": "1.4",
  "body": [
    {
      "type": "TextBlock",
      "text": "Releasing {REPO_NAME} to PROD{COUNTDOWN_SUFFIX}",
      "size": "Medium",
      "weight": "Bolder",
      "wrap": true
    },
    {
      "type": "TextBlock",
      "text": "Previous release: [{LAST_PROD_NAME}]({LAST_PROD_URL}) ({LAST_PROD_DATE_SHORT})",
      "isSubtle": true,
      "spacing": "Small",
      "wrap": true
    },
    {
      "type": "TextBlock",
      "text": "Changes since last release",
      "weight": "Bolder",
      "spacing": "Medium",
      "wrap": true
    },
    {
      "type": "TextBlock",
      "text": "{COMMIT_LIST_MARKDOWN}",
      "wrap": true
    }
  ]
}
```

Placeholder rules:

- **`{REPO_NAME}`** — from Step 2.
- **`{COUNTDOWN_SUFFIX}`** — if minutes were given, ` in {X} minutes` (leading space). Otherwise empty string. Examples:
  - `Releasing EDC.EDCDK.Website to PROD`
  - `Releasing EDC.EDCDK.Website to PROD in 15 minutes`
- **`{LAST_PROD_NAME}`** — from Step 4e, e.g. `Release-1303`.
- **`{LAST_PROD_URL}`** — `https://dev.azure.com/edc-group/Relaunch%20-%20Charlie%20Tango/_releaseProgress?releaseId={RELEASE_ID}`.
- **`{LAST_PROD_DATE_SHORT}`** — ISO date truncated to `YYYY-MM-DD`.
- **`{COMMIT_LIST_MARKDOWN}`** — newline-joined list of `- [{shortSha}] {subject} — {author}` lines. Adaptive Card TextBlock renders `\n` as line breaks and supports inline Markdown for links if needed. Keep it plain text per line (no commit URLs) — shorter and easier to scan.
- **`{MENTION_LINE_HTML}`** — from Step 3. If no mentions at all, omit this and the leading `<br>` so `body.content` is just `<attachment id="card1"></attachment>`.
- **`mentions`** — list from Step 3. Omit the key entirely if empty.

Every `<at id="N">` in `body.content` must have a matching `mentions[]` entry with the same `id`, or Graph rejects the request.

## Step 7: Post to the webhook

As with `post-pr`, build and POST via a small Node.js script written to the **skill's base directory** (the path shown at the top of this file as "Base directory for this skill: …"). Keeping it in the skill folder avoids polluting the user's project and eliminates the risk of accidentally committing it. Do NOT write it to the current working directory or `/tmp/` — Git Bash on Windows handles `/tmp` inconsistently.

```js
const https = require('https');

// Paste the Webhook URL from the config table above verbatim:
const WEBHOOK = "<<<PASTE WEBHOOK URL FROM CONFIG TABLE HERE>>>";

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
  mentions: [
    // one entry per resolved user from Step 3 — OMIT this key entirely if empty
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
node "{SKILL_BASE_DIR}/post-release-post.js"
```

### Handle the response

- **HTTP 200/202** → success. **Verify in Teams before declaring success** — 202 only means Power Automate accepted the trigger; the downstream Graph call may still fail.
- **HTTP 4xx/5xx** → show the response body. Likely causes: expired/revoked webhook signature, trigger schema rejection, or the flow not yet created (if the `Webhook URL` placeholder hasn't been replaced).
- **Flow returned 202 but nothing in Teams** → open Power Automate → flow → Run history → latest run → Graph step. Common causes: missing `ChannelMessage.Send` scope on the owner's connection; mismatched `<at id>` / `mentions[]` id; un-stringified card content.

## Step 8: Confirm and clean up

```bash
rm -f "{SKILL_BASE_DIR}/post-release-post.js"
```

Report back to the user with a short summary:

- ✓ Post sent to Teams channel "Pipelines" (team "110 - EDC / CT - edc.dk relaunch")
- Subject: `Releasing {REPO_NAME} to PROD`
- Countdown: "in X minutes" (or "none")
- Mentions: each resolved user (real notification) and any raw tokens (plain text, no notification). If none, say so.
- Previous PROD release: `{LAST_PROD_NAME}` on `{LAST_PROD_DATE_SHORT}` (commit `{shortSha}`)
- Commits included: {count} (or "none — no changes since last release")

## Notes

- **Release vs. build:** this skill keys off **release pipeline completions**, not build pipeline completions. A PR merged to master produces a build artifact, but until the release pipeline's `PROD *` environments all succeed, it hasn't shipped. The commit diff reflects "merged to master but not yet in prod".
- **Multi-environment PROD:** "PROD CM" and "PROD CD" both succeeding means CM and CD are live. If one succeeded and the other is still running or failed, that release doesn't count — skip and try the previous one.
- **Release definition per repo:** the current `Relaunch - Charlie Tango` project has a single release definition (`EDC.DK Deploy` → `EDC.EDCDK.Website` repo). If this ever changes, Step 4b's heuristic (match `artifacts[?isPrimary].definitionReference.repository.name.id` against `{REPO_NAME}`) handles multiple definitions — no skill changes needed.
- **Mentions:** same plumbing as `post-pr`. If Graph is unreachable or the token lacks scope, raw `@tokens` fall through as plain text (no notification). Make this explicit in the summary so nobody thinks they were pinged when they weren't.
