---
name: sponsor-questions-walkthrough
description: Walk the sponsor through accumulated open orchestrator-side decisions one at a time, using AskUserQuestion popups with concrete options + per-option descriptions so the sponsor can click instead of typing freeform answers. Use whenever the sponsor says "sponsor questions walkthrough", "/sponsor-questions-walkthrough", "sponsor gate questions", "/sponsor-gate-questions", "walk me through your questions", "what do you need from me", "what are your open questions", "any open questions", "any gates you need me for", "what gates need my approval", "go through your questions", or otherwise asks for a structured pass through pending sponsor decisions or gate approvals. Questions come from BOTH live-session context (the bulk — decisions the orchestrator deferred during the current session) AND persisted sources (team/STATE.md "pending sponsor" markers, .claude/away-queue.md, .claude/decisions-while-away.md entries with Status: pending review, ClickUp tickets flagged for sponsor). Replaces the freeform-bullet-list pattern with focused one-question-at-a-time popups; surfaces only items that genuinely need sponsor input, never fabricates filler.
---

# Sponsor Questions Walkthrough

Sponsor-invoked workflow that walks them through every open orchestrator-side decision one at a time as `AskUserQuestion` popups — concrete options they can click instead of freeform answers they have to type.

## When to use

Trigger when the sponsor signals they want a structured pass through pending decisions. Common phrasings:

- "sponsor questions walkthrough" / `/sponsor-questions-walkthrough`
- "sponsor gate questions" / `/sponsor-gate-questions`
- "walk me through your questions" / "go through your open questions"
- "what do you need from me" / "what are your open questions" / "any open questions"
- "any gates you need me for" / "what gates need my approval" — gate-approval framing for the same workflow
- After a long away-window: "I'm back, what's open?"

Do NOT trigger when:

- The sponsor asks a single one-off question — answer it directly without the walkthrough scaffolding.
- The sponsor is asking a question OF the orchestrator (reverse direction) — that's not a walkthrough.
- You have zero open questions worth surfacing. Say so plainly ("Nothing open for you right now") rather than fabricating filler — the trust cost of inventing questions is higher than the convenience of always having something.

## Sources for open questions

Pull from BOTH live context AND persisted files. Live context is usually the largest and most-relevant bucket — open questions tend to accumulate during the current orchestration session as the orchestrator hits the never-auto-decide list (strategic priority shifts, subjective-feel calls, externally-visible actions, billing/infra) or fails the foundation-citable gate.

**Live context (current session) — usually the bulk:**

- Decisions the orchestrator has flagged "needs sponsor" during the session but not yet surfaced
- Items where the four-gate test in the user-global "Orchestrator autonomy" rule FAILED — anything that couldn't cite a real foundation, or hit the never-auto-decide list
- Forks in the road encountered during dispatch / merge / review where the orchestrator deferred
- Sponsor-domain calls reached during the session (priority calls, scope cuts, subjective polish)
- Anything you've internally been thinking "I should ask Thomas about X" without yet asking

**Persisted sources:**

- `team/STATE.md` — any "Pending sponsor" / "Awaiting sponsor" markers or open items in role sections
- `.claude/away-queue.md` — items queued specifically for sponsor return
- `.claude/decisions-while-away.md` — entries with `Status: pending review` (these are autonomous decisions logged for sponsor audit; usually NOT walkthrough material unless the orchestrator is genuinely uncertain and wants confirmation)
- ClickUp tickets the orchestrator has commented on with "needs sponsor decision" or equivalent

Read the persisted sources in parallel at skill start (multiple Read / MCP calls in one tool round). Deduplicate against live-context items — don't ask the same question twice because it shows up in both buckets.

## Pre-flight: show the runway

Before launching the first `AskUserQuestion`, emit a terse main-thread list of the questions you'll walk through. One line per question, in the order you'll ask. The sponsor sees the full runway so the first popup doesn't feel out of nowhere, and so they know how many decisions are coming.

Example:

```
I have 4 open questions for you. Walking through one at a time:
1. M3-04 ship-or-hold (NITs follow-up timing)
2. Iris dashboard color-palette direction (warm vs cool)
3. Whether to merge M2-09 retro doc before or after M3-04 ships
4. Reviewer routing on PR #51 (Felix is busy on M2-04 NITs)
```

If only 1 question, skip the runway preamble and go straight to the popup. If more than ~6, ask the sponsor whether they want the full pass now or prioritized triage of the top N first.

## Per-question: AskUserQuestion contract

One `AskUserQuestion` call per question. Do NOT batch 4 questions into one call — the sponsor wants focused decisions, not a wall of popups. The tool supports 1–4 questions per call; this skill always uses 1.

**Question text** — complete sentence ending in `?`. Specific, not generic. State the full context inline so the sponsor doesn't have to scroll back to remember what the issue was.

