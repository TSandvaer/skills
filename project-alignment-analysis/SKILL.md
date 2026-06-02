---
name: project-alignment-analysis
description: >-
  Compare the CURRENT project's Claude setup against ANOTHER project you point at, and surface
  setup/rules worth adopting. Use this whenever the user says "project alignment analysis",
  "/project-alignment-analysis", "align my project with X", "compare my setup to <other project>",
  "what can I borrow from <project>", "see if my project can learn from <path>", or otherwise wants
  to diff their .claude config (skills, hooks, settings, CLAUDE.md rules, and — for orchestrated
  projects — agents/team roster) against a reference project and selectively adopt improvements.
  Reach for this even when the user just names another project path and asks what they could improve.
  The skill scans the target read-only, builds a ranked candidate list, lets the user decide each
  change via Adopt/Adapt/Skip popups (it NEVER adopts anything automatically), assembles a verified
  plan doc, and only applies after an explicit go-ahead. It also emits a reverse-handoff markdown when
  the target project could itself benefit from the current project's setup.
---

# Project Alignment Analysis

Diff the **current project** (where this session runs) against a **target project** (a path the user
supplies), find setup/rules the current project could adopt, and apply only what the user explicitly
approves. The skill is fully generic — it has no hard-coded project paths and works for any
current/target pair, orchestrated or not.

## Core promises (do not violate)

These came directly from the skill's owner and are non-negotiable enforcement points:

1. **The target project is READ-ONLY.** Never write, edit, move, or delete anything under the target
   path. Every mutation lands in the *current* project (plus the reverse-handoff doc the user carries
   over by hand). If both projects happen to be the same path, refuse and ask for a distinct target.
2. **Never adopt anything automatically.** Every candidate change is decided by the user through an
   `AskUserQuestion` popup. No silent copies, no "obvious wins" applied without a click.
3. **Never weaken production-protection.** If the current project's `CLAUDE.md` contains a
   production-protection / "never touch PROD" rule, no adopted candidate may conflict with, dilute,
   duplicate, or reorder it. Auto-exclude any candidate that touches it and say why.
4. **Add/append only — never overwrite.** Adopting never silently replaces an existing skill, hook,
   setting, or rule. A same-name / same-purpose collision is surfaced as an **Adapt** decision (merge
   or rename), never an in-place overwrite.
5. **Final apply needs an explicit go-ahead.** Per-candidate approval feeds a plan doc; the assembled
   plan is then verified and requires one final confirm-to-apply popup before anything is written.

