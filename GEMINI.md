# Multi-Agent Orchestration Rules

This repository uses a domain-specialized multi-agent layout under `.agents/`. Every agent working in this workspace must follow these shared rules to avoid file conflicts and keep handoffs consistent.

## 1. Project-Specific Context (Optional Layer)

If `.agents/project/` exists, read `.agents/project/context.md` (and any referenced specs such as design guidelines or user stories) **before** planning or editing code.
Project-specific folder mappings and stack constraints in `.agents/project/context.md` override the defaults below.

## 2. Domain Boundaries & Default File Ownership

Keep each agent focused on one domain. Do **not** edit files outside your assigned paths unless the orchestrator explicitly transfers ownership.

| Agent Skill | Role Scope | Default Owned Paths |
| :--- | :--- | :--- |
| `orchestrator` | Planning, task decomposition, routing, integration review | `.agents/handoffs/`, root docs |
| `frontend` | UI components, styling, accessibility (a11y), client performance | `Frontend/`, `frontend/`, `web/`, `client/`, `src/components/`, `src/pages/` |
| `backend` | API contracts, database schema/migrations, auth, caching | `Backend/`, `backend/`, `server/`, `api/`, `supabase/` |
| `testing` | Unit, integration, E2E tests, security audits | `tests/`, `e2e/`, `**/*.test.*`, `**/*.spec.*` |
| `devops` | CI/CD pipelines, containers, deployment, observability | `.github/`, `infra/`, `docker/`, `k8s/`, `Dockerfile*`, `docker-compose*` |

## 3. Conflict Prevention

- **One writer per file**: Never run two agents concurrently on the same file. Split parallel work by directory or isolate edits in separate workspaces/branches (`workspace: "share"` or `"branch"` in swarm mode).
- **Descriptive naming**: Name every spawned agent `<domain>-<feature>` (e.g., `frontend-dashboard`, `backend-auth`, `testing-checkout`), never generic names like `Agent 1`.
- **Clean lifecycle**: Archive or terminate finished agents promptly to avoid stale context and quota drain.

## 4. Model Tiering Guideline

Choose the lightest model that matches task complexity (in Agent Manager or when spawning workers):

- **High reasoning (Pro / Opus)**: Orchestration, architecture, complex debugging, security audits, database migrations.
- **Balanced (Pro)**: Feature implementation (frontend/backend), integration & E2E tests, code review.
- **Fast / low cost (Flash)**: Formatting, linting, boilerplate updates, repetitive refactors, doc tweaks.

## 5. Cross-Agent Handoffs

- **Automated mode (subagents / swarm)**: Pass explicit owned paths, acceptance criteria, and contracts in the brief or board message.
- **Manual mode (Agent Manager tabs)**: Because tabs do not share chat history, write a short handoff file in `.agents/handoffs/<task-slug>.md` using `.agents/handoffs/TEMPLATE.md` whenever work crosses domains (e.g., Backend → Frontend API contract, Feature → Testing verification). Delete stale handoff files once merged.
