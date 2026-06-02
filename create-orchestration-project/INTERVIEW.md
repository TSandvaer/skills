# Interview Script

The sponsor interview is the load-bearing part of `create-orchestration-project`. Vague answers produce vague scaffolds. This document specifies the questions and the cite-back rule that gates each phase.

## How to use this script

1. Ask questions one at a time. Wait for an answer before moving on.
2. **Never** ask all the questions in one block — the sponsor will skim and answer at a level of abstraction that's useless. One question per turn forces specifics.
3. After each phase's question block, apply the **cite-back rule** below. Refuse to advance until the sponsor confirms.
4. Allow the sponsor to say "I don't know yet — that's a Phase 1 decision for the Project Lead." That's a valid answer; capture it and move on. But don't accept it as cover for vagueness on the questions that NEED concrete answers (V1 in-scope, out-of-scope, primary user).

## The cite-back rule

At the end of each phase, echo the sponsor's answers in concrete terms:

> "Here's what I heard: end-product is `<echo>`. Primary user is `<echo>`. Daily-use scenario is `<echo>`. Success criteria are `<echo>`. Is that right? Y / fix `<thing>` / start over."

Refuse to advance until the sponsor responds with `Y`. If they say "fix X", update that field and re-cite. If they say "start over", re-ask the phase's questions from question 1.

**Push back on vague answers.** "A tracker" → "Tracker of what, for whom, that shows what?" "Something fast" → "Fast in what dimension — bootup time, user-perceived latency, throughput?" "Help users" → "Help them do what specifically that they can't do today?"

## Phase 3a — Vision (7 questions)

Skip this phase entirely if the sponsor chose **V1-only** depth in Phase 2.

1. **What is the end product?** In one paragraph — not a marketing pitch, just what someone using it experiences. A sentence describing the artifact, plus a sentence describing what it does for them.
2. **Who is the primary user?** Be specific — role, context, what they're currently doing instead. "Developers" is too broad; "developers debugging multi-agent orchestration locally on Windows" is concrete.
3. **What does a daily-use scenario look like?** Walk through one morning of use. What triggers them to open it, what they look at, what they do next.
4. **What does success look like a year from now?** A specific observable outcome — "I use this every day for X", "team size doubled and onboarding takes a third of the time", "shipped 3 products that depended on it".
5. **What makes this different from what's already on the market?** If the answer is "nothing", that's fine — but then the V1 cut needs to be about cost / control / privacy / something concrete, not "differentiation".
6. **What's the 2-year aspiration?** Sometimes the V1 cut is shaped by where the product is going, not where it is. If the long-term vision matters, capture it; if it doesn't, "no opinion" is fine.
7. **What are the fatal-flaw risks?** What would make this product DOA? E.g. "if it doesn't work on Windows, my whole team is out." Refuse vague risks like "performance issues" — push for concrete ones.

## Phase 3b — V1 cut (5 questions, MANDATORY)

This phase always runs. The skill refuses to proceed past Phase 3b without concrete in-scope and out-of-scope lists.

1. **What is the smallest shippable thing that proves the thesis?** Not the full vision — the minimum that, if working, validates the bet. "If THIS works, we know the rest is worth building."
2. **What is explicitly in scope for V1?** A bulleted list, each item observable. "Login flow" is not observable; "user enters email + password, lands on dashboard" is.
3. **What is explicitly OUT OF scope for V1?** A bulleted list — the things that would be tempting to add but should NOT ship in V1. Out-of-scope is what V1 plans live and die by; push for at least 4–5 items, including 1–2 that the sponsor would be sad to lose.
4. **What are the key moments the user experiences in V1?** 3–5 moments, each a sentence. The "open it for the first time" moment, the "do the core action" moment, the "see the result" moment, etc.
5. **What data sources / external dependencies does V1 need?** Be exact — file paths, API names, schemas. If "we'll figure out the API later" is the answer, V1 isn't ready to scaffold and the sponsor needs another planning loop.

## Phase 3c — Constraints (5 questions)

1. **Solo dev or team?** If team, who's on it (or what roles are needed)? This drives the persona roster in Phase 4.
2. **Local-only, cloud, or hybrid?** Does V1 need to work on a single machine, or is it a hosted product, or both?
3. **What languages / frameworks are already chosen?** If anything is fixed (e.g. "must be TypeScript because that's what the team uses"), capture it. Otherwise "open" is fine.
4. **What's the budget / timeline?** "A week of focused work", "by end of quarter", "no deadline, want it right". Drives milestone sizing.
5. **What regulatory / compliance / external constraints apply?** GDPR, HIPAA, internal IP rules, customer contracts. If "none I know of", note that explicitly — don't leave the question blank.

## At the end of Phase 3 — synthesize V1-PLAN.md

Generate `docs/V1-PLAN.md` from the answers:

- **Vision section** (only if Phase 3a was run).
- **V1 scope** with explicit in-scope and out-of-scope bullets verbatim from Phase 3b answers.
- **Architecture sketch** if the sponsor's answers in Phase 3b/3c were concrete enough (data sources + languages). Otherwise leave as a TODO for the Project Lead's first dispatch.
- **Milestones** (M1–M4 default) sized to the budget/timeline from Phase 3c. M1 is "data spike / smallest end-to-end". M4 is "polish / final V1 ship".
- **Open questions** — any phase 3 answers that were "TBD" or punted to the Project Lead. These become the first ticket-board questions.
- **Non-goals** — verbatim from Phase 3b question 3.

Present the draft V1-PLAN.md to the sponsor. Ask: "approve this V1 plan? Y / edit `<section>` / start over." Refuse to advance until `Y`.

## Anti-patterns to refuse

- **"We'll figure it out as we go"** for V1 in-scope. That's exactly what V1 plans exist to prevent.
- **"Don't worry about out-of-scope"** — out-of-scope is what protects V1 from feature creep. Push for it.
- **"Same as what we're building elsewhere"** — that requires a concrete cite. What project, what scope, what carried over.
- **Repeating the question back** — "What does success look like?" answered with "Success looks like users using it." Push for the observable outcome.

## When the sponsor pushes back

If the sponsor says "I don't want to answer all these questions" or "let's just start building", explain plainly:

> The interview is the load-bearing part of this skill. Skipping it produces a scaffold that doesn't fit the project, and then the team spends the first week re-deriving what we should have nailed down here. We can shortcut to V1-only depth (Phase 2 option) but we can't skip Phase 3b — that's the minimum.

If they still refuse, the skill cannot proceed. Cancel cleanly and suggest they invoke the skill again when they're ready to do the interview.
