---
name: investigate
description: Spawn 3 parallel Sonnet investigation agents to dig into a question, bug, or issue from three distinct angles (root-cause/code-path, alternative-hypotheses/edge-cases, and broader-context/related-systems), then consolidate their findings into one synthesised answer. Use this whenever the user says "investigate", "/investigate", "look into this", "dig into", "research this", "what's causing X", or otherwise wants thorough multi-angle exploration of a problem — even if they don't say the word "investigate" explicitly. Prefer this skill over a single inline investigation any time the question is non-trivial or the user has already had to clarify once.
---

Investigate a question, bug, or issue using three parallel Sonnet agents that each approach it from a distinct angle, then merge their findings into one consolidated answer.

The user may invoke this skill with:
- An explicit topic (e.g. `/investigate why does the agency picker render twice on case pages`)
- No topic — in that case, infer the subject from the most recent unresolved question or issue in the current conversation. If the conversation has no clear subject, ask the user one short clarifying question and stop; do not guess.

## Steps

1. **Frame the investigation.** In one or two sentences, state what you understand the question to be and what a satisfying answer would look like. This frame becomes the shared context each investigator receives. If you had to infer the topic from conversation history (no explicit argument), surface your inference so the user can correct you fast.

2. **Spawn 3 Sonnet agents in parallel.** Send a single message containing three `Agent` tool calls — they MUST go out together so they run concurrently. Set `model: "sonnet"` on each so they run on Claude Sonnet 4.6 specifically, not whatever the parent session is using. Give each agent:
   - The framing from step 1 (verbatim, so they share context).
   - Their assigned angle (one of the three below).
   - The instruction to return a structured, concise report: **Findings**, **Evidence** (file paths + line numbers, commit SHAs, doc links — concrete pointers, not paraphrases), **Confidence** (low/medium/high with a one-line reason), and **What I did NOT check** (so the consolidator knows the gaps).
   - A reminder not to fabricate paths or identifiers — if they don't have a value, they should fetch it or say they don't have it.

   ### The three angles

   - **Agent A — Root-cause / code-path.** Trace the actual mechanism. Read the code in the call chain, follow data flow, identify the specific function/line/condition that produces the observed behaviour. This is the most direct lens — "what literally happens, step by step?"
   - **Agent B — Alternative hypotheses / edge cases.** Deliberately consider what *else* could explain the observed behaviour. What assumptions in the framing might be wrong? What edge cases (null, race, cache, env-specific, division-specific, SSR vs client, prod vs local) haven't been considered? What would make the obvious answer wrong? This agent's job is to be the loyal skeptic.
   - **Agent C — Broader context / related systems.** Widen the lens. Read `git log` and `git blame` on the relevant files, look at recent PRs in the area, check for related issues, similar past bugs, adjacent modules that interact with the same data, and any `.claude/docs/` files covering this surface. The question this angle answers: "what context outside the immediate code path is load-bearing here?"

3. **Consolidate inline (do not spawn a 4th agent).** Once all three reports return, synthesise them yourself. Do NOT just concatenate the three reports — that defeats the point. Specifically:
   - **Reconcile conflicts.** If two agents disagree (e.g. A says "this is the cause", B says "no, the cache layer would mask that"), call it out and pick a side with reasoning, or flag that the question is genuinely open and propose how to disambiguate (a specific log line to grep, a specific commit to check, a specific test to run).
   - **Weight by evidence, not by confidence labels.** A "high confidence" claim with no file:line is weaker than a "medium confidence" claim with three concrete code references.
   - **Strip duplication.** If all three agents found the same thing, mention it once.
   - **Surface the strongest reasoning first.** The answer is the lead; the supporting threads come after.

4. **Return one consolidated answer to the user**, structured roughly as:
   - **Answer** — the synthesised conclusion in 1–3 sentences. If the investigation didn't land on a single conclusion, say so plainly.
   - **Why we think so** — the strongest evidence, with file path + line links in `[file.ts:42](path/file.ts#L42)` form per the VSCode extension convention.
   - **What we're less sure about** — open questions, conflicts between agents, gaps in coverage.
   - **Recommended next step** — one concrete action (a specific edit, a specific check, a specific question to the user) if there is one. Skip this section if there isn't a clear next step rather than padding it.

   Keep the whole consolidated answer tight. The user is reading it to decide what to do — not to read three full reports.

## Notes

- **Always Sonnet for the investigators.** This skill explicitly chooses Sonnet 4.6 for the three angles. Don't substitute Haiku ("faster") or Opus ("smarter") — the user picked Sonnet for the cost/quality balance across three parallel runs.
- **Parallelism is non-negotiable.** Three agents, one message, three Agent tool calls in the same `<function_calls>` block. If you send them sequentially you've defeated the skill.
- **Don't pre-investigate before spawning.** It's tempting to do a quick grep yourself "to give the agents a head start." Resist — that biases all three agents toward your initial framing and collapses the angles. Frame, spawn, then consolidate.
- **The consolidator is the calling agent (you), not a 4th subagent.** Spawning a 4th agent to consolidate adds latency and an extra layer of paraphrase without adding signal. You already have the three reports in context — synthesise them directly.
- **If the topic is genuinely trivial** (a one-line fact lookup, a quick "where is X defined"), this skill is overkill. Use a direct Read/Grep instead. The skill earns its keep on non-obvious bugs, architectural questions, and "I've already looked and I'm stuck" situations.
- **Honour the user's no-fabrication rule.** Pass that constraint through to the three investigators — no guessed file paths, no extrapolated identifiers, no "probably named X" claims. Fetch or say you don't have it.
