# investigate

A slash-command skill that investigates a question, bug, or issue by spawning **three parallel Sonnet agents** — each attacking the problem from a different angle — and then merging their findings into a single, consolidated answer.

It exists to beat the failure mode of a single inline investigation: one agent, one line of reasoning, one blind spot. Three agents working different angles surface conflicts, edge cases, and surrounding context that a single pass tends to miss.

## When to use it

Reach for `/investigate` when:

- A bug or behaviour is **non-obvious** and a quick look hasn't cracked it.
- The question is **architectural** ("how does X actually flow through the system?").
- You've **already looked once and you're stuck**, or you've had to clarify the question.

**When NOT to use it:** trivial fact lookups ("where is `X` defined?", "what does this one line do?"). For those, a direct Read/Grep is faster and the three-agent fan-out is overkill.

## How to invoke

- **With a topic:** `/investigate why does the agency picker render twice on case pages`
- **Without a topic:** `/investigate` — the skill infers the subject from the most recent unresolved question in the conversation. If there's no clear subject, it asks one short clarifying question and stops rather than guessing.
- **Natural-language triggers** (no slash needed): "investigate this", "look into this", "dig into…", "research this", "what's causing X". The skill is preferred over an ad-hoc investigation whenever the question is non-trivial.

## How it works

1. **Frame.** The skill states, in a sentence or two, what it understands the question to be and what a good answer looks like. This framing is shared verbatim with all three agents so they start from the same context. If the topic was inferred (no explicit argument), the inference is surfaced so you can correct it fast.

2. **Spawn 3 Sonnet agents in parallel** (one message, three `Agent` calls, all on Sonnet 4.6):
   - **Agent A — Root-cause / code-path.** Traces the actual mechanism: reads the call chain, follows the data flow, pinpoints the specific function / line / condition that produces the behaviour. "What literally happens, step by step?"
   - **Agent B — Alternative hypotheses / edge cases.** The loyal skeptic. What *else* could explain this? Which framing assumptions might be wrong? What edge cases (null, race, cache, SSR-vs-client, prod-vs-local, division-specific) haven't been considered?
   - **Agent C — Broader context / related systems.** Widens the lens: `git log` / `git blame` on the relevant files, recent PRs, related past bugs, adjacent modules, and any `.claude/docs/` covering the surface. "What context outside the immediate code path is load-bearing?"

   Each agent returns a structured report — **Findings**, **Evidence** (concrete file:line / SHA / doc pointers), **Confidence** (with a one-line reason), and **What I did NOT check** (so gaps are visible).

3. **Consolidate inline.** The calling agent (not a 4th subagent) synthesises the three reports: reconciles conflicts, weights claims by evidence rather than confidence labels, strips duplication, and leads with the strongest reasoning.

## What you get back

A tight, consolidated answer — not three stitched-together reports:

- **Answer** — the conclusion in 1–3 sentences (or a plain statement that it didn't land on one).
- **Why we think so** — the strongest evidence, with clickable `[file.ts:42](path/file.ts#L42)` links.
- **What we're less sure about** — open questions, inter-agent conflicts, coverage gaps.
- **Recommended next step** — one concrete action, if there is a clear one.

## Design notes

- **Always Sonnet** for the three investigators — a deliberate cost/quality choice for three parallel runs. Not Haiku, not Opus.
- **Parallelism is mandatory** — three agents in a single message. Sending them sequentially defeats the skill.
- **No pre-investigation** before spawning — doing a "quick grep first" biases all three agents toward one framing and collapses the angles. Frame, spawn, then consolidate.
- **The consolidator is the calling agent**, not a 4th subagent — the three reports are already in context, so a 4th agent only adds latency and paraphrase.
- **No fabrication** — the no-guessed-paths / no-extrapolated-identifiers rule is passed through to every investigator: fetch the value or say you don't have it.
