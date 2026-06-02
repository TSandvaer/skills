# post-release skill

A Claude Code skill that posts a "Releasing {repo} to PROD" message to a Microsoft Teams release channel via a Power Automate webhook. Lists every commit pushed to `master` since the last successful production deployment (sourced from the Azure DevOps release pipeline — rollback-aware). The target channel is always @mentioned so everyone subscribed to it gets notified.

## What it does

When you run `/post-release 15`, the skill will:

1. Read your personal config (`~/.claude/post-release.config.json`) for the Teams channel, Azure DevOps org/project, and webhook URL.
2. Find the most recent release whose PROD environments all succeeded, sorted by **actual deployment timestamp** (so rollbacks work correctly — an older Release redeployed later counts as current).
3. List every commit on `origin/master` since that release's source commit, formatted as `- [sha] Merged PR NNNN: title — Author`.
4. Build a Graph `chatMessage` payload with an Adaptive Card attachment plus a channel mention + any extra user mentions.
5. POST it to your Power Automate flow, which forwards it to Teams as you (the flow owner).

The resulting post has:
- **Subject:** `Releasing {repo} to PROD`
- **Body:** `@{channel}` mention, then the card
- **Card:** "Releasing {repo} to PROD[ in X minutes]" header, previous release link, and a "Changes since last release" list

## Install

```bash
# macOS/Linux:
cp -r . ~/.claude/skills/post-release/

# Windows (Git Bash):
cp -r . "$HOME/.claude/skills/post-release/"
```

Then restart Claude Code (or start a new session) so the skill is picked up.

## First run

The first time you invoke `/post-release`, the skill detects that `~/.claude/post-release.config.json` doesn't exist and runs an **interactive onboarding**. It will:

1. Check that `az` (Azure CLI), `az` `azure-devops` extension, and `node` are installed.
2. Check that you're logged in to Azure.
3. Ask for your Azure DevOps org URL and project name.
4. List the release pipeline definitions in the project and let you pick (or skip — the skill can auto-discover per repo at runtime).
5. List the Teams you're a member of and ask which one to post into.
6. List that team's channels and ask which one is your release channel.
7. Walk you through creating your own Power Automate flow (so posts appear under your identity) and ask you to paste the resulting webhook URL.
8. Save everything to `~/.claude/post-release.config.json`.

After that, `/post-release` works directly. To re-run onboarding, delete the config file.

For the manual setup reference (or if onboarding fails), see [SETUP.md](SETUP.md).

## Usage

```
/post-release                        # current repo (from cwd), no countdown, channel mention only
/post-release 15                     # "...in 15 minutes", channel mention only
/post-release MyRepo                 # specific DevOps repo name, no countdown
/post-release MyRepo 15              # specific repo + countdown
/post-release 15 Oliver thomas       # current repo + countdown + two user mentions
/post-release MyRepo 10 Oliver       # everything together
```

The arguments are order-independent:

- A token matching a **DevOps repository name** (from the org's repo list) sets the repo.
- A numeric token (optionally suffixed with `m`/`min`/`minutes`) sets the countdown.
- Anything else is treated as an extra `@mention` — resolved as a partial display-name match against the team's members.

If no repository token is given, the skill falls back to `basename $(git remote get-url origin)` from the current working directory. If you're not in a git repo, you'll be asked.

The **target channel is always mentioned automatically**. If you pass the channel name as an argument (e.g. `release`), it's deduplicated so the channel isn't mentioned twice.

## Requirements

- **Azure CLI** (`az`) with the `azure-devops` extension — used to fetch release pipeline data and a Microsoft Graph token
- **Node.js** — used to build the request payload
- **Power Automate** access in your tenant — to create the forwarding flow (onboarding guides you through this)
- Membership of the Teams team you want to post into
- Access to the Azure DevOps project and release definition (`Build Read`, `Release Read` on the target project)

## Files

- [SKILL.md](SKILL.md) — the skill itself (what Claude Code reads)
- [SETUP.md](SETUP.md) — manual setup reference (config schema, Power Automate flow recipe, troubleshooting)
- [README.md](README.md) — this file

## Limitations

- **Assumes classic Release pipelines with environments whose names start with `PROD`.** If you use YAML multi-stage pipelines or different naming (e.g. `Production`), edit `SKILL.md` Step 4 to match your setup.
- **Channel mentions may render as "Unknown User" on some channels.** Verified working on some channels, fails on others — depends on tenant/channel config. If the first real post shows "Unknown User", set `autoMentionChannel: false` in the config and fall back to naming individuals.
- **Plain-text `@tokens` don't notify.** If a user-mention name can't be resolved, the skill still includes it as literal text, but Teams won't ping anyone.
- **Single channel per install.** The config file holds one team + one channel. If you post to multiple channels, you'll need separate Power Automate flows and separate config files (or fork the skill).
- **Teams-tag mentions aren't supported.** Would require a scope the Teams connector doesn't hold by default.