If any project rule (the current project's `CLAUDE.md`, user global instructions) conflicts with this
skill, the project rule wins. In particular, respect Plan mode and Auto mode write-gates during the
apply phase.

## The flow at a glance

```
0. Resolve current + target projects
1. Inventory both (.claude/* + CLAUDE.md; + any prior reverse-handoff in target)  [target read-only]
2. Compare across 4 dimensions → ranked candidates
3. Print the ranked summary report                 [whole landscape first]
4. Per-candidate Adopt / Adapt / Skip popups       [themed, ≤4 per batch]
5. Assemble plan doc in .claude/alignment/
6. Self-verify pass (internal + vs current project + prod-protection)
7. Final "proceed to apply?" gate → apply approved changes
8. Reverse-handoff md (only if real current→target candidates exist)
```

---

## Step 0 — Resolve the two projects

- **Current project** = the session's working directory (repo root). Confirm it has a `.claude/`
  and/or `CLAUDE.md`; if neither exists, tell the user there's nothing to align and stop.
- **Target project** = the path passed as the skill argument. If no path was given, ask for it via a
  short free-text prompt ("Which project should I compare against? Give me its absolute path.").
- Verify the target path exists and is a directory. If it has no `.claude/` and no `CLAUDE.md`, report
  that there's nothing to compare and stop.
- If current and target resolve to the same path, refuse and ask for a different target.

Record both absolute paths; you'll reference them throughout.

## Step 1 — Inventory both projects

Read (never write the target). For **each** project capture:

| Dimension | What to read |
|-----------|--------------|
| Skills | `\.claude/skills/*/SKILL.md` — folder name + `description` + a sense of the body |
| Hooks | `\.claude/hooks/*` — filenames + what each hook does (read the script) |
| Settings | `\.claude/settings.json`, `\.claude/settings.local.json` — hook wiring, permissions, env |
| CLAUDE.md rules | `CLAUDE.md` — split into discrete rules/sections by heading |
| Agents/team | `\.claude/agents/*.md` + any `team/` (or `.claude/team/`) roster files |

Use Glob + Read + Grep (the dedicated tools) rather than shell `find`/`cat` so this works on any OS.

**Orchestration test** (decides whether the agents/team dimension runs): a project is "orchestrated"
if `\.claude/agents/` contains role `.md` files **OR** a `team/` directory with a `STATE.md` exists.
Run the agents/team comparison **only when BOTH projects are orchestrated**. If the current project
isn't orchestrated, skip that dimension entirely and note it in the report ("agents comparison skipped
— current project is not orchestrated").

**Prior reverse-handoff awareness (cross-check, never trust).** A previous alignment run in the
*opposite* direction may have left a handoff doc in the target's tree at
`\.claude/alignment/handoff-to-<current-basename>-*.md` (where `<current-basename>` is the CURRENT
project's folder name). Glob for it; if one or more exist, read the most recent. That doc is the other
project's pre-computed view of what the current project could adopt — i.e. a **preview of this run's
forward candidates**. Treat it as a *hint to verify, never ground truth*: it is a dated snapshot and
either tree may have moved since it was written. Its job is to inform Steps 2–3, not to short-circuit
them:

- **Corroborate** — candidates your own independent inventory also finds gain a confidence signal.
- **Catch misses** — handoff items your pass would otherwise overlook get surfaced (but verify each
  against the *live* trees before listing it — the handoff may cite a path/line that has since moved).
- **Retire stale items** — handoff entries that are already present in the current project, or no
  longer apply, get noted as such rather than re-proposed.

Do NOT let the handoff *replace* the independent inventory — the entire value of a second pass is
computing the candidates yourself and then reconciling against the handoff. Reading a file under the
target is allowed; core promise #1 forbids *writing* the target, not reading it.

Walk all four dimensions and produce two candidate sets:

- **Forward candidates** (target → current): things the current project could adopt.
- **Reverse candidates** (current → target): things the target lacks that the current project has
  (feeds the Step 8 handoff doc).

For each dimension:

- **Skills.** Target-only skills → "add" candidate. Skills present in both → diff the two `SKILL.md`
  files; if the target's is meaningfully better (clearer triggering, extra steps, bundled scripts,
  safer guardrails), surface a "improve existing skill" candidate describing the specific delta.
- **Hooks + settings.** Target-only hooks → "add" candidate (note what wires them in settings).
  Shared hooks → diff for improvements. Settings: surface permission/env/hook-wiring patterns the
  current project lacks. Be conservative with `settings.local.json` (machine-specific) — flag, don't
  push.
- **CLAUDE.md rules.** Map target rules to current rules by topic. Surface (a) target rules with no
  current equivalent, and (b) target phrasings that are clearly stronger/clearer than the current
  equivalent. **Exclude anything touching production-protection** per core promise #3.
- **Agents/team** (orchestrated-both only). Compare role rosters. Suggest agents to **add** (a useful
  role the current team lacks) or **replace/adapt** (target's version of a shared role is better
  structured). Never propose deleting a current role without a replacement rationale.

Give every forward candidate a **value rank** — High / Medium / Low — based on: reusability across
future tasks, how non-obvious it is, and how cleanly it fits the current project. Rank drives ordering
in the report and the popup batches.

For each candidate, capture: dimension, title, value rank, the source artifact (target path/snippet),
the proposed change to the current project, and any conflict/risk note.

## Step 3 — Print the ranked summary report

Before any decision popup, show the whole landscape so the user can see everything first. Use this
structure:

```
# Project Alignment Analysis
Current: <current-abs-path>   |   Target: <target-abs-path>
Orchestrated: current=<yes/no>, target=<yes/no>  → agents comparison: <ran/skipped>

## Forward candidates (target → current), N total
### Skills
- [High]  <title> — <one-line what + why valuable>
- [Med]   ...
### Hooks + settings
- ...
### CLAUDE.md rules
- ...
### Agents / team   (only if both orchestrated)
- ...

## Reverse candidates (current → target), M total
- <title> — <one-line>     (these go into the handoff doc if you proceed)

## Auto-excluded
- <title> — excluded because <touches prod-protection / target-only machine config / etc.>
```

Keep each line terse. This report is the map; the popups are the decisions.

**If a prior reverse-handoff was found in Step 1**, tag each forward candidate inline with its handoff
status — `[corroborated by target handoff]`, `[handoff-only — verified vs live tree]`, or
`[not in handoff]` — and add a one-line `## Handoff cross-check` note above the forward candidates
summarising agreement vs divergence (e.g. "target's 2026-05-31 handoff predicted 3 candidates: this
pass corroborates 2, adds 1 it missed, judges 1 already-present"). **Divergence is the most
informative signal — surface it, don't bury it.** If no handoff was found, omit the cross-check note
entirely (don't print an empty section).

## Step 4 — Per-candidate decisions (Adopt / Adapt / Skip)

Run `AskUserQuestion` popups, **grouped by dimension**, **one popup at a time**, **≤4 candidates per
popup** (the tool caps at 4 questions per call). Order by value rank (High first). Each candidate is
ONE question with exactly these options:

- **Adopt** — take it as-is into the plan.
- **Adapt** — take it, but the user notes a modification (rename to match convention, trim a section,
  merge into an existing rule). Capture their note for the plan.
- **Skip** — don't include it.

For "improve existing skill" / same-name collisions, the Adapt option means "merge/rename, don't
overwrite" (core promise #4). Phrase the question so the collision is explicit.

Carry the user's Adapt notes forward verbatim — they shape what the plan and the apply step do.

## Step 5 — Assemble the plan doc

Write `\.claude/alignment/alignment-plan-<target-name>-<runtag>.md` in the **current** project. Create
the `\.claude/alignment/` directory if missing. `<target-name>` = the target folder's basename;
`<runtag>` = a short stamp the user can read (ask for/derive a date if needed — do not invent one).

The plan doc lists every **Adopted** and **Adapted** candidate with: dimension, exact change, the
concrete artifact (file to add with its full content, or the exact CLAUDE.md text to append, or the
settings keys to add), Adapt notes, and source reference. Skipped/excluded items get a short trailing
list so the run is auditable. See `references/templates.md` for the exact plan-doc template.

## Step 6 — Self-verify pass (the double-check)

Before offering to apply, review the assembled plan with fresh eyes and confirm ALL of:

1. **No internal conflicts** — two candidates don't both edit the same line, add the same file, or
   contradict each other.
2. **No conflict with the current project** — each change is additive and coherent with what's already
   there (don't re-add a rule the current project already states; don't add a hook the current
   settings can't wire).
3. **Production-protection intact** — re-scan the plan for anything that weakens/duplicates/reorders
   the current project's prod-protection rule. If found, pull it from the plan and report it.
4. **Add/append only** — confirm nothing overwrites an existing artifact; collisions must be Adapt
   (merge/rename), not replace.

Report the verification result as a short checklist (each item ✓ or ✗ with a note). If anything is
✗, fix the plan (or drop the offending candidate) and re-verify. Only proceed to Step 7 when all
green.

## Step 7 — Final apply gate, then apply

Show an `AskUserQuestion` popup: "Plan verified (all green). Apply these N changes to the current
project now?" with **Apply all / Apply a subset / Don't apply (keep plan doc only)**.

- **Apply all** → make the writes (current project only): create new skill folders, add hook files +
  wire them in settings, append approved CLAUDE.md text under the right section, add agents, etc.
  Respect Plan/Auto mode write-gates.
- **Apply a subset** → ask which items (popup), apply only those, note the rest stay in the plan doc.
- **Don't apply** → leave the plan doc in place; nothing is written. The user can apply later by hand
  or in a follow-up.

After applying, summarize exactly what changed (file list + one line each) and where the plan doc
lives.

## Step 8 — Reverse-handoff doc (only if real candidates exist)

If Step 2 found genuine **reverse candidates** (things the target could adopt from the current
project), write `\.claude/alignment/handoff-to-<target-name>-<runtag>.md` in the current project. It's
written *for the other project's session* — phrase it as a ready-to-act brief: what to adopt, why, and
the concrete artifact/snippet to copy. Tell the user the file path so they can hand it over. If there
are no real reverse candidates, skip the file and say so explicitly — don't write an empty artifact.

---

## Notes on staying generic

- Never hard-code project names or paths in logic — always derive from the resolved current/target
  paths. The skill must behave identically for any pair.
- `team/` may live at the repo root or under `.claude/`; check both.
- Some projects use a tracker (ClickUp / Azure DevOps) — agent-roster suggestions should be about
  roles/structure, not tracker specifics, unless the user asks.
- Detailed templates (report, plan doc, handoff doc) live in `references/templates.md` — read it when
  you reach Steps 3, 5, and 8.
