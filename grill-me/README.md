# Grill Me

> Claude interviews you relentlessly about a plan or design — one question at a time — until you reach a shared, fully-resolved understanding.

## What it does
This skill flips the usual dynamic: instead of you asking Claude, Claude asks you. It walks down each branch of your plan's decision tree, surfacing dependencies between decisions and resolving them one by one. For every question it asks, it also offers its own recommended answer, so the interview doubles as a design review. The result is a plan whose assumptions, edge cases, and trade-offs have all been pressure-tested before you commit to building anything.

## When to use it
- You have a plan or design and want it stress-tested before implementation.
- You want to be "grilled" on a decision to expose gaps you haven't thought through.
- You're unsure which trade-offs matter and want them drawn out systematically.
- Any time you'd say "grill me", "interview me about this", or "poke holes in my plan".

## How to use it
1. Describe the plan, design, or decision you want examined.
2. Trigger the skill (e.g. say "grill me" or invoke `/grill-me`).
3. Answer each question as it comes — they're asked **one at a time**, not in a batch.
4. Consider Claude's recommended answer for each question alongside your own.
5. Continue until the decision tree is fully resolved and you share a clear understanding.

Note: when a question can be answered by reading the codebase, Claude explores the code itself instead of asking you.

## Inputs
- **The plan or design to examine** — provided in conversation. No formal arguments; just describe what you want grilled on.

## Output
A back-and-forth interview in the conversation. No files are written and no other side effects occur — the value is the shared understanding and the surfaced decisions you reach by the end.

## Prerequisites
None. Works in any Claude Code session.

## Installation
Unzip into your `.claude/skills/` folder (user-level `~/.claude/skills/` to have it
everywhere, or `<project>/.claude/skills/` for a single project), then restart Claude
Code or start a new session so the skill is picked up. After that, trigger it by saying
"grill me" or running `/grill-me`.

## Files in this package
- `SKILL.md` — the skill definition Claude loads.
- `README.md` — this file.
