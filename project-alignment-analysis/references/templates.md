# Templates

Concrete output shapes for the report, the plan doc, and the reverse-handoff doc. Adapt freely — these
are scaffolds, not rigid forms — but keep the headings so the artifacts are skimmable and auditable.

---

## 1. Summary report (Step 3, printed to chat)

```markdown
# Project Alignment Analysis
Current: <current-abs-path>
Target:  <target-abs-path>
Orchestrated: current=<yes|no>, target=<yes|no>  →  agents comparison: <ran|skipped (reason)>

## Forward candidates (target → current) — N total

### Skills
- [High] <title> — <what it adds + why it's valuable here>
- [Med]  <title> — ...

### Hooks + settings
- [High] <title> — ...

### CLAUDE.md rules
- [Med]  <title> — <the gap it fills / the stronger phrasing it offers>

### Agents / team        (omit section entirely if not both-orchestrated)
- [High] add role "<name>" — <responsibility the current team lacks>
- [Med]  adapt "<shared-role>" — <how target's version is better structured>

## Reverse candidates (current → target) — M total
- <title> — <one-line>  (→ handoff doc if you proceed)

## Auto-excluded
- <title> — <reason: touches prod-protection | machine-specific local config | already present>
```

---

## 2. Plan doc (Step 5 → `.claude/alignment/alignment-plan-<target>-<runtag>.md`)

```markdown
# Alignment Plan — adopt from <target-name>
Generated: <runtag>   |   Current: <current-abs-path>   |   Target: <target-abs-path>
Status: PENDING VERIFICATION

## Decisions
| # | Dimension | Title | Decision | Adapt note |
|---|-----------|-------|----------|------------|
| 1 | skill     | ...   | Adopt    | —          |
| 2 | claude.md | ...   | Adapt    | rename X→Y |

## Changes to apply (current project only)

### 1. <title>  [Adopt]
- **Action:** add new skill folder `.claude/skills/<name>/`
- **Source:** `<target-abs-path>/.claude/skills/<name>/SKILL.md`
- **Content:** <full file content to write, or "copy verbatim from source">
- **Risk/conflict:** none

### 2. <title>  [Adapt]
- **Action:** append to `CLAUDE.md` under section "<heading>"
- **Source:** `<target-abs-path>/CLAUDE.md` § <heading>
- **Adapt note:** <user's modification>
- **Exact text to append:**
  ```
  <the rule text, with the adaptation applied>
  ```
- **Risk/conflict:** <e.g. none / verify no overlap with existing rule "Z">

## Self-verification (Step 6)
- [ ] No internal conflicts
- [ ] No conflict with current project
- [ ] Production-protection intact
- [ ] Add/append only (no overwrites)

## Skipped / excluded (audit trail)
- <title> — Skip (user)
- <title> — Excluded (prod-protection)
```

When verification passes, flip `Status: PENDING VERIFICATION` → `Status: VERIFIED — awaiting apply
go-ahead`, and after applying → `Status: APPLIED <runtag>` with the file list.

---

## 3. Reverse-handoff doc (Step 8 → `.claude/alignment/handoff-to-<target>-<runtag>.md`)

Written for the *target* project's future session. Make it self-contained and copy-pasteable.

```markdown
# Handoff: setup <current-name> suggests <target-name> could adopt
From: <current-abs-path>
To:   <target-abs-path>
Generated: <runtag>

These are setup/rules the current project has that <target-name> appears to lack. Each is optional —
review and adopt selectively in the target project's own session (ideally via its own alignment pass
so nothing is taken blindly).

## Candidates

### 1. <title>  [<dimension>]
- **Why it might help <target-name>:** <reasoning>
- **What to add:** <concrete artifact — skill folder / hook + wiring / CLAUDE.md rule text / agent role>
- **Source (in <current-name>):** `<current-abs-path>/<path>`
- **Snippet:**
  ```
  <the actual content to copy>
  ```

### 2. <title>  [<dimension>]
- ...
```
