# codereview

A Claude Code skill that performs an automated, multi-agent code review of a pull request and posts the result back to the PR as a comment.

## What it does

`codereview` runs a structured review pipeline that combines several agents at different model tiers to keep the review both thorough and cheap, and to suppress false positives before anything is posted:

1. **Eligibility check (Haiku).** Skips the PR if it is closed, a draft, an automated/trivial PR, or already has a review from you.
2. **CLAUDE.md discovery (Haiku).** Collects the file paths of the root `CLAUDE.md` and any `CLAUDE.md` files in directories the PR touched, so the review can check project-specific guidance.
3. **Change summary (Haiku).** Views the PR and produces a summary of the change.
4. **Two parallel deep reviews (Opus 4.7).** Run together in a single message so they execute in parallel:
   - **Agent #1 — Change-focused review:** audits the diff against `CLAUDE.md`, does a shallow scan for obvious/large bugs in the changes only, and checks the changes against in-code comment guidance.
   - **Agent #2 — Historical-context review:** uses `git blame`/history and prior PRs (and their review comments) on the same files to surface issues that only the history reveals.
5. **Confidence scoring (Haiku, one per issue).** Each flagged issue is independently scored 0–100 using a fixed rubric (0 = false positive / pre-existing, 100 = certain real issue hit frequently in practice).
6. **Filter.** Issues scoring below **80** are dropped.
7. **Re-check eligibility (Haiku).** Confirms the PR is still review-eligible before posting.
8. **Post the comment (`gh`).** Posts a brief, emoji-free review that links and cites the relevant code with full-SHA permalinks.

### Design intent

- **Confidence-based filtering** means only high-conviction findings reach the PR — nitpicks, linter/compiler-catchable issues, pre-existing problems, and changes on lines the author didn't touch are treated as false positives.
- **Model tiering** (Haiku for mechanical steps, Opus for the actual review) keeps cost down without weakening the core review.
- **Read-only by default.** The only write operation the skill performs is posting the final review comment. It never uses write/update commands (e.g. `gh pr edit`, `az repos pr update`) — even to "test access" — because that has caused accidental PR-description loss in the past.

## How to use it

Invoke the skill and tell it which PR to review. Trigger phrases include:

- `codereview` (optionally with a PR number/URL)
- "review this PR" / "review PR #123"
- "give me automated feedback on this pull request"

The skill uses `gh` to interact with GitHub, so make sure the `gh` CLI is installed and authenticated for the target repository. The review is posted as a comment on the PR; if no high-confidence issues are found, it posts a short "No issues found" note instead.

## Output format

The posted comment follows a fixed format:

- A `### Code review` heading.
- Either a numbered list of issues — each with a brief description, the `CLAUDE.md` quote or context that flagged it, and a full-SHA permalink (`.../blob/<full-sha>/<path>#L<start>-L<end>`) with at least one line of context before and after — or a "No issues found" line.
- A "Generated with Claude Code" footer and a 👍/👎 feedback prompt.

> Note: full-SHA permalinks are required so the links render correctly in GitHub's Markdown preview. The skill is told never to construct links with shell substitutions like `$(git rev-parse HEAD)`, since the comment is rendered as static Markdown.

## Files

- `SKILL.md` — the skill definition and the precise step-by-step instructions the agent follows.
- `README.md` — this document.
