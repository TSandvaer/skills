# {{PROJECT_NAME}} — Agent Team

{{ROSTER_COUNT}} named agents handle the {{PROJECT_NAME}} build. The Sponsor ({{SPONSOR_NAME}}) talks to the **orchestrator** (the Claude Code session). The orchestrator fans out directly to {{PERSONA_LIST}} via the `Agent` tool. **Nested-Agent spawning is unsupported** in the current Claude Code build — top-level fan-out is the permanent model (see *Topology* below).

## Roster

| Agent | Role | Workspace folder | Owns |
|---|---|---|---|
{{ROSTER_TABLE_ROWS}}

## Communication topology

```
              {{SPONSOR_NAME}} (Sponsor)
                    │
                    ▼
              Orchestrator  ◄── single fan-out / fan-in point
{{TOPOLOGY_DIAGRAM}}
```

- **Sponsor talks to the orchestrator**, not to any single agent. Per user-global `sponsor-decision-delegation` pattern: Sponsor only signs off big deliveries (milestone boundaries); orchestrator makes recommended cross-role calls.
{{PEER_REVIEW_BULLETS}}
- **Project Lead does NOT spawn peers** — they author tickets, retros, dispatch contracts. The orchestrator dispatches based on their recommendations.

**Why this topology and not Project-Lead-as-fan-out:** Anthropic's Claude Code runtime filters the `Agent` tool out of the toolset exposed to sub-agents, so a spawned Project Lead cannot itself spawn devs/QA/etc. The `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` flag is **confirmed inert in this Claude Code build**. Top-level fan-out is the permanent model. Re-probe if Anthropic ships native nested-Agent.

## Task lifecycle

1. **Sponsor → Orchestrator:** feature request / direction / decision.
2. **Orchestrator → Project Lead:** "decompose this" / "add to backlog." Project Lead drafts ClickUp task(s) with acceptance criteria, suggests assignee + priority. Returns plan.
3. **Orchestrator → UX Designer** (if UX/visual needed): writes a spec. Returns spec.
4. **Orchestrator → Research Consultant** (if research/internals question): produces a research note. Returns findings.
5. **Orchestrator → Senior Dev:** branches `{role}/<id>-<slug>`, implements, opens PR. Returns PR # + tight final report.
6. **Orchestrator → Peer reviewer:** reviews via `gh pr review` (or `gh pr comment` with "APPROVE" if shared-identity blocks formal approve).
7. **Orchestrator → QA:** QA per testing bar. Returns APPROVE / REQUEST CHANGES.
8. **Merge** (only after QA approval; orchestrator triggers via `gh pr merge --admin --squash --delete-branch`).
9. **Tracker status flip** (paired with merge in same tool round — see Operational IDs below for the {{TRACKER_NAME}} terminal-state move).

## Shared references

Every agent reads these on first substantive task of a session:

- [CLAUDE.md](../../CLAUDE.md) — project brief and hard rules
- [.claude/docs/architecture-overview.md](../docs/architecture-overview.md) — V1 architecture
- [.claude/docs/testing-strategy.md](../docs/testing-strategy.md) — testing layers
- [.claude/docs/orchestration-overview.md](../docs/orchestration-overview.md) — dispatch + PR/merge protocol
- [docs/V1-PLAN.md](../../docs/V1-PLAN.md) — V1 product plan
- [.claude/agents/dispatch-template.md](dispatch-template.md) — reusable dispatch blocks

## Operational IDs

{{TRACKER_OP_IDS}}
- **GitHub repo:** `{{REPO_OWNER}}/{{REPO_NAME}}`
{{PROJECT_SPECIFIC_OP_IDS}}

## Worktree map

- Project root (orchestrator survey, READ-ONLY for code): `{{PROJECT_ROOT_PATH}}`
- Per-role: `{{WORKTREE_BASE_PATH}}-{{role}}-wt` for each persona.
- All role worktrees start on their `<role>/idle` branch and switch to `<role>/<id>-<slug>` per dispatch.

## Models

{{MODEL_TABLE}}

Downgrade other lanes to `sonnet` only if a specific lane proves consistently throughput-bound without quality regression.

## Forward-compat note

`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is set in `.claude/settings.json` for forward-compat — currently inert. If Anthropic ships native nested-Agent or `subagent_type` matching for named personas, the persona files in this directory become harness-loadable automatically.