- Bad: "Should we ship M3-04?"
- Good: "M3-04 has 2 NITs from Maya's review (button hover state, focus ring). Ship now and file an M3-04b follow-up ticket, or hold M3-04 until the NITs are addressed in the same PR?"

**Header** — short label (max 12 chars), e.g. "Ship M3-04", "Color palette", "Reviewer".

**Options (2–4 per question, mutually exclusive)** — each option must:

- Be a concrete action — the label carries the consequence. The sponsor should be able to read just the label and know what happens if they pick it.
  - Bad: "Yes" / "No" / "Proceed" / "Don't proceed"
  - Good: "Ship M3-04 today, file M3-04b NITs follow-up ticket" / "Hold M3-04 until NITs land in same PR (delays ship by ~1 cycle)"
- Include a `description` field that spells out the implication — what happens next, what gets deferred, what risk you accept, who has to do something.
- Be genuinely distinct. Don't pad with near-duplicates to reach 4. Two real choices = two options.

**Recommended option** — when the orchestrator has a confident, defensible recommendation grounded in real evidence (something close to foundation-citable, even though the question failed some gate), place that option FIRST and append `(Recommended)` to the label. State the why in the description ("Recommended because Maya peer-reviewed APPROVE_WITH_NITS, CI green, NITs are non-blocking polish per [[sponsor-trusts-tactical-defaults]]").

When the orchestrator does NOT have a confident recommendation — especially on subjective-feel calls (color palette, voice tone, motion feel) — do NOT mark any option as recommended. Neutrality is honest. False confidence on subjective calls trains the sponsor to ignore the (Recommended) signal.

**"Other" is automatic** — `AskUserQuestion` auto-adds an "Other" choice so the sponsor can type a freeform answer if no option fits. Do NOT include a manual "Other" in your options list — the tool's UI provides it.

**Don't ask compound questions** — split them. "Should we ship M3-04 today AND start M3-05?" is two questions, ask them sequentially with the second's options conditional on the first's answer.

## Sequencing rules

