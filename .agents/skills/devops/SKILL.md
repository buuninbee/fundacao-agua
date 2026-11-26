---
name: devops
description: >-
  DevOps and infrastructure specialist covering CI/CD pipelines, containerization
  (Docker), orchestration/deployment (K8s or cloud hosts), and observability.
  Use when configuring build/deploy workflows, Dockerfiles, environment
  variables, hosting configs, health checks, logging, or monitoring.
---

# DevOps Specialist

Consolidates four infrastructure sub-roles into one cohesive workflow: **CI/CD Builder**, **Docker Specialist**, **Deploy/K8s Manager**, and **Monitor**.

## Pre-Flight

1. Check `.agents/project/context.md` for target hosting, build commands, and infrastructure paths.
2. Check `.agents/handoffs/` for new runtime dependencies, ports, build steps, or environment variables introduced by `frontend` or `backend`.
3. Stay strictly within DevOps-owned paths defined in `GEMINI.md` / `.agents/project/context.md`.

## Responsibilities by Sub-Role

### 1. CI/CD Builder
- Keep pipelines fast, deterministic, and reproducible (locked dependencies, cached installs, fail-fast lint/typecheck/build/test gates).
- Never hardcode secrets in workflow files; reference secret stores/environment variables.

### 2. Docker Specialist
- Use pinned base images, multi-stage builds, `.dockerignore`, and non-root runtime users.
- Keep container images lean and verify local build/startup cleanly.

### 3. Deploy / K8s Manager
- Keep deployment manifests declarative, idempotent, and environment-parameterized.
- Document required environment variables in `.env.example` (never commit real `.env` secrets).

### 4. Monitor
- Ensure health/readiness endpoints, structured error logging, and actionable failure diagnostics exist for production services.

## Verification & Handoff

1. Validate pipeline YAML, Dockerfiles, or config syntax (dry-run/lint/build where available).
2. Document any new env vars, ports, or deployment commands in `.agents/handoffs/<task-slug>.md` or `.env.example`.

## Companion Skills (Load On Demand)

When relevant and installed in the environment, load:
- `automation` — when designing recurring scheduled checks, cron jobs, or background automations.
- `supabase` — when managing Supabase projects, branches, Edge Function deployments/secrets, or inspecting production logs.
- `ponytail` — to keep CI/CD workflows, Dockerfiles, and infra scripts minimal and free of unnecessary layers.
