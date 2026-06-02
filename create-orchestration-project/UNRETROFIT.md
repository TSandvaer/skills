# Unretrofit Mode — Remove Orchestration From a Registered Project

Invoked via `create-orchestration-project unretrofit <path>` (or `<project-slug>` — both work). Surgically removes the orchestration scaffold from a project listed in `KNOWN_PROJECTS.md`, preserving the sponsor's own additions by default.

This is the inverse of `retrofit` (and partially of `new`). It does NOT undo any commits the sponsor made on persona branches — those are the sponsor's work product. It removes the scaffolding so the repo returns to a non-orchestrated state.

## Preconditions (hard gates, checked before any action)

The skill aborts with a clear message if any of the following fail:

1. **`<path>` (or `<slug>`) is in `KNOWN_PROJECTS.md`.** Lookup by path or slug. If not found: "Project not registered. Unretrofit only operates on registered projects — if you want to manually delete `.claude/`, do that with your file manager."
2. **`<path>` exists and is a git repo.** If `<path>` was deleted off disk, just remove the `KNOWN_PROJECTS.md` entry and exit (skill confirms with sponsor first).
3. **Main worktree is clean.** Verify `git -C <path> status --porcelain` is empty. If dirty, abort with the dirty list and message: "Working tree has uncommitted changes. Stash, commit, or discard them, then retry."
4. **All persona worktrees are clean.** For each worktree in `git -C <path> worktree list`, run the same check. If any are dirty, abort with the full list — sponsor decides per-worktree how to resolve.
5. **No persona branches have unmerged commits on `<role>/idle`.** For each `<role>/idle` branch, check `git -C <path> log <default-branch>..<role>/idle` — if non-empty, abort with the list and message: "Branch `<role>/idle` has commits not on `<default-branch>`. Merge them or `--force-unretrofit` to discard. **Discarding loses sponsor work.**"

## Flags

- `unretrofit <path>` — surgical default (described below).
- `unretrofit <path> --nuclear` — wipes `<path>/.claude/` entirely, including sponsor's `.claude/docs/` additions and any non-template files. Requires double-confirm.
- `unretrofit <path> --keep-worktrees` — leaves persona worktrees + branches in place (sponsor wants to manually inspect first). Other removal still proceeds.
- `unretrofit <path> --force-unretrofit` — overrides precondition #5 (allows discarding unmerged persona-branch commits). Sponsor explicitly accepts data loss.

Per the Q1 decision: **no `--delete-clickup` flag**. The skill never touches the tracker (ClickUp list, AzDO board, etc.). Sponsor deletes those manually if desired.

## Inventory step (always runs first)

Before the confirmation block, the skill enumerates exactly what it will and will not touch. This is the audit step:

### Files to delete (skill-managed, always)

Defined by the file paths in `template/` (excluding `template/CLAUDE.md` — never deleted, see below):

- `<path>/.claude/settings.json` (skill-installed — if the sponsor added custom keys, `unretrofit` strips the skill-added keys and rewrites; if `--nuclear`, delete the whole file)
- `<path>/.claude/agents/` (entire directory — template-managed)
- `<path>/.claude/hooks/` (entire directory — template-managed)
- `<path>/.claude/decisions-while-away.md` (template-managed)
- `<path>/.claude/away-queue.md` (template-managed)
- `<path>/.claude/auto-status.state` (machine state, always safe to delete)
- `<path>/.claude/skills/maintain-docs/` (skill-installed sub-skill)

### Files to preserve (always, in surgical mode)

