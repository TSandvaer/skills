# Known Orchestration Projects

Registry of orchestrated Claude Code projects bootstrapped via this skill (or registered manually via `create-orchestration-project register <path>`, or retrofitted via `create-orchestration-project retrofit <path>`). The skill maintains this file so:

1. `port-improvements <project-name>` can locate a project's `.claude/` and diff it against `template/`.
2. `unretrofit <project-name>` can locate the worktrees, branches, and tracker references to clean up.
3. Future skill updates have a list of existing projects to scan for pattern improvements.
4. Cross-project naming collisions can be caught (e.g. two projects both registering "alpha" as a slug).

## Entry schema

Each entry is a `##` heading with the project's kebab-case slug, followed by:

- **path** — absolute path to the project root on this machine
- **repo-url** — full GitHub/GitLab/etc. URL (or `local-only` if no remote)
- **tracker-type** — one of: `clickup` | `azure-devops` | `linear` | `jira` | `github-issues` | `none`
- **tracker-config** — a nested block whose fields depend on `tracker-type`:
  - `clickup`: `list-id`, `workspace-id`, `space-id`, `space-name`, `status-workflow` (ordered, case-sensitive list)
  - `azure-devops`: `org-url`, `project`, `process-template` (e.g. `Scrum` / `Agile` / `CMMI` / `Basic`), `area-path`, `iteration-path`, `board-name`, `work-item-types` (e.g. `Product Backlog Item`, `Task`), `status-workflow` (ordered, case-sensitive list)
  - `linear` / `jira` / `github-issues`: `placeholder-only` (full schemas not wired yet)
  - `none`: no tracker; agents skip status-flip blocks
- **personas** — comma-separated list of persona slugs in the roster
- **bootstrap-mode** — `new` | `retrofit` | `manually-registered`
- **created-at** — YYYY-MM-DD when registered
- **notes** — free-text. Pattern improvements, deviation from template, anything future-maintenance should know.

---

## Entries

## claudeteam

- **path:** `c:\Trunk\PRIVATE\ClaudeTeam`
- **repo-url:** `https://github.com/TSandvaer/ClaudeTeam.git`
- **tracker-type:** `clickup`
- **tracker-config:**
  - list-id: `901523520912`
  - workspace-id: `90151646138`
  - space-id: `90156932495`
  - space-name: `TSandvaer Development`
  - status-workflow: `to do` → `in progress` → `in review` → `complete`
- **personas:** nora (Project Lead), iris (UX Designer), felix (Senior Dev — extension host), maya (Senior Dev — webview), sage (QA), bram (Research Consultant)
- **bootstrap-mode:** `new`
- **created-at:** 2026-05-23
- **notes:** Pattern source for this skill's `template/`. ClaudeTeam was the first project bootstrapped under this orchestration model; the skill's templates were extracted from its `.claude/` at the time of skill creation. Future template upgrades should preferentially merge from ClaudeTeam's evolution.
