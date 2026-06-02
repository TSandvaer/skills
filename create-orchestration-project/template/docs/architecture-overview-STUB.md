# Architecture Overview

> **STUB.** This file is the project-specific architecture doc. The bootstrap skill generates an outline; the Project Lead fills it during M1 once the data model and component boundaries are concrete.

## What this doc should cover (fill in during M1)

### What the system does

One paragraph: what it does, for whom, with what constraints.

### Core data flow

Diagram + 1–2 paragraphs describing the data path from input to output. Use ASCII boxes-and-arrows if visual diagrams aren't easy to generate inline.

### Components / surfaces

For each distinct surface (e.g. backend / frontend, extension-host / webview, CLI / library):

- What it owns.
- What it doesn't own.
- The boundary between it and other surfaces (message protocol, API, file format).

### Data model

The shape of the core entities, the relationships, and the invariants. If a schema doc lives elsewhere (`docs/schema.md`, a `.proto` file, a SQL DDL), reference it here rather than duplicating.

### Failure modes

The 3–5 most likely classes of failure and how the system handles them. If retry / fallback / degraded-mode behavior matters, capture the policy here.

### State and persistence

Where state lives, how it's persisted, what the recovery story is on restart.

### External dependencies

Concrete list: every service / library / API / file format the system depends on. If a dependency has a known limitation, note it here.

## Why this doc is a STUB at scaffold time

The bootstrap skill captures vision + V1 scope + constraints during the interview, but doesn't have enough information to write the architecture without the Project Lead and the devs making concrete tech-stack decisions in M1. Leaving this file as a STUB and asking the Project Lead to fill it during M1 produces a better doc than the bootstrap skill could generate from the interview alone.

When M1 lands, replace this stub content with the real architecture doc. Update the CLAUDE.md "Detailed Documentation" entry to reflect the doc's new shape.
