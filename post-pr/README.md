# post-pr

Posts a **"PR ready for review"** message to a Microsoft Teams channel via a Power Automate webhook. Give it a PR ID (and, optionally, extra people to @mention) and it announces the PR to the reviewers.

Extra @mentions are resolved to full names via Microsoft Graph against the backing M365 group, so the Teams post tags the right people.

## When to use it

- "post-pr" / "announce PR" / "post to Teams"
- Any request to notify reviewers in Teams after creating a PR.

## How it works

1. Takes a PR ID and optional additional @mention targets.
2. Resolves @mention names to full identities via Microsoft Graph (M365 group lookup).
3. Posts the formatted "PR ready for review" message to the configured Teams channel through a Power Automate webhook.

## Setup

The webhook URL and related configuration live in this skill's export/setup material — see [`export/SETUP.md`](export/SETUP.md). Related: [`post-release`](../post-release) for production-deploy announcements.