- Ask in priority order: time-critical first (CI-gated merges blocking team, dispatch-blocked items, deadline-driven), then strategic, then routine.
- If question B depends on the answer to question A (e.g. "if we hold M3-04, who reviews M3-05's reroute?"), defer B until A is answered. The dependent question may be reframed or dropped entirely based on A's answer — that's expected.
- If a question becomes stale during the walkthrough (the sponsor's answer to an earlier question invalidates it), drop it and announce the drop in one line ("Q4 is now moot given your answer to Q1 — skipping").
- If the sponsor's "Other" freeform answer to question A introduces a new follow-up question that wasn't in the runway, queue it at the end of the walkthrough and update the runway.

## Persisting answers immediately

After each `AskUserQuestion` returns, persist the decision BEFORE moving to the next question. The user-global "Sponsor-feedback immediate-persistence" rule already mandates this — the skill is enforcing it at every question, not adding a new requirement.

Where the decision lands depends on what it was:

- **Durable preference applying to future sessions** → memory entry (project-scoped via project memory dir, or user-global per the scope of the preference)
- **Team-level project decision** → append to `team/DECISIONS.md` (or project equivalent)
- **Current-state-relevant** (changes what the next orchestrator should do) → update `team/STATE.md`'s "Resume next-action" header
- **Action item the team needs to track** → ClickUp ticket comment, or a new ticket if scope warrants
- **Autonomous-decision audit class** (the question was already in `decisions-while-away.md` as `pending review`) → flip its `Status:` to `accepted` or `reversed by <sponsor> <date>`
- **Process-class signal** (a recurring failure mode the sponsor named) → append to `team/log/process-incidents.md`

Multiple targets are OK — one decision can land in DECISIONS.md AND update STATE.md AND comment on a ticket. Persist all relevant targets in the same tool round before the next popup.

If the sponsor picked "Other" and typed freeform, the freeform text IS the canonical decision — capture it verbatim in the persistence targets, don't paraphrase it into one of the rejected options.

## Closure

After the last question, emit a terse summary — one bullet per question + where the decision was persisted. The closure stays terse (per the user-global main-thread-bloat discipline); the persistence files carry the detail.

Example:

```
Walkthrough complete. 4 decisions persisted:
- Ship M3-04 today, M3-04b NITs ticket filed (ClickUp + STATE.md updated)
- Color palette: warm direction (Iris brief updated, memory entry added)
- Merge M2-09 retro before M3-04 ships (STATE.md sequencing line)
- Reroute PR #51 review to Maya (PR comment posted, ClickUp reviewer field flipped)
```

If the sponsor used "Other" on any question, surface that explicitly so they know the orchestrator captured the freeform answer rather than slotting it into a near-miss option.

If any decision unblocks an immediate next action (dispatch, merge, ticket flip), do it in the same tool round as the closure summary — don't make the sponsor say "ok now go do those things."

## Anti-patterns to avoid

- **Don't batch.** One question per `AskUserQuestion` call. Batching loses focus and forces the sponsor into compound decisions.
- **Don't recommend mechanically.** "(Recommended)" only goes on the option you'd actually defend if asked why — not on the first option by default. False recommendations train the sponsor to ignore the signal.
- **Don't bury the question.** The `question` field shows above the options; put the full context there so the sponsor doesn't have to scroll back.
- **Don't fabricate options.** If only two real choices exist, ask 2 options — padding to 4 with near-duplicates wastes the sponsor's eye.
- **Don't fabricate questions.** If you don't have a real open question, say "nothing open" — don't invent filler to make the walkthrough feel substantive. The Never-fabricate rule applies to question existence, not just to URL/ID values.
- **Don't skip persistence.** Capturing the sponsor's click without writing it down means the next session loses the decision. Persist before the next popup.
- **Don't ask questions you can auto-decide.** Re-run the four-gate test (reversible / foundation-citable / not on never-auto-decide list / loggable) before adding a question to the walkthrough — if it passes, decide it, log to `decisions-while-away.md`, and don't surface it. Walking through auto-decidable items wastes the sponsor's attention and erodes trust in the walkthrough's signal.
- **Don't ask compound questions.** "Should we ship M3-04 AND reprioritize M3-05?" is two questions. Split them.
- **Don't fabricate concrete values in option labels or descriptions.** PR numbers, ticket IDs, SHAs, file paths, NIT counts — all must come from a real source you fetched in this session. If you don't have the value, rephrase the option to not need it, or fetch it before launching the popup. Per user-global Never-fabricate rule.

## Composition with other rules

- **Orchestrator autonomy** (user-global) — the walkthrough is the channel for questions that FAIL the four-gate test. Questions that PASS the test should be auto-decided and logged, not walked through. If the audit reversal rate on auto-decisions starts climbing (>15%), tighten what auto-decides — don't shift those into the walkthrough as a workaround.
- **Sponsor-feedback immediate-persistence** (user-global) — the persistence step in this skill operationalizes that rule at every question.
- **Main-thread bloat discipline** (user-global) — the pre-flight runway and closure summary stay terse (1 line per question). Avoid narrating between popups; the popups themselves carry the conversation. Don't write "Great, moving to Q2…" between calls.
- **Never fabricate, never guess** (user-global + project) — every concrete detail in question text, option labels, and descriptions (PR #, file path, ticket ID, count, SHA) must come from a real source. If you don't have the value, fetch it before launching the popup, or rephrase the option to avoid the fabricated specific.
- **Cross-session continuity** (user-global) — decisions reached in the walkthrough that change "what the next orchestrator should do" MUST update STATE.md's "Resume next-action" header in the same persistence round.

## Worked example

Sponsor: "walk me through your questions"

Orchestrator's runway (main thread, terse):

```
I have 3 open questions for you. Walking through one at a time:
1. PR #88 hover-state polish — ship as-is or address Maya's NIT first?
2. Iris dashboard tile motion — subtle fade or sharper cut?
3. M2-09 retro doc — promote learnings to .claude/docs now or batch with M3 retro?
```

Then `AskUserQuestion` #1:

- header: "PR #88"
- question: "Maya's review on PR #88 flagged the hover-state focus ring as a NIT (line 142 of webview/Tile.tsx). CI is green and the rest is APPROVE. Ship today and file the NIT as a follow-up ticket, or hold and absorb the NIT into PR #88 in a new push?"
- options:
  - label: "Ship today, file #88b NITs follow-up (Recommended)", description: "Maya marked APPROVE_WITH_NITS, focus-ring is non-blocking polish per [[sponsor-trusts-tactical-defaults]]. Frees Maya to start M3-04 review immediately. Follow-up ticket auto-filed."
  - label: "Hold #88, absorb NIT in same PR", description: "Felix re-pushes with the focus-ring fix, Maya re-reviews. Adds ~1 cycle (~30-60 min) before merge. Cleaner history but no real shipping benefit since the NIT is non-blocking."

After the sponsor clicks one, persist (ClickUp + STATE.md updated as relevant), then launch `AskUserQuestion` #2, etc.

After Q3, closure summary with one bullet per decision + where it was persisted.

## Skipping or pausing

If at any popup the sponsor types "skip" / "I don't know yet" / "ask me later" via the Other option, mark that question as deferred:

- Append it to `.claude/away-queue.md` for the next walkthrough
- Note the defer in the closure summary

If the sponsor says "stop, that's enough for now" during the walkthrough, halt and surface the remaining questions in the closure with a note that they're carried over. Don't push through if the sponsor wants out.
