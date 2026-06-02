# skill-creator

The meta-skill for working on skills. Use it to **create** new skills from scratch, **modify and improve** existing ones, and **measure** skill performance.

## When to use it

- Creating a skill from scratch.
- Editing or optimizing an existing skill.
- Running evals to test a skill.
- Benchmarking skill performance with variance analysis.
- Optimizing a skill's `description` for better triggering accuracy.

## What it covers

- **Authoring** — scaffolds a new skill's folder, `SKILL.md` frontmatter (name + description), and supporting files.
- **Improving** — refines an existing skill's instructions, structure, or description.
- **Description tuning** — the `description` is what the model matches against to decide when to fire a skill; this skill helps sharpen it so the skill triggers when it should and stays quiet when it shouldn't.
- **Evals & benchmarking** — runs tests against a skill and reports performance, including variance analysis across runs.