- `<path>/CLAUDE.md` (sponsor's project brief — strip the orchestration block by hand; see "CLAUDE.md handling" below)
- `<path>/.claude/docs/` (sponsor's accumulated knowledge — per Q3 decision, preserved by default)
- `<path>/.claude/CLAUDE.md.proposed` (left as-is — if it exists, it's a retrofit artifact the sponsor still owes a merge)
- Any non-template files under `<path>/.claude/` (sponsor's custom additions — preserved)
- `<path>/.gitignore` (the auto-status line is stripped; everything else preserved)

### `--nuclear` mode adds these to the deletion list

- `<path>/.claude/docs/` (sponsor's docs — WIPED)
- All non-template files under `<path>/.claude/`
- `<path>/CLAUDE.md.proposed` (if present)

### Worktrees + branches (always, unless `--keep-worktrees`)

Enumerated from `git worktree list` and `git branch --list '*/idle'`:

- Worktrees: every directory in `git worktree list` matching the `<worktree-base>-<role>-wt` pattern recorded in `KNOWN_PROJECTS.md`'s `personas` field.
- Branches: every `<role>/idle` branch in the personas list.
- Order: remove worktrees FIRST, then delete branches (cannot delete a checked-out branch).

### Tracker references (always, in all modes)

- Stripped from `<path>/CLAUDE.md` and `<path>/.claude/agents/*.md` ONLY if those files are being modified anyway (in `--nuclear` they're deleted; in surgical, `CLAUDE.md` is left to the sponsor and `.claude/agents/` is deleted wholesale).
- The actual ClickUp list / AzDO board itself is NEVER touched. Sponsor cleans up manually if desired.

### KNOWN_PROJECTS.md entry

Always removed at the end of the run.

## CLAUDE.md handling (surgical mode)

Per the Q2 spirit (refuse-overwrite on retrofit), the skill is similarly cautious on unretrofit. `CLAUDE.md` lives at `<path>/CLAUDE.md` and may have been hand-merged by the sponsor — automatic editing would risk clobbering sponsor content.

Therefore: **the skill does NOT modify `<path>/CLAUDE.md` directly.** Instead, after the surgical removal completes, the skill emits a "Manual edit required" note in the summary:

```
Manual cleanup of CLAUDE.md required:
- The orchestration brief is still in <path>/CLAUDE.md. Remove the sections that
  refer to orchestrators, personas, dispatch, tracker, and worktree map — those
  are no longer applicable. Sections covering project goals, architecture, and
  any sponsor-specific rules should remain.
- A diff of the original (pre-retrofit) CLAUDE.md is not stored — sponsor recalls
  what was there before, or uses `git log -p -- CLAUDE.md` to recover history.
```

In `--nuclear` mode, the skill ALSO refuses to edit CLAUDE.md (same reason — sponsor content risk). The "--nuclear" flag affects `.claude/`, not the project root.

## Phase 7-style confirmation block

Same hard-gate as bootstrap mode. Cannot be skipped or relaxed.

```
About to unretrofit <path> — REVIEW CAREFULLY:

Mode: <surgical | nuclear | surgical + --keep-worktrees | surgical + --force-unretrofit>

Files to DELETE (<N> files):
  - <path>/.claude/agents/  (directory)
  - <path>/.claude/hooks/  (directory)
  - <path>/.claude/decisions-while-away.md
  - <path>/.claude/away-queue.md
  - <path>/.claude/auto-status.state
  - <path>/.claude/skills/maintain-docs/  (directory)
  - <path>/.claude/settings.json  (skill-managed; sponsor's custom keys will be stripped, sponsor keys preserved unless --nuclear)
  [in --nuclear:]
  - <path>/.claude/docs/  (directory)
  - <path>/CLAUDE.md.proposed (if present)

Files to PRESERVE:
  - <path>/CLAUDE.md  (manual cleanup required — see summary)
  - <path>/.claude/docs/  (sponsor knowledge — preserved by default)
  - <path>/.gitignore  (auto-status line stripped; rest preserved)
  - All non-template files under <path>/.claude/

Worktrees to REMOVE (<K>):
  - <worktree-base>-nora-wt
  - <worktree-base>-felix-wt
  - ...

Branches to DELETE (<K>):
  - nora/idle
  - felix/idle
  - ...

[if precondition #5 warnings:]
  WARNING: <role>/idle has <N> unmerged commits not on <default-branch>.
  Without --force-unretrofit, the skill REFUSES TO CONTINUE.

Tracker references:
  - ClickUp list <id> / AzDO board <name>: NOT TOUCHED. Sponsor deletes manually if desired.

KNOWN_PROJECTS.md:
  - Entry "<slug>" will be removed.

Proceed? Y / cancel / show <file> / change <thing>
```

Refuse to act on anything except `Y`. On `--nuclear`, also require a second `Y` after re-displaying the docs-deletion warning.

## Execute (after Y in Phase 7-style block)

Execute in this order to avoid git complaints:

1. **Remove worktrees** — for each persona worktree path: `git -C <path> worktree remove <worktree-path>`. If `--force-unretrofit`, append `--force` to handle dirty trees. Skip in `--keep-worktrees` mode.
2. **Delete branches** — for each `<role>/idle`: `git -C <path> branch -D <role>/idle`. Skip in `--keep-worktrees` mode.
3. **Delete files** — per the inventory list. Order doesn't matter; use `Bash(rm -rf ...)` on directories where appropriate.
4. **Strip skill-managed keys from `<path>/.claude/settings.json`** (surgical mode):
   - Read the file.
   - Remove permission entries that match `template/settings.json`'s allowlist (after substitution).
   - Remove the SessionStart hook entries that point to template hook scripts.
   - Remove the Stop hook entry that points to `maintain-docs-stop.sh`.
   - Preserve all sponsor's other keys. Write back.
   - If after stripping the file would be empty or trivial (just `{}`), delete it entirely.
5. **Strip auto-status line from `<path>/.gitignore`** — remove the line `.claude/auto-status.state` if present. Preserve everything else.
6. **Commit the changes** — `git -C <path> add -A && git -C <path> commit -m "Unretrofit: remove orchestration scaffold"`. The sponsor can `git revert HEAD` if they change their mind.
7. **Remove the entry from `KNOWN_PROJECTS.md`** — delete the `## <slug>` section and its body.
8. **Emit the post-execution summary**:
   - List of what was deleted (counts: files, dirs, worktrees, branches).
   - Manual cleanup reminder for `CLAUDE.md` (see CLAUDE.md handling).
   - Tracker manual-cleanup reminder.
   - Confirmation that `KNOWN_PROJECTS.md` entry was removed.

## Edge cases

### `<path>` is gone from disk

If the sponsor deleted the project directory directly before unretrofitting:
- Precondition #2 fails. Skill offers: "Project directory not found on disk. Remove the `KNOWN_PROJECTS.md` entry only (no other cleanup possible)? Y / cancel."
- On Y, just delete the entry and exit.

### Sponsor's `settings.json` only has skill-managed content

After stripping, the file might be `{}` or just `{ "env": {} }`. Skill detects this and deletes the file entirely rather than leaving a stub.

### A persona branch was renamed by the sponsor

If `git branch --list 'felix/idle'` returns nothing but the worktree still exists, the skill surfaces "Branch `felix/idle` not found — worktree present but branch renamed/deleted. Will remove worktree only." Sponsor confirms.

### Multiple personas share a worktree base path (shouldn't happen but check)

If `git worktree list` shows two worktrees in the persona-base-path pattern, abort with "Worktree layout doesn't match KNOWN_PROJECTS — manual cleanup required. Won't auto-remove."

---

## Hard rules (unretrofit-specific)

- **Never delete `<path>/CLAUDE.md`.** It belongs to the sponsor; manual cleanup only.
- **Never call `mcp__clickup__delete_list` or `az boards` deletion.** Tracker resources are sponsor-managed.
- **Never operate on a dirty worktree without `--force-unretrofit`.** Precondition #4 is the safety net.
- **Never delete `<path>/.claude/docs/` in surgical mode.** Sponsor accumulated that knowledge over the project's life.
- **Never proceed past the Phase 7-style block without `Y`.** Same gate as bootstrap.
- **Refuse to unretrofit a project not in `KNOWN_PROJECTS.md`.** The registry is the source of truth for what's "skill-managed" — without an entry, the skill doesn't know which personas / worktrees / files to remove cleanly.
