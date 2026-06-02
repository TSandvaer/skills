# post-release

Posts a **"Releasing {repo} to PROD"** message to a Microsoft Teams release channel via a Power Automate webhook, so the team is notified before a production deploy. The target channel is always @mentioned so every subscriber gets pinged.

The message lists **every commit pushed to `master` since the last successful production deployment** (sourced from the Azure DevOps release pipeline), so reviewers can see exactly what's going out.

## When to use it

- "post-release" / "announce release" / "post release to Teams"
- Any request to notify the team before a production deploy.

## Inputs

- **Repository name** *(optional)* — which repo is being released.
- **Minutes until release** *(optional)* — lead-time hint included in the message.
- **Extra @mentions** *(optional)* — resolved to full names via Microsoft Graph.

## How it works

1. Determines the last successful production deployment from the Azure DevOps release pipeline.
2. Collects every `master` commit pushed since then.
3. Posts the formatted release announcement (with the channel @mention and commit list) to Teams via the Power Automate webhook.

## Setup

Webhook URL and configuration live in this skill's export/setup material — see [`export/SETUP.md`](export/SETUP.md). Related: [`post-pr`](../post-pr) for PR-review announcements.
