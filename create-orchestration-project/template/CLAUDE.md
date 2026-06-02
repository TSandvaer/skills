# {{PROJECT_NAME}} — Project Brief

{{PROJECT_ONE_LINER}}. See [docs/V1-PLAN.md](docs/V1-PLAN.md) for the full V1 plan.

## Orchestrator model

The Claude Code main session is the **orchestrator**. {{ROSTER_COUNT}} named-role sub-agents ({{PERSONA_LIST}}) handle dispatched work, each in their own per-role git worktree. **The orchestrator never codes** — it briefs, dispatches, gates, and merges. Sponsor ({{SPONSOR_NAME}}) speaks only to the orchestrator.

## Hard rules (non-negotiable)

1. **`main` is protected (team discipline)** — orchestration-doc updates can land directly while we bootstrap; once {{SCAFFOLD_GATE_THING}} lands, all PRs go through `gh pr merge --admin --squash --delete-branch`. Branch protection is NOT yet enforced server-side.
2. **Testing bar** — paired tests + green CI + QA sign-off before "complete." Sponsor will not debug.
3. **{{PROJECT_SPECIFIC_GATE_1}}** — {{PROJECT_SPECIFIC_GATE_1_DESCRIPTION}}.
4. **{{PROJECT_SPECIFIC_GATE_2}}** — {{PROJECT_SPECIFIC_GATE_2_DESCRIPTION}}.
5. **Tracker status as hard gate** — every dispatch / PR-open / merge pairs with a tracker status flip in the same tool round. ({{TRACKER_NAME}} specifics in the tracker section below.)
6. **Orchestrator never codes** — dispatches from symptoms, never greps/traces/edits source.
7. **Always parallel dispatch** — every tick aims for 3–5 agents in flight; tickets aren't progress, dispatches are.
8. **Tightened final-report contract** — sub-agent reports ≤200 words; PR URL + verdict + blockers + doc-updates line. State claims (CI, tests, {{PROJECT_SMOKE_NAME}}) must cite verifiable evidence (run-id URL / SHA / file:line / screenshot).

## Autonomy

Defers to user-global CLAUDE.md "Orchestrator autonomy" rule. Every autonomous orchestrator decision is logged to [.claude/decisions-while-away.md](.claude/decisions-while-away.md) with `Foundation:`, `Alternative:`, `Reversibility:`, `Status:` fields. Calibration target: 5–10% reversal rate.

The reviewer-track gate is hard: every code PR requires a peer `APPROVE` comment from the designated reviewer before the orchestrator admin-merges. No self-merge. Cross-review pairing: {{CROSS_REVIEW_RULE}}.

## Tracker — {{TRACKER_NAME}}

{{TRACKER_BLOCK}}

## Detailed Documentation

All files below are auto-loaded into context at session start via the [`session-start-read-docs.sh`](.claude/hooks/session-start-read-docs.sh) hook. Sub-agents do NOT inherit that load — they read these files themselves on their first task of a session.

- [architecture-overview.md](.claude/docs/architecture-overview.md) — V1 architecture and core data flow.
- [testing-strategy.md](.claude/docs/testing-strategy.md) — unit / integration / manual layers.
- [orchestration-overview.md](.claude/docs/orchestration-overview.md) — dispatch, worktrees, PR/merge protocol.

The [`maintain-docs`](.claude/skills/maintain-docs/SKILL.md) skill (auto-triggered after every turn via Stop hook) reviews each turn for non-obvious findings worth capturing here and updates this index when new doc files are created.

## Sub-agent docs preload (load-bearing)

If you are a sub-agent spawned via the `Agent` tool, you do NOT inherit the SessionStart auto-load. Before starting any work, read every `.claude/docs/*.md` file (in parallel via multiple Read calls in one message).
