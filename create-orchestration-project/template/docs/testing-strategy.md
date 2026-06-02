# Testing Strategy

Three layers. Each layer catches a different bug class. None of them is optional.

## Layer 1 — Unit ({{UNIT_TEST_FRAMEWORK}})

Tests pure functions: parsers, matchers, reducers, helpers. No external system dependencies (no DOM, no filesystem, no network).

**Coverage targets:**

- {{LAYER_1_COVERAGE_TARGETS}}

**Where:** `tests/unit/`. Fast — should run in <2s for the whole suite. Pre-commit hook runs them.

## Layer 2 — Integration / fixture filesystem

Spin up a tempdir with captured input fixtures. Point the system under test at it. Assert it produces the expected events / outputs.

**Coverage targets:**

- {{LAYER_2_COVERAGE_TARGETS}}

**Where:** `tests/integration/`. Slower (≤30s for the whole suite). Run on CI and pre-push.

## Layer 3 — {{LAYER_3_NAME}}

{{LAYER_3_DESCRIPTION}}

**Coverage targets:**

- {{LAYER_3_COVERAGE_TARGETS}}

**Where:** `tests/{{LAYER_3_DIR}}/`. CI-only by default; locally on demand.

## Manual {{MANUAL_TEST_KIND}} checklist

For every UI PR, the author runs a manual check before requesting QA. The checklist:

{{MANUAL_CHECKLIST_STEPS}}

## Self-Test Report contract

Every PR that affects {{UX_SURFACE_NAME}} requires a Self-Test Report comment on the PR before requesting QA:

```markdown
## Self-Test Report

### AC walkthrough
- **AC1:** <description> — ✅ verified. Screenshot: <link>
- **AC2:** <description> — ✅ verified. Screenshot: <link>

### Side-effect inventory
- <surface this change can affect>

### {{SELF_TEST_PROBE_1}}

### State-coverage
- <state 1>: <screenshot>
- <state 2>: <screenshot>
- Empty: <screenshot>

### Failure-mode probes (for parser/host PRs)
- {{FAILURE_MODE_PROBE_LIST}}
```

If the Self-Test Report is missing, QA REQUESTs CHANGES with "Self-Test Report required" as the reason. No exceptions.

## QA contract

When the orchestrator dispatches the QA role to review a PR (vs author-supplied tests):

**REQUEST CHANGES when:**

- Self-Test Report missing.
- AC walkthrough not present or visually unconfirmed.
- Regression test not named for this bug class.
- {{PROJECT_SPECIFIC_REQUEST_CHANGES_TRIGGER}}.
- Manual {{MANUAL_TEST_KIND}} screenshot missing (for UI PRs).
- Test coverage doesn't include at least one negative-path assertion.

**APPROVE when:**

- All AC met with cite-able evidence.
- Tests cover the bug class (not just the instance).
- Self-Test Report complete.
- Manual {{MANUAL_TEST_KIND}} confirms behavior.

**Drain-mode preference:** err toward approving non-critical nits. Reserve REQUEST CHANGES for failed AC, regression risk, or contract violations.

## CI

{{CI_PROVIDER}} runs Layer 1 + Layer 2 on every push. Layer 3 runs on PRs targeting `main`. The merge gate is:

1. Layer 1 + 2 green.
2. Layer 3 green (PRs only).
3. QA APPROVE comment.
4. Peer-reviewer APPROVE comment.

The orchestrator admin-merges with `gh pr merge --admin --squash --delete-branch`.

## Test fixtures

`tests/fixtures/` contains captured real-world data:

{{FIXTURE_LIST}}

Fixtures are **anonymized real captures**, not synthesized. When the schema changes, capture fresh fixtures from the new version rather than editing existing ones.

## What we don't test

{{NOT_TESTED_LIST}}
