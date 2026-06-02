# pbi

Takes an Azure DevOps **PBI** (by link or ID), creates an Obsidian task note for it, then spawns a **subagent team** to research and implement the work:

- **Knowledge gatherer** — researches the task, the surrounding code, and prior art.
- **Developer** — implements the change.
- **Note taker** — records findings and progress into the Obsidian note.

## When to use it

- "pbi"
- Pasting a DevOps work item link.
- Any request to start working on a PBI end-to-end.

## How it works

1. Fetch the PBI from Azure DevOps by link or ID.
2. Create an Obsidian task note capturing the work item.
3. Dispatch the knowledge-gatherer / developer / note-taker subagent team to research and implement.

## Related skills

For the EDC-style guided lifecycle (branch → analyze → PR → review → announce), see [`start-flow`](../start-flow) and its component skills [`start-branch`](../start-branch), [`start-pbi`](../start-pbi), and [`start-pr`](../start-pr).
