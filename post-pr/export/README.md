# post-pr skill

A Claude Code skill that posts a "PR ready for review" message to a Microsoft Teams channel via a Power Automate webhook. Takes an Azure DevOps PR ID and optional `@mentions`, resolves the mentions against the Teams team's backing M365 group, and posts an Adaptive Card with real (notifying) mentions.

## What it does

When you run `/post-pr 12345 Oliver Thomas`, the skill will:

1. Look up PR `12345` in Azure DevOps (title, author, branches, linked PBI, description).
2. Match `Oliver` and `Thomas` as partial display-name queries against the configured Teams team's members via Microsoft Graph.
3. Build a Graph `chatMessage` payload with an Adaptive Card attachment and real `<at>` mentions.
4. POST it to your Power Automate flow, which forwards it to the Teams channel as you (the flow owner).

The resulting post in Teams contains the PR title, author, branches, linked work item, an excerpt of the description, and an "Open PR" button — plus real notifications for the people you mentioned.

## Install

```bash
# Copy (or clone) this folder to your Claude Code skills directory:
# macOS/Linux:
cp -r . ~/.claude/skills/post-pr/

# Windows (Git Bash):
cp -r . "$HOME/.claude/skills/post-pr/"
```

Then restart Claude Code (or start a new session) so the skill is picked up.

## First run

The first time you invoke `/post-pr`, the skill detects that `~/.claude/post-pr.config.json` doesn't exist and runs an **interactive onboarding**. It will:

1. Check that `az` (Azure CLI) and `node` are installed.
2. Check that you're logged in to Azure (`az login` if not).
3. List the Teams you're a member of (via Graph) and ask which one to post into.
4. List that team's channels and ask which channel.
5. Walk you through creating your own Power Automate flow (so posts appear under your identity) and ask you to paste the resulting webhook URL.
6. Save everything to `~/.claude/post-pr.config.json`.

After that, `/post-pr <id>` works directly. To re-run onboarding, delete the config file.

For the manual setup reference (or if onboarding fails), see [SETUP.md](SETUP.md).

## Usage

```
/post-pr 19647                   # no mentions
/post-pr 19647 Oliver            # one mention
/post-pr 19647 Oliver thomas     # two mentions
/post-pr 19647 @Oliver, @thomas  # commas and @ are fine
```

Mentions are resolved as partial (starts-with) display-name matches. If a token matches multiple people, the skill will ask you to pick. If it matches nobody, the raw `@token` is included as plain text (no notification) and the skill warns you.

## Requirements

- **Azure CLI** (`az`) — used to fetch PR/PBI data and get a Microsoft Graph token
- **Node.js** — used to build the request payload
- **Power Automate** access in your tenant — to create the forwarding flow (onboarding guides you through this)
- Membership of the Teams team you want to post into (Graph permissions are delegated through `az`, so you need to be able to read the group's members)

## Files

- [SKILL.md](SKILL.md) — the skill itself (what Claude Code reads)
- [SETUP.md](SETUP.md) — manual setup reference (Power Automate flow recipe, config schema, troubleshooting)
- [README.md](README.md) — this file

## Limitations

- **Channel mentions aren't supported.** Teams channel thread IDs aren't valid mention targets through Power Automate + Graph; they render as "Unknown User". Mention individuals instead.
- **Teams-tag mentions aren't supported.** Would require a scope the Teams connector doesn't hold by default.
- **Plain-text `@tokens` don't notify.** If a name can't be resolved, the skill still includes it as literal text, but Teams won't ping anyone.
- **Single channel per install.** The config file holds one team + one channel. If you post to multiple channels, you'll need separate Power Automate flows and you'd have to swap the config file (or fork the skill).
