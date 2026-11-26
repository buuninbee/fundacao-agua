---
name: orchestrator
description: >-
  Coordinates multi-agent work across frontend, backend, testing, and devops
  specialists. Use when a task spans multiple domains, requires parallel
  execution, needs a sequential build-review-test pipeline, or when the user
  asks to orchestrate agents in Antigravity (via subagents, swarm, or manual
  Agent Manager playbooks).
---

# Multi-Agent Orchestrator

Decompose cross-domain work into non-overlapping slices, pick the right execution pattern, assign domain specialists, and verify integration.

## Step 1: Load Context & Ownership

1. Read `GEMINI.md` and, if present, `.agents/project/context.md`.
2. Map the requested change to the active domains (`frontend`, `backend`, `testing`, `devops`).
3. If the task fits cleanly inside a single domain with no parallel benefit, handle it directly instead of spawning multiple agents.

## Step 2: Choose the Orchestration Pattern

- **Pipeline (Sequential)**: `Build -> Review -> Test` (or `Backend contract -> Frontend -> Testing`). Use when each stage depends on the previous output or quality risk is high.
- **Parallel (Concurrent)**: Multiple specialists run simultaneously on disjoint directories (e.g., `frontend-dashboard` + `backend-stats` + `devops-ci`). Require an explicit interface contract upfront so both sides agree on types/endpoints.
- **Specialist + Generalist**: Orchestrator owns the plan, shared contracts, and final integration while domain specialists execute well-scoped sub-tasks and report back.

## Step 3: Execute (Hybrid Mode)

### Mode A — Automated (Antigravity Subagents / Swarm)
1. Assign descriptive names: `<domain>-<slice>` (e.g., `frontend-map`, `testing-auth`).
2. Give every worker an isolated brief stating:
   - Which skill to follow (`.agents/skills/<domain>/SKILL.md`)
   - Exact **owned paths** (no overlap across concurrent writers; use `workspace: "share"` when concurrent edits touch shared tooling)
   - Concrete **definition of done** and verification command
   - Model tier per `GEMINI.md` (only override when requested or clearly justified)
3. After specialists finish, inspect diffs for cross-domain contract mismatches, run end-to-end checks, and clean up finished workers.

### Mode B — Manual (Agent Manager Playbook)
When the user wants to run separate tabs in Agent Manager:
1. Create a shared contract in `.agents/handoffs/<task-slug>.md` from `.agents/handoffs/TEMPLATE.md` if domains share an interface.
2. Output ready-to-paste prompts per agent tab containing:
   - Suggested tab name (`<domain>-<slice>`) and model tier
   - Exact skill & project spec files to read
   - Owned paths and acceptance criteria
   - Execution order (which tabs can start in parallel vs. which must wait for a handoff)

## Step 4: Integration Gate

Before declaring the orchestrated task done:
- Confirm no unintended edits outside each domain's owned paths.
- Verify shared contracts (API shapes, env vars, build scripts, test assertions) match.
- Run the project's build/lint/test commands and remove temporary handoff files when finished.

## Companion Skills (Load On Demand)

When relevant and installed in the environment, load:
- `swarm_pane` — before briefing and adding the first workers to a swarm.
- `run-workflow` — when orchestrating a large fan-out (many files/modules/review angles) or staged pipeline as Python code.
- `ponytail-debt` — to collect deferred `ponytail:` shortcuts across domains before closing a milestone.
